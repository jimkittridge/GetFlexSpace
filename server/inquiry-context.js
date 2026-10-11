import properties from './generated/inquiry-properties.json' with { type: 'json' };

function findProperty(lead, catalog = properties) {
  if (lead.location_slug) return catalog.find(property => property.slug === lead.location_slug);
  const name = lead.location?.toLowerCase();
  return catalog.find(property => [property.name, property.fullName,
    ...(property.slug === 'asheville-nc' ? ['Asheville', 'Asheville, NC'] : []),
  ].some(value => value.toLowerCase() === name));
}

export function resolveInquiryContext(lead, catalog = properties) {
  const property = findProperty(lead, catalog);
  if (!property) return null;
  const selected = lead.suite_key ? property.suites.find(suite => suite.key === lead.suite_key) : null;
  if (lead.suite_key && !selected) return null;
  const suite = selected || (property.suites.length === 1 ? property.suites[0] : null);
  return {
    slug: property.slug, name: property.name, address: property.address, url: property.url,
    addressNote: property.postalCodeMissing ? 'ZIP code is not recorded in the property CMS.' : '',
    suiteKey: suite?.key || null, suiteLabel: suite?.label || null,
    unitNumber: suite?.unitNumber || null,
    selection: selected ? 'selected-space' : suite ? 'only-listed-space' : 'property',
    unitNote: suite?.unitNumber ? '' : suite
      ? 'The listing identifies this space by name and size; no unit number is recorded in the CMS.'
      : 'No specific space was selected; this is a property-level inquiry. Ideal size is a preference, not a unit assignment.',
  };
}

export function savedInquiryContext(lead) {
  if (lead.property_context) {
    try { return JSON.parse(lead.property_context); } catch { /* Legacy or incomplete context. */ }
  }
  const property = findProperty(lead);
  return {
    address: property?.address || 'Not recorded; the original location cannot be matched to a current published property.',
    url: property?.url || '', suiteLabel: null, unitNumber: null, selection: 'legacy',
    addressNote: property ? 'Address from the current property listing; the original form did not save an address.' : '',
    unitNote: 'The original form did not record a specific space or unit selection.',
  };
}
