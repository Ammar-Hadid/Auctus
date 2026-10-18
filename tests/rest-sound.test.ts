import { it, expect, vi, afterEach } from 'vitest';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('plays an audible-length three-tone preview, survives screen remounts, and handles suspended audio', async () => {
  const instances: FakeAudio[] = [];
  const starts = vi.fn();
  class FakeAudio {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    onstatechange: (() => void) | null = null;
    constructor() {
      instances.push(this);
    }
    async resume() {
      this.state = 'running';
      this.onstatechange?.();
    }
    createOscillator() {
      return {
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequency: { value: 0 },
        start: starts,
        stop: vi.fn(),
        onended: null,
      };
    }
    createGain() {
      return {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
      };
    }
  }
  const values = new Map();
  vi.stubGlobal('AudioContext', FakeAudio);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key),
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal('navigator', { vibrate: vi.fn() });
  const sound = await import('../src/client/rest-sound');
  expect(sound.playRestSound()).toBe(false);
  await sound.testSound();
  expect(starts).toHaveBeenCalledTimes(3);
  expect(values.get('auctus.rest-sound')).toBe('on');
  sound.restoreSoundPreference();
  expect(sound.playRestSound()).toBe(true);
  expect(starts).toHaveBeenCalledTimes(6);
  instances[0].state = 'suspended';
  instances[0].onstatechange?.();
  expect(sound.playRestSound()).toBe(false);
  await sound.prepareSound();
  expect(sound.playRestSound()).toBe(true);
  sound.muteSound();
  expect(sound.playRestSound()).toBe(false);
});
it('reports blocked audio rather than reporting sound enabled', async () => {
  vi.stubGlobal(
    'AudioContext',
    class {
      async resume() {
        throw new Error('blocked');
      }
    },
  );
  const sound = await import('../src/client/rest-sound');
  await sound.testSound();
  expect(sound.soundSnapshot()).toMatchObject({ enabled: false, ready: false });
  expect(sound.soundSnapshot().error).toContain('Sound could not start');
});
