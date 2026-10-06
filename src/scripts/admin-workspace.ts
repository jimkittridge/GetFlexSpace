import { CMS_VERSION, readCmsSession } from '../lib/cms-session.js';

const content = document.querySelector<HTMLElement>('#content-panel')!;
const tours = document.querySelector<HTMLElement>('#tours-panel')!;
const contentTab = document.querySelector<HTMLButtonElement>('#content-tab')!;
const toursTab = document.querySelector<HTMLButtonElement>('#tours-tab')!;
const frame = document.querySelector<HTMLIFrameElement>('#tours-frame')!;
const notice = document.querySelector<HTMLElement>('#workspace-notice')!;
let pendingTours = new URL(location.href).searchParams.get('view') === 'tours';

function hasSession() {
  try { return Boolean(readCmsSession(localStorage)); } catch { return false; }
}
function show(view: 'content' | 'tours') {
  const isTours = view === 'tours';
  content.hidden = isTours; tours.hidden = !isTours;
  contentTab.toggleAttribute('aria-current', !isTours);
  toursTab.toggleAttribute('aria-current', isTours);
  (isTours ? toursTab : contentTab).setAttribute('aria-current', 'page');
  const url = new URL(location.href); url.searchParams.set('view', view);
  history.replaceState(history.state, '', url);
  if (isTours) frame.contentWindow?.postMessage({ type: 'getflexspace:refresh-inbox' }, location.origin);
}
function openTours() {
  if (!hasSession()) {
    pendingTours = true;
    show('content');
    notice.textContent = 'Sign in to the content manager once. Your tour inbox will open automatically afterward.';
    notice.hidden = false;
    return;
  }
  pendingTours = false; notice.hidden = true; show('tours');
}
contentTab.addEventListener('click', () => { pendingTours = false; notice.hidden = true; show('content'); });
toursTab.addEventListener('click', openTours);
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'getflexspace:cms-sign-in') {
    pendingTours = true; show('content');
    notice.textContent = 'Sign in to the content manager to open your tour inbox.';
    notice.hidden = false;
  } else if (event.data?.type === 'getflexspace:session-changed') {
    if (hasSession() && pendingTours) openTours();
    else if (!hasSession() && !tours.hidden) {
      pendingTours = true; show('content');
      notice.textContent = 'You’re signed out. Sign in once to access content and tour requests.';
      notice.hidden = false;
    }
  }
});

if (pendingTours) openTours();

// The supported custom mount keeps the CMS alive when switching to the inbox,
// so unsaved content edits are not discarded. Only the existing CMS stores auth.
const cmsWindow = window as typeof window & {
  CMS_MANUAL_INIT?: boolean;
  CMS?: { init: () => Promise<void> };
};
cmsWindow.CMS_MANUAL_INIT = true;
const loading = document.querySelector<HTMLElement>('#cms-loading')!;
const script = document.createElement('script');
script.src = `https://unpkg.com/@sveltia/cms@${CMS_VERSION}/dist/sveltia-cms.js`;
script.addEventListener('load', async () => {
  try {
    if (!cmsWindow.CMS) throw new Error('CMS unavailable');
    await cmsWindow.CMS.init(); loading.hidden = true;
  } catch { loading.textContent = 'Couldn’t load the content manager. Refresh this page to try again.'; }
});
script.addEventListener('error', () => { loading.textContent = 'Couldn’t load the content manager. Check your connection and refresh.'; });
document.body.append(script);
