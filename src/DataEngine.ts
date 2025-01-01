import { ProcessingOptions, AggregationResult } from './types';
import { StreamProcessor } from './processors/StreamProcessor';
import { WindowAggregator } from './aggregators/WindowAggregator';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { Transform } from 'stream';

export class DataEngine {
    private processor: StreamProcessor;
    private aggregator: WindowAggregator;
    private results: AggregationResult[] = [];

    constructor(options: ProcessingOptions) {
        this.processor = new StreamProcessor(options);
        this.aggregator = new WindowAggregator(options);

        this.aggregator.on('aggregation', this.handleAggregationResult.bind(this));
    }

    async processFile(filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const parser = parse({
                    columns: true,
                    skip_empty_lines: true,
                    cast: true,
                    cast_date: true
                });

                const errorHandler = new Transform({
                    objectMode: true,
                    transform(chunk, encoding, callback) {
                        try {
                            if (!chunk || typeof chunk !== 'object') {
                                callback(new Error('Invalid record format'));
                                return;
                            }
                            callback(null, chunk);
                        } catch (error) {
                            callback(error instanceof Error ? error : new Error(String(error)));
                        }
                    }
                });

                this.processor.addStream(parser);
                this.processor.addStream(errorHandler);

                const stream = createReadStream(filePath)
                    .pipe(parser)
                    .pipe(errorHandler)
                    .pipe(this.processor);

                const cleanup = () => {
                    stream.destroy();
                    parser.destroy();
                    errorHandler.destroy();
                    this.processor.cleanup();
                };

                stream.on('error', (error) => {
                    cleanup();
                    reject(error instanceof Error ? error : new Error(String(error)));
                });

                parser.on('error', (error) => {
                    cleanup();
                    reject(error instanceof Error ? error : new Error(String(error)));
                });

                errorHandler.on('error', (error) => {
                    cleanup();
                    reject(error instanceof Error ? error : new Error(String(error)));
                });

                stream.on('data', (record) => {
                    this.aggregator.addRecord(record);
                });

                stream.on('end', () => {
                    resolve();
                });

            } catch (error) {
                this.cleanup();
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    private handleAggregationResult(result: AggregationResult): void {
        this.results.push(result);
        this.log('Aggregation result:', result);
    }

    private log(...args: any[]): void {
        if (process.env.NODE_ENV !== 'production') {
            console.log(...args);
        }
    }

    getResults(): AggregationResult[] {
        return [...this.results]; 
    }

    cleanup(): void {
        this.processor.cleanup();
        this.aggregator.stop();
        this.results = [];
    }
}
