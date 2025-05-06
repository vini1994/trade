import { TradeEntryAnalyzer, TradeType } from '../src/TradeEntryAnalyzer';

describe('TradeEntryAnalyzer', () => {
  let analyzer: TradeEntryAnalyzer;

  beforeEach(() => {
    analyzer = new TradeEntryAnalyzer();
  });

  describe('hasPriceInRange', () => {
    it('should return true for LONG if any previous close is less than entry', () => {
      const klineData = [
        { close: 105, time: 3 },
        { close: 100, time: 2 },
        { close: 99, time: 1 }, // < entry
      ];
      expect(analyzer['hasPriceInRange'](klineData, 100, 95, 'LONG')).toBe(true);
    });

    it('should return false for LONG if all previous closes are greater than or equal to entry', () => {
      const klineData = [
        { close: 105, time: 3 },
        { close: 102, time: 2 },
        { close: 101, time: 1 },
      ];
      expect(analyzer['hasPriceInRange'](klineData, 100, 95, 'LONG')).toBe(false);
    });

    it('should return true for SHORT if any previous close is greater than entry', () => {
      const klineData = [
        { close: 95, time: 3 },
        { close: 100, time: 2 },
        { close: 101, time: 1 }, // > entry
      ];
      expect(analyzer['hasPriceInRange'](klineData, 100, 105, 'SHORT')).toBe(true);
    });

    it('should return false for SHORT if all previous closes are less than or equal to entry', () => {
      const klineData = [
        { close: 95, time: 3 },
        { close: 98, time: 2 },
        { close: 99, time: 1 },
      ];
      expect(analyzer['hasPriceInRange'](klineData, 100, 105, 'SHORT')).toBe(false);
    });
  });
}); 