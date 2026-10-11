import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountsEndpoint, authEndpoint, sessionAccount, digest } from '../server/admin-auth.js';
import { authorizeAdmin, listRequests } from '../server/tour-requests.js';

import { database, accountSession, context, ownerFetch, ownerHeaders } from './admin-fixtures.mjs';

test('Cloudflare invokes Functions for every admin endpoint instead of serving the static homepage', () => {
  const routes = JSON.parse(readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  for (const path of ['/api/admin/auth/login', '/api/admin/auth/session', '/api/admin/auth/logout', '/api/admin/accounts',
    '/api/admin/github/graphql', '/api/admin/github/api/v3/user', '/api/admin/requests', '/api/admin/requests/example']) {
    const match = pattern => pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern;
    assert.ok(routes.include.some(match), path);
    assert.ok(!routes.exclude.some(match), path);
  }
});

test('accounts use generated random passwords, hashed storage and cookie-bound sessions', async () => {
  const db = database(); const { credentials, session, headers } = await accountSession(db);
  assert.match(credentials.password, /^gfs_[A-Za-z0-9_-]{43}$/);
  const account = db.sqlite.prepare('SELECT * FROM admin_accounts').get();
  assert.equal(account.password_hash, await digest(`gfs-password-v1:${credentials.password}`));
  assert.ok(!JSON.stringify(account).includes(credentials.password));
  const row = db.sqlite.prepare('SELECT * FROM admin_sessions').get();
  assert.ok(!headers.Cookie.includes(row.token_hash));
  assert.ok(!JSON.stringify(session).includes('test-server-only-credential'));
  assert.equal((await sessionAccount(context(db, 'requests', undefined, headers).request, { LEADS_DB: db })).username, 'agent');
  assert.equal(await sessionAccount(context(db, 'requests', undefined, { Authorization: headers.Authorization }).request, { LEADS_DB: db }), null);
  assert.equal(await sessionAccount(context(db, 'requests', undefined, { Cookie: headers.Cookie }).request, { LEADS_DB: db }), null);
  assert.equal(await sessionAccount(context(db, 'requests', undefined, { ...headers, Authorization: 'Bearer gfs_session_wrong' }).request, { LEADS_DB: db }), null);
});

test('login rotates sessions and sets Secure HttpOnly SameSite cookies; logout invalidates immediately', async () => {
  const db = database(); const { credentials, headers } = await accountSession(db);
  const login = await authEndpoint(context(db, 'auth/login', credentials));
  assert.match(login.headers.get('Set-Cookie'), /Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200/);
  assert.notEqual(login.headers.get('Set-Cookie').split(';')[0], headers.Cookie);
  const response = await authEndpoint(context(db, 'auth/logout', {}, headers));
  assert.equal(response.status, 200); assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal(await authorizeAdmin(context(db, 'requests', undefined, headers).request, () => { throw Error('No GitHub fallback'); }, { LEADS_DB: db }), false);
});

test('editors can manage inbox, but cannot create accounts or change their role', async () => {
  const db = database(); const { headers } = await accountSession(db);
  const listed = await listRequests(context(db, 'requests', undefined, headers));
  assert.equal(listed.status, 200);
  for (const data of [undefined, { action: 'create', name: 'Owner', username: 'owner', role: 'owner' }, { action: 'enable', id: 'arbitrary' }]) {
    assert.equal((await accountsEndpoint(context(db, 'accounts', data, headers), ownerFetch)).status, 403);
  }
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_accounts').get().count, 1);
});

test('owner can reset and revoke accounts; old passwords and all old sessions stop working', async () => {
  const db = database(); const { credentials, headers, session } = await accountSession(db);
  const reset = await accountsEndpoint(context(db, 'accounts', { action: 'reset', id: session.user.id }, ownerHeaders), ownerFetch);
  const fresh = await reset.json();
  assert.notEqual(fresh.password, credentials.password);
  assert.equal((await authEndpoint(context(db, 'auth/login', credentials))).status, 401);
  assert.equal(await sessionAccount(context(db, 'requests', undefined, headers).request, { LEADS_DB: db }), null);
  const newLogin = await authEndpoint(context(db, 'auth/login', fresh)); assert.equal(newLogin.status, 200);
  assert.equal((await accountsEndpoint(context(db, 'accounts', { action: 'disable', id: session.user.id }, ownerHeaders), ownerFetch)).status, 200);
  assert.equal((await authEndpoint(context(db, 'auth/login', fresh))).status, 401);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_sessions').get().count, 0);
  assert.equal((await accountsEndpoint(context(db, 'accounts', { action: 'enable', id: session.user.id }, ownerHeaders), ownerFetch)).status, 200);
  assert.equal((await authEndpoint(context(db, 'auth/login', fresh))).status, 200);
});

test('human-chosen passwords are not accepted by account creation or reset', async () => {
  const db = database();
  assert.equal((await accountsEndpoint(context(db, 'accounts', { action: 'create', username: 'agent', name: 'Agent', role: 'editor', password: 'guessable' }, ownerHeaders), ownerFetch)).status, 400);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_accounts').get().count, 0);
});

test('wrong usernames/passwords share a generic response and repeated attempts are limited', async () => {
  const db = database(); await accountSession(db);
  const missing = await authEndpoint(context(db, 'auth/login', { username: 'missing', password: 'incorrect' }));
  const wrong = await authEndpoint(context(db, 'auth/login', { username: 'agent', password: 'incorrect' }));
  assert.equal(missing.status, 401); assert.deepEqual(await missing.json(), await wrong.json());
  for (let i = 0; i < 20; i++) await authEndpoint(context(db, 'auth/login', { username: 'agent', password: 'incorrect' }));
  assert.equal((await authEndpoint(context(db, 'auth/login', { username: 'agent', password: 'incorrect' }))).status, 429);
});

test('cross-origin requests cannot sign in, manage accounts, or reuse sessions', async () => {
  const db = database(); const { credentials, headers } = await accountSession(db);
  assert.equal((await authEndpoint(context(db, 'auth/login', credentials, { Origin: 'https://other.example' }))).status, 403);
  assert.equal((await authEndpoint(context(db, 'auth/logout', {}, { ...headers, Origin: 'https://other.example' }))).status, 403);
  assert.equal((await accountsEndpoint(context(db, 'accounts', { action: 'create' }, { ...ownerHeaders, Origin: 'https://other.example' }), ownerFetch)).status, 403);
  assert.equal(await sessionAccount(context(db, 'requests', undefined, { ...headers, 'Sec-Fetch-Site': 'cross-site' }).request, { LEADS_DB: db }), null);
});

test('expired sessions fail closed and owner-only management does not trust repository push access', async () => {
  const db = database(); const { headers } = await accountSession(db);
  db.sqlite.exec('UPDATE admin_sessions SET expires_at = 0');
  assert.equal(await sessionAccount(context(db, 'requests', undefined, headers).request, { LEADS_DB: db }), null);
  const otherUser = async () => Response.json({ login: 'some-collaborator', permissions: { push: true, admin: true } });
  assert.equal((await accountsEndpoint(context(db, 'accounts', undefined, ownerHeaders), otherUser)).status, 403);
});

test('owner list never returns passwords, hashes, cookies, or the GitHub credential', async () => {
  const db = database(); const { credentials } = await accountSession(db);
  const response = await accountsEndpoint(context(db, 'accounts', undefined, ownerHeaders), ownerFetch);
  const text = await response.text();
  for (const secret of [credentials.password, 'password_hash', 'token_hash', 'csrf_token', 'test-server-only-credential']) assert.ok(!text.includes(secret));
});
