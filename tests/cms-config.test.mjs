import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const root = new URL('../', import.meta.url);
const config = yaml.load(readFileSync(new URL('public/admin/config.yml', root), 'utf8'));

test('CMS file collections contain editable files, not misplaced field definitions', () => {
  for (const collection of config.collections) {
    if (!collection.files) continue;
    for (const entry of collection.files) {
      const label = `${collection.label} / ${entry.label}`;
      assert.equal(typeof entry.file, 'string', `${label} requires a file path`);
      assert.ok(existsSync(new URL(entry.file, root)), `${label} must reference an existing file`);
      assert.ok(Array.isArray(entry.fields) && entry.fields.length, `${label} requires editable fields`);
      assert.equal(entry.widget, undefined, `${label} must be a file entry, not a field`);
    }
  }
});

test('property settings stay in Locations and Contact keeps its tenant access field', () => {
  const locations = config.collections.find(collection => collection.name === 'locations');
  const pages = config.collections.find(collection => collection.name === 'pages');
  const propertyFields = ['published', 'navigationOrder', 'marketingStage', 'highlights', 'yard', 'yardNotes', 'pricingNote'];
  for (const name of propertyFields) {
    assert.equal(locations.fields.filter(field => field.name === name).length, 1, `${name} belongs in Locations once`);
    for (const page of pages.files) {
      assert.ok(!page.fields?.some(field => field.name === name), `${name} does not belong in ${page.label}`);
    }
  }
  const contact = pages.files.find(page => page.name === 'contact');
  assert.ok(contact.fields.some(field => field.name === 'tenantAccess'));
});
