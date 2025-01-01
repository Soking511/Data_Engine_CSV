import { DataEngine } from '../DataEngine';
import { ProcessingOptions } from '../types';
import fs from 'fs/promises';
import path from 'path';

describe('DataEngine', () => {
    const options: ProcessingOptions = {
        batchSize: 100,
        windowSize: 1000,
        slidingInterval: 500
    };

    const testDataDir = path.join(__dirname, 'test-data');

    beforeAll(async () => {
        // Create test directory if it doesn't exist
        try {
            await fs.access(testDataDir);
        } catch {
            await fs.mkdir(testDataDir, { recursive: true });
        }
    });

    beforeEach(async () => {
        // Clean up test files before each test
        try {
            const files = await fs.readdir(testDataDir);
            await Promise.all(
                files.map(file => fs.unlink(path.join(testDataDir, file)))
            );
        } catch (error) {
            console.error('Error cleaning test files:', error);
        }
    });

    afterAll(async () => {
        // Clean up test directory
        try {
            await fs.rm(testDataDir, { recursive: true });
        } catch (error) {
            console.error('Error cleaning test directory:', error);
        }
    });

    const createTestCSV = async (filename: string, content: string): Promise<string> => {
        const filepath = path.join(testDataDir, filename);
        await fs.writeFile(filepath, content);
        return filepath;
    };

    test('processes valid CSV file successfully', async () => {
        const engine = new DataEngine(options);
        const validCSV = 'id,value\n1,10\n2,20\n3,30\n';
        const filepath = await createTestCSV('valid.csv', validCSV);

        await expect(engine.processFile(filepath)).resolves.not.toThrow();
        const results = engine.getResults();
        expect(results.length).toBeGreaterThan(0);
    });

    test('handles missing file gracefully', async () => {
        const engine = new DataEngine(options);
        const nonExistentPath = path.join(testDataDir, 'nonexistent.csv');

        await expect(engine.processFile(nonExistentPath)).rejects.toThrow();
    });

    test('handles invalid CSV format', async () => {
        const engine = new DataEngine(options);
        const invalidCSV = 'invalid\nformat\nfile\n';
        const filepath = await createTestCSV('invalid.csv', invalidCSV);

        await expect(engine.processFile(filepath)).rejects.toThrow();
    });

    test('handles empty CSV file', async () => {
        const engine = new DataEngine(options);
        const emptyCSV = '';
        const filepath = await createTestCSV('empty.csv', emptyCSV);

        await expect(engine.processFile(filepath)).rejects.toThrow();
    });

    test('processes multiple files concurrently', async () => {
        const engine = new DataEngine(options);
        const validCSV = 'id,value\n1,10\n2,20\n3,30\n';
        
        // Create multiple test files
        const files = await Promise.all([
            createTestCSV('test1.csv', validCSV),
            createTestCSV('test2.csv', validCSV),
            createTestCSV('test3.csv', validCSV)
        ]);

        // Process files concurrently
        await Promise.all(files.map(file => engine.processFile(file)));

        // Verify results
        const results = engine.getResults();
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('count');
            expect(result).toHaveProperty('data');
        });
    });

    test('handles partial failures without affecting other streams', async () => {
        const engine = new DataEngine(options);
        
        // Create valid and invalid test files
        const validCSV = 'id,value\n1,10\n2,20\n3,30\n';
        const invalidCSV = 'invalid,csv\na,b,c\n';
        const validFile = await createTestCSV('valid.csv', validCSV);
        const invalidFile = await createTestCSV('invalid.csv', invalidCSV);

        // Process both files
        const [validResult, invalidResult] = await Promise.allSettled([
            engine.processFile(validFile),
            engine.processFile(invalidFile)
        ]);

        // Verify valid file processed successfully
        expect(validResult.status).toBe('fulfilled');
        
        // Verify invalid file failed but didn't affect valid file
        expect(invalidResult.status).toBe('rejected');

        // Verify aggregation results
        const results = engine.getResults();
        expect(results.length).toBeGreaterThan(0);
    });

    test('handles malformed records in CSV', async () => {
        const engine = new DataEngine(options);
        const malformedCSV = 'id,value\n1,10\nmalformed,data\n3,30\n';
        const filepath = await createTestCSV('malformed.csv', malformedCSV);

        await expect(engine.processFile(filepath)).rejects.toThrow();
    });

    test('processes large files efficiently', async () => {
        const engine = new DataEngine(options);
        
        // Create a large CSV file
        const header = 'id,value\n';
        const records = Array.from({ length: 1000 }, (_, i) => `${i + 1},${Math.random()}\n`).join('');
        const filepath = await createTestCSV('large.csv', header + records);

        // Process file and measure time
        const startTime = Date.now();
        await engine.processFile(filepath);
        const endTime = Date.now();

        // Verify processing time is reasonable
        const processingTime = endTime - startTime;
        expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds

        // Verify results
        const results = engine.getResults();
        expect(results.length).toBeGreaterThan(0);
    });

    test('maintains consistent aggregation during high load', async () => {
        const engine = new DataEngine(options);
        const aggregationResults = new Set<number>();

        // Create multiple large files
        const files = await Promise.all(
            Array.from({ length: 5 }, (_, i) => createTestCSV(`large${i}.csv`, 'id,value\n1,10\n2,20\n3,30\n'))
        );

        // Monitor aggregations
        engine['aggregator'].on('aggregation', (result) => {
            aggregationResults.add(result.timestamp);
        });

        // Process all files
        await Promise.all(files.map(file => engine.processFile(file)));

        // Verify aggregation consistency
        const timestamps = Array.from(aggregationResults).sort();
        for (let i = 1; i < timestamps.length; i++) {
            const timeDiff = timestamps[i] - timestamps[i-1];
            expect(timeDiff).toBe(options.slidingInterval);
        }
    }, 15000);
});
