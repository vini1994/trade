import { BinanceDataService } from './BinanceDataService';
import { BingXDataService } from './BingXDataService';
import { BinanceFuturesDataService } from './BinanceFuturesDataService';
import { KlineData } from './utils/types';

export class DataServiceManager {
    private binanceFuturesService: BinanceFuturesDataService;
    private bingxService: BingXDataService;
    private binanceService: BinanceDataService;

    constructor() {
        this.binanceFuturesService = new BinanceFuturesDataService();
        this.bingxService = new BingXDataService();
        this.binanceService = new BinanceDataService();
    }

    public async getKlineData(symbol: string): Promise<{ data: KlineData[]; source: 'binance_futures' | 'bingx' | 'binance' }> {
        // Try Binance Futures first
        try {
            console.log(`Attempting to fetch data from Binance Futures for ${symbol}...`);
            const futuresData = await this.binanceFuturesService.getKlineData(symbol);
            const sortedData = [...futuresData].sort((a, b) => b.closeTime - a.closeTime);
            const dataToCheck = [...sortedData]
            console.log('Successfully fetched data from Binance Futures');
            return { data: dataToCheck, source: 'binance_futures' };
        } catch (futuresError: any) {
            console.log(`Failed to fetch data from Binance Futures: ${futuresError.message}`);
            
            // Try BingX next
            try {
                console.log(`Attempting to fetch data from BingX for ${symbol}...`);
                const bingxData = await this.bingxService.getKlineData(symbol);
                const sortedData = [...bingxData].sort((a, b) => b.closeTime - a.closeTime);
                const dataToCheck = [...sortedData].slice(1)
        
                console.log('Successfully fetched data from BingX');
                return { data: dataToCheck, source: 'bingx' };
            } catch (bingxError: any) {
                console.log(`Failed to fetch data from BingX: ${bingxError.message}`);
                
                // Finally try Binance Spot
                try {
                    console.log(`Attempting to fetch data from Binance Spot for ${symbol}...`);
                    const binanceData = await this.binanceService.getKlineData(symbol);
                    const sortedData = [...binanceData].sort((a, b) => b.closeTime - a.closeTime);
                    const dataToCheck = [...sortedData].slice(1)
                    console.log('Successfully fetched data from Binance Spot');
                    return { data: dataToCheck, source: 'binance' };
                } catch (binanceError: any) {
                    console.error(`Failed to fetch data from all services for ${symbol}`);
                    console.error('Binance Futures error:', futuresError);
                    console.error('BingX error:', bingxError);
                    console.error('Binance Spot error:', binanceError);
                    throw new Error(`Failed to fetch data for ${symbol} from all services`);
                }
            }
        }
    }

    public async getKlineDataWithRetry(symbol: string, maxRetries: number = 3): Promise<{ data: KlineData[]; source: 'binance_futures' | 'bingx' | 'binance' }> {
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