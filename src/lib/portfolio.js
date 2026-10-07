import { compareLocationAvailability } from './property.js';

export const propertyGroups = [
  { type: 'flex', label: 'Small Bay Spaces', heading: 'Small-bay warehouse & flex space.', id: 'small-bay' },
  { type: 'warehouse', label: 'Larger Warehouses', heading: 'Larger Warehouses & Yards', id: 'larger-warehouses' },
  { type: 'retail', label: 'Retail Space', heading: 'Retail space. Ready for your business.', id: 'retail-space' },
];
export const acquisitionNotice = 'Subject to acquisition and availability. This is a potential future offering; GetFlexSpace does not yet own this property. Timing, terms, and availability are not confirmed.';
export const isPublished = entry => entry.data.published !== false;
export function comparePortfolio(a, b) {
  return propertyGroups.findIndex(group => group.type === (a.propertyType || 'flex'))
    - propertyGroups.findIndex(group => group.type === (b.propertyType || 'flex'))
    || compareLocationAvailability(a, b);
}
export function groupLocations(entries) {
  return propertyGroups.map(group => ({ ...group, locations: entries.filter(isPublished)
    .filter(entry => (entry.data.propertyType || 'flex') === group.type)
    .sort((a, b) => (a.data.navigationOrder ?? 100) - (b.data.navigationOrder ?? 100) || a.data.name.localeCompare(b.data.name))
  })).filter(group => group.locations.length);
}
export function propertyTypeLabel(type) {
  return type === 'retail' ? 'Retail space' : type === 'warehouse' ? 'Industrial warehouse' : 'Small-bay warehouse & flex';
}
export function propertyViewLabel(data) {
  return `View ${data.name} ${data.propertyType === 'retail' ? 'Retail' : data.propertyType === 'warehouse' ? 'Warehouse' : 'Flex Space'}`;
}
export function propertyHighlights(data) {
  return data.highlights?.length ? data.highlights.slice(0, 2)
    : [data.propertyType === 'retail' ? 'Storefront entrances' : data.specs.doorSize].filter(Boolean);
}

export function isRenderingImage(data) {
  const index = (data.gallery || []).indexOf(data.image);
  return index >= 0 && data.galleryImageTypes?.[index] === 'rendering';
}
