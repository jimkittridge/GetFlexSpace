import { openTourInquiry } from './tour-inquiry';

type Market = {
  name: string; fullName: string; stateName: string; index: string;
  image: string; range: string; available: boolean; description: string;
  door: string; height: string; power: string; lease: string; url: string;
};

const { markets }: { markets: Market[] } = JSON.parse(
  document.querySelector('#homepage-data')!.textContent!,
);
const propertyDialog = document.querySelector<HTMLDialogElement>('#property-dialog')!;
const detailAction = document.querySelector<HTMLButtonElement>('#detail-action')!;
let currentMarket = markets[0];

document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll<HTMLElement>('.property').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.city !== button.dataset.filter;
    });
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-hero]').forEach(button => {
  button.addEventListener('click', () => {
    const market = markets.find(item => item.name === button.dataset.hero)!;
    const image = document.querySelector<HTMLImageElement>('.hero-photo > img')!;
    image.src = market.image;
    image.alt = `Warehouse and flex space in ${market.fullName}`;
    document.querySelector('.photo-caption p')!.textContent = `${market.name}, ${market.stateName}`.toUpperCase();
    document.querySelector('.photo-top > span:last-child')!.textContent = `${market.index} / ${String(markets.length).padStart(2, '0')}`;
    const link = document.querySelector<HTMLAnchorElement>('.photo-caption [data-property]')!;
    link.dataset.property = market.name;
    link.href = market.url;
    link.setAttribute('aria-label', `Explore ${market.name}`);
    document.querySelectorAll('[data-hero]').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
  });
});

document.querySelectorAll<HTMLAnchorElement>('[data-property]').forEach(link => {
  link.addEventListener('click', event => {
    // Preserve opening the real property URL in a new tab.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    currentMarket = markets.find(item => item.name === link.dataset.property)!;
    const image = document.querySelector<HTMLImageElement>('#detail-image')!;
    image.src = currentMarket.image;
    image.alt = `Warehouse property in ${currentMarket.fullName}`;
    document.querySelector('#detail-status')!.textContent = currentMarket.available ? 'NOW LEASING' : 'WAITLIST OPEN';
    document.querySelector('#detail-title')!.textContent = currentMarket.fullName;
    document.querySelector('#detail-description')!.textContent = currentMarket.description;
    const facts = document.querySelector('#detail-facts')!;
    facts.replaceChildren();
    for (const [label, value] of [
      ['Suite sizes', currentMarket.range], ['Loading', currentMarket.door],
      ['Clear height', currentMarket.height], ['Power', currentMarket.power],
      ['Lease terms', currentMarket.lease], ['Office layout', 'Confirm by suite'],
    ]) {
      const wrap = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      wrap.append(term, description);
      facts.append(wrap);
    }
    document.querySelector<HTMLAnchorElement>('#detail-link')!.href = currentMarket.url;
    detailAction.textContent = currentMarket.available ? 'Request a tour ↗' : 'Join the waitlist ↗';
    propertyDialog.showModal();
  });
});

function showInquiry(city = '') {
  if (propertyDialog.open) propertyDialog.close();
  openTourInquiry(city);
}

document.querySelectorAll<HTMLAnchorElement>('[data-tour]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showInquiry(link.dataset.location || '');
  });
});
detailAction.addEventListener('click', () => showInquiry(currentMarket.name));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.close-dialog')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
});

const menu = document.querySelector<HTMLButtonElement>('.menu')!;
const navigation = document.querySelector('#navigation')!;
function closeMenu() {
  navigation.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open menu');
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  navigation.classList.toggle('open', open);
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navigation.classList.contains('open')) {
    closeMenu();
    menu.focus();
  }
});
