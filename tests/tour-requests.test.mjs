import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { authorizeAdmin, listRequests, notifyRequest, submitRequest, updateRequest, validateRequest } from '../server/tour-requests.js';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_tour_requests.sql', import.meta.url), 'utf8'));
  return { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql);
    let args = [];
    return { bind(...values) { args = values; return this; },
      async run() { const result = statement.run(...args); return { meta: { changes: Number(result.changes) } }; },
      async first() { return statement.get(...args) || null; },
      async all() { return { results: statement.all(...args) }; },
    };
  } };
}
function lead() { return { id: crypto.randomUUID(), name: 'Test Visitor', location: 'Durham',
  business: 'Test Business', cell_phone: '(704) 555-0123', request_type: 'tour', website_confirm: '' }; }
function context(data, db, options = {}) {
  const promises = [];
  return { request: new Request('https://getflexspace.com/api/tour-requests', {
    method: 'POST', headers: { Origin: 'https://getflexspace.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10', ...options.headers },
    body: JSON.stringify(data),
  }), env: { LEADS_DB: db }, waitUntil(promise) { promises.push(promise); }, promises };
}
const adminFetch = async () => Response.json({ full_name: 'jimkittridge/GetFlexSpace', permissions: { push: true } });
const adminHeaders = { Authorization: `Bearer ${'a'.repeat(40)}`, Origin: 'https://getflexspace.com', 'Content-Type': 'application/json' };

test('stores a request before returning success and keeps PII out of the response', async () => {
  const db = database(); const data = lead(); const ctx = context(data, db);
  const response = await submitRequest(ctx);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, id: data.id });
  const row = db.sqlite.prepare('SELECT * FROM tour_requests').get();
  assert.equal(row.name, data.name); assert.equal(row.cell_phone, data.cell_phone);
  assert.equal(row.status, 'new'); assert.equal(row.email_status, 'pending');
  await Promise.all(ctx.promises);
});

test('a retry returns the original request and does not create a duplicate', async () => {
  const db = database(); const data = lead();
  await submitRequest(context(data, db));
  const response = await submitRequest(context(data, db));
  assert.equal(response.status, 200);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM tour_requests').get().count, 1);
  const conflict = await submitRequest(context({ ...data, name: 'Changed Name' }, db));
  assert.equal(conflict.status, 409);
});

test('rejects invalid phones, unexpected fields, oversized payloads, and cross-origin submissions', async () => {
  const db = database();
  for (const change of [{ cell_phone: '123' }, { cell_phone: '1234567890<script>' }, { name: '\r\nInjected header' },
    { website_confirm: 'bot' }, { request_type: 'arbitrary' }, { business: 'x'.repeat(201) }]) {
    assert.equal(validateRequest({ ...lead(), ...change }), null);
    assert.equal((await submitRequest(context({ ...lead(), ...change }, db))).status, 400);
  }
  assert.equal((await submitRequest(context({ ...lead(), business: 'x'.repeat(9000) }, db))).status, 400);
  assert.equal((await submitRequest(context(lead(), db, { headers: { Origin: 'https://example.org' } }))).status, 403);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM tour_requests').get().count, 0);
});

test('limits repeated submissions from the same connecting IP', async () => {
  const db = database();
  for (let i = 0; i < 5; i++) assert.equal((await submitRequest(context(lead(), db))).status, 201);
  assert.equal((await submitRequest(context(lead(), db))).status, 429);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM tour_requests').get().count, 5);
});

test('database failures do not produce a success response', async () => {
  const broken = { prepare() { throw new Error('Unavailable'); } };
  assert.equal((await submitRequest(context(lead(), broken))).status, 503);
  assert.equal((await submitRequest(context(lead(), undefined))).status, 503);
});

test('email failure preserves the saved lead, and retry sends to the fixed recipient only', async () => {
  const db = database(); const data = lead();
  await submitRequest(context(data, db));
  let row = db.sqlite.prepare('SELECT * FROM tour_requests').get();
  await notifyRequest(db, row, { TOUR_EMAIL_ENABLED: 'true', TOUR_NOTIFICATIONS: { notify: async () => { throw new Error('Timeout'); } } });
  row = db.sqlite.prepare('SELECT * FROM tour_requests').get();
  assert.equal(row.email_status, 'failed'); assert.equal(row.name, data.name);
  let calls = 0;
  const sender = { notify: async message => {
    calls++; assert.ok(message.subject.includes('Durham'));
    assert.ok(message.text.includes(data.id)); assert.ok(message.text.includes(data.business));
    assert.equal(Object.hasOwn(message, 'to'), false); return { messageId: 'test-message' };
  } };
  await notifyRequest(db, row, { TOUR_EMAIL_ENABLED: 'true', TOUR_NOTIFICATIONS: sender });
  await notifyRequest(db, row, { TOUR_EMAIL_ENABLED: 'true', TOUR_NOTIFICATIONS: sender });
  row = db.sqlite.prepare('SELECT * FROM tour_requests').get();
  assert.equal(row.email_status, 'sent'); assert.equal(row.email_attempts, 2); assert.equal(calls, 1);
});

test('no admin data is returned without repository write permission', async () => {
  const db = database(); await submitRequest(context(lead(), db));
  const request = new Request('https://getflexspace.com/api/admin/requests');
  assert.equal((await listRequests({ request, env: { LEADS_DB: db } }, adminFetch)).status, 401);
  const authenticated = new Request(request, { headers: adminHeaders });
  const readOnly = async () => Response.json({ full_name: 'jimkittridge/GetFlexSpace', permissions: { pull: true } });
  assert.equal(await authorizeAdmin(authenticated, readOnly), false);
  assert.equal((await listRequests({ request: authenticated, env: { LEADS_DB: db } }, readOnly)).status, 401);
  const response = await listRequests({ request: authenticated, env: { LEADS_DB: db } }, adminFetch);
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).requests.length, 1);
});

test('admin can update request status, but cannot bypass allowed statuses', async () => {
  const db = database(); const data = lead(); await submitRequest(context(data, db));
  const make = status => ({ request: new Request(`https://getflexspace.com/api/admin/requests/${data.id}`, {
    method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ status }),
  }), env: { LEADS_DB: db }, params: { id: data.id } });
  assert.equal((await updateRequest(make('contacted'), adminFetch)).status, 200);
  assert.equal(db.sqlite.prepare('SELECT status FROM tour_requests').get().status, 'contacted');
  assert.equal((await updateRequest(make('invalid'), adminFetch)).status, 400);
});

test('only one sender claims a pending email', async () => {
  const db = database(); const data = lead(); await submitRequest(context(data, db));
  const saved = db.sqlite.prepare('SELECT * FROM tour_requests').get(); let calls = 0;
  const sender = { notify: async () => { calls++; return { messageId: 'test-message' }; } };
  await Promise.all([notifyRequest(db, saved, { TOUR_EMAIL_ENABLED: 'true', TOUR_NOTIFICATIONS: sender }), notifyRequest(db, saved, { TOUR_EMAIL_ENABLED: 'true', TOUR_NOTIFICATIONS: sender })]);
  assert.equal(calls, 1);
});
