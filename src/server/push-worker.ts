import { getStore } from './db/connection';
import { deliverDueRests, pushSubject, sender } from './push';
const runtime = globalThis as typeof globalThis & {
  restPushWorker?: ReturnType<typeof setInterval>;
};
export function startPushWorker() {
  const subject = pushSubject();
  if (!subject || runtime.restPushWorker) return;
  const store = getStore();
  const send = sender(store, subject);
  let busy = false;
  runtime.restPushWorker = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await deliverDueRests(store, send);
    } catch {
      console.error('Rest notification scheduler failed; will retry.');
    } finally {
      busy = false;
    }
  }, 1000);
  runtime.restPushWorker.unref();
}
