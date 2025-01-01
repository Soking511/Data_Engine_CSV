import { StreamProcessor } from '../processors/StreamProcessor';
import { Readable, PassThrough } from 'stream';
import { ProcessingOptions } from '../types';

describe('StreamProcessor', () => {
    const options: ProcessingOptions = {
        batchSize: 2,
        windowSize: 1000,
        slidingInterval: 500
    };

    test('processes data in batches with back-pressure', (done) => {
        const processor = new StreamProcessor(options);
        const results: any[] = [];

        // Create a slow writable stream to test back-pressure
        const slowWriter = new PassThrough({ objectMode: true })
            .on('data', (chunk) => {
                results.push(chunk);
                // Simulate slow processing
                return new Promise(resolve => setTimeout(resolve, 100));
            });

        // Create test data
        const testData = [
            { id: 1, value: 'a' },
            { id: 2, value: 'b' },
            { id: 3, value: 'c' },
            { id: 4, value: 'd' }
        ];

        // Create readable stream
        const source = Readable.from(testData, { objectMode: true });

        // Pipeline
        source
            .pipe(processor)
            .pipe(slowWriter)
            .on('finish', () => {
                expect(results).toHaveLength(2); // Should have 2 batches
                expect(results[0].records).toHaveLength(2); // First batch
                expect(results[1].records).toHaveLength(2); // Second batch
                done();
            });
    }, 15000);

    test('handles errors gracefully and continues processing', (done) => {
        const processor = new StreamProcessor(options);
        const results: any[] = [];

        // Create test data with invalid records
        const testData = [
            { id: 1, value: 'a' },
            { id: 2, value: 'b' },
            undefined, // This should be skipped
            { id: 4, value: 'd' },
            { id: 5, value: 'e' }
        ];

        const source = Readable.from(testData.filter(Boolean), { objectMode: true });

        source
            .pipe(processor)
            .on('data', (result) => {
                results.push(result);
            })
            .on('end', () => {
                // Should still process valid records
                expect(results.length).toBeGreaterThan(0);
                expect(results.every(r => r.success)).toBeTruthy();
                const totalRecords = results.reduce((sum, r) => sum + r.records.length, 0);
                expect(totalRecords).toBe(4); // All valid records processed
                done();
            });
    }, 15000);

    test('flushes remaining records in buffer', (done) => {
        const processor = new StreamProcessor({ ...options, batchSize: 3 });
        const results: any[] = [];

        // Create test data that doesn't perfectly fit batch size
        const testData = [
            { id: 1, value: 'a' },
            { id: 2, value: 'b' } // Only 2 records, less than batchSize of 3
        ];

        const source = Readable.from(testData, { objectMode: true });

        source
            .pipe(processor)
            .on('data', (result) => {
                results.push(result);
            })
            .on('end', () => {
                expect(results).toHaveLength(1);
                expect(results[0].records).toHaveLength(2);
                done();
            });
    }, 15000);

    test('maintains memory efficiency during processing', (done) => {
        const processor = new StreamProcessor(options);
        const results: any[] = [];
        const initialMemory = process.memoryUsage().heapUsed;

        // Create large test dataset
        const testData = Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            value: `value${i}`
        }));

        const source = Readable.from(testData, { objectMode: true });

        source
            .pipe(processor)
            .on('data', (result) => {
                results.push(result);
            })
            .on('end', () => {
                const finalMemory = process.memoryUsage().heapUsed;
                const memoryIncrease = finalMemory - initialMemory;
                
                // Memory increase should be reasonable
                expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
                expect(results.length).toBe(Math.ceil(testData.length / options.batchSize));
                done();
            });
    }, 15000);
});
