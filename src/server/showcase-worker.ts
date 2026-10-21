import { getStore } from './db/connection';
import { cleanupShowcases } from './showcase';
const runtime = globalThis as typeof globalThis & {
  showcaseCleanup?: ReturnType<typeof setInterval>;
};
export function startShowcaseCleanup() {
  if (runtime.showcaseCleanup) return;
  const clean = () => {
    try {
      cleanupShowcases(getStore());
    } catch {
      console.error('Showcase cleanup failed; will retry.');
    }
  };
  clean();
  runtime.showcaseCleanup = setInterval(clean, 60000);
  runtime.showcaseCleanup.unref();
}
