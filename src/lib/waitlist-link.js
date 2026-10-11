// Only resolve published locations passed in by the form; never trust URL text
// as a location name or expose an unpublished property's details.
export function waitlistLocation(url, markets) {
  const target = url.searchParams.get('waitlist');
  if (!target) return undefined;
  const slug = target === '1' ? url.pathname.match(/^\/locations\/([^/]+)\/?$/)?.[1] : target;
  return markets.find(market => market.slug === slug)?.name || '';
}

export function waitlistUrl(url, slug = '') {
  const shared = new URL(url);
  shared.searchParams.set('waitlist', slug || '1');
  return shared;
}
