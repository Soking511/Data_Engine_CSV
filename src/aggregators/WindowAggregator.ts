import { EventEmitter } from 'events';
import { ProcessingOptions, CSVRecord } from '../types';

interface Window {
    startTime: number;
    records: CSVRecord[];
}

export class WindowAggregator extends EventEmitter {
    private windows: Map<number, Window>;
    private readonly windowSize: number;
    private readonly slidingInterval: number;
    private lastCleanup: number;
    private timer: NodeJS.Timeout | null;
    private processing: boolean;
    private readonly maxWindows: number;

    constructor(options: ProcessingOptions) {
        super();
        this.windowSize = options.windowSize;
        this.slidingInterval = options.slidingInterval;
        this.windows = new Map();
        this.lastCleanup = Date.now();
        this.timer = null;
        this.processing = false;
        this.maxWindows = Math.ceil(this.windowSize / this.slidingInterval) + 1;

        this.setMaxListeners(50);

        this.timer = setInterval(() => {
            this.processWindows();
        }, this.slidingInterval);
    }

    addRecord(record: CSVRecord): void {
        const now = Date.now();
        const windowStart = Math.floor(now / this.slidingInterval) * this.slidingInterval;

        for (let i = 0; i < this.maxWindows; i++) {
            const windowTime = windowStart - (i * this.slidingInterval);
            if (now - windowTime <= this.windowSize) {
                this.addToWindow(windowTime, record);
            }
        }

        if (now - this.lastCleanup > this.windowSize) {
            this.cleanupWindows();
        }
    }

    private addToWindow(windowTime: number, record: CSVRecord): void {
        let window = this.windows.get(windowTime);
        if (!window) {
            window = {
                startTime: windowTime,
                records: []
            };
            this.windows.set(windowTime, window);
        }
        window.records.push({ ...record }); // Clone record for data consistency
    }

    private async processWindows(): Promise<void> {
        if (this.processing) return;

        this.processing = true;
        try {
            const now = Date.now();
            const windowsToProcess = Array.from(this.windows.entries())
                .filter(([startTime]) => now - startTime >= this.slidingInterval)
                .sort(([a], [b]) => b - a);

            for (const [startTime, window] of windowsToProcess) {
                try {
                    await this.processWindow(startTime, window);
                } catch (error) {
                    console.error(`Error processing window ${startTime}:`, error);
                }
            }
        } finally {
            this.processing = false;
        }
    }

    private async processWindow(startTime: number, window: Window): Promise<void> {
        if (window.records.length === 0) return;

        try {
            const aggregations = this.calculateAggregations(window.records);

            this.emit('aggregation', {
                timestamp: startTime,
                count: window.records.length,
                data: aggregations
            });
        } catch (error) {
            console.error('Error calculating aggregations:', error);
            throw error; 
        }
    }

    private calculateAggregations(records: CSVRecord[]): any {
        const groups = new Map<string, CSVRecord[]>();
        
        records.forEach(record => {
            const key = this.getGroupKey(record);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(record);
        });

        const results: any = {};
        groups.forEach((groupRecords, key) => {
            results[key] = this.calculateGroupAggregations(groupRecords);
        });

        return results;
    }

    private getGroupKey(record: CSVRecord): string {
        return Object.entries(record)
            .filter(([key]) => key !== 'timestamp')
            .map(([key, value]) => `${key}:${value}`)
            .join('|');
    }

    private calculateGroupAggregations(records: CSVRecord[]): any {
        const numericFields = this.getNumericFields(records[0]);
        const result: any = {
            count: records.length
        };

        numericFields.forEach(field => {
            const values = records.map(r => Number(r[field])).filter(v => !isNaN(v));
            if (values.length > 0) {
                result[`${field}_sum`] = values.reduce((a, b) => a + b, 0);
                result[`${field}_avg`] = result[`${field}_sum`] / values.length;
                result[`${field}_max`] = Math.max(...values);
                result[`${field}_min`] = Math.min(...values);
            }
        });

        return result;
    }

    private getNumericFields(record: CSVRecord): string[] {
        return Object.entries(record)
            .filter(([key, value]) => key !== 'timestamp' && typeof value === 'number')
            .map(([key]) => key);
    }

    private cleanupWindows(): void {
        const now = Date.now();
        const cutoff = now - this.windowSize;

        for (const [startTime] of this.windows) {
            if (startTime < cutoff) {
                this.windows.delete(startTime);
            }
        }

        this.lastCleanup = now;
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.windows.clear();
        this.removeAllListeners();
    }
}
