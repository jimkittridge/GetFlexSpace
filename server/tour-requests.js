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
  if (typeof data.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) return null;
  return { id: data.id, name, location, business, cell_phone: phone, request_type: data.request_type };
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
    await env.TOUR_NOTIFICATIONS.notify({
      subject: `GetFlexSpace ${lead.request_type === 'tour' ? 'tour request' : 'waitlist request'} — ${lead.location}`,
      text: [
        `Name: ${lead.name}`, `Location: ${lead.location}`, `Business: ${lead.business}`,
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

export async function submitRequest(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ error: 'Please submit this form from our website.' }, 403);
  if (!env.LEADS_DB) return json({ error: 'Online requests are temporarily unavailable. Please call or text leasing.' }, 503);
  let lead;
  try { lead = validateRequest(await readJson(request)); } catch { /* Invalid or oversized JSON. */ }
  if (!lead) return json({ error: 'Check your name, location, business, and cell phone, then try again.' }, 400);
  try {
    if (!(await allowSubmission(request, env.LEADS_DB))) return json({ error: 'Please wait a few minutes before trying again, or call or text leasing.' }, 429);
    const existing = await env.LEADS_DB.prepare('SELECT * FROM tour_requests WHERE id = ?').bind(lead.id).first();
    if (existing) {
      if (['name', 'location', 'business', 'cell_phone', 'request_type'].some(key => existing[key] !== lead[key])) {
        return json({ error: 'This request has already been received. Please call or text us to update it.' }, 409);
      }
      return json({ success: true, id: existing.id });
    }
    const now = new Date().toISOString();
    const result = await env.LEADS_DB.prepare(`INSERT OR IGNORE INTO tour_requests
      (id, created_at, updated_at, name, location, business, cell_phone, request_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(lead.id, now, now, lead.name, lead.location, lead.business, lead.cell_phone, lead.request_type).run();
    if (result.meta.changes !== 1) {
      // A concurrent retry may have stored this ID while this request was validating.
      const saved = await env.LEADS_DB.prepare('SELECT * FROM tour_requests WHERE id = ?').bind(lead.id).first();
      if (!saved || ['name', 'location', 'business', 'cell_phone', 'request_type'].some(key => saved[key] !== lead[key])) {
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

export async function authorizeAdmin(request, fetcher = fetch) {
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
  if (!(await authorizeAdmin(context.request, fetcher))) return json({ error: 'Sign in with a GitHub token that can edit GetFlexSpace.' }, 401);
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
    return json({ requests: rows.results.slice(0, 50), hasMore: rows.results.length > 50, counts: counts.results, recipient: RECIPIENT });
  } catch { return json({ error: 'Couldn’t load requests. Please try again.' }, 503); }
}

export async function updateRequest(context, fetcher = fetch) {
  if (!sameOrigin(context.request)) return json({ error: 'Invalid origin.' }, 403);
  if (!(await authorizeAdmin(context.request, fetcher))) return json({ error: 'Sign in with a GitHub token that can edit GetFlexSpace.' }, 401);
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
