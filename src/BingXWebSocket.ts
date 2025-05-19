import WebSocket from 'ws';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface PriceData {
    symbol: string;
    price: number;
    timestamp: number;
    volume24h?: number;
    priceChange24h?: number;
}

export class BingXWebSocket {
    private ws: WebSocket | null = null;
    private readonly baseUrl: string;
    private readonly symbol: string;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private readonly PING_INTERVAL = 30000; // 30 seconds
    private readonly RECONNECT_DELAY = 60000; // 1 minute
    private lastPongTime: number = Date.now();
    private onPriceUpdate: ((data: PriceData) => void) | null = null;

    constructor(symbol: string, onPriceUpdate?: (data: PriceData) => void) {
        this.baseUrl = process.env.BINGX_WS_URL || 'wss://open-api-swap.bingx.com/swap-market';
        this.symbol = symbol.toUpperCase();
        this.onPriceUpdate = onPriceUpdate || null;
    }

    private getWebSocketUrl(): string {
        return `${this.baseUrl}?symbol=${this.symbol}`;
    }

    public connect(): void {
        try {
            this.ws = new WebSocket(this.getWebSocketUrl());

            this.ws.on('open', () => {
                console.log(`WebSocket connected for ${this.symbol}`);
                this.reconnectAttempts = 0;
                this.lastPongTime = Date.now();
                this.startPingInterval();
                this.subscribe();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    // Handle pong message
                    if (message.pong) {
                        this.lastPongTime = Date.now();
                        return;
                    }
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            this.ws.on('error', (error: Error) => {
                console.error(`WebSocket error for ${this.symbol}:`, error);
                this.handleConnectionLoss();
            });

            this.ws.on('close', () => {
                console.log(`WebSocket connection closed for ${this.symbol}`);
                this.handleConnectionLoss();
            });

        } catch (error) {
            console.error(`Error connecting to WebSocket for ${this.symbol}:`, error);
            this.handleConnectionLoss();
        }
    }

    private startPingInterval(): void {
        // Clear any existing ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Send ping message
                const pingMessage = {
                    ping: Date.now()
                };
                this.ws.send(JSON.stringify(pingMessage));

                // Check if we haven't received a pong in the last 2 ping intervals
                const timeSinceLastPong = Date.now() - this.lastPongTime;
                if (timeSinceLastPong > this.PING_INTERVAL * 2) {
                    console.log(`No pong received for ${timeSinceLastPong}ms, reconnecting...`);
                    this.handleConnectionLoss();
                }
            }
        }, this.PING_INTERVAL);
    }

    private handleConnectionLoss(): void {
        // Clear ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Clear any existing reconnect timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Connection lost. Attempting to reconnect in 1 minute... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            this.reconnectTimeout = setTimeout(() => {
                this.connect();
            }, this.RECONNECT_DELAY);
        } else {
            console.error(`Max reconnection attempts reached for ${this.symbol}`);
        }
    }

    private subscribe(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Subscribe to ticker data for latest price
            const subscribeMessage = {
                id: Date.now(),
                reqType: "sub",
                dataType: "ticker", // This will give us the latest price updates
                symbol: this.symbol
            };

            this.ws.send(JSON.stringify(subscribeMessage));
            console.log(`Subscribed to price updates for ${this.symbol}`);
        }
    }

    private handleMessage(message: any): void {
        try {
            // Handle different message types
            if (message.data && message.dataType === 'ticker') {
                const priceData: PriceData = {
                    symbol: this.symbol,
                    price: parseFloat(message.data.lastPrice || message.data.price),
                    timestamp: message.data.timestamp || Date.now(),
                    volume24h: message.data.volume24h ? parseFloat(message.data.volume24h) : undefined,
                    priceChange24h: message.data.priceChange24h ? parseFloat(message.data.priceChange24h) : undefined
                };

                // Log price update
                console.log(`Latest price for ${this.symbol}: ${priceData.price}`);

                // Call the callback if provided
                if (this.onPriceUpdate) {
                    this.onPriceUpdate(priceData);
                }
            }
        } catch (error) {
            console.error('Error processing price message:', error);
        }
    }

    public disconnect(): void {
        // Clear ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Clear reconnect timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    public setPriceUpdateCallback(callback: (data: PriceData) => void): void {
        this.onPriceUpdate = callback;
    }

    public getLatestPrice(): Promise<PriceData> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket is not connected'));
                return;
            }

            const requestId = Date.now();
            const requestMessage = {
                id: requestId,
                reqType: "req",
                dataType: "ticker",
                symbol: this.symbol
            };

            // Set up a one-time message handler for this request
            const messageHandler = (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.id === requestId) {
                        if (this.ws) {
                            this.ws.removeListener('message', messageHandler);
                        }
                        
                        if (message.data) {
                            const priceData: PriceData = {
                                symbol: this.symbol,
                                price: parseFloat(message.data.lastPrice || message.data.price),
                                timestamp: message.data.timestamp || Date.now(),
                                volume24h: message.data.volume24h ? parseFloat(message.data.volume24h) : undefined,
                                priceChange24h: message.data.priceChange24h ? parseFloat(message.data.priceChange24h) : undefined
                            };
                            resolve(priceData);
                        } else {
                            reject(new Error('Invalid price data received'));
                        }
                    }
                } catch (error) {
                    if (this.ws) {
                        this.ws.removeListener('message', messageHandler);
                    }
                    reject(error);
                }
            };

            this.ws.on('message', messageHandler);
            this.ws.send(JSON.stringify(requestMessage));

            // Set a timeout for the request
            setTimeout(() => {
                if (this.ws) {
                    this.ws.removeListener('message', messageHandler);
                }
                reject(new Error('Price request timeout'));
            }, 5000);
        });
    }
} 