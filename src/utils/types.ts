import { BingXWebSocket } from '../BingXWebSocket';
import { Order } from '../OrderMonitor';

export interface KlineData {
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    quoteAssetVolume: string;
    numberOfTrades: number;
    takerBuyBaseAssetVolume: string;
    takerBuyQuoteAssetVolume: string;
}

export interface Trade {
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    tp1: number | null;
    tp2: number | null;
    tp3: number | null;
    tp4: number | null;
    tp5: number | null;
    tp6: number | null;
    volume_adds_margin: boolean;
    setup_description: string | null;
    volume_required: boolean;
    modify_tp1?: boolean | false;
}

export interface BingXOrderResponse {
    code: number;
    msg: string;
    data: { 
        order:{
            orderId: string;
            clientOrderId: string;
            symbol: string;
            side: string;
            positionSide: string;
            type: string;
            price: string;
            stopPrice: string;
            quantity: string;
            status: string;
        }
    };
}

export interface TradeRecord extends Trade {
    id: number;
    entryOrderId: string;
    stopOrderId: string;
    tp1OrderId: string | null;
    tp2OrderId: string | null;
    tp3OrderId: string | null;
    tp4OrderId: string | null;
    tp5OrderId: string | null;
    tp6OrderId: string | null;
    trailingStopOrderId: string | null;
    quantity: number;
    leverage: number;
    status: 'OPEN' | 'CLOSED';
}

export interface TradeExecutionResult {
    success: boolean;
    message: string;
    data?: {
        entryOrder: BingXOrderResponse;
        stopOrder: BingXOrderResponse;
        tpOrders: BingXOrderResponse[];
        leverage: {
            optimalLeverage: number;
            theoreticalMaxLeverage: number;
            exchangeMaxLeverage: number;
            stopLossPercentage: number;
        };
        quantity: number;
        tradeRecord: TradeRecord;
        volumeMarginAdded?: {
            percentage: number;
            baseMargin: number;
            totalMargin: number;
        };
    };
}

export interface OrderDetails {
    status: string;
    executedQuantity: number;
    averagePrice: number;
    createTime: number;
    updateTime: number;
    isFilled: boolean;
    isCanceled: boolean;
    isOpen: boolean;
    pnl: number;
    fee: number;
    feeType?: 'LIMIT' | 'MAKER';
    result: number;
}

export interface Position {
    symbol: string;
    positionSide: 'LONG' | 'SHORT';
    positionAmt: string;
    avgPrice: string;
    markPrice: string;
    unRealizedProfit: string;
    liquidationPrice: string;
    leverage: string;
}

export interface BingXPositionResponse {
    code: number;
    msg: string;
    data: Position[];
}

export interface MonitoredPosition {
    symbol: string;
    positionSide: 'LONG' | 'SHORT';
    position: Position;
    websocket: BingXWebSocket;
    tradeId?: number;
    lastPrice?: number;
    stopLossOrder?: Order;
    initialStopPrice?: number;
    entryPrice?: number;
    leverage?: number;
}

export interface TradeNotification {
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    takeProfits: {
        tp1: number | null;
        tp2: number | null;
        tp3: number | null;
        tp4: number | null;
        tp5: number | null;
        tp6: number | null;
    };
    validation: {
        isValid: boolean;
        message: string;
        volumeAnalysis: {
            color: string;
            stdBar: number;
            currentVolume: number;
            mean: number;
            std: number;
        };
        entryAnalysis: {
            currentClose: number;
            canEnter: boolean;
            hasClosePriceBeforeEntry: boolean;
            message: string;
        };
    };
    analysisUrl: string;
    executionResult?: {
        leverage: number;
        quantity: number;
        entryOrderId: string;
        stopOrderId: string;
        volumeMarginAdded?: {
            percentage: number;
            baseMargin: number;
            totalMargin: number;
        };
    };
    executionError?: string;
    timestamp: string;
    isWarning?: boolean;
    volume_required: boolean;
    volume_adds_margin: boolean;
    setup_description: string | null;
    manually_generated?: boolean;
} 