import { BingXOrderExecutor } from './BingXOrderExecutor';
import { TradeDatabase } from './TradeDatabase';
import { PositionValidator } from './PositionValidator';

interface Trade {
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    tp1: number;
    tp2: number;
    tp3: number;
}

interface TradeExecutionResult {
    success: boolean;
    message: string;
    data?: {
        entryOrder: any;
        stopOrder: any;
        tpOrders: any[];
        leverage: {
            optimalLeverage: number;
            theoreticalMaxLeverage: number;
            exchangeMaxLeverage: number;
            stopLossPercentage: number;
        };
        quantity: number;
        tradeRecord: any;
    };
}

export class TradeExecutor {
    private readonly orderExecutor: BingXOrderExecutor;
    private readonly tradeDatabase: TradeDatabase;
    private readonly positionValidator: PositionValidator;

    constructor() {
        this.orderExecutor = new BingXOrderExecutor();
        this.tradeDatabase = new TradeDatabase();
        this.positionValidator = new PositionValidator();
    }

    /**
     * Validates a trade before execution
     * @param trade The trade to validate
     * @returns Promise<boolean> True if trade is valid, false otherwise
     */
    private async validateTrade(trade: Trade): Promise<{ isValid: boolean; message: string }> {
        // Check if trade has required fields
        if (!trade.symbol || !trade.type || !trade.entry || !trade.stop) {
            return {
                isValid: false,
                message: 'Trade is missing required fields (symbol, type, entry, or stop)'
            };
        }

        // Validate take profit levels
        if (trade.type === 'LONG') {
            // Only validate tp1 if it has a value
            if (trade.tp1 > 0 && trade.tp1 <= trade.entry) {
                return {
                    isValid: false,
                    message: 'Invalid take profit level 1 for LONG trade'
                };
            }
            // Only validate tp2 if both tp1 and tp2 have values
            if (trade.tp1 > 0 && trade.tp2 > 0 && trade.tp2 <= trade.tp1) {
                return {
                    isValid: false,
                    message: 'Invalid take profit level 2 for LONG trade'
                };
            }
            // Only validate tp3 if both tp2 and tp3 have values
            if (trade.tp2 > 0 && trade.tp3 > 0 && trade.tp3 <= trade.tp2) {
                return {
                    isValid: false,
                    message: 'Invalid take profit level 3 for LONG trade'
                };
            }
            if (trade.stop >= trade.entry) {
                return {
                    isValid: false,
                    message: 'Stop loss must be below entry price for LONG trade'
                };
            }
        } else {
            // Only validate tp1 if it has a value
            if (trade.tp1 > 0 && trade.tp1 >= trade.entry) {
                return {
                    isValid: false,
                    message: 'Invalid take profit level 1 for SHORT trade'
                };
            }
            // Only validate tp2 if both tp1 and tp2 have values
            if (trade.tp1 > 0 && trade.tp2 > 0 && trade.tp2 >= trade.tp1) {
                return {
                    isValid: false,
                    message: 'Invalid take profit level 2 for SHORT trade'
                };
            }
            // Only validate tp3 if both tp2 and tp3 have values
            if (trade.tp2 > 0 && trade.tp3 > 0 && trade.tp3 >= trade.tp2) {
                return {
                    isValid: false,
                    message: 'Invalid take profit level 3 for SHORT trade'
                };
            }
            if (trade.stop <= trade.entry) {
                return {
                    isValid: false,
                    message: 'Stop loss must be above entry price for SHORT trade'
                };
            }
        }

        // Check for existing position
        const { hasPosition, message } = await this.positionValidator.hasOpenPosition(trade.symbol, trade.type);
        if (hasPosition) {
            return {
                isValid: false,
                message: `Cannot execute trade: ${message}`
            };
        }

        return { isValid: true, message: 'Trade is valid' };
    }

    /**
     * Executes a trade using the BingXOrderExecutor
     * @param trade The trade to execute
     * @returns Promise<TradeExecutionResult> The result of the trade execution
     */
    public async executeTrade(trade: Trade): Promise<TradeExecutionResult> {
        try {
            // Validate trade before execution
            const validation = await this.validateTrade(trade);
            if (!validation.isValid) {
                return {
                    success: false,
                    message: validation.message
                };
            }

            // Execute the trade using BingXOrderExecutor
            const executionResult = await this.orderExecutor.executeTrade(trade);

            return {
                success: true,
                message: 'Trade executed successfully',
                data: executionResult
            };
        } catch (error) {
            console.error('Error executing trade:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error occurred during trade execution'
            };
        }
    }

    /**
     * Cancels an order
     * @param symbol The trading pair symbol
     * @param orderId The ID of the order to cancel
     * @returns Promise<boolean> True if order was cancelled successfully
     */
    public async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
        try {
            await this.orderExecutor.cancelOrder(symbol, orderId);
            return true;
        } catch (error) {
            console.error('Error cancelling order:', error);
            return false;
        }
    }
} 