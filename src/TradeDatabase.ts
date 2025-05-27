import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import { Trade, TradeRecord, BingXOrderResponse, OrderDetails } from './utils/types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class TradeDatabase {
    private db: any;

    constructor() {
        this.initializeDatabase();
    }

    private async initializeDatabase() {
        const dbPath = path.join(__dirname, '../db/trades.db');
        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                type TEXT NOT NULL,
                entry REAL NOT NULL,
                stop REAL NOT NULL,
                tp1 REAL,
                tp2 REAL,
                tp3 REAL,
                tp4 REAL,
                tp5 REAL,
                tp6 REAL,
                entryOrderId TEXT NOT NULL,
                stopOrderId TEXT NOT NULL,
                tp1OrderId TEXT,
                tp2OrderId TEXT,
                tp3OrderId TEXT,
                tp4OrderId TEXT,
                tp5OrderId TEXT,
                tp6OrderId TEXT,
                trailingStopOrderId TEXT,
                quantity REAL NOT NULL,
                leverage INTEGER NOT NULL,
                status TEXT NOT NULL,
                volume_adds_margin BOOLEAN NOT NULL DEFAULT 0,
                setup_description TEXT,
                volume_required BOOLEAN NOT NULL DEFAULT 0,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS order_details (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tradeId INTEGER NOT NULL,
                orderId TEXT NOT NULL,
                status TEXT NOT NULL,
                executedQuantity REAL,
                averagePrice REAL,
                createTime TEXT,
                updateTime TEXT,
                isFilled BOOLEAN,
                isCanceled BOOLEAN,
                isOpen BOOLEAN,
                pnl REAL,
                fee REAL,
                feeType TEXT,
                result REAL,
                createdAt TEXT NOT NULL,
                FOREIGN KEY (tradeId) REFERENCES trades(id)
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS trade_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tradeId INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                pair TEXT NOT NULL,
                side TEXT NOT NULL,
                positionSide TEXT NOT NULL,
                type TEXT NOT NULL,
                price REAL,
                stopPrice REAL,
                quantity REAL,
                orderResponse TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                FOREIGN KEY (tradeId) REFERENCES trades(id)
            )
        `);
    }

    public async saveTrade(
        trade: Trade,
        orders: {
            entryOrder: BingXOrderResponse;
            stopOrder: BingXOrderResponse;
            tpOrders: BingXOrderResponse[];
        },
        quantity: number,
        leverage: number
    ): Promise<TradeRecord> {
        const now = new Date().toISOString();
        
        const result = await this.db.run(`
            INSERT INTO trades (
                symbol,
                type,
                entry,
                stop,
                tp1,
                tp2,
                tp3,
                tp4,
                tp5,
                tp6,
                entryOrderId,
                stopOrderId,
                tp1OrderId,
                tp2OrderId,
                tp3OrderId,
                tp4OrderId,
                tp5OrderId,
                tp6OrderId,
                trailingStopOrderId,
                quantity,
                leverage,
                status,
                volume_adds_margin,
                setup_description,
                volume_required,
                createdAt,
                updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trade.symbol,
            trade.type,
            trade.entry,
            trade.stop,
            trade.tp1,
            trade.tp2,
            trade.tp3,
            trade.tp4,
            trade.tp5,
            trade.tp6,
            orders.entryOrder.data.order.orderId,
            orders.stopOrder.data.order.orderId,
            orders.tpOrders[0]?.data.order.orderId || null,
            orders.tpOrders[1]?.data.order.orderId || null,
            orders.tpOrders[2]?.data.order.orderId || null,
            orders.tpOrders[3]?.data.order.orderId || null,
            orders.tpOrders[4]?.data.order.orderId || null,
            orders.tpOrders[5]?.data.order.orderId || null,
            orders.tpOrders[6]?.data.order.orderId || null,
            quantity,
            leverage,
            'OPEN',
            trade.volume_adds_margin ? 1 : 0,
            trade.setup_description,
            trade.volume_required ? 1 : 0,
            now,
            now
        ]);

        return this.getTradeById(result.lastID);
    }

    public async getTradeById(id: number): Promise<TradeRecord> {
        return await this.db.get('SELECT * FROM trades WHERE id = ?', [id]);
    }

    public async getOpenTrades(): Promise<TradeRecord[]> {
        return await this.db.all('SELECT * FROM trades WHERE status = ?', ['OPEN']);
    }

    public async getClosedTrades(): Promise<TradeRecord[]> {
        return await this.db.all('SELECT * FROM trades WHERE status = ?', ['CLOSED']);
    }

    public async updateTradeStatus(id: number, status: 'OPEN' | 'CLOSED'): Promise<void> {
        const now = new Date().toISOString();
        await this.db.run(
            'UPDATE trades SET status = ?, updatedAt = ? WHERE id = ?',
            [status, now, id]
        );
    }

    public async updateOrderIds(
        id: number,
        orderIds: {
            tp1OrderId?: string | null;
            tp2OrderId?: string | null;
            tp3OrderId?: string | null;
            tp4OrderId?: string | null;
            tp5OrderId?: string | null;
            tp6OrderId?: string | null;
            trailingStopOrderId?: string | null;
            entryOrderId?: string;
            stopOrderId?: string;
        }
    ): Promise<void> {
        const updates = [];
        const values = [];

        if ('entryOrderId' in orderIds) {
            updates.push('entryOrderId = ?');
            values.push(orderIds.entryOrderId);
        }
        if ('stopOrderId' in orderIds) {
            updates.push('stopOrderId = ?');
            values.push(orderIds.stopOrderId);
        }
        if ('tp1OrderId' in orderIds) {
            updates.push('tp1OrderId = ?');
            values.push(orderIds.tp1OrderId);
        }
        if ('tp2OrderId' in orderIds) {
            updates.push('tp2OrderId = ?');
            values.push(orderIds.tp2OrderId);
        }
        if ('tp3OrderId' in orderIds) {
            updates.push('tp3OrderId = ?');
            values.push(orderIds.tp3OrderId);
        }
        if ('tp4OrderId' in orderIds) {
            updates.push('tp4OrderId = ?');
            values.push(orderIds.tp4OrderId);
        }
        if ('tp5OrderId' in orderIds) {
            updates.push('tp5OrderId = ?');
            values.push(orderIds.tp5OrderId);
        }
        if ('tp6OrderId' in orderIds) {
            updates.push('tp6OrderId = ?');
            values.push(orderIds.tp6OrderId);
        }
        if ('trailingStopOrderId' in orderIds) {
            updates.push('trailingStopOrderId = ?');
            values.push(orderIds.trailingStopOrderId);
        }

        if (updates.length > 0) {
            const now = new Date().toISOString();
            updates.push('updatedAt = ?');
            values.push(now);
            values.push(id);

            await this.db.run(
                `UPDATE trades SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }
    }

    public async saveOrderDetails(
        tradeId: number,
        orderId: string,
        details: {
            status: string;
            executedQuantity: number;
            averagePrice: number;
            createTime: Date;
            updateTime: Date;
            isFilled: boolean;
            isCanceled: boolean;
            isOpen: boolean;
            pnl?: number;
            fee?: number;
            feeType?: 'LIMIT' | 'MAKER';
            result?: number;
        }
    ): Promise<void> {
        const now = new Date().toISOString();
        
        await this.db.run(`
            INSERT INTO order_details (
                tradeId,
                orderId,
                status,
                executedQuantity,
                averagePrice,
                createTime,
                updateTime,
                isFilled,
                isCanceled,
                isOpen,
                pnl,
                fee,
                feeType,
                result,
                createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tradeId,
            orderId,
            details.status,
            details.executedQuantity,
            details.averagePrice,
            details.createTime.toISOString(),
            details.updateTime.toISOString(),
            details.isFilled ? 1 : 0,
            details.isCanceled ? 1 : 0,
            details.isOpen ? 1 : 0,
            details.pnl || null,
            details.fee || null,
            details.feeType || null,
            details.result || null,
            now
        ]);
    }

    public async hasOrderDetails(orderId: string): Promise<boolean> {
        const result = await this.db.get(
            'SELECT COUNT(*) as count FROM order_details WHERE orderId = ?',
            [orderId]
        );
        return result.count > 0;
    }

    public async saveTradeLog(
        tradeId: number,
        pair: string,
        side: 'BUY' | 'SELL',
        positionSide: 'LONG' | 'SHORT',
        type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TRIGGER_LIMIT' | 'TRAILING_STOP_MARKET',
        price: number | null,
        stopPrice: number | null,
        quantity: number,
        orderResponse: BingXOrderResponse
    ): Promise<void> {
        const now = new Date().toISOString();
        
        await this.db.run(`
            INSERT INTO trade_logs (
                tradeId,
                timestamp,
                pair,
                side,
                positionSide,
                type,
                price,
                stopPrice,
                quantity,
                orderResponse,
                createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tradeId,
            now,
            pair,
            side,
            positionSide,
            type,
            price,
            stopPrice,
            quantity,
            JSON.stringify(orderResponse),
            now
        ]);
    }

    public async getTradeLogs(tradeId: number): Promise<any[]> {
        return await this.db.all('SELECT * FROM trade_logs WHERE tradeId = ? ORDER BY timestamp DESC', [tradeId]);
    }
} 