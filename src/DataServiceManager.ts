import { BinanceDataService } from './BinanceDataService';
import { BingXDataService } from './BingXDataService';
import { KlineData } from './utils/types';

export class DataServiceManager {
    private binanceService: BinanceDataService;
    private bingxService: BingXDataService;

    constructor() {
        this.binanceService = new BinanceDataService();
        this.bingxService = new BingXDataService();
    }

    public async getKlineData(symbol: string): Promise<{ data: KlineData[]; source: 'binance' | 'bingx' }> {
        try {
            console.log(`Attempting to fetch data from Binance for ${symbol}...`);
            const binanceData = await this.binanceService.getKlineData(symbol);
            console.log('Successfully fetched data from Binance');
            return { data: binanceData, source: 'binance' };
        } catch (error: any) {
            console.log(`Failed to fetch data from Binance: ${error.message}`);
            console.log(`Attempting to fetch data from BingX for ${symbol}...`);
            
            try {
                const bingxData = await this.bingxService.getKlineData(symbol);
                console.log('Successfully fetched data from BingX');
                return { data: bingxData, source: 'bingx' };
            } catch (bingxError: any) {
                console.error(`Failed to fetch data from both services for ${symbol}`);
                console.error('Binance error:', error);
                console.error('BingX error:', bingxError);
                throw new Error(`Failed to fetch data for ${symbol} from both services`);
            }
        }
    }

    public async getKlineDataWithRetry(symbol: string, maxRetries: number = 3): Promise<{ data: KlineData[]; source: 'binance' | 'bingx' }> {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.getKlineData(symbol);
            } catch (error: any) {
                lastError = new Error(error.message);
                console.log(`Attempt ${attempt}/${maxRetries} failed. Retrying...`);
                // Wait for 1 second before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        throw lastError || new Error(`Failed to fetch data after ${maxRetries} attempts`);
    }
} 