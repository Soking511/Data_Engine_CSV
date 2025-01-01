# Data Engine - Concurrent CSV Stream Processor

A TypeScript-based system for processing multiple CSV streams concurrently with real-time aggregation capabilities.

## Features

- Concurrent CSV stream processing
- Back-pressure handling using Node.js streams
- Real-time aggregation with sliding windows
- Graceful partial failure handling
- Type-safe implementation
- Data consistency during processing

## Installation

```bash
npm install
```

## Usage

```typescript
import { DataEngine } from './src/DataEngine';

const options = {
    batchSize: 1000,
    windowSize: 60000, // 1 minute window
    slidingInterval: 5000 // 5 second slides
};

const engine = new DataEngine(options);

// Process multiple files concurrently
await engine.processFile('path/to/file1.csv');
await engine.processFile('path/to/file2.csv');
```

## Architecture

- `StreamProcessor`: Handles individual CSV streams with back-pressure
- `WindowAggregator`: Manages sliding window aggregations
- `DataEngine`: Orchestrates the entire processing pipeline

## Best Practices

1. **Type Safety**: Comprehensive TypeScript types for all components
2. **Error Handling**: Graceful error recovery and logging
3. **Memory Management**: Efficient stream processing with back-pressure
4. **Modularity**: Clean separation of concerns
5. **KISS Principle**: Simple, focused components with clear responsibilities

## API Endpoints

### Upload Single File
```http
POST /api/upload
Content-Type: multipart/form-data

file: [CSV file]
```

### Process Multiple Files
```http
POST /api/process
Content-Type: multipart/form-data

files: [CSV files]
```

## Technical Details

### Stream Processing
- Efficient memory usage through streaming
- Configurable batch sizes
- Back-pressure handling
- Error recovery mechanisms

### Window Aggregation
- Sliding window implementation
- Configurable window sizes
- Real-time aggregation
- Memory-efficient window management

### Performance Optimization
- Concurrent file processing
- Batch processing for efficiency
- Memory usage optimization
- CPU utilization management

## Configuration

```typescript
interface ProcessingOptions {
    batchSize: number;      // Number of records per batch
    windowSize: number;     // Window size in milliseconds
    slidingInterval: number; // Sliding interval in milliseconds
}
```

## Error Handling

- Graceful error recovery
- Partial failure handling
- Comprehensive error logging
- Stream error management

## Development

```bash
# Build the project
npm run build

# Run tests
npm test
```

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run specific tests
npm test -- -t "test-name"
```

## Monitoring

- Stream processing metrics
- Window aggregation statistics
- Memory usage monitoring
- Processing throughput tracking

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
