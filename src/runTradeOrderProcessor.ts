import { TradeOrderProcessor } from './TradeOrderProcessor';
import { PositionMonitor } from './PositionMonitor';

async function main() {
    try {
        // Create PositionMonitor instance
        const positionMonitor = new PositionMonitor((position) => {
            if (position.lastPrice) {
                console.log(`[${new Date().toLocaleString()}] ${position.symbol} ${position.positionSide} - Price: ${position.lastPrice}`);
                if (position.stopLossOrder) {
                    console.log(`Stop Loss: ${position.stopLossOrder.stopPrice}`);
                }
            }
        });

        // Create TradeOrderProcessor instance
        const processor = new TradeOrderProcessor();

        // Process trades every minute
        setInterval(async () => {
            try {
                console.log(`\n[${new Date().toLocaleString()}] Processing trades...`);
                // Update positions first
                await positionMonitor.updatePositions();
                // Get monitored positions as a Map
                const monitoredPositions = positionMonitor.getMonitoredPositionsMap();
                await processor.processTrades(monitoredPositions);
            } catch (error) {
                console.error('Error processing trades:', error);
            }
        }, 60000); // Run every minute

        console.log('TradeOrderProcessor started. Will process trades every minute.');
    } catch (error) {
        console.error('Error starting TradeOrderProcessor:', error);
        process.exit(1);
    }
}

// Run the main function
main().catch(console.error); 