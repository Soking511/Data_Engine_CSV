import express from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import fs from 'fs/promises';

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure required directories exist
async function ensureDirectories() {
    const dirs = [
        path.join(__dirname, 'uploads'),
        path.join(__dirname, '../public')
    ];

    for (const dir of dirs) {
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
    }
}

// Initialize server
async function initializeServer() {
    await ensureDirectories();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Serve static files from the public directory
    app.use(express.static(path.join(__dirname, '../public')));

    // API routes
    app.use('/api', routes);

    // Serve index.html for the root route
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error(err.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log('Available endpoints:');
        console.log('  POST /api/process - Upload and process CSV files');
        console.log('  GET  /api/status  - Get current processing status');
    });
}

// Initialize server
initializeServer().catch(error => {
    console.error('Failed to initialize server:', error);
    process.exit(1);
});

export default app;
