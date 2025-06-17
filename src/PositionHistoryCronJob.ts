import * as cron from 'node-cron';
import { PositionHistory } from './PositionHistory';

export class PositionHistoryCronJob {
    private positionHistory: PositionHistory;
    private isRunning: boolean = false;
    private symbols: string[] = [
        'ALL'
        /*
        'BTCUSDT',
        'ETHUSDT',
        'BNBUSDT',
        'ADAUSDT',
        'SOLUSDT',
        'DOTUSDT',
        'LINKUSDT',
        'MATICUSDT',
        'AVAXUSDT',
        'UNIUSDT'*/
    ];

    constructor() {
        this.positionHistory = new PositionHistory();
    }

    private async updatePositionHistory(): Promise<void> {
        try {
            console.log(`\n[${new Date().toLocaleString()}] Starting position history cache update...`);
            
            // Update cache for all configured symbols
            await this.positionHistory.createOrUpdateCache(this.symbols);
            
            console.log(`[${new Date().toLocaleString()}] Position history cache update completed successfully`);
        } catch (error) {
            console.error(`[${new Date().toLocaleString()}] Error updating position history cache:`, error);
        }
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            console.log('PositionHistoryCronJob is already running');
            return;
        }

        // Initial execution after 30 seconds
        setTimeout(async () => {
            console.log(`\n[${new Date().toLocaleString()}] Running initial position history update...`);
            await this.updatePositionHistory();
        }, 1000);

        // Schedule the job to run every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            await this.updatePositionHistory();
        });

        this.isRunning = true;
        console.log('PositionHistoryCronJob started. Will run every 30 minutes.');
        console.log(`Monitoring symbols: ${this.symbols.join(', ')}`);
    }

    public stop(): void {
        if (!this.isRunning) {
            console.log('PositionHistoryCronJob is not running');
            return;
        }

        this.isRunning = false;
        console.log('PositionHistoryCronJob stopped');
    }

    /**
     * Set the symbols to monitor for position history
     * @param symbols Array of symbols to monitor
     */
    public setSymbols(symbols: string[]): void {
        this.symbols = symbols;
        console.log(`Updated symbols to monitor: ${this.symbols.join(', ')}`);
    }

    /**
     * Get the current symbols being monitored
     * @returns Array of symbols
     */
    public getSymbols(): string[] {
        return [...this.symbols];
    }

    /**
     * Add a symbol to the monitoring list
     * @param symbol Symbol to add
     */
    public addSymbol(symbol: string): void {
        if (!this.symbols.includes(symbol)) {
            this.symbols.push(symbol);
            console.log(`Added symbol to monitoring: ${symbol}`);
        }
    }

    /**
     * Remove a symbol from the monitoring list
     * @param symbol Symbol to remove
     */
    public removeSymbol(symbol: string): void {
        const index = this.symbols.indexOf(symbol);
        if (index > -1) {
            this.symbols.splice(index, 1);
            console.log(`Removed symbol from monitoring: ${symbol}`);
        }
    }

    /**
     * Manually trigger a position history update
     */
    public async manualUpdate(): Promise<void> {
        console.log(`\n[${new Date().toLocaleString()}] Manual position history update triggered...`);
        await this.updatePositionHistory();
    }
} 