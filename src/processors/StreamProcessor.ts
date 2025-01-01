import { Transform } from 'stream';
import { ProcessingOptions, CSVRecord } from '../types';

export class StreamProcessor extends Transform {
    private buffer: CSVRecord[] = [];
    private readonly options: ProcessingOptions;
    private activeStreams: Set<Transform>;
    private processing: boolean = false;
    private highWaterMark: number;

    constructor(options: ProcessingOptions) {
        super({ 
            objectMode: true,
            highWaterMark: 1000, 
            readableHighWaterMark: 1000,
            writableHighWaterMark: 1000
        });
        
        this.options = options;
        this.activeStreams = new Set();
        this.highWaterMark = 1000;
        this.setMaxListeners(50);

        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }

    _transform(chunk: CSVRecord, encoding: string, callback: Function): void {
        try {
            this.buffer.push(chunk);

            if (this.buffer.length >= this.options.batchSize || 
                this.buffer.length >= this.highWaterMark) {
                this.processBatch(callback);
            } else {
                callback();
            }
        } catch (error) {
            callback(error);
        }
    }

    private async processBatch(callback: Function) {
        if (this.processing) {
            callback();
            return;
        }

        this.processing = true;
        try {
            const batch = this.buffer.splice(0, this.options.batchSize);
            if (batch.length > 0) {
                const chunks = this.chunkArray(batch, Math.ceil(batch.length / 4));
                await Promise.all(chunks.map(chunk => this.processChunk(chunk)));
            }
        } catch (error) {
            console.error('Error processing batch:', error);
        } finally {
            this.processing = false;
            callback();
        }
    }

    private async processChunk(records: CSVRecord[]) {
        try {
            const processedRecords = records.map(record => {
                return {
                    ...record,
                    timestamp: Date.now()
                };
            });

            processedRecords.forEach(record => {
                this.push(record);
            });
        } catch (error) {
            console.error('Error processing chunk:', error);
        }
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    _flush(callback: Function): void {
        if (this.buffer.length > 0) {
            this.processBatch(() => {
                if (this.buffer.length > 0) {
                    this._flush(callback);
                } else {
                    callback();
                }
            });
        } else {
            callback();
        }
    }

    addStream(stream: Transform) {
        this.activeStreams.add(stream);
        
        stream.on('drain', () => {
            this.resume();
        });

        stream.once('end', () => {
            this.activeStreams.delete(stream);
            stream.removeAllListeners();
        });

        stream.on('error', (error) => {
            console.error('Stream error:', error);
            this.activeStreams.delete(stream);
            stream.destroy();
        });
    }

    cleanup() {
        for (const stream of this.activeStreams) {
            stream.removeAllListeners();
            stream.destroy();
        }
        this.activeStreams.clear();
        this.removeAllListeners();
        this.buffer = [];
    }

    _destroy(error: Error | null, callback: (error?: Error | null) => void) {
        this.cleanup();
        callback(error);
    }
}
