import { describe, expect, it } from 'vitest';
import {
  buildConnectionSocketOptions,
  isPrivateLanIPv4,
  isWifiInterfaceUnavailable,
} from './socketOptions';

describe('isPrivateLanIPv4', () => {
  it('accepts the private-use LAN ranges', () => {
    expect(isPrivateLanIPv4('192.168.254.106')).toBe(true);
    expect(isPrivateLanIPv4('192.168.1.1')).toBe(true);
    expect(isPrivateLanIPv4('10.0.0.5')).toBe(true);
    expect(isPrivateLanIPv4('172.16.0.1')).toBe(true);
    expect(isPrivateLanIPv4('172.31.255.254')).toBe(true);
  });

  it('rejects non-LAN, malformed, and cellular-looking addresses', () => {
    expect(isPrivateLanIPv4('8.8.8.8')).toBe(false);
    expect(isPrivateLanIPv4('172.15.0.1')).toBe(false);
    expect(isPrivateLanIPv4('172.32.0.1')).toBe(false);
    expect(isPrivateLanIPv4('100.64.0.1')).toBe(false);
    expect(isPrivateLanIPv4('127.0.0.1')).toBe(false);
    expect(isPrivateLanIPv4('169.254.1.2')).toBe(false);
    expect(isPrivateLanIPv4('fe80::1')).toBe(false);
    expect(isPrivateLanIPv4('not-an-ip')).toBe(false);
    expect(isPrivateLanIPv4('192.168.1.256')).toBe(false);
    expect(isPrivateLanIPv4(null)).toBe(false);
    expect(isPrivateLanIPv4(undefined)).toBe(false);
  });
});

describe('buildConnectionSocketOptions', () => {
  it('pins Android dials to Wi-Fi with the LAN source address', () => {
    expect(buildConnectionSocketOptions({ platform: 'android', localIp: '192.168.254.106' })).toEqual({
      interface: 'wifi',
      localAddress: '192.168.254.106',
    });
  });

  it('still pins Android without a usable source address', () => {
    expect(buildConnectionSocketOptions({ platform: 'android', localIp: null })).toEqual({ interface: 'wifi' });
    expect(buildConnectionSocketOptions({ platform: 'android', localIp: '8.8.8.8' })).toEqual({ interface: 'wifi' });
  });

  it('leaves iOS and unknown platforms untouched', () => {
    expect(buildConnectionSocketOptions({ platform: 'ios', localIp: '192.168.1.50' })).toEqual({});
    expect(buildConnectionSocketOptions({ platform: 'unknown' })).toEqual({});
  });
});

describe('isWifiInterfaceUnavailable', () => {
  it('matches the native Android unreachable-interface error', () => {
    expect(isWifiInterfaceUnavailable('Interface wifi unreachable')).toBe(true);
    expect(isWifiInterfaceUnavailable('socket error: Interface wifi unreachable')).toBe(true);
    expect(isWifiInterfaceUnavailable('Connection timed out')).toBe(false);
    expect(isWifiInterfaceUnavailable(null)).toBe(false);
  });
});
