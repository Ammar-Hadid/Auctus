import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const sources: {
  loop: boolean;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];
const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};
let resume = async () => {};
let samples: Float32Array;
const contexts: FakeAudioContext[] = [];
class FakeAudioContext {
  state = 'running';
  sampleRate = 8000;
  destination = {};
  onstatechange: (() => void) | null = null;
  constructor() {
    contexts.push(this);
  }
  async resume() {
    await resume();
    this.state = 'running';
    this.onstatechange?.();
  }
  createBuffer(_channels: number, length: number) {
    samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }
  createBufferSource() {
    const source = {
      loop: false,
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      connect: vi.fn(),
    };
    sources.push(source);
    return source;
  }
}
beforeEach(() => {
  vi.resetModules();
  sources.length = 0;
  contexts.length = 0;
  resume = async () => {};
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('localStorage', memory());
  vi.stubGlobal('sessionStorage', memory());
  vi.stubGlobal('navigator', { vibrate: vi.fn(), audioSession: { type: 'auto' } });
});
afterEach(() => vi.unstubAllGlobals());

it('loops audible clock beeps until stopped, without muting the next rest', async () => {
  const sound = await import('../src/client/rest-sound');
  await sound.testSound('rest-1:0');
  expect(sources[0].loop).toBe(true);
  expect(sources[0].stop).not.toHaveBeenCalled();
  expect(samples.some((value) => Math.abs(value) > 0.1)).toBe(true);
  expect(samples.slice(8000).every((value) => value === 0)).toBe(true);
  sound.playRestSound('rest-1:0');
  expect(sources).toHaveLength(1);
  sound.stopAlarm();
  expect(sources[0].stop).toHaveBeenCalledOnce();
  expect(sources[0].disconnect).toHaveBeenCalledOnce();
  expect(sound.soundSnapshot()).toMatchObject({ enabled: true, activeKey: null });
  sound.playRestSound('rest-1:0');
  expect(sources).toHaveLength(1);
  sound.playRestSound('rest-2:0');
  expect(sources).toHaveLength(2);
  sound.muteSound();
  expect(sources[1].stop).toHaveBeenCalledOnce();
  expect(sound.playRestSound('rest-3:0')).toBe(false);
});

it('remembers dismissal across reload but re-arms an extended rest', async () => {
  let sound = await import('../src/client/rest-sound');
  await sound.testSound('rest:0');
  sound.stopAlarm();
  vi.resetModules();
  sound = await import('../src/client/rest-sound');
  sound.restoreSoundPreference();
  await sound.prepareSound();
  sound.playRestSound('rest:0');
  expect(sources).toHaveLength(1);
  sound.playRestSound('rest:5000');
  expect(sources).toHaveLength(2);
  sound.stopAlarm();
});

it('stops when controls unmount and can resume an undismissed rest', async () => {
  const sound = await import('../src/client/rest-sound');
  const unsubscribe = sound.subscribeSound(() => {});
  await sound.testSound('rest:0');
  unsubscribe();
  expect(sources[0].stop).toHaveBeenCalledOnce();
  expect(sound.soundSnapshot().activeKey).toBeNull();
  sound.playRestSound('rest:0');
  expect(sources).toHaveLength(2);
  sound.stopAlarm();
});

it('cannot start a delayed preview after mute or leaving the screen', async () => {
  let resolve!: () => void;
  resume = () =>
    new Promise<void>((done) => {
      resolve = done;
    });
  const sound = await import('../src/client/rest-sound');
  const pending = sound.testSound();
  sound.muteSound();
  resolve();
  expect(await pending).toBe(false);
  expect(sources).toHaveLength(0);
  expect(sound.soundSnapshot().enabled).toBe(false);
});

it('reports blocked audio and retries an undismissed rest after suspension', async () => {
  const sound = await import('../src/client/rest-sound');
  resume = async () => {
    throw Error('blocked');
  };
  expect(await sound.testSound()).toBe(false);
  expect(sound.soundSnapshot()).toMatchObject({ enabled: false, ready: false, activeKey: null });
  expect(sound.soundSnapshot().error).toContain('Sound could not start');
  resume = async () => {};
  await sound.testSound();
  sound.stopAlarm();
  contexts[0].state = 'suspended';
  contexts[0].onstatechange?.();
  expect(sound.playRestSound('rest:0')).toBe(false);
  await sound.prepareSound();
  expect(sound.playRestSound('rest:0')).toBe(true);
  sound.stopAlarm();
});
