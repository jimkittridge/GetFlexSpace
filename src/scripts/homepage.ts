import { openTourInquiry } from './tour-inquiry';
import { createSlideshow } from '../lib/slideshow.js';

type Market = {
  type: string; typeLabel: string; statusLabel: string; viewLabel: string;
  name: string; fullName: string; stateName: string; index: string;
  image: string; range: string; available: boolean; description: string;
  door: string; height: string; power: string; lease: string; url: string;
};

const { heroMarkets }: { heroMarkets: Market[] } = JSON.parse(
  document.querySelector('#homepage-data')!.textContent!,
);
const hero = document.querySelector<HTMLElement>('.hero')!;
const mobileContact = document.querySelector<HTMLElement>('.mobile-contact')!;
function updateMobileContact() {
  // Keep the hero readable; also handle direct links and restored scroll positions.
  mobileContact.hidden = hero.getBoundingClientRect().bottom > 0;
}
const contactVisibility = new IntersectionObserver(updateMobileContact);
contactVisibility.observe(hero);
window.addEventListener('pageshow', updateMobileContact);
updateMobileContact();

document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll<HTMLElement>('#locations .property').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.city !== button.dataset.filter;
    });
  });
});

const heroPhoto = document.querySelector<HTMLElement>('.hero-photo')!;
const heroImage = heroPhoto.querySelector<HTMLImageElement>('img')!;
const rotationButton = heroPhoto.querySelector<HTMLButtonElement>('.photo-rotation')!;
const heroButtons = [...heroPhoto.querySelectorAll<HTMLButtonElement>('[data-hero]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let heroIndex = 0;
let imageRequest = 0;

async function showHero(index: number, signal?: AbortSignal) {
  const version = ++imageRequest;
  const market = heroMarkets[index];
  const nextImage = new Image();
  nextImage.src = market.image;
  // Keep the current photo and caption together until the next photo is ready.
  try { await nextImage.decode(); } catch { return; }
  if (version !== imageRequest || signal?.aborted) return;
  heroIndex = index;
  heroImage.src = market.image;
  heroImage.alt = `${market.typeLabel} in ${market.fullName}`;
  heroPhoto.querySelector('.photo-caption p')!.textContent = `${market.name}, ${market.stateName}`.toUpperCase();
  heroPhoto.querySelector('#photo-count')!.textContent = `${market.index} / ${String(heroMarkets.length).padStart(2, '0')}`;
  const link = heroPhoto.querySelector<HTMLAnchorElement>('.photo-caption [data-property]')!;
  link.dataset.property = market.name;
  link.href = market.url;
  link.setAttribute('aria-label', `Explore ${market.name}`);
  heroButtons.forEach((button, i) => {
    button.classList.toggle('active', i === index);
    button.setAttribute('aria-pressed', String(i === index));
  });
}

const slideshow = createSlideshow({
  reducedMotion: reducedMotion.matches,
  advance: (signal: AbortSignal) => showHero((heroIndex + 1) % heroMarkets.length, signal),
  onChange: (enabled: boolean) => {
    rotationButton.title = enabled ? 'Pause location slideshow' : 'Play location slideshow';
    rotationButton.setAttribute('aria-label', enabled ? 'Pause location slideshow' : 'Play location slideshow');
    rotationButton.classList.toggle('is-playing', enabled);
  },
});
rotationButton.hidden = heroMarkets.length < 2;
slideshow.setBlocked('single-location', heroMarkets.length < 2);
heroButtons.forEach((button, index) => {
  button.addEventListener('click', () => { slideshow.pause(); void showHero(index); });
});

// Preserve the pressed action when pointer focus pauses rotation before click.
let pointerAction = false;
rotationButton.addEventListener('pointerdown', () => { pointerAction = !slideshow.enabled; });
rotationButton.addEventListener('click', event => {
  const play = event.detail > 0 ? pointerAction : !slideshow.enabled;
  if (play) slideshow.play(); else slideshow.pause();
});
heroPhoto.addEventListener('focusin', () => slideshow.pause());
heroPhoto.addEventListener('mouseenter', () => slideshow.setBlocked('hover', true));
heroPhoto.addEventListener('mouseleave', () => slideshow.setBlocked('hover', false));
heroPhoto.addEventListener('pointerdown', event => {
  if (!(event.target as Element).closest('.photo-rotation')) slideshow.pause();
});
reducedMotion.addEventListener('change', event => slideshow.setReducedMotion(event.matches));
function updateVisibility() { slideshow.setBlocked('hidden', document.hidden); }
document.addEventListener('visibilitychange', updateVisibility);
updateVisibility();
const heroVisibility = new IntersectionObserver(entries => {
  slideshow.setBlocked('offscreen', !entries[0].isIntersecting || entries[0].intersectionRatio < .5);
}, { threshold: [0, .5] });
heroVisibility.observe(heroPhoto);
const dialogVisibility = new MutationObserver(() => {
  slideshow.setBlocked('dialog', Boolean(document.querySelector('dialog[open]')));
});
document.querySelectorAll('dialog').forEach(dialog => dialogVisibility.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
window.addEventListener('pagehide', () => slideshow.setBlocked('pagehide', true));
window.addEventListener('pageshow', () => slideshow.setBlocked('pagehide', false));

function showInquiry(city = '') { openTourInquiry(city); }

document.querySelectorAll<HTMLAnchorElement>('[data-tour], header [data-property-inquiry]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showInquiry(link.dataset.location || '');
  });
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.close-dialog')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
});
