import { describe, expect, it } from 'vitest';
import { createTrafficRule, trafficRulesValid, trafficTotal } from './TrafficRulesEditor';

const rule = (segmentKey: string, trafficPercentage: string, priority = '1') => ({
  segmentKey,
  trafficPercentage,
  priority,
});

describe('traffic rules', () => {
  it('sums percentages treating blank/NaN as zero', () => {
    expect(trafficTotal([rule('A', '60'), rule('B', '')])).toBe(60);
    expect(trafficTotal([rule('A', '60', '1'), rule('B', '40', '2')])).toBe(100);
  });

  it('treats an empty rule set as valid (DIRECT-style empty traffic)', () => {
    expect(trafficRulesValid([])).toBe(true);
  });

  it('requires named segments and a total of exactly 100 when rules exist', () => {
    expect(trafficRulesValid([rule('A', '60'), rule('B', '40')])).toBe(true);
    expect(trafficRulesValid([rule('A', '60'), rule('', '40')])).toBe(false);
    expect(trafficRulesValid([rule('A', '60')])).toBe(false);
  });

  it('seeds a new rule with an index-based priority', () => {
    expect(createTrafficRule(0)).toMatchObject({
      segmentKey: '',
      trafficPercentage: '',
      priority: '1',
    });
    expect(createTrafficRule(2).priority).toBe('3');
  });
});
