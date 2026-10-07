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
