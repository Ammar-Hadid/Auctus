'use client';
// One audio context per page, shared across workout screens and settings.
type SoundState = { enabled: boolean; ready: boolean; error: string; activeKey: string | null };
const initial: SoundState = { enabled: false, ready: false, error: '', activeKey: null };
let state = initial;
let context: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let buffer: AudioBuffer | null = null;
let generation = 0;
let dismissedKey: string | null = null;
const listeners = new Set<() => void>();
function update(patch: Partial<SoundState>) {
  if ((Object.keys(patch) as (keyof SoundState)[]).every((key) => state[key] === patch[key]))
    return;
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
export const soundSnapshot = () => state;
export const serverSoundSnapshot = () => initial;
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // Never leave an alarm playing after its controls have left the screen.
    if (!listeners.size) stopAlarm(false);
  };
}
function audioSession(type: 'playback' | 'auto') {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = type;
  } catch {}
}
function alarmBuffer(audio: AudioContext) {
  const result = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const samples = result.getChannelData(0);
  // Four crisp, alternating clock beeps followed by a gap. Short attack/release
  // envelopes avoid clicks; the audio engine loops the buffer without JS timers.
  for (let beep = 0; beep < 4; beep++) {
    const offset = Math.round(beep * 0.26 * audio.sampleRate);
    const frequency = beep % 2 ? 1174 : 880;
    for (let i = 0; i < audio.sampleRate * 0.18; i++) {
      const t = i / audio.sampleRate;
      const envelope = Math.min(1, t / 0.008, (0.18 - t) / 0.025);
      const phase = 2 * Math.PI * frequency * t;
      samples[offset + i] = envelope * (0.22 * Math.sin(phase) + 0.055 * Math.sin(phase * 3));
    }
  }
  return result;
}
export function stopAlarm(dismiss = true) {
  generation++;
  if (dismiss && state.activeKey) {
    dismissedKey = state.activeKey;
    try {
      sessionStorage.setItem('auctus.rest-dismissed', dismissedKey);
    } catch {}
  }
  if (source) {
    try {
      source.stop();
    } catch {}
    source.disconnect();
    source = null;
  }
  audioSession('auto');
  if (state.activeKey !== null) update({ activeKey: null });
  navigator.vibrate?.(0);
}
function startAlarm(key: string) {
  if (!context || context.state !== 'running') return false;
  if (state.activeKey === key && source) return true;
  stopAlarm(false);
  try {
    buffer ??= alarmBuffer(context);
    source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(context.destination);
    audioSession('playback');
    source.start();
    update({ activeKey: key, error: '' });
    navigator.vibrate?.([200, 100, 200, 100, 300]);
    return true;
  } catch {
    stopAlarm(false);
    update({ error: 'The alarm could not play. Tap Enable sound to try again.' });
    return false;
  }
}
export async function prepareSound() {
  try {
    context ??= new AudioContext();
    context.onstatechange = () => update({ ready: context?.state === 'running' });
    await context.resume();
    if (context.state !== 'running') throw new Error('Audio is blocked.');
    update({ ready: true, error: '' });
    return true;
  } catch {
    update({
      ready: false,
      error:
        'Sound could not start. Tap Enable sound and check your device volume and silent mode.',
    });
    return false;
  }
}
export async function enableSound() {
  const attempt = ++generation;
  if (!(await prepareSound()) || attempt !== generation) return false;
  update({ enabled: true });
  try {
    localStorage.setItem('auctus.rest-sound', 'on');
  } catch {}
  return true;
}
export function muteSound() {
  stopAlarm();
  update({ enabled: false, error: '' });
  try {
    localStorage.setItem('auctus.rest-sound', 'off');
  } catch {}
}
export function playRestSound(key: string) {
  if (!state.enabled || !context || context.state !== 'running') return false;
  if (dismissedKey === key) return true;
  try {
    if (sessionStorage.getItem('auctus.rest-dismissed') === key) return true;
  } catch {}
  return startAlarm(key);
}
export function restoreSoundPreference() {
  try {
    update({ enabled: localStorage.getItem('auctus.rest-sound') === 'on' });
  } catch {}
}
