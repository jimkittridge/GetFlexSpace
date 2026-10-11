import test from 'node:test';
import assert from 'node:assert/strict';
import { inquiryProperty, suiteKey } from '../src/lib/inquiry-property.js';
import { resolveInquiryContext, savedInquiryContext } from '../server/inquiry-context.js';

const suite = { name: 'Office + warehouse', size: '2,000 SF', unitNumber: ' B ' };
const catalog = [inquiryProperty({ name: 'Example', fullName: 'Example, NC', slug: 'example-nc',
  schema: { address: { street: '100 Example Rd', city: 'Example', state: 'NC', zip: '28000' } }, suites: [suite] })];

test('real unit numbers come from the CMS and remain stable across suite sorting', () => {
  const context = resolveInquiryContext({ location_slug: 'example-nc', suite_key: suiteKey(suite) }, catalog);
  assert.equal(context.unitNumber, 'B');
  assert.equal(context.suiteLabel, 'Unit B — 2,000 SF');
  assert.equal(context.selection, 'selected-space');
  assert.equal(context.unitNote, '');
});

test('a single listed space is identified honestly without claiming the visitor selected it', () => {
  const context = resolveInquiryContext({ location_slug: 'concord-nc' });
  assert.equal(context.suiteLabel, 'Warehouse — 3,400 SF');
  assert.equal(context.selection, 'only-listed-space');
  assert.equal(context.unitNumber, null);
});

test('legacy requests get a current address but never an invented historical unit', () => {
  const context = savedInquiryContext({ location: 'Asheville' });
  assert.equal(context.address, '452 Butler Bridge Rd, Fletcher, NC 28732');
  assert.match(context.addressNote, /current property listing/);
  assert.match(context.unitNote, /original form did not record/);
  assert.equal(context.suiteLabel, null);
  assert.match(savedInquiryContext({ location: 'Removed property' }).address, /Not recorded/);
});
