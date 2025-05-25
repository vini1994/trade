import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import winston from 'winston';
import * as path from 'path';

dotenv.config();

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Write all logs with level 'info' and below to bingx-api.log
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/bingx-api.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // Write all errors to bingx-api-error.log
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/bingx-api-error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        })
    ]
});

export interface BingXApiConfig {
    useAuth?: boolean;
    apiKey?: string;
    apiSecret?: string;
    baseUrl?: string;
}

export class BingXApiClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly useAuth: boolean;

    constructor(config?: Partial<BingXApiConfig>) {
        // Always use environment variables by default
        this.baseUrl = process.env.BINGX_BASE_URL || 'https://open-api.bingx.com';
        this.apiKey = process.env.BINGX_API_KEY || '';
        this.apiSecret = process.env.BINGX_API_SECRET || '';
        this.useAuth = true; // Always use auth by default

        // Only override with custom config if explicitly provided
        if (config) {
            if (config.baseUrl) this.baseUrl = config.baseUrl;
            if (config.apiKey) this.apiKey = config.apiKey;
            if (config.apiSecret) this.apiSecret = config.apiSecret;
            if (config.useAuth !== undefined) this.useAuth = config.useAuth;
        }

        // Validate credentials if auth is enabled
        if (this.useAuth && (!this.apiKey || !this.apiSecret)) {
            logger.error('Missing API credentials', { 
                useAuth: this.useAuth,
                hasApiKey: !!this.apiKey,
                hasApiSecret: !!this.apiSecret
            });
            throw new Error('BINGX_API_KEY and BINGX_API_SECRET must be set in environment variables');
        }

        logger.info('BingXApiClient initialized', {
            baseUrl: this.baseUrl,
            useAuth: this.useAuth,
            hasCustomConfig: !!config
        });
    }

    private generateSignature(timestamp: number, method: string, path: string, params: Record<string, any>): string {
        const queryString = Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        const signatureString = `${timestamp}${method}${path}${queryString}`;
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(signatureString)
            .digest('hex');
    }

    private getHeaders(method: string, path: string, params: Record<string, any> = {}): Record<string, string> {
        if (!this.useAuth) {
            return {};
        }

        const timestamp = Date.now().toString();
        const signature = this.generateSignature(parseInt(timestamp), method, path, params);

        return {
            'X-BX-APIKEY': this.apiKey,
            'X-BX-SIGN': signature,
            'X-BX-TIMESTAMP': timestamp
        };
    }

    public async get<T = any>(path: string, params: Record<string, any> = {}): Promise<T> {
        const requestId = crypto.randomUUID();
        logger.info('Making GET request', {
            requestId,
            path,
            params: { ...params, timestamp: '[REDACTED]' }
        });

        const config: AxiosRequestConfig = {
            params,
            headers: this.getHeaders('GET', path, params)
        };

        try {
            const startTime = Date.now();
            const response: AxiosResponse<T> = await axios.get(`${this.baseUrl}${path}`, config);
            const duration = Date.now() - startTime;

            logger.info('GET request successful', {
                requestId,
                path,
                duration,
                statusCode: response.status
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = {
                    requestId,
                    path,
                    statusCode: error.response?.status,
                    errorMessage: error.response?.data?.msg || error.message,
                    responseData: error.response?.data
                };

                logger.error('GET request failed', errorData);
                throw new Error(`BingX API Error: ${error.response?.data?.msg || error.message}`);
            }
            logger.error('Unexpected error in GET request', {
                requestId,
                path,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    public async post<T = any>(path: string, data: Record<string, any> = {}): Promise<T> {
        const requestId = crypto.randomUUID();
        logger.info('Making POST request', {
            requestId,
            path,
            data: { ...data, timestamp: '[REDACTED]' }
        });

        const config: AxiosRequestConfig = {
            headers: this.getHeaders('POST', path, data)
        };

        try {
            const startTime = Date.now();
            const response: AxiosResponse<T> = await axios.post(`${this.baseUrl}${path}`, data, config);
            const duration = Date.now() - startTime;

            logger.info('POST request successful', {
                requestId,
                path,
                duration,
                statusCode: response.status
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = {
                    requestId,
                    path,
                    statusCode: error.response?.status,
                    errorMessage: error.response?.data?.msg || error.message,
                    responseData: error.response?.data
                };

                logger.error('POST request failed', errorData);
                throw new Error(`BingX API Error: ${error.response?.data?.msg || error.message}`);
            }
            logger.error('Unexpected error in POST request', {
                requestId,
                path,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    public async delete<T = any>(path: string, params: Record<string, any> = {}): Promise<T> {
        const requestId = crypto.randomUUID();
        logger.info('Making DELETE request', {
            requestId,
            path,
            params: { ...params, timestamp: '[REDACTED]' }
        });

        const config: AxiosRequestConfig = {
            params,
            headers: this.getHeaders('DELETE', path, params)
        };

        try {
            const startTime = Date.now();
            const response: AxiosResponse<T> = await axios.delete(`${this.baseUrl}${path}`, config);
            const duration = Date.now() - startTime;

            logger.info('DELETE request successful', {
                requestId,
                path,
                duration,
                statusCode: response.status
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = {
                    requestId,
                    path,
                    statusCode: error.response?.status,
                    errorMessage: error.response?.data?.msg || error.message,
                    responseData: error.response?.data
                };

                logger.error('DELETE request failed', errorData);
                throw new Error(`BingX API Error: ${error.response?.data?.msg || error.message}`);
            }
            logger.error('Unexpected error in DELETE request', {
                requestId,
                path,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
} 