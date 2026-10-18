'use client';
import { useEffect, useSyncExternalStore } from 'react';
import {
  subscribeSound,
  soundSnapshot,
  serverSoundSnapshot,
  restoreSoundPreference,
  prepareSound,
} from '@/client/rest-sound';
export function useRestSound() {
  const state = useSyncExternalStore(subscribeSound, soundSnapshot, serverSoundSnapshot);
  useEffect(() => {
    restoreSoundPreference();
    const unlock = () => {
      const sound = soundSnapshot();
      if (sound.enabled && !sound.ready) void prepareSound();
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);
  return state;
}
