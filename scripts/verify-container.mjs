// Disposable production-image drill. Never connects to the owner's database.
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const name = `auctus-drill-${Date.now()}`;
const volume = `${name}-data`;
const origin = 'http://127.0.0.1:3103';
const env = {
  ...process.env,
  BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
  BETTER_AUTH_URL: origin,
};
const docker = (args, input) =>
  execFileSync('docker', args, {
    env,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
let cookie;
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Container did not become healthy: ' + docker(['logs', name]));
}
async function request(path, data) {
  const response = await fetch(origin + path, {
    method: data ? 'POST' : 'GET',
    headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  if (response.headers.getSetCookie().length)
    cookie = response.headers
      .getSetCookie()
      .map((s) => s.split(';')[0])
      .join('; ');
  return result;
}
const command = (action, data) =>
  request('/api/command', { requestId: randomUUID(), action, data });
try {
  docker([
    'run',
    '-d',
    '--name',
    name,
    '-p',
    '127.0.0.1:3103:3000',
    '-e',
    'BETTER_AUTH_URL',
    '-e',
    'BETTER_AUTH_SECRET',
    '-v',
    `${volume}:/app/data`,
    'auctus:local',
  ]);
  await ready();
  assert.equal((await fetch(origin + '/api/state')).status, 401);
  docker(
    ['exec', '-i', name, 'node', '--import', 'tsx', '--input-type=module'],
    "import {getStore} from './src/server/db/connection.ts'; import {provisionOwner} from './src/server/owner.ts'; await provisionOwner(getStore(),'drill@example.test','test-only-container-password');",
  );
  await request('/api/auth/sign-in/email', {
    email: 'drill@example.test',
    password: 'test-only-container-password',
  });
  const exercise = (await command('exercise.save', { name: 'Container row' })).result;
  const program = (await command('program.save', { name: 'Container drill' })).result;
  await command('template.save', {
    name: 'Persistence',
    program_id: program.id,
    exercises: [
      {
        exercise_id: exercise.id,
        sets: [{ type: 'normal', min_reps: 8, max_reps: 8, rest_ms: 60000 }],
      },
    ],
  });
  let state = (await command('program.select', { id: program.id })).state;
  state = (await command('workout.start', { assignment_id: state.assignments[0].id })).state;
  let w = state.activeWorkout;
  const act = async (action, extra = {}) => {
    w = (
      await command('session.action', { workout_id: w.id, version: w.version, action, ...extra })
    ).state.activeWorkout;
  };
  await act('exercise.start', { id: w.exercises[0].id });
  await act('set.start', { id: w.exercises[0].sets[0].id });
  await act('set.complete', { id: w.exercises[0].sets[0].id, actual_grams: 22000, actual_reps: 9 });
  const recorded = structuredClone(w);
  docker(['restart', name]);
  await ready();
  assert.deepEqual((await request('/api/state')).activeWorkout, recorded);
  docker(['exec', name, 'node', '--import', 'tsx', 'scripts/backup.ts', '/app/data/restored.db']);
  docker(['rm', '-f', name]);
  docker([
    'run',
    '-d',
    '--name',
    name,
    '-p',
    '127.0.0.1:3103:3000',
    '-e',
    'BETTER_AUTH_URL',
    '-e',
    'BETTER_AUTH_SECRET',
    '-e',
    'DATABASE_PATH=/app/data/restored.db',
    '-v',
    `${volume}:/app/data`,
    'auctus:local',
  ]);
  await ready();
  assert.deepEqual((await request('/api/state')).activeWorkout, recorded);
  console.log(
    'Production container passed: authentication, programming, set completion, live-rest restart, verified backup and restored application with identical workout records.',
  );
} finally {
  try {
    docker(['rm', '-f', name]);
  } catch {}
  try {
    docker(['volume', 'rm', volume]);
  } catch {}
}
