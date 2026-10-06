type Lead = { id: string; created_at: string; name: string; location: string; business: string;
  cell_phone: string; request_type: string; status: string; email_status: string };
const labels: Record<string, string> = { new: 'New', contacted: 'Contacted', tour_scheduled: 'Tour scheduled', closed: 'Closed' };
const login = document.querySelector<HTMLElement>('#admin-login')!;
const inbox = document.querySelector<HTMLElement>('#admin-inbox')!;
const message = document.querySelector<HTMLElement>('#admin-message')!;
const list = document.querySelector<HTMLElement>('#requests-list')!;
const tokenInput = document.querySelector<HTMLInputElement>('#github-token')!;
const filter = document.querySelector<HTMLSelectElement>('#status-filter')!;
const previous = document.querySelector<HTMLButtonElement>('#previous-page')!;
const next = document.querySelector<HTMLButtonElement>('#next-page')!;
const signOut = document.querySelector<HTMLButtonElement>('#sign-out')!;
let token = '';
let offset = 0;
let loadId = 0;

function showMessage(text: string, error = false) {
  message.textContent = text; message.hidden = !text; message.classList.toggle('error', error);
}
function clearSession() {
  token = ''; tokenInput.value = ''; list.replaceChildren();
  login.hidden = false; inbox.hidden = true; signOut.hidden = true; offset = 0; loadId++;
}
async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`,
    Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new Error(data.error || 'The request could not be completed.');
  }
  return data;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
function renderLead(lead: Lead) {
  const card = element('article', '', 'request-card');
  const content = element('div');
  const meta = element('div', '', 'request-meta');
  const time = new Date(lead.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  meta.append(element('span', lead.request_type === 'waitlist' ? 'Waitlist' : 'Tour request', 'request-kind'), element('span', `${lead.location} · ${time}`));
  const phone = element('a', lead.cell_phone, 'request-phone');
  phone.href = `tel:${lead.cell_phone.replace(/[^\d+]/g, '')}`;
  content.append(meta, element('h2', lead.name), element('p', lead.business, 'business'), phone,
    element('p', `Reference ${lead.id.slice(0, 8).toUpperCase()}`, 'request-id'));
  const actions = element('div', '', 'request-actions');
  const label = element('label', 'Request status');
  const select = element('select', '', 'request-status');
  select.setAttribute('aria-label', `Status for ${lead.name} in ${lead.location}`);
  for (const [value, text] of Object.entries(labels)) { const option = element('option', text); option.value = value; select.append(option); }
  select.value = lead.status; label.append(select);
  select.addEventListener('change', async () => {
    select.disabled = true;
    try { await api(`/api/admin/requests/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await load(); }
    catch (error) { select.value = lead.status; showMessage(error instanceof Error ? error.message : 'Couldn’t update the request.', true); }
    finally { select.disabled = false; }
  });
  const emailLabels: Record<string, string> = { sent: 'Email notification sent', pending: 'Email notification pending', sending: 'Email notification sending', failed: 'Email notification failed — request is safely saved' };
  actions.append(label, element('p', emailLabels[lead.email_status] || 'Email notification pending', 'request-email'));
  if (lead.email_status !== 'sent') {
    const retry = element('button', 'Retry email');
    retry.addEventListener('click', async () => {
      retry.disabled = true; retry.textContent = 'Sending…';
      try {
        const result = await api(`/api/admin/requests/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'retry_email' }) });
        await load(); if (!result.success) showMessage('The request is saved, but the email could not be confirmed. Try again shortly.', true);
      } catch (error) { showMessage(error instanceof Error ? error.message : 'Couldn’t send the notification.', true); }
      finally { retry.disabled = false; retry.textContent = 'Retry email'; }
    });
    actions.append(retry);
  }
  card.append(content, actions); return card;
}
async function load() {
  const current = ++loadId;
  showMessage('Loading requests…');
  try {
    const data = await api(`/api/admin/requests?status=${encodeURIComponent(filter.value)}&offset=${offset}`);
    if (current !== loadId || !token) return;
    login.hidden = true; inbox.hidden = false; signOut.hidden = false;
    list.replaceChildren(...data.requests.map(renderLead));
    document.querySelector<HTMLElement>('#empty-inbox')!.hidden = data.requests.length > 0;
    const counts = Object.fromEntries(data.counts.map((item: {status: string; count: number}) => [item.status, item.count]));
    document.querySelector('#new-count')!.textContent = String(counts.new || 0);
    document.querySelector('#scheduled-count')!.textContent = String(counts.tour_scheduled || 0);
    document.querySelector('#total-count')!.textContent = String(data.counts.reduce((sum: number, item: {count: number}) => sum + item.count, 0));
    previous.disabled = offset === 0; next.disabled = !data.hasMore;
    document.querySelector('#page-description')!.textContent = data.requests.length ? `Showing ${offset + 1}–${offset + data.requests.length}` : '';
    showMessage('');
  } catch (error) { if (current === loadId || !token) showMessage(error instanceof Error ? error.message : 'Couldn’t load requests.', true); }
}
document.querySelector<HTMLFormElement>('#admin-login-form')!.addEventListener('submit', async event => {
  event.preventDefault(); token = tokenInput.value.trim(); tokenInput.value = ''; offset = 0; await load();
});
filter.addEventListener('change', () => { offset = 0; load(); });
document.querySelector('#refresh-inbox')!.addEventListener('click', () => load());
previous.addEventListener('click', () => { offset = Math.max(0, offset - 50); load(); });
next.addEventListener('click', () => { offset += 50; load(); });
signOut.addEventListener('click', () => { clearSession(); showMessage('Signed out.'); });
window.addEventListener('pagehide', clearSession);
