import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { TradeValidator } from './TradeValidator';
import { TradeOrderProcessor } from './TradeOrderProcessor';

interface Trade {
    entry: number;
    stop: number;
    ls: string;
    tp1: number;
    tp2: number;
    tp3: number;
    par: string;
}

export class TradeCronJob {
    private readonly dataPath: string;
    private readonly tradeValidator: TradeValidator;
    private readonly tradeOrderProcessor: TradeOrderProcessor;

    constructor() {
        this.dataPath = path.join(__dirname, '../data/trades.json');
        this.tradeValidator = new TradeValidator();
        this.tradeOrderProcessor = new TradeOrderProcessor();
    }

    private readTrades(): Trade[] {
        try {
            const data = fs.readFileSync(this.dataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading trades file:', error);
            return [];
        }
    }

    private async displayTrades(trades: Trade[]): Promise<void> {
        console.log('\n=== Trades at', new Date().toLocaleString(), '===');
        
        for (const trade of trades) {
            console.log(`\nTrade #${trades.indexOf(trade) + 1}:`);
            console.log(`Pair: ${trade.par}`);
            console.log(`Position: ${trade.ls}`);
            console.log(`Entry: ${trade.entry}`);
            console.log(`Stop: ${trade.stop}`);
            console.log(`Take Profits: ${trade.tp1}, ${trade.tp2}, ${trade.tp3}`);

            // Validate the trade
            const validationResult = await this.tradeValidator.validateTrade({
                symbol: trade.par,
                type: trade.ls as 'LONG' | 'SHORT',
                entry: trade.entry,
                stop: trade.stop
            });

            // Display validation results
            console.log('\nValidation Results:');
            console.log(`Status: ${validationResult.isValid ? 'VALID' : 'INVALID'}`);
            console.log(`Message: ${validationResult.message}`);
            console.log(`Volume Analysis: ${validationResult.volumeAnalysis.color} (StdBar: ${validationResult.volumeAnalysis.stdBar.toFixed(2)})`);
            console.log(`Current Close: ${validationResult.entryAnalysis.currentClose}`);
            console.log('----------------------------------------');
        }
        
        console.log('\n================================\n');
    }

    public execute(): void {
        // Schedule the job to run at minute 2 of every hour
        cron.schedule('2 * * * *', async () => {
            const trades = this.readTrades();
            await this.displayTrades(trades);
            
            // Process orders for open trades
            await this.tradeOrderProcessor.processTrades();
        });

        console.log('Trade cron job started. Will run at minute 2 of every hour.');
    }
} 