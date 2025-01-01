import { Router } from 'express';
import multer from 'multer';
import { DataEngine } from '../DataEngine';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

const uploadsDir = path.join(__dirname, '../uploads');
(async () => {
    try {
        await fs.access(uploadsDir);
    } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
    }
})();

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.access(uploadsDir);
            cb(null, uploadsDir);
        } catch {
            try {
                await fs.mkdir(uploadsDir, { recursive: true });
                cb(null, uploadsDir);
            } catch (error) {
                cb(error as Error, uploadsDir);
            }
        }
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

const dataEngine = new DataEngine({
    batchSize: 100,
    windowSize: 1000,
    slidingInterval: 500
});

router.post('/process', upload.array('files'), async (req, res) => {
    try {
        const files = req.files as Express.Multer.File[];
        
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded',
                results: []
            });
        }

        const results = await Promise.all(
            files.map(async (file) => {
                try {
                    await dataEngine.processFile(file.path);
                    return {
                        filename: file.originalname,
                        status: 'success'
                    };
                } catch (error) {
                    return {
                        filename: file.originalname,
                        status: 'error',
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            })
        );

        const hasErrors = results.some(result => result.status === 'error');
        
        res.json({
            success: !hasErrors,
            message: `Processed ${files.length} file(s)`,
            filesProcessed: files.length,
            results
        });
    } catch (error) {
        console.error('Error processing files:', error);
        dataEngine.cleanup();
        res.status(400).json({
            success: false,
            error: 'Error processing files',
            results: []
        });
    }
});

// Legacy upload endpoint (for backward compatibility)
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded',
                results: []
            });
        }

        await dataEngine.processFile(req.file.path);

        res.json({
            success: true,
            message: 'File processed successfully',
            results: [{
                filename: req.file.originalname,
                status: 'success'
            }]
        });
    } catch (error) {
        console.error('Error processing file:', error);
        dataEngine.cleanup();
        res.status(400).json({
            success: false,
            error: 'Error processing file',
            results: [{
                filename: req.file?.originalname || 'unknown',
                status: 'error',
                error: error instanceof Error ? error.message : String(error)
            }]
        });
    }
});

// Get aggregations endpoint
router.get('/aggregations', (req, res) => {
    const results = dataEngine.getResults();
    res.json(results);
});

// Get status endpoint
router.get('/status', (req, res) => {
    res.json({
        status: 'operational',
        timestamp: Date.now(),
        aggregationCount: dataEngine.getResults().length,
        activeStreams: 0 
    });
});

export default router;
