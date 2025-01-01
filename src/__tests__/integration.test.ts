import request from 'supertest';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import router from '../routes';

describe('API Integration Tests', () => {
    let app: express.Application;
    const testDataDir = path.join(__dirname, 'test-data');
    const uploadDir = path.join(__dirname, '../uploads');

    beforeAll(async () => {
        // Create test directories
        await Promise.all([
            fs.mkdir(testDataDir, { recursive: true }),
            fs.mkdir(uploadDir, { recursive: true })
        ]).catch(error => {
            console.error('Error creating test directories:', error);
        });

        // Setup Express app
        app = express();
        app.use('/api', router);
    });

    beforeEach(async () => {
        // Clean test directories
        for (const dir of [testDataDir, uploadDir]) {
            try {
                const files = await fs.readdir(dir);
                await Promise.all(
                    files.map(file => fs.unlink(path.join(dir, file)))
                );
            } catch (error) {
                console.error(`Error cleaning directory ${dir}:`, error);
            }
        }
    });

    afterAll(async () => {
        // Cleanup test directories
        await Promise.all([
            fs.rm(testDataDir, { recursive: true }),
            fs.rm(uploadDir, { recursive: true })
        ]).catch(error => {
            console.error('Error cleaning up test directories:', error);
        });
    });

    const createTestCSV = async (filename: string, records: number): Promise<Buffer> => {
        const header = 'id,value\n';
        const data = Array.from({ length: records }, (_, i) => 
            `${i + 1},${Math.random()}\n`
        ).join('');
        
        return Buffer.from(header + data);
    };

    describe('Process Endpoint', () => {
        test('handles missing files in process request', async () => {
            const response = await request(app)
                .post('/api/process')
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error', 'No files uploaded');
        });

        test('processes multiple files in single request', async () => {
            const files = await Promise.all([
                createTestCSV('test1.csv', 100),
                createTestCSV('test2.csv', 100),
                createTestCSV('test3.csv', 100)
            ]);

            const response = await request(app)
                .post('/api/process')
                .attach('files', files[0], 'test1.csv')
                .attach('files', files[1], 'test2.csv')
                .attach('files', files[2], 'test3.csv')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('filesProcessed', 3);

            // Verify files were saved
            const savedFiles = await fs.readdir(uploadDir);
            expect(savedFiles.length).toBe(3);
        });

        test('handles invalid files in process request', async () => {
            const invalidFile = Buffer.from('invalid,csv,format\na,b,c,d\n');
            const validFile = await createTestCSV('valid.csv', 100);

            const response = await request(app)
                .post('/api/process')
                .attach('files', invalidFile, 'invalid.csv')
                .attach('files', validFile, 'valid.csv')
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error', 'Error processing files');
        });
    });

    describe('Upload Endpoint', () => {
        test('handles missing file in upload request', async () => {
            const response = await request(app)
                .post('/api/upload')
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error', 'No file uploaded');
        });

        test('uploads and processes single file', async () => {
            const testFile = await createTestCSV('test.csv', 100);

            const response = await request(app)
                .post('/api/upload')
                .attach('file', testFile, 'test.csv')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', 'File processed successfully');

            // Verify file was saved
            const files = await fs.readdir(uploadDir);
            expect(files.length).toBe(1);
        });

        test('handles invalid file upload', async () => {
            const invalidFile = Buffer.from('invalid,csv,format\na,b,c,d\n');

            const response = await request(app)
                .post('/api/upload')
                .attach('file', invalidFile, 'invalid.csv')
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error', 'Error processing file');
        });
    });

    describe('Aggregation and Status', () => {
        test('retrieves empty aggregation results', async () => {
            const response = await request(app)
                .get('/api/aggregations')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        test('retrieves aggregation results after processing', async () => {
            // Upload a file first
            const testFile = await createTestCSV('test.csv', 100);
            await request(app)
                .post('/api/process')
                .attach('files', testFile, 'test.csv')
                .expect(200);

            // Get aggregation results
            const response = await request(app)
                .get('/api/aggregations')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            if (response.body.length > 0) {
                const result = response.body[0];
                expect(result).toHaveProperty('timestamp');
                expect(result).toHaveProperty('count');
                expect(result).toHaveProperty('data');
                expect(result.data).toHaveProperty('id');
                expect(result.data).toHaveProperty('value');
            }
        });

        test('retrieves system status', async () => {
            const response = await request(app)
                .get('/api/status')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'operational');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('aggregationCount');
            expect(typeof response.body.timestamp).toBe('number');
            expect(typeof response.body.aggregationCount).toBe('number');
        });
    });

    describe('Concurrent Operations', () => {
        test('handles concurrent file uploads and aggregation requests', async () => {
            const files = await Promise.all([
                createTestCSV('concurrent1.csv', 100),
                createTestCSV('concurrent2.csv', 100)
            ]);

            // Concurrent uploads and aggregation requests
            const results = await Promise.all([
                request(app)
                    .post('/api/process')
                    .attach('files', files[0], 'concurrent1.csv')
                    .attach('files', files[1], 'concurrent2.csv'),
                request(app)
                    .get('/api/aggregations'),
                request(app)
                    .get('/api/status')
            ]);

            // Verify responses
            expect(results[0].status).toBe(200);
            expect(results[1].status).toBe(200);
            expect(results[2].status).toBe(200);

            // Verify files were saved
            const savedFiles = await fs.readdir(uploadDir);
            expect(savedFiles.length).toBe(2);
        });
    });
});
