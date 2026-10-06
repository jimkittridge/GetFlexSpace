import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlideshow } from '../src/lib/slideshow.js';

function fixture(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const advances = [];
  const states = [];
  const carousel = createSlideshow({ advance: signal => advances.push(signal), onChange: enabled => states.push(enabled), ...options });
  t.after(() => carousel.destroy());
  return { carousel, advances, states };
}

test('waits a full seven visible seconds for each slide, including after re-entry', async t => {
  const { carousel, advances } = fixture(t);
  t.mock.timers.tick(21000);
  assert.equal(advances.length, 0);
  carousel.setBlocked('offscreen', false);
  t.mock.timers.tick(6999);
  assert.equal(advances.length, 0);
  t.mock.timers.tick(1);
  assert.equal(advances.length, 1);
  await Promise.resolve();
  t.mock.timers.tick(7000);
  assert.equal(advances.length, 2);
  carousel.setBlocked('offscreen', true);
  t.mock.timers.tick(30000);
  carousel.setBlocked('offscreen', false);
  t.mock.timers.tick(6999);
  assert.equal(advances.length, 2);
  t.mock.timers.tick(1);
  assert.equal(advances.length, 3);
});

test('hover, hidden tabs, and dialogs must all clear before rotation resumes', t => {
  const { carousel, advances } = fixture(t);
  carousel.setBlocked('offscreen', false);
  for (const reason of ['hover', 'hidden', 'dialog']) carousel.setBlocked(reason, true);
  carousel.setBlocked('hover', false);
  carousel.setBlocked('hidden', false);
  t.mock.timers.tick(14000);
  assert.equal(advances.length, 0);
  carousel.setBlocked('dialog', false);
  t.mock.timers.tick(7000);
  assert.equal(advances.length, 1);
});

test('an explicit pause persists across visibility changes until Play', t => {
  const { carousel, advances, states } = fixture(t);
  carousel.setBlocked('offscreen', false);
  carousel.pause();
  carousel.setBlocked('offscreen', true);
  carousel.setBlocked('offscreen', false);
  t.mock.timers.tick(21000);
  assert.equal(advances.length, 0);
  carousel.play();
  t.mock.timers.tick(7000);
  assert.equal(advances.length, 1);
  assert.deepEqual(states, [true, false, true]);
});

test('reduced motion starts paused and changes do not silently restart it', t => {
  const { carousel, advances } = fixture(t, { reducedMotion: true });
  carousel.setBlocked('offscreen', false);
  t.mock.timers.tick(14000);
  assert.equal(carousel.enabled, false);
  assert.equal(advances.length, 0);
  carousel.play();
  carousel.setReducedMotion(true);
  carousel.setReducedMotion(false);
  t.mock.timers.tick(14000);
  assert.equal(advances.length, 0);
  carousel.play();
  t.mock.timers.tick(7000);
  assert.equal(advances.length, 1);
});

test('pausing cancels a slow image load so it cannot change the selected slide', async t => {
  let finish;
  let request;
  let committed = false;
  const { carousel } = fixture(t, {
    advance: async signal => {
      request = signal;
      await new Promise(resolve => { finish = resolve; });
      if (!signal.aborted) committed = true;
    },
  });
  carousel.setBlocked('offscreen', false);
  t.mock.timers.tick(7000);
  carousel.pause();
  assert.equal(request.aborted, true);
  finish();
  await Promise.resolve();
  assert.equal(committed, false);
});
