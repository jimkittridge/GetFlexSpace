import { UNIT_SIZES, unitSizeLabel } from '../src/lib/unit-sizes.js';
import { resolveInquiryContext, savedInquiryContext } from './inquiry-context.js';
import { isSessionRequest, sessionAccount } from './admin-auth.js';

export const RECIPIENT = 'jim@rothcapital.com';
export const STATUSES = ['new', 'contacted', 'tour_scheduled', 'closed'];
const REPOSITORY = 'jimkittridge/GetFlexSpace';

export function json(data, status = 200) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
  } });
}

export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}

export async function readJson(request) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new Error('Invalid content type');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty request');
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); throw new Error('Request too large'); }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

export function validateRequest(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.website_confirm) return null; // Honeypot, separate from the real business field.
  const clean = (value, min, max) => typeof value === 'string' && value.trim().length >= min
    && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : null;
  const name = clean(data.name, 2, 100);
  const location = clean(data.location, 2, 80);
  const business = clean(data.business, 2, 200);
  const phone = clean(data.cell_phone, 10, 40);
  const digits = phone?.replace(/\D/g, '') || '';
  if (!name || !location || !business || !phone || !/^[+\d().\s-]+$/.test(phone)
    || digits.length < 10 || digits.length > 15) return null;
  if (!['tour', 'waitlist'].includes(data.request_type)) return null;
  // Older, already-open forms can still submit without the newly added field.
  const ideal_size = data.ideal_size === undefined || data.ideal_size === '' ? null : data.ideal_size;
  if (ideal_size !== null && !UNIT_SIZES.some(size => size.value === ideal_size)) return null;
  const location_slug = data.location_slug == null || data.location_slug === '' ? null : clean(data.location_slug, 2, 100);
  const suite_key = data.suite_key == null || data.suite_key === '' ? null : clean(data.suite_key, 2, 500);
  if ((data.location_slug != null && data.location_slug !== '' && !location_slug)
    || (data.suite_key != null && data.suite_key !== '' && !suite_key)) return null;
  if (typeof data.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) return null;
  return { id: data.id, name, location, business, cell_phone: phone, request_type: data.request_type, ideal_size, location_slug, suite_key };
}

