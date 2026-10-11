// Shared identifiers keep a suite selection intact when CMS entries are reordered.
export function suiteKey(suite) {
  return JSON.stringify([suite.name, suite.size, suite.unitNumber?.trim() || '']);
}

export function suiteLabel(suite) {
  if (suite.unitNumber?.trim()) return `Unit ${suite.unitNumber.trim()} — ${suite.size}`;
  return suite.name.includes(suite.size) ? suite.name : `${suite.name} — ${suite.size}`;
}

export function inquiryProperty(data) {
  const address = data.schema.address;
  return {
    slug: data.slug, name: data.name, fullName: data.fullName,
    address: [address.street, address.city, `${address.state} ${address.zip}`.trim()].filter(Boolean).join(', '),
    postalCodeMissing: !address.zip,
    url: `https://getflexspace.com/locations/${data.slug}/`,
    suites: (data.suites || []).map(suite => ({
      key: suiteKey(suite), label: suiteLabel(suite), unitNumber: suite.unitNumber?.trim() || '', size: suite.size,
    })),
  };
}
