/**
 * Normalizes a trading symbol to BingX format
 * @param symbol The trading symbol to normalize
 * @returns The normalized symbol in BingX format (e.g., "BTC-USDT")
 */
export function normalizeSymbolBingX(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    if (!upperSymbol.endsWith('-USDT')) {
        return upperSymbol.replace('USDT', '') + '-USDT';
    }
    return upperSymbol;
} 