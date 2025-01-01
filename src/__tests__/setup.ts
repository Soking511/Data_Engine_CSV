// Increase timeout for all tests
jest.setTimeout(10000); // 10 seconds

// Mock timers for window-based tests
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});
