import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLocations, isPublished, comparePortfolio } from '../src/lib/portfolio.js';
import { propertyAvailability, publicAvailability } from '../src/lib/property.js';
const entry = (name, propertyType, published, availability = 'available', navigationOrder = 100) => ({data:{name,slug:name,propertyType,published,availability,navigationOrder}});
test('public groups omit acquisition drafts and preserve explicit navigation order', () => {
  const input = [entry('Candler','warehouse',false),entry('Morganton','retail',true),entry('Concord','flex',true,'available',20),entry('High Point','warehouse',true,'coming-soon'),entry('Durham','flex',true,'available',10),entry('Fletcher','flex',undefined,'full',30)];
  assert.equal(input.filter(isPublished).length,5);
  const groups=groupLocations(input);
  assert.deepEqual(groups.map(group=>group.label),['Small Bay Spaces','Larger Warehouses','Retail Space']);
  assert.deepEqual(groups[0].locations.map(item=>item.data.name),['Durham','Concord','Fletcher']);
  assert.deepEqual(groups[1].locations.map(item=>item.data.name),['High Point']);
});
test('homepage keeps small-bay first and availability order within each property type', () => {
  const values=[entry('Retail','retail',true),entry('Full small bay','flex',true,'full'),entry('Large','warehouse',true),entry('Available small bay','flex',true)];
  assert.deepEqual(values.map(e=>e.data).sort(comparePortfolio).map(data=>data.name),['Available small bay','Full small bay','Large','Retail']);
});
test('an acquisition-stage listing cannot imply confirmed availability even with stale available flags', () => {
  const result=propertyAvailability({marketingStage:'subject-to-acquisition',availability:'available',suites:[{size:'5,000 SF',status:'available'}]});
  assert.equal(publicAvailability({marketingStage:'subject-to-acquisition',availability:'available'}),'coming-soon');
  assert.equal(result.acceptingTours,false);
  assert.equal(result.available.length,0);
  assert.match(result.summary,/subject to acquisition and availability/);
});
