import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { TradeValidator } from './TradeValidator';
import { DataServiceManager } from './DataServiceManager';
import { ConsoleChartService } from './ConsoleChartService';
import { NotificationService } from './NotificationService';
import { TradeExecutor } from './TradeExecutor';

const VOLUME_MARGIN_PERCENTAGE = Number(process.env.VOLUME_MARGIN_PERCENTAGE) || 10;

interface Trade {
    id: number;
    symbol: string;
    entry: number;
    stop: number;
    side: 'LONG' | 'SHORT';
    tp1: number;
    tp2: number | null;
    tp3: number | null;
    tp4: number | null;
    tp5: number | null;
    tp6: number | null;
    pair: string;
    volume: boolean;
    url_analysis: string;
    volume_required: boolean;
    volume_adds_margin: boolean;
    setup_description: string | null;
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
                symbol: trade.pair,
                type: trade.side,
                entry: trade.entry,
                stop: trade.stop,
                volume: trade.volume,
                tp1: trade.tp1,
                volume_adds_margin: trade.volume_adds_margin,
                setup_description: trade.setup_description,
                volume_required: trade.volume_required
            });

            console.log(`\nTrade #${trades.indexOf(trade) + 1}:`);
            console.log(`Pair: ${trade.pair}`);
            console.log(`Position: ${trade.side}`);
            console.log(`Entry: ${trade.entry}`);
            console.log(`Stop: ${trade.stop}`);
            console.log(`Take Profits: ${[trade.tp1, trade.tp2, trade.tp3, trade.tp4, trade.tp5, trade.tp6]
                .filter(tp => tp !== null)
                .join(', ')}`);
            console.log('\nValidation Results:');
            console.log(`Validation: ${validationResult.isValid}`);
            console.log(`Message: ${validationResult.message}`);
            console.log(`Volume Analysis: ${validationResult.volumeAnalysis.color} (StdBar: ${validationResult.volumeAnalysis.stdBar.toFixed(2)})`);
            console.log(`Current Close: ${validationResult.entryAnalysis.currentClose}`);
            console.log(`Recent Closes: ${validationResult.recentCloses}`);
            
            if (validationResult.warning) {
                console.log(`⚠️ WARNING: Trade has warning status - Entry conditions met but invalidated by other factors`);
            }
            console.log('----------------------------------------');

            // Send notification for trades with warning status
            if (validationResult.warning) {
                await this.notificationService.sendTradeNotification({
                    symbol: trade.pair,
                    type: trade.side,
                    entry: trade.entry,
                    stop: trade.stop,
                    takeProfits: {
                        tp1: trade.tp1,
                        tp2: trade.tp2,
                        tp3: trade.tp3,
                        tp4: trade.tp4,
                        tp5: trade.tp5,
                        tp6: trade.tp6
                    },
                    validation: validationResult,
                    analysisUrl: trade.url_analysis,
                    isWarning: true,
                    volume_adds_margin: trade.volume_adds_margin,
                    setup_description: trade.setup_description,
                    volume_required: trade.volume_required
                });
            }

            if (validationResult.isValid) {
                validCount++;

                const { data: klineData, source } = await this.dataServiceManager.getKlineData(trade.pair);
                this.consoleChartService.drawChart(klineData, trade.pair);

                // Execute the trade using TradeExecutor
                try {
                    const executionResult = await this.tradeExecutor.executeTrade({
                        symbol: trade.pair,
                        type: trade.side,
                        entry: trade.entry,
                        stop: trade.stop,
                        tp1: trade.tp1,
                        tp2: trade.tp2,
                        tp3: trade.tp3,
                        tp4: trade.tp4,
                        tp5: trade.tp5,
                        tp6: trade.tp6,
                        volume_adds_margin: trade.volume_adds_margin,
                        setup_description: trade.setup_description,
                        volume_required: trade.volume_required
                    });

                    if (executionResult.success) {
                        console.log('\nTrade Execution Results:');
                        console.log(`Status: ${executionResult.message}`);
                        console.log(`Leverage: ${executionResult.data?.leverage.optimalLeverage}x`);
                        console.log(`Quantity: ${executionResult.data?.quantity}`);
                        
                        // Volume margin info is now handled by TradeExecutor
                        if (executionResult.data?.volumeMarginAdded) {
                            console.log(`Volume Margin Added: ${executionResult.data.volumeMarginAdded.percentage}%`);
                            console.log(`Base Margin: ${executionResult.data.volumeMarginAdded.baseMargin.toFixed(2)}`);
                            console.log(`Total Margin: ${executionResult.data.volumeMarginAdded.totalMargin.toFixed(2)}`);
                        }
                        
                        console.log('----------------------------------------');

                        // Send notification for valid trade
                        await this.notificationService.sendTradeNotification({
                            symbol: trade.pair,
                            type: trade.side,
                            entry: trade.entry,
                            stop: trade.stop,
                            takeProfits: {
                                tp1: trade.tp1,
                                tp2: trade.tp2,
                                tp3: trade.tp3,
                                tp4: trade.tp4,
                                tp5: trade.tp5,
                                tp6: trade.tp6
                            },
                            validation: validationResult,
                            analysisUrl: trade.url_analysis,
                            volume_adds_margin: trade.volume_adds_margin,
                            setup_description: trade.setup_description,
                            volume_required: trade.volume_required,
                            executionResult: executionResult.success && executionResult.data ? {
                                leverage: executionResult.data.leverage.optimalLeverage,
                                quantity: executionResult.data.quantity,
                                entryOrderId: executionResult.data.entryOrder.data.order.orderId,
                                stopOrderId: executionResult.data.stopOrder.data.order.orderId,
                                volumeMarginAdded: executionResult.data.volumeMarginAdded
                            } : undefined,
                            executionError: !executionResult.success ? executionResult.message : undefined
                        });
                    } else {
                        console.error('\nTrade Execution Failed:');
                        console.error(`Error: ${executionResult.message}`);
                        console.log('----------------------------------------');
                    }
                } catch (error) {
                    console.error('Failed to execute trade:', error);
                    // Send notification about execution failure
                    await this.notificationService.sendTradeNotification({
                        symbol: trade.pair,
                        type: trade.side,
                        entry: trade.entry,
                        stop: trade.stop,
                        takeProfits: {
                            tp1: trade.tp1,
                            tp2: trade.tp2,
                            tp3: trade.tp3,
                            tp4: trade.tp4,
                            tp5: trade.tp5,
                            tp6: trade.tp6
                        },
                        validation: validationResult,
                        analysisUrl: trade.url_analysis,
                        executionError: error instanceof Error ? error.message : undefined,
                        volume_adds_margin: trade.volume_adds_margin,
                        setup_description: trade.setup_description,
                        volume_required: trade.volume_required
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
        // Initial execution after 30 seconds
        setTimeout(async () => {
            console.log('Executing initial trade check after 30 seconds...');
            const trades = this.readTrades();
            await this.processAndDisplayTrades(trades);
        }, 30000);

        // Schedule the job to run at minute 1 of every hour
        cron.schedule('1 * * * *', async () => {
            const trades = this.readTrades();
            await this.processAndDisplayTrades(trades);
        });

        console.log('Trade cron job started. Initial execution in 30 seconds, then will run at minute 1 of every hour.');
    }
} 