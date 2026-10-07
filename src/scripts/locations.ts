import { openTourInquiry } from './tour-inquiry';

const cards = [...document.querySelectorAll<HTMLElement>('[data-location-card]')];
const statusButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-location-status]')];
const typeFilter = document.querySelector<HTMLSelectElement>('#location-type')!;
const resultCount = document.querySelector<HTMLElement>('#location-result-count')!;
const emptyState = document.querySelector<HTMLElement>('.directory-empty')!;
let selectedStatus = 'all';

function filterLocations() {
  let visible = 0;
  cards.forEach(card => {
    card.hidden = (selectedStatus !== 'all' && card.dataset.availability !== selectedStatus)
      || (typeFilter.value !== 'all' && card.dataset.spaceType !== typeFilter.value);
    if (!card.hidden) visible++;
  });
  statusButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.locationStatus === selectedStatus)));
  resultCount.textContent = visible === cards.length ? `Showing all ${cards.length} locations`
    : `Showing ${visible} of ${cards.length} locations`;
  emptyState.hidden = visible > 0;
}
statusButtons.forEach(button => button.addEventListener('click', () => {
  selectedStatus = button.dataset.locationStatus!;
  filterLocations();
}));
typeFilter.addEventListener('change', filterLocations);
document.querySelector('#reset-location-filters')!.addEventListener('click', () => {
  selectedStatus = 'all'; typeFilter.value = 'all'; filterLocations(); statusButtons[0].focus();
});
document.querySelector<HTMLElement>('.directory-filters')!.hidden = false;
window.addEventListener('pageshow', filterLocations);
filterLocations();

document.querySelectorAll<HTMLAnchorElement>('[data-property-inquiry]').forEach(link => link.addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const menu = link.closest('header details');
  if (menu) { menu.removeAttribute('open'); menu.querySelector<HTMLElement>('summary')?.focus(); }
  openTourInquiry(link.dataset.propertyInquiry, link.dataset.requestType === 'waitlist' ? 'waitlist' : undefined);
}));
const inquiry = document.querySelector<HTMLDialogElement>('#inquiry-dialog')!;
inquiry.querySelector('.close-dialog')!.addEventListener('click', () => inquiry.close());
inquiry.addEventListener('click', event => {
  if (event.target !== inquiry) return;
  const box = inquiry.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) inquiry.close();
});
