import * as cron from 'node-cron';
import { PositionMonitor } from './PositionMonitor';
import { TradeOrderProcessor } from './TradeOrderProcessor';

export class PositionMonitorCronJob {
    private positionMonitor: PositionMonitor;
    private tradeOrderProcessor: TradeOrderProcessor;
    private isRunning: boolean = false;

    constructor() {
        // Create PositionMonitor with a callback to log price updates
        this.positionMonitor = new PositionMonitor((position) => {
            if (position.lastPrice) {
                console.log(`[${new Date().toLocaleString()}] ${position.symbol} ${position.positionSide} - Price: ${position.lastPrice}`);
                if (position.stopLossOrder) {
                    console.log(`Stop Loss: ${position.stopLossOrder.stopPrice}`);
                }
            }
        });
        this.tradeOrderProcessor = new TradeOrderProcessor();
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            console.log('PositionMonitorCronJob is already running');
            return;
        }


        // Schedule the job to run every minute
        cron.schedule('* * * * *', async () => {
            try {
                console.log(`\n[${new Date().toLocaleString()}] Running position update...`);
                await this.positionMonitor.updatePositions();
                const monitoredPositions = this.positionMonitor.getMonitoredPositionsMap();
                await this.tradeOrderProcessor.processTrades(monitoredPositions);
                
                // Log current monitored positions
                const positions = this.positionMonitor.getMonitoredPositions();
                if (positions.length > 0) {
                    console.log('\nCurrent monitored positions:');
                    positions.forEach(pos => {
                        console.log(`- ${pos.symbol} ${pos.positionSide}`);
                        console.log(`  Entry: ${pos.entryPrice}`);
                        console.log(`  Current Price: ${pos.lastPrice}`);
                        if (pos.stopLossOrder) {
                            console.log(`  Stop Loss: ${pos.stopLossOrder.stopPrice}`);
                        }
                        console.log('---');
                    });
                } else {
                    console.log('No positions currently being monitored');
                }
            } catch (error) {
                console.error('Error updating positions:', error);
            }
        });

        this.isRunning = true;
        console.log('PositionMonitorCronJob started. Will run every minute.');
    }

    public stop(): void {
        if (!this.isRunning) {
            console.log('PositionMonitorCronJob is not running');
            return;
        }

        // Disconnect all websockets
        this.positionMonitor.disconnect();
        this.isRunning = false;
        console.log('PositionMonitorCronJob stopped');
    }
} 