import { TradeCronJob } from './TradeCronJob';
import { PositionMonitorCronJob } from './PositionMonitorCronJob';

// Start trade cron job
const tradeCronJob = new TradeCronJob();
tradeCronJob.execute();

// Check for required environment variables
const bingxApiKey = process.env.BINGX_API_KEY;
const bingxApiSecret = process.env.BINGX_API_SECRET;

// Start position monitor cron job only if API credentials are available
if (bingxApiKey && bingxApiSecret) {
    const positionMonitorCron = new PositionMonitorCronJob();
    positionMonitorCron.start().catch((error: Error) => {
        console.error('Error starting PositionMonitorCronJob:', error);
        process.exit(1);
    });

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\nGracefully shutting down...');
        positionMonitorCron.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\nGracefully shutting down...');
        positionMonitorCron.stop();
        process.exit(0);
    });
} else {
    console.log('Skipping PositionMonitorCronJob: BingX API credentials not found in environment variables');
} 