async function allowSubmission(request, db) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / 900);
  // The connecting IP is supplied by Cloudflare. Only a short-lived hash is saved.
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${bucket}:${ip}`));
  const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  await db.prepare('DELETE FROM tour_request_limits WHERE expires_at < ?').bind(now).run();
  const row = await db.prepare(`INSERT INTO tour_request_limits (bucket_key, expires_at, attempts)
    VALUES (?, ?, 1) ON CONFLICT(bucket_key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts`)
    .bind(key, (bucket + 1) * 900).first();
  return row.attempts <= 5;
}

export async function notifyRequest(db, lead, env) {
  if (env.TOUR_EMAIL_ENABLED !== 'true') return;
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const claim = await db.prepare(`UPDATE tour_requests SET email_status = 'sending',
    email_attempts = email_attempts + 1, email_attempted_at = ?
    WHERE id = ? AND (email_status IN ('pending', 'failed') OR
      (email_status = 'sending' AND email_attempted_at < ?))`).bind(now, lead.id, stale).run();
  if (claim.meta.changes !== 1) return;
  try {
    if (!env.TOUR_NOTIFICATIONS) throw new Error('Email sender unavailable');
    const property = savedInquiryContext(lead);
    await env.TOUR_NOTIFICATIONS.notify({
      subject: `GetFlexSpace ${lead.request_type === 'tour' ? 'tour request' : 'waitlist request'} — ${property.address}${property.suiteLabel ? ` — ${property.suiteLabel}` : ''}`.slice(0, 300),
      text: [
        `Name: ${lead.name}`, `Location: ${lead.location}`, `Property address: ${property.address}`,
        ...(property.addressNote ? [`Address note: ${property.addressNote}`] : []),
        `Space of interest: ${property.suiteLabel || 'No specific space selected'}`,
        `Unit / suite number: ${property.unitNumber || 'Not specified'}`,
        ...(property.unitNote ? [`Unit note: ${property.unitNote}`] : []),
        ...(property.selection === 'only-listed-space' ? ['Space context: This is the only space listed for this property.'] : []),
        ...(property.url ? [`Property details: ${property.url}`] : []),
        ...(property.selection === 'selected-space' ? [] : [`Ideal unit size: ${unitSizeLabel(lead.ideal_size)}`]),
        `Business: ${lead.business}`,
        `Cell phone: ${lead.cell_phone}`, `Request type: ${lead.request_type}`,
        `Request ID: ${lead.id}`, `Received at: ${lead.created_at}`,
        '', 'Manage requests: https://getflexspace.com/admin/requests/',
      ].join('\n'),
    });
    await db.prepare("UPDATE tour_requests SET email_status = 'sent', email_sent_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), lead.id).run();
  } catch {
    await db.prepare("UPDATE tour_requests SET email_status = 'failed' WHERE id = ?").bind(lead.id).run();
  }
}

function sameInquiry(existing, lead) {
  if (['name', 'business', 'cell_phone', 'request_type'].some(key => existing[key] !== lead[key])) return false;
  const saved = existing.property_context ? JSON.parse(existing.property_context) : resolveInquiryContext(existing);
  const current = JSON.parse(lead.property_context);
  // Older forms asked for a range even after the visitor chose an exact space.
  // That redundant field must not turn a safe retry into a conflicting lead.
  if ((saved?.selection !== 'selected-space' || current.selection !== 'selected-space')
    && existing.ideal_size !== lead.ideal_size) return false;
  return saved?.slug === current.slug
    && (existing.property_context || lead.suite_key ? saved?.suiteKey === current.suiteKey : true);
}

export async function submitRequest(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: 'Please submit this form from our website.' }, 403);
  if (!env.LEADS_DB) return json({ error: 'Online requests are temporarily unavailable. Please call or text leasing.' }, 503);
  let lead;
  try { lead = validateRequest(await readJson(request)); } catch { /* Invalid or oversized JSON. */ }
  if (!lead) return json({ error: 'Check your name, location, ideal size, business, and cell phone, then try again.' }, 400);
  const property = resolveInquiryContext(lead);
  if (!property) return json({ error: 'This property or space listing has changed. Refresh the page and choose your location again.' }, 400);
  lead.location = property.name;
  if (property.selection === 'selected-space') lead.ideal_size = null;
  lead.property_context = JSON.stringify(property);
  try {
    if (!(await allowSubmission(request, env.LEADS_DB))) return json({ error: 'Please wait a few minutes before trying again, or call or text leasing.' }, 429);
    const existing = await env.LEADS_DB.prepare('SELECT * FROM tour_requests WHERE id = ?').bind(lead.id).first();
    if (existing) {
      if (!sameInquiry(existing, lead)) {
        return json({ error: 'This request has already been received. Please call or text us to update it.' }, 409);
      }
      return json({ success: true, id: existing.id });
    }
    const now = new Date().toISOString();
    const result = await env.LEADS_DB.prepare(`INSERT OR IGNORE INTO tour_requests
      (id, created_at, updated_at, name, location, business, cell_phone, request_type, ideal_size, property_context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(lead.id, now, now, lead.name, lead.location, lead.business, lead.cell_phone, lead.request_type, lead.ideal_size, lead.property_context).run();
    if (result.meta.changes !== 1) {
      // A concurrent retry may have stored this ID while this request was validating.
      const saved = await env.LEADS_DB.prepare('SELECT * FROM tour_requests WHERE id = ?').bind(lead.id).first();
      if (!saved || !sameInquiry(saved, lead)) {
        return json({ error: 'This request has already been received. Please call or text us to update it.' }, 409);
      }
    } else {
      context.waitUntil(notifyRequest(env.LEADS_DB, { ...lead, created_at: now }, env));
    }
    // Success means the request is durably saved, never that a tour time is booked.
    return json({ success: true, id: lead.id }, 201);
  } catch {
    return json({ error: 'We couldn’t confirm your request. Your details are still here—try again or call/text leasing.' }, 503);
  }
}

