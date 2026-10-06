import { openTourInquiry } from './tour-inquiry';

document.querySelectorAll<HTMLAnchorElement>('[data-property-inquiry]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    link.closest('header details')?.removeAttribute('open');
    openTourInquiry(link.dataset.propertyInquiry, link.dataset.requestType === 'waitlist' ? 'waitlist' : undefined);
  });
});
const inquiry = document.querySelector<HTMLDialogElement>('#inquiry-dialog')!;
inquiry.querySelector('.close-dialog')!.addEventListener('click', () => inquiry.close());
inquiry.addEventListener('click', event => { if (event.target === inquiry) inquiry.close(); });

const suiteCards = [...document.querySelectorAll<HTMLElement>('[data-suite-status]')];
const filters = [...document.querySelectorAll<HTMLButtonElement>('[data-suite-filter]')];
filters.forEach(filter => filter.addEventListener('click', () => {
  let count = 0;
  suiteCards.forEach(card => {
    card.hidden = filter.dataset.suiteFilter !== 'all' && card.dataset.suiteStatus !== filter.dataset.suiteFilter;
    if (!card.hidden) count++;
  });
  filters.forEach(button => button.setAttribute('aria-pressed', String(button === filter)));
  document.querySelector('#suite-filter-status')!.textContent = `${count} ${count === 1 ? 'space' : 'spaces'} shown.`;
}));

type Media = { src: string; label: string };
const groups: Record<string, Media[]> = JSON.parse(document.querySelector('#property-media-data')!.textContent!);
const viewer = document.querySelector<HTMLDialogElement>('#property-lightbox')!;
const photo = viewer.querySelector<HTMLImageElement>('#property-media-image')!;
const stage = viewer.querySelector<HTMLElement>('.property-lightbox-stage')!;
const caption = viewer.querySelector('#property-media-caption')!;
const counter = viewer.querySelector('#property-media-count')!;
const original = viewer.querySelector<HTMLAnchorElement>('#property-media-original')!;
const zoom = viewer.querySelector<HTMLButtonElement>('[data-media-zoom]')!;
const error = viewer.querySelector<HTMLElement>('#property-media-error')!;
let currentGroup: Media[] = [];
let currentIndex = 0;
let touchStart = 0;
function resetZoom() {
  stage.classList.remove('is-zoomed'); zoom.setAttribute('aria-pressed', 'false'); zoom.textContent = 'Zoom in';
  stage.scrollTo(0, 0);
}
function show(index: number) {
  currentIndex = (index + currentGroup.length) % currentGroup.length;
  const item = currentGroup[currentIndex];
  resetZoom(); error.hidden = true;
  photo.alt = item.label; photo.src = item.src;
  caption.textContent = item.label; counter.textContent = `${currentIndex + 1} / ${currentGroup.length}`;
  original.href = item.src;
  viewer.querySelectorAll<HTMLButtonElement>('[data-media-prev], [data-media-next]').forEach(button => button.disabled = currentGroup.length < 2);
}
photo.addEventListener('error', () => { error.hidden = false; });
photo.addEventListener('load', () => { error.hidden = true; });
document.addEventListener('click', event => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('[data-property-media]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const media = groups[link.dataset.propertyMedia || ''];
  if (!media?.length) return;
  event.preventDefault(); currentGroup = media;
  show(Number(link.dataset.mediaIndex) || 0); viewer.showModal();
});
viewer.querySelector('.property-lightbox-close')!.addEventListener('click', () => viewer.close());
viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
viewer.querySelector('[data-media-prev]')!.addEventListener('click', () => show(currentIndex - 1));
viewer.querySelector('[data-media-next]')!.addEventListener('click', () => show(currentIndex + 1));
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault(); show(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
zoom.addEventListener('click', () => {
  const zoomed = stage.classList.toggle('is-zoomed');
  zoom.setAttribute('aria-pressed', String(zoomed)); zoom.textContent = zoomed ? 'Zoom out' : 'Zoom in';
});
stage.addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, { passive: true });
stage.addEventListener('touchend', event => {
  if (stage.classList.contains('is-zoomed')) return;
  const delta = event.changedTouches[0].clientX - touchStart;
  if (Math.abs(delta) > 65) show(currentIndex + (delta < 0 ? 1 : -1));
}, { passive: true });
const header = document.querySelector('body > header');
if (header) new ResizeObserver(() => {
  document.body.style.setProperty('--property-header-height', `${header.getBoundingClientRect().height}px`);
}).observe(header);
