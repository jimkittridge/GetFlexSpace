import { CMS_VERSION, CMS_USER_KEYS, readCmsSession } from '../lib/cms-session.js';

type Account = { id: string; username: string; name: string; role: 'owner' | 'editor' };
type Session = { user: Account | null; cmsToken?: string; contentConnected: boolean };
type View = 'content' | 'tours' | 'accounts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
const frame = $<HTMLIFrameElement>('tours-frame');
const notice = $('workspace-notice');
const panels = { content: $('content-panel'), tours: $('tours-panel'), accounts: $('accounts-panel') };
const tabs = { content: $('content-tab'), tours: $('tours-tab'), accounts: $('accounts-tab') };
let session: Session | null = null;
let mode: 'password' | 'github' | null = null;
let cmsStarted = false;
let pendingView: View = new URL(location.href).searchParams.get('view') === 'tours' ? 'tours' : 'content';

function token() { try { return readCmsSession(localStorage)?.token || ''; } catch { return ''; } }
function clearCache() { CMS_USER_KEYS.forEach(key => localStorage.removeItem(key)); }
function message(text: string) { notice.textContent = text; notice.hidden = !text; }
function show(view: View) {
  if (!mode) return;
  $('login-panel').hidden = true;
  for (const key of Object.keys(panels) as View[]) {
    panels[key].hidden = key !== view; tabs[key].removeAttribute('aria-current');
  }
  tabs[view].setAttribute('aria-current', 'page');
  const url = new URL(location.href); url.searchParams.set('view', view);
  history.replaceState(history.state, '', url);
  if (view === 'tours') {
    if (!frame.getAttribute('src')) frame.src = '/admin/requests/?embedded=1';
    else frame.contentWindow?.postMessage({ type: 'getflexspace:refresh-inbox' }, location.origin);
  }
}
function showLogin() {
  mode = null; Object.values(panels).forEach(panel => { panel.hidden = true; });
  $('login-panel').hidden = false; $('workspace-signout').hidden = true;
  tabs.accounts.hidden = true;
}
async function accountApi(path: string, data?: object) {
  const response = await fetch(path, { method: data ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token()}`,
      ...(data ? { 'Content-Type': 'application/json' } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Please try again.');
  return result;
}
function cachePasswordSession(data: Session) {
  if (!data.user || !data.cmsToken) return;
  // This cache contains only a CSRF marker. The actual session is an HttpOnly
  // cookie; copying this object cannot grant access in another browser.
  clearCache();
  localStorage.setItem('sveltia-cms.user', JSON.stringify({ backendName: 'github', token: data.cmsToken,
    login: data.user.username, name: data.user.name, id: data.user.id }));
}
async function signOut() {
  if (session?.user && session.cmsToken) {
    const response = await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin',
      headers: { Authorization: `Bearer ${session.cmsToken}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok && response.status !== 401) { message('Couldn’t finish signing out. Please try again.'); return; }
  }
  clearCache(); location.replace('/admin/');
}
async function loadCms() {
  if (cmsStarted) return;
  if (mode === 'password' && !session?.contentConnected) {
    $('cms-loading').textContent = 'Content editing needs its GitHub connection. Your tour inbox is available; ask the account owner to finish setup.';
    return;
  }
  cmsStarted = true;
  const cmsWindow = window as typeof window & { CMS_MANUAL_INIT?: boolean; CMS?: { init: (options?: object) => Promise<void> } };
  cmsWindow.CMS_MANUAL_INIT = true;
  const script = document.createElement('script');
  script.src = `https://unpkg.com/@sveltia/cms@${CMS_VERSION}/dist/sveltia-cms.js`;
  script.addEventListener('load', async () => {
    try {
      if (!cmsWindow.CMS) throw new Error('CMS unavailable');
      await cmsWindow.CMS.init(mode === 'password' ? { config: {
        backend: { api_root: `${location.origin}/api/admin/github/api/v3`,
          graphql_api_root: `${location.origin}/api/admin/github/graphql`, include_credentials: true },
        logout_redirect_url: '/admin/?signout=1',
      } } : undefined);
      $('cms-loading').hidden = true;
    } catch { $('cms-loading').textContent = 'Couldn’t load the content manager. Refresh this page to try again.'; }
  });
  script.addEventListener('error', () => { $('cms-loading').textContent = 'Couldn’t load the content manager. Check your connection and refresh.'; });
  document.body.append(script);
}
function credentials(data: { username: string; password: string }) {
  $<HTMLTextAreaElement>('credential-details').value = `Login: ${location.origin}/admin/\nUsername: ${data.username}\nPassword: ${data.password}`;
  $('new-credentials').hidden = false;
  $('new-credentials').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function node(tag: string, text: string, className = '') {
  const item = document.createElement(tag); item.textContent = text; item.className = className; return item;
}
async function loadAccounts() {
  try {
    const data = await accountApi('/api/admin/accounts');
    tabs.accounts.hidden = false;
    $('connection-notice').hidden = data.contentConnected;
    $('accounts-list').replaceChildren(...data.accounts.map((account: any) => {
      const card = node('article', '', 'account-card');
      const details = node('div', '');
      details.append(node('h2', account.display_name), node('p', `${account.username} · ${account.role === 'owner' ? 'Owner' : 'Content + inbox'} · ${account.disabled ? 'Disabled' : 'Active'}`),
        node('p', account.last_login_at ? `Last sign-in: ${new Date(account.last_login_at).toLocaleString()}` : 'Has not signed in yet', 'account-help'));
      const actions = node('div', '', 'account-actions');
      for (const [action, label] of [['reset', 'Reset password'], [account.disabled ? 'enable' : 'disable', account.disabled ? 'Enable access' : 'Disable access']]) {
        const button = node('button', label) as HTMLButtonElement; button.type = 'button';
        button.addEventListener('click', async () => {
          if (!confirm(`${label} for ${account.display_name}? Existing sessions will be signed out.`)) return;
          button.disabled = true; $('accounts-message').textContent = '';
          try {
            const result = await accountApi('/api/admin/accounts', { action, id: account.id });
            if (result.password) credentials(result);
            if (account.id === session?.user?.id) {
              // A self-reset revoked the current cookie; keep the new password
              // visible for copying instead of reloading and losing it.
              $('accounts-message').textContent = 'Password reset. Save the new password, then sign in again.';
              clearCache(); session = null; return;
            }
            await loadAccounts();
          } catch (error) { $('accounts-message').textContent = error instanceof Error ? error.message : 'Couldn’t update the account.'; }
          finally { button.disabled = false; }
        });
        actions.append(button);
      }
      card.append(details, actions); return card;
    }));
    $('account-activity-list').replaceChildren(...data.activity.map((entry: any) => node('li', `${new Date(entry.created_at).toLocaleString()} · ${entry.actor} · ${entry.action.replaceAll('_', ' ')} · ${entry.target}`)));
  } catch (error) { $('accounts-message').textContent = error instanceof Error ? error.message : 'Couldn’t load accounts.'; }
}
$('create-account-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector('button')!; button.disabled = true;
  $('accounts-message').textContent = '';
  try {
    const fields = new FormData(form);
    const result = await accountApi('/api/admin/accounts', { action: 'create', name: fields.get('name'), username: fields.get('username'), role: fields.get('role') });
    form.reset(); credentials(result); await loadAccounts();
  } catch (error) { $('accounts-message').textContent = error instanceof Error ? error.message : 'Couldn’t create the account.'; }
  finally { button.disabled = false; }
});
$('copy-credentials').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($<HTMLTextAreaElement>('credential-details').value); $('copy-credentials').textContent = 'Copied'; }
  catch { $<HTMLTextAreaElement>('credential-details').select(); }
});
$('dismiss-credentials').addEventListener('click', () => {
  $<HTMLTextAreaElement>('credential-details').value = ''; $('new-credentials').hidden = true; $('copy-credentials').textContent = 'Copy login details';
});
$('account-login-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector('button')!; button.disabled = true; $('login-message').textContent = 'Signing in…';
  try {
    const response = await fetch('/api/admin/auth/login', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $<HTMLInputElement>('login-username').value, password: $<HTMLInputElement>('login-password').value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Couldn’t sign in.');
    cachePasswordSession(data); $<HTMLInputElement>('login-password').value = '';
    location.replace(`/admin/?view=${pendingView}`);
  } catch (error) { $('login-message').textContent = error instanceof Error ? error.message : 'Couldn’t sign in. Please try again.'; }
  finally { button.disabled = false; }
});
$('workspace-signout').addEventListener('click', () => void signOut());
for (const view of Object.keys(tabs) as View[]) tabs[view].addEventListener('click', () => {
  pendingView = view;
  if (!mode) return;
  if (!token() && view !== 'content') { show('content'); message('Sign in to open your admin workspace.'); return; }
  message(''); show(view); if (view === 'accounts') void loadAccounts();
});
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'getflexspace:cms-sign-in') {
    if (mode === 'password') { void signOut(); return; }
    show('content'); message('Sign in to the content manager to open your tour inbox.');
  }
});
// A different tab signing out clears sensitive views immediately.
window.addEventListener('storage', event => {
  if ((event.key === null || CMS_USER_KEYS.includes(event.key)) && !token()) location.replace('/admin/');
});
async function start() {
  const params = new URL(location.href).searchParams;
  try {
    const response = await fetch('/api/admin/auth/session', { cache: 'no-store', credentials: 'same-origin' });
    if (response.ok) session = await response.json();
  } catch { /* Static mirror and setup-in-progress still have owner sign-in. */ }
  if (params.has('signout')) { await signOut(); return; }
  if (session?.user && params.get('login') !== 'github') {
    mode = 'password'; cachePasswordSession(session); tabs.accounts.hidden = session.user.role !== 'owner';
  } else if (params.get('login') === 'github' || (token() && !token().startsWith('gfs_session_'))) {
    if (token().startsWith('gfs_session_')) clearCache();
    mode = 'github'; tabs.accounts.hidden = false;
  } else { if (token().startsWith('gfs_session_')) clearCache(); showLogin(); return; }
  $('workspace-signout').hidden = false;
  show(pendingView); await loadCms();
}
void start();
let checkingSession = false;
async function checkSession() {
  if (mode !== 'password' || !session?.user || checkingSession || document.hidden) return;
  checkingSession = true;
  try {
    const response = await fetch('/api/admin/auth/session', { cache: 'no-store', credentials: 'same-origin' });
    if (response.ok) {
      const current = await response.json();
      if (!current.user || current.cmsToken !== session.cmsToken) { clearCache(); location.replace('/admin/'); }
    }
  } finally { checkingSession = false; }
}
window.setInterval(() => { void checkSession().catch(() => {}); }, 60000);
window.addEventListener('focus', () => { void checkSession().catch(() => {}); });
