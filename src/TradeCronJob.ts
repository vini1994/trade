import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { TradeValidator } from './TradeValidator';
import player from 'play-sound';
import { DataServiceManager } from './DataServiceManager';
import { KlineData } from './utils/types';
import { ConsoleChartService } from './ConsoleChartService';


interface Trade {
    entry: number;
    stop: number;
    ls: string;
    tp1: number;
    tp2: number;
    tp3: number;
    par: string;
    volume: boolean;
}

const play = player();

export class TradeCronJob {
    private readonly dataPath: string;
    private readonly tradeValidator: TradeValidator;
    private readonly dataServiceManager: DataServiceManager;
    private readonly consoleChartService: ConsoleChartService;

    constructor() {
        this.dataPath = path.join(__dirname, '../data/trades.json');
        this.tradeValidator = new TradeValidator();
        this.dataServiceManager = new DataServiceManager();
        this.consoleChartService = new ConsoleChartService();
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

        let validCount = 0;
        for (const trade of trades) {
            // Delay de 2 segundos entre cada trade
            if (validCount > 0 || trades.indexOf(trade) > 0) {
                await new Promise(res => setTimeout(res, 2000));
            }

            // Validate the trade
            const validationResult = await this.tradeValidator.validateTrade({
                symbol: trade.par,
                type: trade.ls as 'LONG' | 'SHORT',
                entry: trade.entry,
                stop: trade.stop,
                volume: trade.volume
            });

            console.log(`\nTrade #${trades.indexOf(trade) + 1}:`);
            console.log(`Pair: ${trade.par}`);
            console.log(`Position: ${trade.ls}`);
            console.log(`Entry: ${trade.entry}`);
            console.log(`Stop: ${trade.stop}`);
            console.log(`Take Profits: ${trade.tp1}, ${trade.tp2}, ${trade.tp3}`);
            console.log('\nValidation Results:');
            console.log(`Validation: ${validationResult.isValid}`);
            console.log(`Message: ${validationResult.message}`);
            console.log(`Volume Analysis: ${validationResult.volumeAnalysis.color} (StdBar: ${validationResult.volumeAnalysis.stdBar.toFixed(2)})`);
            console.log(`Current Close: ${validationResult.entryAnalysis.currentClose}`);
            console.log('----------------------------------------');
            const { data: klineData, source } = await this.dataServiceManager.getKlineData(trade.par);
            this.consoleChartService.drawChart(klineData, trade.par);

            if (validationResult.isValid) {
                validCount++;

                // Play alert.mp3
                play.play(path.join(__dirname, '../data/alert.mp3'), (err: any) => {
                    if (err) console.error('Error playing sound:', err);
                });
            }
        }

        if (validCount === 0) {
            console.log('No valid trades at this time.');
        }

        console.log('\n================================\n');
    }

    public execute(): void {
        // Schedule the job to run at minute 2 of every hour
        cron.schedule('2 * * * *', async () => {
        //cron.schedule('* * * * *', async () => {
            const trades = this.readTrades();
            await this.displayTrades(trades);
            

        });

        console.log('Trade cron job started. Will run at minute 2 of every hour.');
    }
} 