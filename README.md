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

## Development

```bash
# Build the project
npm run build

# Run tests
npm test
```
