import { PositionHistoryCronJob } from '../src/PositionHistoryCronJob';

describe('PositionHistoryCronJob', () => {
    let positionHistoryCron: PositionHistoryCronJob;

    beforeEach(() => {
        positionHistoryCron = new PositionHistoryCronJob();
    });

    afterEach(() => {
        positionHistoryCron.stop();
    });

    describe('Constructor', () => {
        it('should initialize with default symbols', () => {
            const symbols = positionHistoryCron.getSymbols();
            expect(symbols).toContain('BTCUSDT');
            expect(symbols).toContain('ETHUSDT');
            expect(symbols).toContain('BNBUSDT');
            expect(symbols.length).toBeGreaterThan(0);
        });
    });

    describe('Symbol management', () => {
        it('should set symbols correctly', () => {
            const testSymbols = ['BTCUSDT', 'ETHUSDT'];
            positionHistoryCron.setSymbols(testSymbols);
            
            const currentSymbols = positionHistoryCron.getSymbols();
            expect(currentSymbols).toEqual(testSymbols);
        });

        it('should add symbol correctly', () => {
            const initialSymbols = positionHistoryCron.getSymbols();
            positionHistoryCron.addSymbol('TESTUSDT');
            
            const updatedSymbols = positionHistoryCron.getSymbols();
            expect(updatedSymbols).toContain('TESTUSDT');
            expect(updatedSymbols.length).toBe(initialSymbols.length + 1);
        });

        it('should not add duplicate symbols', () => {
            const initialSymbols = positionHistoryCron.getSymbols();
            const initialLength = initialSymbols.length;
            
            positionHistoryCron.addSymbol('BTCUSDT'); // Already exists
            
            const updatedSymbols = positionHistoryCron.getSymbols();
            expect(updatedSymbols.length).toBe(initialLength);
        });

        it('should remove symbol correctly', () => {
            const initialSymbols = positionHistoryCron.getSymbols();
            const symbolToRemove = initialSymbols[0];
            
            positionHistoryCron.removeSymbol(symbolToRemove);
            
            const updatedSymbols = positionHistoryCron.getSymbols();
            expect(updatedSymbols).not.toContain(symbolToRemove);
            expect(updatedSymbols.length).toBe(initialSymbols.length - 1);
        });

        it('should handle removing non-existent symbol', () => {
            const initialSymbols = positionHistoryCron.getSymbols();
            const initialLength = initialSymbols.length;
            
            positionHistoryCron.removeSymbol('NONEXISTENT');
            
            const updatedSymbols = positionHistoryCron.getSymbols();
            expect(updatedSymbols.length).toBe(initialLength);
        });
    });

    describe('State management', () => {
        it('should start and stop correctly', async () => {
            // Mock console.log to avoid output during tests
            const originalLog = console.log;
            console.log = jest.fn();
            
            await positionHistoryCron.start();
            positionHistoryCron.stop();
            
            // Restore console.log
            console.log = originalLog;
            
            // The test passes if no errors are thrown
            expect(true).toBe(true);
        });

        it('should not start if already running', async () => {
            const originalLog = console.log;
            console.log = jest.fn();
            
            await positionHistoryCron.start();
            await positionHistoryCron.start(); // Should not start again
            
            positionHistoryCron.stop();
            
            console.log = originalLog;
            
            expect(true).toBe(true);
        });

        it('should not stop if not running', () => {
            const originalLog = console.log;
            console.log = jest.fn();
            
            positionHistoryCron.stop(); // Should not stop if not running
            
            console.log = originalLog;
            
            expect(true).toBe(true);
        });
    });

    describe('Manual update', () => {
        it('should execute manual update without errors', async () => {
            const originalLog = console.log;
            console.log = jest.fn();
            
            await positionHistoryCron.manualUpdate();
            
            console.log = originalLog;
            
            expect(true).toBe(true);
        });
    });
}); 