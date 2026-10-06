import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Replace only the Cloudflare platform base class; exercise the real worker code.
const source = readFileSync(new URL('../notification-worker/index.js', import.meta.url), 'utf8')
  .replace("import { WorkerEntrypoint } from 'cloudflare:workers';", 'class WorkerEntrypoint { constructor(env) { this.env = env; } }');
const { default: Worker } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('public HTTP requests cannot send notifications', async () => {
  let calls = 0;
  const worker = new Worker({ EMAIL: { send: async () => { calls++; } } });
  assert.equal(worker.fetch().status, 404);
  assert.equal(calls, 0);
});

test('private notification method fixes the sender and recipient', async () => {
  let delivered;
  const worker = new Worker({ EMAIL: { send: async message => { delivered = message; return { messageId: 'test' }; } } });
  await worker.notify({ subject: 'Tour request', text: 'Test request details', to: 'unexpected@example.org' });
  assert.equal(delivered.to, 'jim@rothcapital.com');
  assert.equal(delivered.from.email, 'notifications@getflexspace.com');
  assert.equal(delivered.text, 'Test request details');
});

test('notification method rejects header injection and oversized content', async () => {
  const worker = new Worker({ EMAIL: { send: async () => assert.fail('Invalid mail must not send') } });
  await assert.rejects(worker.notify({ subject: 'Tour\r\nBcc: other@example.org', text: 'Test' }));
  await assert.rejects(worker.notify({ subject: 'Tour', text: 'x'.repeat(3001) }));
});
