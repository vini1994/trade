import { TradeCronJob } from './TradeCronJob';
import { PositionMonitorCronJob } from './PositionMonitorCronJob';

// Start trade cron job
const tradeCronJob = new TradeCronJob();
tradeCronJob.execute();

// Start position monitor cron job
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