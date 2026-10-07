const menu = document.querySelector<HTMLDetailsElement>('.gfs-mobile-menu');
if (menu) {
  const toggle = menu.querySelector<HTMLElement>('summary')!;
  const closeMenu = () => { menu.open = false; };
  menu.addEventListener('toggle', () => toggle.setAttribute('aria-label', menu.open ? 'Close menu' : 'Open menu'));
  menu.addEventListener('click', event => {
    const link = (event.target as Element).closest('a');
    if (!link) return;
    // Close before the inquiry opens so the dialog restores focus to the toggle.
    closeMenu();
    if (link.hasAttribute('data-property-inquiry')) toggle.focus();
  }, { capture: true });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target as Node)) closeMenu();
  });
  document.addEventListener('focusin', event => {
    if (!menu.contains(event.target as Node)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) { closeMenu(); toggle.focus(); }
  });
  matchMedia('(max-width: 960px)').addEventListener('change', closeMenu);
  window.addEventListener('pageshow', closeMenu);
}

const locationsMenu = document.querySelector<HTMLDetailsElement>('.gfs-location-menu');
if (locationsMenu) {
  const hoverRegion = locationsMenu.closest<HTMLElement>('.gfs-locations-nav')!;
  const desktopHover = matchMedia('(min-width: 961px) and (hover: hover) and (pointer: fine)');
  const toggle = locationsMenu.querySelector<HTMLElement>('summary')!;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelClose = () => { clearTimeout(closeTimer); };
  const close = () => { cancelClose(); locationsMenu.open = false; };
  hoverRegion.addEventListener('pointerenter', event => {
    if (!desktopHover.matches || event.pointerType === 'touch') return;
    cancelClose();
    locationsMenu.open = true;
  });
  hoverRegion.addEventListener('pointerleave', () => {
    if (!desktopHover.matches) return;
    cancelClose();
    closeTimer = setTimeout(() => {
      // Keep an actively focused submenu available to keyboard users.
      if (!locationsMenu.contains(document.activeElement)) close();
    }, 180);
  });
  locationsMenu.addEventListener('toggle', () => toggle.setAttribute('aria-label', locationsMenu.open ? 'Hide property locations' : 'Show property locations'));
  document.addEventListener('click', event => { if (!hoverRegion.contains(event.target as Node)) close(); });
  document.addEventListener('focusin', event => { if (!hoverRegion.contains(event.target as Node)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && locationsMenu.open) { close(); toggle.focus(); } });
  matchMedia('(max-width: 960px)').addEventListener('change', close);
  desktopHover.addEventListener('change', close);
  window.addEventListener('pageshow', close);
}
