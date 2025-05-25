import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { TradeValidator } from './TradeValidator';
import { DataServiceManager } from './DataServiceManager';
import { ConsoleChartService } from './ConsoleChartService';
import { NotificationService } from './NotificationService';
import { TradeExecutor } from './TradeExecutor';


interface Trade {
    entry: number;
    stop: number;
    ls: string;
    tp1: number;
    tp2: number;
    tp3: number;
    par: string;
    volume: boolean;
    url_analysis: string;
}


export class TradeCronJob {
    private readonly dataPath: string;
    private readonly tradeValidator: TradeValidator;
    private readonly dataServiceManager: DataServiceManager;
    private readonly consoleChartService: ConsoleChartService;
    private readonly notificationService: NotificationService;
    private readonly tradeExecutor: TradeExecutor;

    constructor() {
        this.dataPath = path.join(__dirname, '../data/trades.json');
        this.tradeValidator = new TradeValidator();
        this.dataServiceManager = new DataServiceManager();
        this.consoleChartService = new ConsoleChartService();
        this.notificationService = new NotificationService();
        this.tradeExecutor = new TradeExecutor();
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

    private async processAndDisplayTrades(trades: Trade[]): Promise<void> {
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
                volume: trade.volume,
                tp1: trade.tp1
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
            if (validationResult.warning) {
                console.log(`⚠️ WARNING: Trade has warning status - Entry conditions met but invalidated by other factors`);
            }
            console.log('----------------------------------------');

            // Send notification for trades with warning status
            if (validationResult.warning) {
                await this.notificationService.sendTradeNotification({
                    symbol: trade.par,
                    type: trade.ls as 'LONG' | 'SHORT',
                    entry: trade.entry,
                    stop: trade.stop,
                    takeProfits: {
                        tp1: trade.tp1,
                        tp2: trade.tp2,
                        tp3: trade.tp3
                    },
                    validation: validationResult,
                    analysisUrl: trade.url_analysis,
                    isWarning: true
                });
            }

            if (validationResult.isValid) {
                validCount++;

                const { data: klineData, source } = await this.dataServiceManager.getKlineData(trade.par);
                this.consoleChartService.drawChart(klineData, trade.par);

                // Execute the trade using TradeExecutor
                try {
                    const executionResult = await this.tradeExecutor.executeTrade({
                        symbol: trade.par,
                        type: trade.ls as 'LONG' | 'SHORT',
                        entry: trade.entry,
                        stop: trade.stop,
                        tp1: trade.tp1,
                        tp2: trade.tp2,
                        tp3: trade.tp3
                    });

                    if (executionResult.success) {
                        console.log('\nTrade Execution Results:');
                        console.log(`Status: ${executionResult.message}`);
                        console.log(`Leverage: ${executionResult.data?.leverage.optimalLeverage}x`);
                        console.log(`Quantity: ${executionResult.data?.quantity}`);
                        console.log('----------------------------------------');
                    } else {
                        console.error('\nTrade Execution Failed:');
                        console.error(`Error: ${executionResult.message}`);
                        console.log('----------------------------------------');
                    }

                    // Send notification for valid trade
                    await this.notificationService.sendTradeNotification({
                        symbol: trade.par,
                        type: trade.ls as 'LONG' | 'SHORT',
                        entry: trade.entry,
                        stop: trade.stop,
                        takeProfits: {
                            tp1: trade.tp1,
                            tp2: trade.tp2,
                            tp3: trade.tp3
                        },
                        validation: validationResult,
                        analysisUrl: trade.url_analysis,
                        executionResult: executionResult.success && executionResult.data ? {
                            leverage: executionResult.data.leverage.optimalLeverage,
                            quantity: executionResult.data.quantity,
                            entryOrderId: executionResult.data.entryOrder.data.orderId,
                            stopOrderId: executionResult.data.stopOrder.data.orderId
                        } : undefined,
                        executionError: !executionResult.success ? executionResult.message : undefined
                    });
                } catch (error) {
                    console.error('Failed to execute trade:', error);
                    // Send notification about execution failure
                    await this.notificationService.sendTradeNotification({
                        symbol: trade.par,
                        type: trade.ls as 'LONG' | 'SHORT',
                        entry: trade.entry,
                        stop: trade.stop,
                        takeProfits: {
                            tp1: trade.tp1,
                            tp2: trade.tp2,
                            tp3: trade.tp3
                        },
                        validation: validationResult,
                        analysisUrl: trade.url_analysis,
                        executionError: error instanceof Error ? error.message : undefined
                    });
                }
            }
        }

        if (validCount === 0) {
            console.log('No valid trades at this time.');
        }

        console.log('\n================================\n');
    }

    public execute(): void {
        // Schedule the job to run at minute 2 of every hour
        //cron.schedule('1 * * * *', async () => {
        cron.schedule('* * * * *', async () => {
            const trades = this.readTrades();
            await this.processAndDisplayTrades(trades);
            
        });

        console.log('Trade cron job started. Will run at minute 2 of every hour.');
    }
} 