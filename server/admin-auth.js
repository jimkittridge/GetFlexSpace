// These passwords are server-generated 256-bit random secrets, never human-chosen
// passwords. Hashing them like API keys is deliberate: do not add a user-supplied
// password field without introducing a password KDF and its migration first.
export const REPOSITORY = 'jimkittridge/GetFlexSpace';
export const CONTENT_BRANCH = 'claude/build-flexspace-site-dSsmL';
export const SESSION_PREFIX = 'gfs_session_'; // CSRF marker, not a bearer credential.
const COOKIE = '__Host-gfs_admin';
const TTL = 12 * 60 * 60;
const encoder = new TextEncoder();

export function reply(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow', ...headers,
  } });
}
export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}
export async function readBody(request, maximum = 8192) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new Error('Invalid request');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty request');
  let size = 0, text = '';
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) { await reader.cancel(); throw new Error('Request too large'); }
    text += decoder.decode(value, { stream: true });
  }
  const data = JSON.parse(text + decoder.decode());
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid request');
  return data;
}
export async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
function secret() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function isSessionRequest(request) {
  return /^(?:Bearer|token) gfs_session_/.test(request.headers.get('Authorization') || '');
}
function sessionCookie(request) {
  return request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
}
export async function sessionAccount(request, env, requireCsrf = true) {
  if (!env.LEADS_DB || request.headers.get('Sec-Fetch-Site') === 'cross-site') return null;
  const raw = sessionCookie(request);
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  const session = await env.LEADS_DB.prepare(`SELECT a.id, a.username, a.display_name, a.role, s.csrf_token, s.token_hash
    FROM admin_sessions s JOIN admin_accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND a.disabled = 0`)
    .bind(await digest(raw), Math.floor(Date.now() / 1000)).first();
  if (!session) return null;
  if (requireCsrf && !equal(request.headers.get('Authorization')?.replace(/^(?:Bearer|token) /, ''), SESSION_PREFIX + session.csrf_token)) return null;
  return session;
}
export async function githubOwner(request, fetcher = fetch) {
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer \S{20,255}$/.test(authorization) || isSessionRequest(request)) return null;
  const options = { headers: { Authorization: authorization, Accept: 'application/vnd.github+json',
    'User-Agent': 'GetFlexSpace-Admin', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(8000) };
  try {
    const response = await fetcher('https://api.github.com/user', options);
    if (!response.ok) return null;
    const user = await response.json();
    if (user.login?.toLowerCase() !== 'jimkittridge') return null;
    const repository = await fetcher(`https://api.github.com/repos/${REPOSITORY}`, options);
    if (!repository.ok) return null;
    const repo = await repository.json();
    return repo.full_name?.toLowerCase() === REPOSITORY.toLowerCase() && repo.permissions?.admin === true
      ? { id: 'github:jimkittridge', username: 'jimkittridge', display_name: user.name || 'Jim', role: 'owner' } : null;
  } catch { return null; }
}
export async function accountOwner(request, env, fetcher = fetch) {
  const user = isSessionRequest(request) ? await sessionAccount(request, env) : await githubOwner(request, fetcher);
  return user?.role === 'owner' ? user : null;
}
export async function audit(db, actor, action, target) {
  await db.prepare('INSERT INTO admin_audit (id, actor, action, target, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), actor, action, target, new Date().toISOString()).run();
}
async function allowLogin(request, db, username) {
  const now = Math.floor(Date.now() / 1000), bucket = Math.floor(now / 900);
  await db.prepare('DELETE FROM admin_auth_limits WHERE expires_at <= ?').bind(now).run();
  const identifiers = [`ip:${request.headers.get('CF-Connecting-IP') || 'local'}`, `account:${username}`];
  for (const identifier of identifiers) {
    const row = await db.prepare(`INSERT INTO admin_auth_limits (bucket_key, expires_at, attempts)
      VALUES (?, ?, 1) ON CONFLICT(bucket_key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts`)
      .bind(await digest(`${bucket}:${identifier}`), (bucket + 1) * 900).first();
    if (row.attempts > 20) return false;
  }
  return true;
}
function publicAccount(account) {
  return { id: account.id, username: account.username, name: account.display_name, role: account.role };
}
export async function authEndpoint({ request, env, params }) {
  const action = params.action;
  try {
    if (request.method === 'GET' && action === 'session') {
      const account = await sessionAccount(request, env, false);
      return reply({ user: account ? publicAccount(account) : null,
        ...(account ? { cmsToken: SESSION_PREFIX + account.csrf_token } : {}),
        contentConnected: Boolean(env.CMS_GITHUB_TOKEN) });
    }
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    if (!sameOrigin(request)) return reply({ error: 'Open the admin on this website to continue.' }, 403);
    if (!env.LEADS_DB) return reply({ error: 'Admin accounts are not connected yet. Use the owner sign-in below.' }, 503);
    if (action === 'logout') {
      const account = await sessionAccount(request, env);
      if (!account) return reply({ error: 'Please sign in again.' }, 401);
      await env.LEADS_DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(account.token_hash).run();
      return reply({ success: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` });
    }
    if (action !== 'login') return reply({ error: 'Not found.' }, 404);
    const data = await readBody(request);
    const username = typeof data.username === 'string' ? data.username.trim().toLowerCase() : '';
    if (username.length > 64 || typeof data.password !== 'string' || data.password.length > 256) return reply({ error: 'Incorrect username or password.' }, 401);
    if (!(await allowLogin(request, env.LEADS_DB, username))) return reply({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    const account = await env.LEADS_DB.prepare('SELECT * FROM admin_accounts WHERE username = ?').bind(username).first();
    const supplied = await digest(`gfs-password-v1:${data.password}`);
    if (!equal(supplied, account?.password_hash || '0'.repeat(64)) || !account || account.disabled) return reply({ error: 'Incorrect username or password.' }, 401);
    const raw = secret(), csrf = secret(), now = Math.floor(Date.now() / 1000);
    await env.LEADS_DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now).run();
    await env.LEADS_DB.prepare('INSERT INTO admin_sessions (token_hash, account_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await digest(raw), account.id, csrf, now + TTL).run();
    await env.LEADS_DB.prepare('UPDATE admin_accounts SET last_login_at = ? WHERE id = ?').bind(new Date().toISOString(), account.id).run();
    await audit(env.LEADS_DB, account.username, 'sign_in', account.id);
    return reply({ user: publicAccount(account), cmsToken: SESSION_PREFIX + csrf, contentConnected: Boolean(env.CMS_GITHUB_TOKEN) }, 200,
      { 'Set-Cookie': `${COOKIE}=${raw}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${TTL}` });
  } catch { return reply({ error: 'Admin sign-in is not ready. Use the owner sign-in or try again shortly.' }, 503); }
}

export async function accountsEndpoint({ request, env }, fetcher = fetch) {
  try {
    const owner = await accountOwner(request, env, fetcher);
    if (!owner) return reply({ error: 'Only an account owner can manage access.' }, 403);
    if (!env.LEADS_DB) return reply({ error: 'The admin database is not connected.' }, 503);
    if (request.method === 'GET') {
      const accounts = await env.LEADS_DB.prepare('SELECT id, username, display_name, role, disabled, created_at, last_login_at FROM admin_accounts ORDER BY created_at').all();
      const activity = await env.LEADS_DB.prepare('SELECT actor, action, target, created_at FROM admin_audit ORDER BY created_at DESC LIMIT 50').all();
      return reply({ accounts: accounts.results, activity: activity.results, contentConnected: Boolean(env.CMS_GITHUB_TOKEN) });
    }
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    if (!sameOrigin(request)) return reply({ error: 'Open the admin on this website to continue.' }, 403);
    const data = await readBody(request);
    if (Object.hasOwn(data, 'password')) return reply({ error: 'Passwords must be generated by the server.' }, 400);
    if (data.action === 'create') {
      const username = typeof data.username === 'string' ? data.username.trim().toLowerCase() : '';
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(username) || !name || name.length > 80 || /[\u0000-\u001f]/.test(name)
        || !['owner', 'editor'].includes(data.role)) return reply({ error: 'Enter a name, a valid username, and an access level.' }, 400);
      const password = `gfs_${secret()}`, id = crypto.randomUUID();
      const result = await env.LEADS_DB.prepare(`INSERT OR IGNORE INTO admin_accounts
        (id, username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(id, username, name, await digest(`gfs-password-v1:${password}`), data.role, new Date().toISOString()).run();
      if (!result.meta.changes) return reply({ error: 'That username is already in use.' }, 409);
      await audit(env.LEADS_DB, owner.username, 'account_created', username);
      return reply({ username, password, role: data.role }, 201);
    }
    const account = typeof data.id === 'string' ? await env.LEADS_DB.prepare('SELECT * FROM admin_accounts WHERE id = ?').bind(data.id).first() : null;
    if (!account) return reply({ error: 'Account not found.' }, 404);
    if (data.action === 'reset') {
      const password = `gfs_${secret()}`;
      await env.LEADS_DB.batch([
        env.LEADS_DB.prepare('UPDATE admin_accounts SET password_hash = ? WHERE id = ?').bind(await digest(`gfs-password-v1:${password}`), account.id),
        env.LEADS_DB.prepare('DELETE FROM admin_sessions WHERE account_id = ?').bind(account.id),
      ]);
      await audit(env.LEADS_DB, owner.username, 'password_reset', account.username);
      return reply({ username: account.username, password, role: account.role });
    }
    if (data.action === 'disable' || data.action === 'enable') {
      if (account.id === owner.id && data.action === 'disable') return reply({ error: 'You cannot disable your own account.' }, 400);
      await env.LEADS_DB.batch([
        env.LEADS_DB.prepare('UPDATE admin_accounts SET disabled = ? WHERE id = ?').bind(data.action === 'disable' ? 1 : 0, account.id),
        env.LEADS_DB.prepare('DELETE FROM admin_sessions WHERE account_id = ?').bind(account.id),
      ]);
      await audit(env.LEADS_DB, owner.username, `account_${data.action}d`, account.username);
      return reply({ success: true });
    }
    return reply({ error: 'Unknown action.' }, 400);
  } catch { return reply({ error: 'Accounts are not ready yet. Apply the admin accounts database migration, then try again.' }, 503); }
}
