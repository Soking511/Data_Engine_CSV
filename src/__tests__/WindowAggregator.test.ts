import { WindowAggregator } from '../aggregators/WindowAggregator';
import { ProcessingOptions } from '../types';

describe('WindowAggregator', () => {
    const options: ProcessingOptions = {
        batchSize: 10,
        windowSize: 1000, // 1 second window
        slidingInterval: 500 // 500ms slides
    };

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('aggregates data within time windows', () => {
        const aggregator = new WindowAggregator(options);
        const results: any[] = [];

        aggregator.on('aggregation', (result) => {
            results.push(result);
        });

        // Add records at different times
        const now = Date.now();
        jest.setSystemTime(now);
        
        aggregator.addRecord({ id: 1, value: 10 });
        aggregator.addRecord({ id: 2, value: 20 });

        // Advance time by sliding interval
        jest.advanceTimersByTime(options.slidingInterval);
        
        aggregator.addRecord({ id: 3, value: 30 });
        aggregator.addRecord({ id: 4, value: 40 });

        // Verify results
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].count).toBe(2); // First window
        
        // Verify aggregation data structure
        const firstWindow = results[0];
        expect(firstWindow.data).toHaveProperty('id');
        expect(firstWindow.data).toHaveProperty('value');
    });

    test('maintains data consistency across windows', () => {
        const aggregator = new WindowAggregator(options);
        const windowData = new Map<number, number>();

        aggregator.on('aggregation', (result) => {
            windowData.set(result.timestamp, result.count);
        });

        const now = Date.now();
        jest.setSystemTime(now);

        // Add records over multiple windows
        for (let i = 0; i < 5; i++) {
            aggregator.addRecord({ id: i, value: i });
            jest.advanceTimersByTime(options.slidingInterval / 2);
        }

        // Verify window consistency
        const windows = Array.from(windowData.keys()).sort();
        for (let i = 1; i < windows.length; i++) {
            const timeDiff = windows[i] - windows[i-1];
            expect(timeDiff).toBe(options.slidingInterval);
        }
    });

    test('properly calculates aggregations', () => {
        const aggregator = new WindowAggregator(options);
        const results: any[] = [];

        aggregator.on('aggregation', (result) => {
            results.push(result);
        });

        const now = Date.now();
        jest.setSystemTime(now);

        // Add records with known values in the same window
        aggregator.addRecord({ id: 1, category: 'A', value: 10 });
        aggregator.addRecord({ id: 2, category: 'A', value: 20 });
        aggregator.addRecord({ id: 3, category: 'B', value: 30 });

        // Force window processing
        jest.advanceTimersByTime(options.slidingInterval);

        // Verify aggregations
        expect(results[0].data).toEqual({
            id: 3, // 3 unique IDs
            category: 2, // 2 unique categories (A, B)
            value: 3 // 3 unique values (10, 20, 30)
        });
    });

    test('handles window cleanup correctly', () => {
        const aggregator = new WindowAggregator({
            ...options,
            windowSize: 500,
            slidingInterval: 100
        });

        const results: any[] = [];
        aggregator.on('aggregation', (result) => {
            results.push(result);
        });

        const now = Date.now();
        jest.setSystemTime(now);

        // Add records over multiple windows
        for (let i = 0; i < 10; i++) {
            aggregator.addRecord({ id: i, value: i });
            jest.advanceTimersByTime(100);
        }

        // Advance time beyond window size
        jest.advanceTimersByTime(1000);

        // Verify old windows were cleaned up
        const timestamps = results.map(r => r.timestamp);
        const currentTime = Date.now();
        const oldWindows = timestamps.filter(t => (currentTime - t) > options.windowSize);
        expect(oldWindows.length).toBe(0);
    });

    test('handles window boundaries correctly', () => {
        const aggregator = new WindowAggregator(options);
        const windows = new Set<number>();

        aggregator.on('aggregation', (result) => {
            windows.add(result.timestamp);
        });

        const now = Date.now();
        jest.setSystemTime(now);

        // Add record at window start
        aggregator.addRecord({ id: 1, value: 'start' });

        // Add record just before window end
        jest.advanceTimersByTime(options.slidingInterval - 10);
        aggregator.addRecord({ id: 2, value: 'end' });

        // Verify window boundaries
        const windowTimes = Array.from(windows).sort();
        expect(windowTimes.length).toBeGreaterThan(0);
        
        // Verify window alignment
        windowTimes.forEach(time => {
            expect(time % options.slidingInterval).toBe(0);
        });
    });
});
