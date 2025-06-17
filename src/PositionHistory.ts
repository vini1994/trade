import { BingXApiClient } from './services/BingXApiClient';
import { DatabasePositionHistoryService } from './services/DatabasePositionHistoryService';
import { normalizeSymbolBingX } from './utils/bingxUtils';
import { PositionHistory as PositionHistoryType, BingXPositionHistoryResponse } from './utils/types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface PositionHistoryParams {
    symbol: string;
    startTs?: number;
    endTs?: number;
    pageIndex?: number;
    pageSize?: number;
    useCache?: boolean;
}

export class PositionHistory {
    private readonly apiClient: BingXApiClient;
    private readonly dbService: DatabasePositionHistoryService;

    constructor() {
        this.apiClient = new BingXApiClient();
        this.dbService = DatabasePositionHistoryService.getInstance();
        this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.dbService.initialize();
    }

    public async getPositionHistory(params: PositionHistoryParams): Promise<PositionHistoryType[]> {
        const { useCache = true, ...requestParams } = params;

        // Set default values for startTs and endTs if not provided
        const now = Date.now();
        const threeMonthsAgo = now - (3 * 30 * 24 * 60 * 60 * 1000); // 3 months in milliseconds
        
        const apiParams: Record<string, string | number> = {
            symbol: normalizeSymbolBingX(requestParams.symbol),
            startTs: requestParams.startTs || threeMonthsAgo,
            endTs: requestParams.endTs || now
        };

        if (requestParams.pageIndex) apiParams.pageIndex = requestParams.pageIndex;
        if (requestParams.pageSize) apiParams.pageSize = requestParams.pageSize;

        let allPositions: PositionHistoryType[] = [];
        let maxCloseTimeFromCache = 0;

        // First, try to get from cache if enabled
        if (useCache) {
            try {
                const cachedData = await this.dbService.getPositionHistory(
                    requestParams.symbol,
                    apiParams.startTs as number,
                    apiParams.endTs as number,
                    requestParams.pageIndex,
                    requestParams.pageSize
                );
                
                if (cachedData.length > 0) {
                    allPositions = cachedData;
                    // Find the maximum closeTime from cache
                    maxCloseTimeFromCache = Math.max(...cachedData.map(pos => pos.closeTime));
                    console.log(`Found ${cachedData.length} positions in cache, max closeTime: ${new Date(maxCloseTimeFromCache).toISOString()}`);
                }
            } catch (error) {
                console.warn('Error reading from cache:', error);
            }
        }

        // If we have cached data, query API only for newer records
        if (maxCloseTimeFromCache > 0) {
            const apiParamsForNewData: Record<string, string | number> = {
                symbol: normalizeSymbolBingX(requestParams.symbol),
                startTs: maxCloseTimeFromCache + 1, // Start from the next millisecond after the latest cached record
                endTs: apiParams.endTs
            };

            if (requestParams.pageIndex) apiParamsForNewData.pageIndex = requestParams.pageIndex;
            if (requestParams.pageSize) apiParamsForNewData.pageSize = requestParams.pageSize;

            try {
                const path = '/openApi/swap/v1/trade/positionHistory';
                const response = await this.apiClient.get<BingXPositionHistoryResponse>(path, apiParamsForNewData);
                
                if (response.code === 0 && response.data && response.data.length > 0) {
                    console.log(`Found ${response.data.length} new positions from API`);
                    
                    // Save new data to cache
                    if (useCache) {
                        try {
                            await this.dbService.savePositionHistory(response.data);
                        } catch (error) {
                            console.warn('Error saving new data to cache:', error);
                        }
                    }
                    
                    // Combine cached and new data
                    allPositions = [...allPositions, ...response.data];
                }
            } catch (error) {
                console.error('Error fetching new position history from API:', error);
            }
        } else {
            // No cache data, fetch all data from API
            const path = '/openApi/swap/v1/trade/positionHistory';

            try {
                const response = await this.apiClient.get<BingXPositionHistoryResponse>(path, apiParams);
                if (response.code !== 0) {
                    console.warn(`API returned non-zero code: ${response.code}, message: ${response.msg}`);
                    return [];
                }

                const positions = response.data || [];
                
                // Save to cache if we got data
                if (positions.length > 0 && useCache) {
                    try {
                        await this.dbService.savePositionHistory(positions);
                    } catch (error) {
                        console.warn('Error saving to cache:', error);
                    }
                }

                allPositions = positions;
            } catch (error) {
                console.error('Error fetching position history:', error);
                return [];
            }
        }

        return allPositions;
    }

    public async getPositionHistoryByTimeRange(
        symbol: string,
        startTime: Date,
        endTime: Date,
        pageIndex: number = 1,
        pageSize: number = 100
    ): Promise<PositionHistoryType[]> {
        const params: PositionHistoryParams = {
            symbol,
            startTs: startTime.getTime(),
            endTs: endTime.getTime(),
            pageIndex,
            pageSize
        };

        return this.getPositionHistory(params);
    }

    public async getPositionHistoryBySymbol(
        symbol: string,
        pageIndex: number = 1,
        pageSize: number = 100
    ): Promise<PositionHistoryType[]> {
        const params: PositionHistoryParams = {
            symbol,
            pageIndex,
            pageSize
        };

        return this.getPositionHistory(params);
    }

    public async clearCache(): Promise<void> {
        await this.dbService.clearCache();
    }

    /**
     * Creates or updates the cache for a list of symbols
     * @param symbols Array of symbols to update in cache
     * @returns Promise that resolves when all symbols are processed
     */
    public async createOrUpdateCache(symbols: string[]): Promise<void> {
        console.log(`Starting cache update for ${symbols.length} symbols...`);
        
        for (const symbol of symbols) {
            try {
                console.log(`Updating cache for symbol: ${symbol}`);
                
                // Get the latest position from cache to determine startTs
                const cachedData = await this.dbService.getPositionHistory(
                    symbol,
                    undefined, // startTs
                    undefined, // endTs
                    1,        // pageIndex
                    1         // pageSize - we only need the latest record
                );

                let startTs: number | undefined;
                if (cachedData.length > 0) {
                    // Sort by closeTime in descending order and get the most recent
                    const latestPosition = cachedData.sort((a, b) => b.closeTime - a.closeTime)[0];
                    startTs = latestPosition.closeTime;
                    console.log(`Using startTs from latest cached position: ${new Date(startTs).toISOString()}`);
                } else {
                    console.log('No cached data found, will fetch from beginning');
                }

                // Using getPositionHistory with the determined startTs
                await this.getPositionHistory({
                    symbol,
                    startTs,
                    useCache: false
                });
                console.log(`Successfully updated cache for symbol: ${symbol}`);
            } catch (error) {
                console.error(`Error updating cache for symbol ${symbol}:`, error);
                // Continue with next symbol even if one fails
            }
        }
        
        console.log('Cache update completed');
    }
} 