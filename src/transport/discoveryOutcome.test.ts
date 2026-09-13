import { describe, expect, it } from 'vitest';
import { probeHost, scanLocalSubnet, ProbeOutcome } from './discovery';

// In tests react-native-tcp-socket is stubbed to throw, so every probe ends
// 'refused' — which is exactly what lets us verify the outcome plumbing.
describe('probe outcome tallies', () => {
  it('probeHost reports refused when the socket cannot be created', async () => {
    const outcomes: ProbeOutcome[] = [];
    const found = await probeHost('192.168.1.99', 51837, 50, {}, (o) => outcomes.push(o));
    expect(found).toBeNull();
    expect(outcomes).toEqual(['refused']);
  });

  it('scanLocalSubnet tallies every probe outcome', async () => {
    const outcomes: ProbeOutcome[] = [];
    const found = await scanLocalSubnet({
      timeoutMs: 20,
      batchSize: 254,
      onProbeOutcome: (_ip, outcome) => outcomes.push(outcome),
    });
    expect(found).toEqual([]);
    expect(outcomes.length).toBeGreaterThan(0);
    expect(outcomes.every((o) => o === 'refused')).toBe(true);
  });
});
