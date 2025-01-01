export interface CSVRecord {
    [key: string]: string | number;
}

export interface ProcessingOptions {
    batchSize: number;
    windowSize: number; // in milliseconds
    slidingInterval: number; // in milliseconds
}

export interface AggregationResult {
    timestamp: number;
    count: number;
    data: {
        [key: string]: {
            count: number;
            [key: string]: number;
        };
    };
}
