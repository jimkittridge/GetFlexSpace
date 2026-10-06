import test from 'node:test';
import assert from 'node:assert/strict';
import { propertyAvailability, propertyFaq } from '../src/lib/property.js';
const suite = (size, status) => ({ size, status });
test('location marked full cannot advertise stale available suites', () => {
  const city = { availability: 'full', suites: [suite('2,000 SF', 'available'), suite('4,000 SF', 'waitlist')] };
  const result = propertyAvailability(city);
  assert.equal(result.acceptingTours, false);
  assert.equal(result.available.length, 0);
  assert.ok(result.suites.every(s => !s.available));
  assert.match(result.summary, /currently full/);
  assert.equal(city.suites[0].status, 'available');
});
test('available suites lead the list without mutating CMS data', () => {
  const city = { availability: 'available', suites: [suite('1,200 SF', 'waitlist'), suite('3,000 SF', 'available'), suite('2,000 SF', 'available')] };
  const result = propertyAvailability(city);
  assert.equal(result.acceptingTours, true);
  assert.deepEqual(result.suites.map(s => s.size), ['2,000 SF', '3,000 SF', '1,200 SF']);
  assert.match(result.summary, /2,000 SF and 3,000 SF/);
  assert.doesNotMatch(result.summary, /1,200/);
  assert.equal(city.suites[0].size, '1,200 SF');
});
test('an available property without a suite list asks leasing for availability', () => {
  const result = propertyAvailability({ availability: 'available', suites: [] });
  assert.equal(result.acceptingTours, true);
  assert.match(result.summary, /Contact leasing/);
});
test('all waitlisted suites do not produce a tour availability claim', () => {
  assert.equal(propertyAvailability({ availability: 'available', suites: [suite('1,000 SF', 'waitlist')] }).acceptingTours, false);
});
test('FAQs resolve size and availability from the same current listing', () => {
  const city = { availability: 'available', suites: [suite('2,000 SF', 'available')], specs: { suiteRange: '950–3,000 sq ft', ceilingHeight: '14–20 ft clear' }, faq: [{ question: 'What is available?', answer: '{{suiteRange}}. {{ceilingHeight}}. {{availabilitySummary}}' }, { question: 'Other question?', answer: 'An ordinary answer.' }] };
  const faq = propertyFaq(city, propertyAvailability(city).summary);
  assert.equal(faq[0].answer, '950–3,000 sq ft. 14–20 ft clear. Currently listed: 2,000 SF. Contact leasing to confirm availability and arrange a tour.');
  assert.equal(faq[1].answer, 'An ordinary answer.');
  assert.match(city.faq[0].answer, /\{\{suiteRange\}\}/);
});
