import { BingXApiClient } from './services/BingXApiClient';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Position {
    symbol: string;
    positionSide: 'LONG' | 'SHORT';
    positionAmt: string;
    entryPrice: string;
    markPrice: string;
    unRealizedProfit: string;
    liquidationPrice: string;
    leverage: string;
}

interface BingXPositionResponse {
    code: number;
    msg: string;
    data: Position[];
}

export class PositionValidator {
    private readonly apiClient: BingXApiClient;

    constructor() {
        this.apiClient = new BingXApiClient();
    }

    public async getPositions(symbol: string): Promise<Position[]> {
        const path = '/openApi/swap/v2/user/positions';
        const params = {
            symbol: symbol
        };

        try {
            const response = await this.apiClient.get<BingXPositionResponse>(path, params);
            return response.data;
        } catch (error) {
            console.error('Error fetching positions:', error);
            throw error;
        }
    }

    public async hasOpenPosition(symbol: string, type: 'LONG' | 'SHORT'): Promise<{
        hasPosition: boolean;
        position?: Position;
        message: string;
    }> {
        try {
            const positions = await this.getPositions(symbol);
            
            // Find position for the specified type
            const position = positions ? positions.find(p => 
                p.symbol === symbol && 
                p.positionSide === type && 
                parseFloat(p.positionAmt) !== 0
            ) : undefined;

            if (position) {
                return {
                    hasPosition: true,
                    position,
                    message: `Found open ${type} position for ${symbol} with amount ${position.positionAmt}`
                };
            }

            return {
                hasPosition: false,
                message: `No open ${type} position found for ${symbol}`
            };
        } catch (error) {
            console.error(`Error checking position for ${symbol}:`, error);
            throw error;
        }
    }

    public async getPositionDetails(symbol: string, type: 'LONG' | 'SHORT'): Promise<{
        position: Position | null;
        details: {
            entryPrice: number;
            markPrice: number;
            unrealizedProfit: number;
            liquidationPrice: number;
            leverage: number;
            positionAmount: number;
        } | null;
    }> {
        try {
            const { hasPosition, position } = await this.hasOpenPosition(symbol, type);

            if (!hasPosition || !position) {
                return {
                    position: null,
                    details: null
                };
            }

            return {
                position,
                details: {
                    entryPrice: parseFloat(position.entryPrice),
                    markPrice: parseFloat(position.markPrice),
                    unrealizedProfit: parseFloat(position.unRealizedProfit),
                    liquidationPrice: parseFloat(position.liquidationPrice),
                    leverage: parseFloat(position.leverage),
                    positionAmount: parseFloat(position.positionAmt)
                }
            };
        } catch (error) {
            console.error(`Error getting position details for ${symbol}:`, error);
            throw error;
        }
    }
} 