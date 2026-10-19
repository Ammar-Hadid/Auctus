import { test, expect } from '@playwright/test';
import type { State } from '../src/domain/types';

test('bottom timer collapses, preserves scrolling and follows the mobile viewport', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const origin = 'http://localhost:3100';
  expect(
    (
      await page.request.post('/api/auth/sign-in/email', {
        headers: { origin },
        data: { email: 'athlete@example.test', password: 'test-only-training-password' },
      })
    ).status(),
  ).toBe(200);
  let state: State = await (await page.request.get('/api/state')).json();
  const send = async (action: string, data: Record<string, unknown>) => {
    const response = await page.request.post('/api/command', {
      headers: { origin, 'x-auctus-account': state.account.id },
      data: { requestId: crypto.randomUUID(), action, data },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    state = body.state;
    return body.result;
  };
  const exercise = await send('exercise.save', {
    name: 'Bottom layout exercise',
    equipment: 'dumbbell',
  });
  const program = await send('program.save', { name: 'Bottom layout program' });
  const template = await send('template.save', {
    program_id: program.id,
    name: 'Bottom layout workout',
    mandatory: true,
    exercises: [
      {
        exercise_id: exercise.id,
        sets: Array.from({ length: 8 }, () => ({
          type: 'normal',
          min_reps: 6,
          max_reps: 10,
          rest_ms: 180000,
        })),
      },
    ],
  });
  await send('program.select', { id: program.id });
  await send('workout.start', {
    assignment_id: state.assignments.find((a) => a.template_id === template.id)!.id,
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Auctus · Training, recorded.');
  await page.getByRole('button', { name: 'Continue workout', exact: true }).click();
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Start set 1', exact: true }).click();
  await page.getByLabel('Set 1 actual kg').fill('15');
  await page.getByLabel('Set 1 actual reps').fill('8');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  const timer = page.getByRole('region', { name: 'Rest timer' });
  const nav = page.getByRole('navigation', { name: 'Mobile navigation', exact: true });
  const mobile = page.viewportSize()!.width <= 760;
  const checkDock = async () => {
    await expect
      .poll(async () => {
        const t = (await timer.boundingBox())!;
        const edge = mobile ? (await nav.boundingBox())!.y : page.viewportSize()!.height;
        return Math.round(edge - t.y - t.height);
      })
      .toBe(mobile ? 0 : 12);
    if (mobile) {
      await expect
        .poll(async () => {
          const n = (await nav.boundingBox())!;
          return Math.round(n.y + n.height);
        })
        .toBe(page.viewportSize()!.height);
    }
  };
  await checkDock();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await checkDock();
  await expect
    .poll(async () => {
      const footer = (await page.locator('.app-footer').boundingBox())!;
      return footer.y + footer.height <= (await timer.boundingBox())!.y;
    })
    .toBe(true);
  const abandon = page.getByRole('button', { name: 'Abandon workout', exact: true });
  await expect
    .poll(async () => {
      const last = (await abandon.boundingBox())!;
      return last.y + last.height <= (await timer.boundingBox())!.y;
    })
    .toBe(true);
  await page.screenshot({
    path: `/tmp/auctus-unified-expanded-${test.info().project.name}.png`,
    scale: 'css',
  });
  const expanded = (await timer.boundingBox())!.height;
  await timer.getByRole('button', { name: 'Collapse rest timer' }).click();
  await expect(timer.getByRole('button')).toHaveCount(2);
  await expect(timer.getByRole('button', { name: 'End rest', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`auctus.rest-collapsed.${id}`),
      state.account.id,
    ),
  ).toBe('true');
  await page.reload();
  await expect(timer.getByRole('button', { name: 'Expand rest timer' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue workout', exact: true }).click();
  await expect(timer.getByRole('button', { name: 'Expand rest timer' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(timer.getByRole('timer')).toBeVisible();
  expect((await timer.boundingBox())!.height).toBeLessThan(expanded);
  await checkDock();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(async () => {
      const last = (await abandon.boundingBox())!;
      return last.y + last.height <= (await timer.boundingBox())!.y;
    })
    .toBe(true);
  await page.screenshot({
    path: `/tmp/auctus-unified-collapsed-${test.info().project.name}.png`,
    scale: 'css',
  });
  await timer.getByRole('button', { name: 'Expand rest timer' }).click();
  await timer.getByRole('button', { name: 'Pause rest timer' }).click();
  const paused = await timer.getByRole('timer').textContent();
  await timer.getByRole('button', { name: '+15s', exact: true }).click();
  await expect(timer.getByRole('timer')).not.toHaveText(paused!);
  if (mobile) {
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: original.width, height: 500 });
    await checkDock();
    await page.setViewportSize(original);
    await checkDock();
    // Simulate the independent visual viewport change caused by a phone keyboard,
    // then dismissal. WebKit automation does not open a real iOS software keyboard.
    await page.evaluate(() => {
      const viewport = window.visualViewport!;
      Object.defineProperty(viewport, 'height', {
        configurable: true,
        value: window.innerHeight - 250,
      });
      viewport.dispatchEvent(new Event('resize'));
    });
    await expect
      .poll(async () => {
        const n = (await nav.boundingBox())!;
        return Math.round(n.y + n.height);
      })
      .toBe(original.height - 250);
    await page.evaluate(() => {
      Reflect.deleteProperty(window.visualViewport!, 'height');
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    await checkDock();
  }
  await timer.getByRole('button', { name: 'Collapse rest timer' }).click();
  await timer.getByRole('button', { name: 'End rest', exact: true }).click();
  await expect(timer).toHaveCount(0);
  await expect
    .poll(async () => {
      const dock = await page.locator('.bottom-dock').boundingBox();
      return mobile
        ? Math.round(dock!.height) === Math.round((await nav.boundingBox())!.height + 1)
        : dock === null;
    })
    .toBe(true);
  await page.getByRole('button', { name: 'Start set 2', exact: true }).click();
  await page.getByLabel('Set 2 actual kg').fill('15');
  await page.getByLabel('Set 2 actual reps').fill('8');
  await page.getByRole('button', { name: 'Complete set', exact: true }).click();
  await expect(timer.getByRole('button', { name: 'Expand rest timer' })).toBeVisible();
  await timer.getByRole('button', { name: 'Expand rest timer' }).click();
  await page.reload();
  await expect(timer.getByRole('button', { name: 'Collapse rest timer' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue workout', exact: true }).click();
  await timer.getByRole('button', { name: 'End rest', exact: true }).click();
  await abandon.click();
  await page.getByRole('button', { name: 'Confirm abandon', exact: true }).click();
  expect(errors).toEqual([]);
});
