import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { accountsEndpoint, authEndpoint } from '../server/admin-auth.js';

export function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_tour_requests', '0002_ideal_unit_size', '0003_inquiry_property_context', '0004_admin_accounts']) sqlite.exec(readFileSync(new URL(`../migrations/${file}.sql`, import.meta.url), 'utf8'));
  const db = { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql); let args = [];
    return { bind(...values) { args = values; return this; },
      async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
      async first() { return statement.get(...args) || null; },
      async all() { return { results: statement.all(...args) }; } };
  }, async batch(statements) { return Promise.all(statements.map(statement => statement.run())); } };
  return db;
}
export const ownerHeaders = { Authorization: `Bearer ${'t'.repeat(40)}` };
export const ownerFetch = async url => Response.json(url.endsWith('/user') ? { login: 'jimkittridge', name: 'Jim' }
  : { full_name: 'jimkittridge/GetFlexSpace', permissions: { admin: true } });
export function context(db, path, data, headers = {}) {
  return { env: { LEADS_DB: db, CMS_GITHUB_TOKEN: 'test-server-only-credential' }, params: { action: path.split('/').at(-1) },
    request: new Request(`https://getflexspace.com/api/admin/${path}`, { method: data ? 'POST' : 'GET', headers: {
      Origin: 'https://getflexspace.com', 'CF-Connecting-IP': '192.0.2.21', ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers,
    }, ...(data ? { body: JSON.stringify(data) } : {}) }) };
}
export async function accountSession(db, role = 'editor') {
  const created = await accountsEndpoint(context(db, 'accounts', { action: 'create', username: 'agent', name: 'Test Agent', role }, ownerHeaders), ownerFetch);
  assert.equal(created.status, 201);
  const credentials = await created.json();
  const login = await authEndpoint(context(db, 'auth/login', credentials));
  assert.equal(login.status, 200);
  const session = await login.json();
  return { credentials, session, headers: { Cookie: login.headers.get('Set-Cookie').split(';')[0], Authorization: `Bearer ${session.cmsToken}` } };
}

