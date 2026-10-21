export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { startPushWorker } = await import('./server/push-worker');
    startPushWorker();
    const { startShowcaseCleanup } = await import('./server/showcase-worker');
    startShowcaseCleanup();
  }
}
