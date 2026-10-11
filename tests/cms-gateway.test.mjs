import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { CONTENT_BRANCH, REPOSITORY } from '../server/admin-auth.js';
import { allowedRestPath, cmsGateway, editablePath, validateGraphQL } from '../server/cms-gateway.js';
import { accountSession, context, database } from './admin-fixtures.mjs';
const query = { query: 'query($owner: String!, $repo: String!, $branch: String!) { repository(owner: $owner, name: $repo) { ref(qualifiedName: $branch) { target { ... on Commit { history(first: 1) { nodes { oid message } } } } } } }', variables: { owner: 'jimkittridge', repo: 'getflexspace', branch: CONTENT_BRANCH } };
function mutation(path = 'src/content/locations/durham-nc.md') {
  return { query: 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid committedDate file_0: file(path: "src/content/locations/durham-nc.md") { oid } } } }', variables: { input: {
    branch: { repositoryNameWithOwner: REPOSITORY, branchName: CONTENT_BRANCH }, expectedHeadOid: 'a'.repeat(40),
    fileChanges: { additions: [{ path, contents: btoa('---\nname: Durham\n---\nWarehouse space.') }], deletions: [] }, message: { headline: 'Update Durham', body: 'Untrusted attribution' },
  } } };
}
test('gateway destination matches the actual CMS configuration', () => {
  const config = yaml.load(readFileSync(new URL('../public/admin/config.yml', import.meta.url), 'utf8'));
  assert.equal(config.backend.repo.toLowerCase(), REPOSITORY.toLowerCase()); assert.equal(config.backend.branch, CONTENT_BRANCH);
});
test('Sveltia reads and content commits are accepted with server-authored account attribution', () => {
  assert.deepEqual(validateGraphQL(query, 'grok').body, query);
  const result = validateGraphQL(mutation(), 'grok');
  assert.equal(result.body.variables.input.message.body, 'Website account: grok');
  assert.deepEqual(result.paths, ['src/content/locations/durham-nc.md']);
});
test('GraphQL rejects other repositories, extra operations, aliases, fragments, introspection and destructive mutations', () => {
  const bad = [
    { ...query, variables: { ...query.variables, repo: 'private-repo' } },
    { query: '{ viewer { repositories(first: 10) { nodes { name } } } }' },
    { ...query, query: query.query + '\n mutation { deleteRepository(input: {repositoryId:"x"}) { clientMutationId } }' },
    { query: '{ __schema { types { name } } }' },
    { query: '{ repository(owner:"jimkittridge",name:"GetFlexSpace") { ...Leak } } fragment Leak on Repository { name }' },
    { ...mutation(), query: 'mutation($input: CreateCommitOnBranchInput!) { hidden: createCommitOnBranch(input:$input) { commit { oid } } }' },
    { ...query, query: query.query.replace('history(first: 1)', 'history(first: 1000000)') },
  ];
  for (const item of bad) assert.throws(() => validateGraphQL(item, 'grok'));
});
test('content accounts cannot change code, configuration, auth, workflows, active uploads, paths outside collections or another branch', () => {
  const badPaths = ['.github/workflows/deploy.yml', 'functions/api/admin/accounts.js', 'public/admin/config.yml', 'src/content/locations/../../pages/admin.astro', 'src/content/locations/%2e%2e.md', 'public/images/a.svg', 'public/images/a.html', 'public/images/../a.png', 'public/images/.headers', 'src/content/pages/secret.md'];
  for (const path of badPaths) { assert.equal(editablePath(path), false); assert.throws(() => validateGraphQL(mutation(path), 'agent')); }
  const otherBranch = mutation(); otherBranch.variables.input.branch.branchName = 'master';
  assert.throws(() => validateGraphQL(otherBranch, 'agent'));
  const anotherRepo = mutation(); anotherRepo.variables.input.branch.repositoryNameWithOwner = 'jimkittridge/another';
  assert.throws(() => validateGraphQL(anotherRepo, 'agent'));
});
test('executable markdown and disguised images are rejected; safe uploads and deletion are supported', () => {
  for (const payload of ['<script>alert(1)</script>', '[click](javascript:alert(1))', 'image: data:image/svg+xml,something']) {
    const change = mutation(); change.variables.input.fileChanges.additions[0].contents = btoa(payload);
    assert.throws(() => validateGraphQL(change, 'agent'));
  }
  const image = mutation('public/images/new-photo.png');
  assert.throws(() => validateGraphQL(image, 'agent'));
  image.variables.input.fileChanges.additions[0].contents = btoa('\x89PNG\r\n\x1a\nexample');
  assert.doesNotThrow(() => validateGraphQL(image, 'agent'));
  const deletion = mutation(); deletion.variables.input.fileChanges = { additions: [], deletions: [{ path: 'src/content/blog/old-post.md' }] };
  assert.doesNotThrow(() => validateGraphQL(deletion, 'agent'));
});
test('REST access is restricted to this repository and read-only tree/blob requests', () => {
  assert.equal(allowedRestPath('/repos/jimkittridge/getflexspace'), `/repos/${REPOSITORY}`);
  assert.ok(allowedRestPath(`/repos/${REPOSITORY}/git/blobs/${'a'.repeat(40)}`));
  for (const path of ['/user', '/repos/other/private', `/repos/${REPOSITORY}/collaborators`, `/repos/${REPOSITORY}/hooks`, `/repos/${REPOSITORY}/contents/.env`]) assert.equal(allowedRestPath(path), null);
});
test('gateway uses the server credential only upstream, and an expired or copied CSRF marker makes no upstream call', async () => {
  const db = database(); const { headers } = await accountSession(db);
  let calls = 0;
  const upstream = async (url, options) => { calls++; assert.equal(url, 'https://api.github.com/graphql'); assert.equal(options.headers.Authorization, 'Bearer test-server-only-credential'); return Response.json({ data: { repository: { name: 'GetFlexSpace' } } }); };
  const response = await cmsGateway(context(db, 'github/graphql', query, headers), upstream);
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.ok(!(await response.text()).includes('test-server-only-credential'));
  assert.equal((await cmsGateway(context(db, 'github/graphql', query, { Authorization: headers.Authorization }), upstream)).status, 401);
  assert.equal(calls, 1);
  assert.equal((await cmsGateway(context(db, 'github/graphql', mutation('.github/workflows/pwn.yml'), headers), upstream)).status, 400);
  assert.equal(calls, 1);
});

 test('existing CMS markdown can still be saved, including ordinary HTML links', () => {
  const change = mutation('src/content/blog/clear-height-explained.md');
  change.variables.input.fileChanges.additions[0].contents = Buffer.from(readFileSync(new URL('../src/content/blog/clear-height-explained.md', import.meta.url))).toString('base64');
  assert.doesNotThrow(() => validateGraphQL(change, 'agent'));
});
test('YAML aliases and escaped executable URL schemes cannot evade validation', () => {
  for (const text of ['---\nmapEmbedUrl: "java\\x73cript:alert(1)"\n---\n', '---\ncycle: &cycle [*cycle]\n---\n']) {
    const change = mutation(); change.variables.input.fileChanges.additions[0].contents = Buffer.from(text).toString('base64');
    assert.throws(() => validateGraphQL(change, 'agent'));
  }
});
