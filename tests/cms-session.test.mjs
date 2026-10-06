import test from 'node:test';
import assert from 'node:assert/strict';
import { readCmsSession } from '../src/lib/cms-session.js';

const user = { backendName: 'github', token: 'test-token-not-a-secret-1234567890', login: 'test-editor' };
function storage(values = {}) { return { getItem: key => values[key] ?? null }; }

test('uses the existing Sveltia session without copying credentials or unrelated account data', () => {
  assert.deepEqual(readCmsSession(storage({ 'sveltia-cms.user': JSON.stringify(user) })), { token: user.token });
});

test('does not resurrect a legacy login after Sveltia signs out or writes an invalid cache', () => {
  for (const signedOut of ['{}', 'null', 'invalid-json', JSON.stringify({ ...user, token: '' })]) {
    assert.equal(readCmsSession(storage({ 'sveltia-cms.user': signedOut, 'decap-cms-user': JSON.stringify(user) })), null);
  }
});

test('only accepts a GitHub session with a valid header-safe token', () => {
  for (const changed of [{ backendName: 'local' }, { backendName: 'gitlab' }, { token: 'short' },
    { token: 'x'.repeat(256) }, { token: 'valid-length-but\nheader-injection' }, { token: 123 }]) {
    assert.equal(readCmsSession(storage({ 'sveltia-cms.user': JSON.stringify({ ...user, ...changed }) })), null);
  }
});

test('supports the CMS legacy cache only when no primary cache exists', () => {
  assert.deepEqual(readCmsSession(storage({ 'decap-cms-user': JSON.stringify(user) })), { token: user.token });
  assert.equal(readCmsSession(storage()), null);
});

test('fails closed when browser storage is unavailable', () => {
  assert.equal(readCmsSession({ getItem() { throw new Error('Storage denied'); } }), null);
});
