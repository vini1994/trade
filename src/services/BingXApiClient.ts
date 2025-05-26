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
    
    private getParameters(params: Record<string, any>, timestamp:string, urlEncode:boolean): string {
        let parameters = ""
        for (const key in params) {
            if (urlEncode) {
                parameters += key + "=" + encodeURIComponent(params[key]) + "&"
            } else {
                parameters += key + "=" + params[key] + "&"
            }
        }
        if (parameters) {
            parameters = parameters.substring(0, parameters.length - 1)
            parameters = parameters + "&timestamp=" + timestamp
        } else {
            parameters = "timestamp=" + timestamp
        }
        return parameters
    }
    

    private generateSignature(signatureString: string): string {
        
        // Generate HMAC SHA256 signature
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(signatureString)
            .digest('hex');
    }

    private getHeaders(): Record<string, string> {
        if (!this.useAuth) {
            return {};
        }

        return {
            'X-BX-APIKEY': this.apiKey,
        };
    }

    private handleBigIntResponse(response: string): any {
        try {
            // First try to parse as JSON
            const data = JSON.parse(response);
            
            // Function to recursively process objects and handle BigInt values
            const processBigInts = (obj: any): any => {
                if (typeof obj !== 'object' || obj === null) return obj;
                
                if (Array.isArray(obj)) {
                    return obj.map(item => processBigInts(item));
                }
                
                const result: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    // Check if the value is a string that looks like a BigInt
                    if (typeof value === 'string' && /^\d{16,}$/.test(value)) {
                        try {
                            result[key] = BigInt(value).toString();
                        } catch {
                            result[key] = value;
                        }
                    } else if (typeof value === 'object' && value !== null) {
                        result[key] = processBigInts(value);
                    } else {
                        result[key] = value;
                    }
                }
                return result;
            };

            return processBigInts(data);
        } catch (error) {
            logger.error('Error parsing response with BigInt handling', {
                error: error instanceof Error ? error.message : 'Unknown error',
                response
            });
            return response;
        }
    }

    private async makeRequest<T = any>(
        method: string,
        path: string,
        params: Record<string, any> = {},
        data?: Record<string, any>
    ): Promise<T> {
        const requestId = crypto.randomUUID();
        const timestamp = Date.now().toString();

        
        
        // Add timestamp to params
        const requestParams = this.getParameters(params, timestamp, false);

        const encodedParams = this.getParameters(params, timestamp, true);
        

        const signature = this.generateSignature(requestParams);

        const url = `${this.baseUrl}${path}?${encodedParams}&signature=${signature}`;

        logger.info(`Making ${method} request`, {
            requestId,
            path,
            params: { requestParams },
            headers: this.getHeaders(),
            body: data
        });

        const config: AxiosRequestConfig = {
            method,
            url,
            headers: this.getHeaders(),
            data,
            transformResponse: [(data) => this.handleBigIntResponse(data)]
        };

        try {
            const startTime = Date.now();
            const response: AxiosResponse<T> = await axios(config);
            const duration = Date.now() - startTime;

            logger.info(`${method} request successful`, {
                requestId,
                path,
                duration,
                statusCode: response.status,
                responseHeaders: response.headers,
                responseData: response.data
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = {
                    requestId,
                    path,
                    statusCode: error.response?.status,
                    errorMessage: error.response?.data?.msg || error.message,
                    responseData: error.response?.data,
                    responseHeaders: error.response?.headers
                };

                logger.error(`${method} request failed`, errorData);
                throw new Error(`BingX API Error: ${error.response?.data?.msg || error.message}`);
            }
            logger.error(`Unexpected error in ${method} request`, {
                requestId,
                path,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    public async get<T = any>(path: string, params: Record<string, any> = {}): Promise<T> {
        return this.makeRequest<T>('GET', path, params);
    }

    public async post<T = any>(path: string, data: Record<string, any> = {}): Promise<T> {
        return this.makeRequest<T>('POST', path, data);
    }

    public async delete<T = any>(path: string, params: Record<string, any> = {}): Promise<T> {
        return this.makeRequest<T>('DELETE', path, params);
    }
} 