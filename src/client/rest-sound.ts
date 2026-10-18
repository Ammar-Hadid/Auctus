'use client';
// One audio context per page, shared across workout screens and settings.
type SoundState = { enabled: boolean; ready: boolean; error: string };
const initial: SoundState = { enabled: false, ready: false, error: '' };
let state = initial;
let context: AudioContext | null = null;
const listeners = new Set<() => void>();
function update(patch: Partial<SoundState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
export const soundSnapshot = () => state;
export const serverSoundSnapshot = () => initial;
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function chime(audio: AudioContext) {
  // Three distinct tones, rather than a single quiet, easily missed click.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  [740, 880, 1046].forEach((frequency, i) => {
    const start = audio.currentTime + i * 0.42;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.35, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      if (i === 2 && session) session.type = 'auto';
    };
    oscillator.start(start);
    oscillator.stop(start + 0.38);
  });
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
      error: 'Sound could not start. Tap Test sound and check your device volume and silent mode.',
    });
    return false;
  }
}
export async function testSound() {
  if (!(await prepareSound())) return false;
  update({ enabled: true });
  try {
    localStorage.setItem('auctus.rest-sound', 'on');
  } catch {}
  chime(context!);
  return true;
}
export function muteSound() {
  update({ enabled: false, error: '' });
  try {
    localStorage.setItem('auctus.rest-sound', 'off');
  } catch {}
}
export function rememberRestSound(key: string) {
  try {
    sessionStorage.setItem('auctus.rest-alerted', key);
  } catch {}
}
export function playRestSound(key?: string) {
  if (!state.enabled || !context || context.state !== 'running') return false;
  try {
    if (key && sessionStorage.getItem('auctus.rest-alerted') === key) return true;
  } catch {}
  chime(context);
  if (key) rememberRestSound(key);
  navigator.vibrate?.([200, 100, 200, 100, 300]);
  return true;
}
export function restoreSoundPreference() {
  try {
    update({ enabled: localStorage.getItem('auctus.rest-sound') === 'on' });
  } catch {}
}
