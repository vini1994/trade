import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

interface Trade {
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    tp1: number;
    tp2: number;
    tp3: number;
}

interface Order {
    code: number;
    msg: string;
    data: {
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
    };
}

interface TradeRecord {
    id: number;
    symbol: string;
    type: 'LONG' | 'SHORT';
    entry: number;
    stop: number;
    tp1: number;
    tp2: number;
    tp3: number;
    entryOrderId: string;
    stopOrderId: string;
    tp1OrderId: string | null;
    tp2OrderId: string | null;
    tp3OrderId: string | null;
    trailingStopOrderId: string | null;
    quantity: number;
    leverage: number;
    status: 'OPEN' | 'CLOSED';
    createdAt: string;
    updatedAt: string;
}

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
                tp1 REAL NOT NULL,
                tp2 REAL NOT NULL,
                tp3 REAL NOT NULL,
                entryOrderId TEXT NOT NULL,
                stopOrderId TEXT NOT NULL,
                tp1OrderId TEXT,
                tp2OrderId TEXT,
                tp3OrderId TEXT,
                trailingStopOrderId TEXT,
                quantity REAL NOT NULL,
                leverage INTEGER NOT NULL,
                status TEXT NOT NULL,
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
    }

    public async saveTrade(
        trade: Trade,
        orders: {
            entryOrder: Order;
            stopOrder: Order;
            tpOrders: Order[];
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
                entryOrderId,
                stopOrderId,
                tp1OrderId,
                tp2OrderId,
                tp3OrderId,
                trailingStopOrderId,
                quantity,
                leverage,
                status,
                createdAt,
                updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            trade.symbol,
            trade.type,
            trade.entry,
            trade.stop,
            trade.tp1,
            trade.tp2,
            trade.tp3,
            orders.entryOrder.data.orderId,
            orders.stopOrder.data.orderId,
            orders.tpOrders[0]?.data.orderId || null,
            orders.tpOrders[1]?.data.orderId || null,
            orders.tpOrders[2]?.data.orderId || null,
            orders.tpOrders[3]?.data.orderId || null,
            quantity,
            leverage,
            'OPEN',
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
            tp1OrderId?: string;
            tp2OrderId?: string;
            tp3OrderId?: string;
            trailingStopOrderId?: string;
        }
    ): Promise<void> {
        const updates = [];
        const values = [];

        if (orderIds.tp1OrderId) {
            updates.push('tp1OrderId = ?');
            values.push(orderIds.tp1OrderId);
        }
        if (orderIds.tp2OrderId) {
            updates.push('tp2OrderId = ?');
            values.push(orderIds.tp2OrderId);
        }
        if (orderIds.tp3OrderId) {
            updates.push('tp3OrderId = ?');
            values.push(orderIds.tp3OrderId);
        }
        if (orderIds.trailingStopOrderId) {
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
} 