export async function authorizeAdmin(request, fetcher = fetch, env = {}) {
  if (isSessionRequest(request)) {
    try { return Boolean(await sessionAccount(request, env)); } catch { return false; }
  }
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer \S{20,255}$/.test(authorization)) return false;
  try {
    const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}`, {
      headers: { Authorization: authorization, Accept: 'application/vnd.github+json',
        'User-Agent': 'GetFlexSpace-Admin', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const repository = await response.json();
    return repository.full_name?.toLowerCase() === REPOSITORY.toLowerCase()
      && (repository.permissions?.admin === true || repository.permissions?.maintain === true || repository.permissions?.push === true);
  } catch { return false; }
}

export async function listRequests(context, fetcher = fetch) {
  if (!(await authorizeAdmin(context.request, fetcher, context.env))) return json({ error: 'Sign in to your GetFlexSpace admin account.' }, 401);
  if (!context.env.LEADS_DB) return json({ error: 'The request database is not connected yet.' }, 503);
  const url = new URL(context.request.url);
  const status = url.searchParams.get('status') || '';
  const offset = Math.max(0, Math.min(100000, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0));
  if (status && !STATUSES.includes(status)) return json({ error: 'Invalid status.' }, 400);
  try {
    const query = status ? ' WHERE status = ?' : '';
    const params = status ? [status] : [];
    const rows = await context.env.LEADS_DB.prepare(`SELECT * FROM tour_requests${query} ORDER BY created_at DESC, id DESC LIMIT 51 OFFSET ?`).bind(...params, offset).all();
    const counts = await context.env.LEADS_DB.prepare('SELECT status, COUNT(*) AS count FROM tour_requests GROUP BY status').all();
    return json({ requests: rows.results.slice(0, 50).map(lead => ({ ...lead, property: savedInquiryContext(lead) })), hasMore: rows.results.length > 50, counts: counts.results, recipient: RECIPIENT });
  } catch { return json({ error: 'Couldn’t load requests. Please try again.' }, 503); }
}

export async function updateRequest(context, fetcher = fetch) {
  if (!sameOrigin(context.request)) return json({ error: 'Invalid origin.' }, 403);
  if (!(await authorizeAdmin(context.request, fetcher, context.env))) return json({ error: 'Sign in to your GetFlexSpace admin account.' }, 401);
  if (!context.env.LEADS_DB) return json({ error: 'The request database is not connected yet.' }, 503);
  try {
    const data = await readJson(context.request);
    const lead = await context.env.LEADS_DB.prepare('SELECT * FROM tour_requests WHERE id = ?').bind(context.params.id).first();
    if (!lead) return json({ error: 'Request not found.' }, 404);
    if (data.action === 'retry_email') {
      if (context.env.TOUR_EMAIL_ENABLED !== 'true') return json({ error: 'Email delivery has not been activated yet.' }, 503);
      await notifyRequest(context.env.LEADS_DB, lead, context.env);
      const updated = await context.env.LEADS_DB.prepare('SELECT email_status FROM tour_requests WHERE id = ?').bind(lead.id).first();
      return json({ success: updated.email_status === 'sent', email_status: updated.email_status });
    }
    if (!STATUSES.includes(data.status)) return json({ error: 'Invalid status.' }, 400);
    await context.env.LEADS_DB.prepare('UPDATE tour_requests SET status = ?, updated_at = ? WHERE id = ?')
      .bind(data.status, new Date().toISOString(), lead.id).run();
    return json({ success: true });
  } catch { return json({ error: 'Couldn’t update this request. Please try again.' }, 503); }
}
