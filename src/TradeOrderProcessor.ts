import { TradeDatabase } from './TradeDatabase';
import { OrderStatusChecker } from './OrderStatusChecker';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class TradeOrderProcessor {
    private readonly tradeDatabase: TradeDatabase;
    private readonly orderStatusChecker: OrderStatusChecker;
    private readonly limitOrderFee: number;
    private readonly makerOrderFee: number;

    constructor() {
        this.tradeDatabase = new TradeDatabase();
        this.orderStatusChecker = new OrderStatusChecker();
        this.limitOrderFee = parseFloat(process.env.BINGX_LIMIT_ORDER_FEE || '0.0002');
        this.makerOrderFee = parseFloat(process.env.BINGX_MAKER_ORDER_FEE || '0.0001');
    }

    public async processTrades(): Promise<void> {
        try {
            // Get all open trades from the database
            const openTrades = await this.tradeDatabase.getOpenTrades();
            console.log(`Found ${openTrades.length} open trades to process`);

            for (const trade of openTrades) {
                await this.processTrade(trade);
            }
        } catch (error) {
            console.error('Error processing trades:', error);
            throw error;
        }
    }

    private async processTrade(trade: any): Promise<void> {
        try {
            // Collect all order IDs that need to be checked
            const orderIds = [
                trade.entryOrderId,
                trade.stopOrderId,
                trade.tp1OrderId,
                trade.tp2OrderId,
                trade.tp3OrderId,
                trade.trailingStopOrderId
            ].filter(id => id !== null);

            // Get status for all orders
            const orderStatuses = await this.orderStatusChecker.getMultipleOrderStatus(orderIds);

            // Process each order status
            for (const [orderId, status] of orderStatuses) {
                if (!status) {
                    console.warn(`No status found for order ${orderId}`);
                    continue;
                }

                // Skip orders that are in NEW status
                if (status.status === 'NEW') {
                    console.log(`Order ${orderId} has NEW status, skipping`);
                    continue;
                }

                // Skip orders that already have details in the database
                const hasDetails = await this.tradeDatabase.hasOrderDetails(orderId);
                if (hasDetails) {
                    console.log(`Order ${orderId} already has details in database, skipping`);
                    continue;
                }

                // Get detailed status information
                const details = await this.orderStatusChecker.getOrderStatusWithDetails(orderId);
                console.log(`Order ${orderId} details:`, details);

                // Calculate PnL, fee, and result
                let pnl = 0;
                let fee = 0;
                let feeType: 'LIMIT' | 'MAKER' | undefined;
                let result = 0;

                if (details.isFilled) {
                    // Determine fee type based on order type
                    feeType = status.type === 'LIMIT' ? 'LIMIT' : 'MAKER';
                    const feeRate = feeType === 'LIMIT' ? this.limitOrderFee : this.makerOrderFee;

                    // Calculate fee with leverage
                    const orderValue = details.executionDetails.executedQuantity * details.executionDetails.averagePrice;
                    const leveragedOrderValue = orderValue * trade.leverage;
                    fee = leveragedOrderValue * feeRate;

                    // Calculate PnL for stop and take profit orders with leverage
                    if (orderId === trade.stopOrderId || 
                        orderId === trade.tp1OrderId || 
                        orderId === trade.tp2OrderId || 
                        orderId === trade.tp3OrderId) {
                        
                        const entryPrice = trade.entry;
                        const exitPrice = details.executionDetails.averagePrice;
                        const quantity = details.executionDetails.executedQuantity;
                        const leverage = trade.leverage;

                        if (trade.type === 'LONG') {
                            pnl = (exitPrice - entryPrice) * quantity * leverage;
                        } else {
                            pnl = (entryPrice - exitPrice) * quantity * leverage;
                        }

                        // Calculate final result (PnL - fee)
                        result = pnl - fee;
                    }
                }

                // Save order details to database
                await this.tradeDatabase.saveOrderDetails(trade.id, orderId, {
                    status: details.status.status,
                    executedQuantity: details.executionDetails.executedQuantity,
                    averagePrice: details.executionDetails.averagePrice,
                    createTime: details.executionDetails.createTime,
                    updateTime: details.executionDetails.updateTime,
                    isFilled: details.isFilled,
                    isCanceled: details.isCanceled,
                    isOpen: details.isOpen,
                    pnl,
                    fee,
                    feeType,
                    result
                });

                // Only mark trade as CLOSED if the order is stop or trailingStop
                if (orderId === trade.stopOrderId || orderId === trade.trailingStopOrderId) {
                    await this.tradeDatabase.updateTradeStatus(trade.id, 'CLOSED');
                    console.log(`Trade ${trade.id} marked as CLOSED - ${orderId} is ${details.status.status}`);
                    if (pnl !== 0) {
                        console.log(`PnL: ${pnl.toFixed(2)}, Fee: ${fee.toFixed(2)}, Result: ${result.toFixed(2)}`);
                        console.log(`Leverage used: ${trade.leverage}x`);
                    }
                } else {
                    console.log(`Trade ${trade.id} remains open - ${orderId} is ${details.status.status}`);
                }
            }
        } catch (error) {
            console.error(`Error processing trade ${trade.id}:`, error);
        }
    }
} 