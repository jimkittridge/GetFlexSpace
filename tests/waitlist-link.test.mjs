import test from 'node:test';
import assert from 'node:assert/strict';
import { waitlistLocation, waitlistUrl } from '../src/lib/waitlist-link.js';

const markets = [{ slug: 'asheville-nc', name: 'Fletcher / Asheville' }, { slug: 'columbia-sc', name: 'Columbia' }];

test('shared links open a general waitlist or preselect a published property', () => {
  assert.equal(waitlistLocation(new URL('https://getflexspace.com/'), markets), undefined);
  assert.equal(waitlistLocation(new URL('https://getflexspace.com/?waitlist=1'), markets), '');
  assert.equal(waitlistLocation(new URL('https://getflexspace.com/?waitlist=asheville-nc'), markets), 'Fletcher / Asheville');
  assert.equal(waitlistLocation(new URL('https://getflexspace.com/locations/columbia-sc/?waitlist=1'), markets), 'Columbia');
  assert.equal(waitlistLocation(new URL('https://getflexspace.com/?waitlist=high-point-nc'), markets), '');
  assert.equal(waitlistLocation(new URL('https://getflexspace.com/?waitlist=%3Cscript%3E'), markets), '');
});

test('the waitlist URL shares only the chosen location and preserves the current page', () => {
  const original = new URL('https://getflexspace.com/locations/?utm_source=facebook#property-list');
  const shared = waitlistUrl(original, 'asheville-nc');
  assert.equal(shared.href, 'https://getflexspace.com/locations/?utm_source=facebook&waitlist=asheville-nc#property-list');
  assert.equal(original.searchParams.has('waitlist'), false);
  assert.equal(waitlistUrl(original).searchParams.get('waitlist'), '1');
});

test('shared suite waitlists keep the selected space and clear it when changing location', () => {
  const key = JSON.stringify(['Standard Suite', '1,000 SF', '']);
  const shared = waitlistUrl(new URL('https://getflexspace.com/'), 'asheville-nc', key);
  assert.equal(shared.searchParams.get('space'), key);
  assert.equal(waitlistUrl(shared, 'columbia-sc').searchParams.has('space'), false);
  assert.equal(waitlistUrl(shared, '', key).searchParams.has('space'), false);
});
