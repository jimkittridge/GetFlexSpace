const locationStatuses = {
  available: { rank: 0, label: 'Now leasing' },
  'coming-soon': { rank: 1, label: 'Coming soon' },
  full: { rank: 2, label: 'Join the waitlist' },
};

export function locationStatus(availability) {
  return locationStatuses[availability] || locationStatuses.full;
}

export function compareLocationAvailability(a, b) {
  return locationStatus(a.availability).rank - locationStatus(b.availability).rank
    || a.name.localeCompare(b.name)
    || a.slug.localeCompare(b.slug);
}

export function propertyAvailability(city) {
  const suites = [...(city.suites || [])].map(suite => ({
    ...suite,
    // A location marked full must not advertise a stale suite as available.
    available: city.availability === 'available' && suite.status === 'available',
  })).sort((a, b) => Number(b.available) - Number(a.available)
    || Number(a.size.replace(/[^0-9.]/g, '')) - Number(b.size.replace(/[^0-9.]/g, '')));
  const available = suites.filter(suite => suite.available);
  const acceptingTours = city.availability === 'available' && (available.length > 0 || suites.length === 0);
  const summary = available.length
    ? `Currently listed: ${available.map(suite => suite.size).join(' and ')}. Contact leasing to confirm availability and arrange a tour.`
    : acceptingTours ? 'Contact leasing for current suite availability and a tour.'
    : city.availability === 'coming-soon' ? 'This location is coming soon. Join the waitlist for opening updates and future availability.'
    : 'This location is currently full. Join the waitlist for upcoming availability.';
  return { suites, available, acceptingTours, summary };
}

export function propertyFaq(city, summary) {
  return city.faq.map(item => ({
    question: item.question,
    answer: item.answer.replaceAll('{{availabilitySummary}}', summary)
      .replaceAll('{{suiteRange}}', city.specs.suiteRange)
      .replaceAll('{{ceilingHeight}}', city.specs.ceilingHeight),
  }));
}
