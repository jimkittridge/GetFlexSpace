import { parse, valueFromASTUntyped, visit } from 'graphql';
import yaml from 'js-yaml';
import { audit, CONTENT_BRANCH, readBody, REPOSITORY, reply, sameOrigin, sessionAccount } from './admin-auth.js';

// Sveltia 0.229.0's GitHub queries. An allowlist prevents traversal into other
// repositories, the credential owner's account, or unrelated API capabilities.
const READ_FIELDS = new Set(`repository defaultBranchRef name ref target refUpdateRule viewerCanPush
  history nodes author email user databaseId login avatarUrl committedDate oid message object text
  isTruncated status contexts context state targetUrl description deployments environment latestStatus
  environmentUrl logUrl createdAt checkSuites checkRuns conclusion detailsUrl output summary title url
  pageInfo hasNextPage endCursor`.split(/\s+/));
const WRITE_FIELDS = new Set(['createCommitOnBranch', 'commit', 'oid', 'committedDate', 'file']);
const OWNER = REPOSITORY.split('/')[0], REPO = REPOSITORY.split('/')[1];
function requireValid(condition) { if (!condition) throw new Error('This action is not permitted for a website account.'); }

export function editablePath(path) {
  if (typeof path !== 'string' || path.length > 240 || /[\\\u0000-\u001f%?#]/.test(path)
    || path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) return false;
  return /^src\/content\/(locations|blog)\/[a-z0-9][a-z0-9-]*\.md$/.test(path)
    || /^src\/content\/pages\/(homepage|contact|faq)\.md$/.test(path)
    || /^public\/images\/[a-zA-Z0-9_ ./-]+\.(png|jpe?g|webp|gif)$/i.test(path)
    || /^public\/documents\/[a-zA-Z0-9_ ./-]+\.pdf$/i.test(path);
}
function validateAddition(addition) {
  requireValid(editablePath(addition?.path) && typeof addition.contents === 'string'
    && addition.contents.length <= 16 * 1024 * 1024 && /^[A-Za-z0-9+/]*={0,2}$/.test(addition.contents));
  const bytes = Uint8Array.from(atob(addition.contents), c => c.charCodeAt(0));
  if (addition.path.endsWith('.md')) {
    requireValid(bytes.length <= 512 * 1024);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Content accounts cannot publish executable HTML or URL schemes. Markdown
    // is also sanitized at render time; script JSON is escaped in both layouts.
    requireValid(!/<\s*\/?\s*(script|iframe|object|embed|style|link|meta)\b/i.test(text)
      && !/(?:javascript|vbscript|data)\s*:/i.test(text));
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    requireValid(frontmatter);
    const values = [yaml.load(frontmatter[1])], seen = new Set();
    let inspected = 0;
    while (values.length) {
      requireValid(++inspected <= 10000);
      const value = values.pop();
      if (typeof value === 'string') requireValid(!/^(?:javascript|vbscript|data):/i.test(value.replace(/[\u0000-\u0020]/g, '')));
      else if (value && typeof value === 'object') {
        requireValid(!seen.has(value)); seen.add(value); values.push(...Object.values(value));
      }
    }
  } else {
    const head = Array.from(bytes.slice(0, 12), b => String.fromCharCode(b)).join('');
    const extension = addition.path.split('.').at(-1).toLowerCase();
    const signatures = {
      png: head.startsWith('\x89PNG\r\n\x1a\n'), jpg: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      jpeg: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      gif: /^GIF8[79]a/.test(head), webp: head.startsWith('RIFF') && head.slice(8) === 'WEBP',
      pdf: head.startsWith('%PDF-'),
    };
    requireValid(signatures[extension]);
  }
  return { path: addition.path, contents: addition.contents };
}

export function validateGraphQL(body, actor) {
  requireValid(typeof body.query === 'string' && body.query.length < 400000);
  const ast = parse(body.query, { maxTokens: 60000 });
  requireValid(ast.definitions.length === 1);
  const operation = ast.definitions[0];
  requireValid(operation.kind === 'OperationDefinition' && ['query', 'mutation'].includes(operation.operation));
  const variables = body.variables || {};
  const roots = operation.selectionSet.selections;
  const write = operation.operation === 'mutation';
  requireValid(roots.length === 1 && roots[0].kind === 'Field' && !roots[0].alias
    && roots[0].name.value === (write ? 'createCommitOnBranch' : 'repository'));
  let count = 0;
  visit(ast, {
    FragmentSpread() { requireValid(false); },
    Directive() { requireValid(false); },
    Field(node, key, parent, path) {
      requireValid(++count < 16000 && path.length < 100);
      requireValid((write ? WRITE_FIELDS : READ_FIELDS).has(node.name.value));
      if (node.name.value === 'repository') {
        requireValid(node === roots[0]);
        const args = Object.fromEntries(node.arguments.map(arg => [arg.name.value, valueFromASTUntyped(arg.value, variables)]));
        requireValid(args.owner?.toLowerCase() === OWNER && args.name?.toLowerCase() === REPO.toLowerCase());
      }
      for (const arg of node.arguments || []) {
        if (['first', 'last'].includes(arg.name.value)) {
          const number = valueFromASTUntyped(arg.value, variables);
          requireValid(Number.isInteger(number) && number >= 1 && number <= 100);
        }
      }
    },
  });
  if (!write) return { body: { query: body.query, variables }, paths: [] };
  const inputArgument = roots[0].arguments;
  requireValid(inputArgument.length === 1 && inputArgument[0].name.value === 'input'
    && inputArgument[0].value.kind === 'Variable');
  const key = inputArgument[0].value.name.value;
  const input = variables[key];
  requireValid(input?.branch?.repositoryNameWithOwner?.toLowerCase() === REPOSITORY.toLowerCase()
    && input.branch.branchName === CONTENT_BRANCH && /^[0-9a-f]{40}$/.test(input.expectedHeadOid));
  const additions = input.fileChanges?.additions ?? [], deletions = input.fileChanges?.deletions ?? [];
  requireValid(Array.isArray(additions) && Array.isArray(deletions)
    && additions.length + deletions.length > 0 && additions.length + deletions.length <= 100);
  const safeAdditions = additions.map(validateAddition);
  const safeDeletions = deletions.map(item => { requireValid(editablePath(item?.path)); return { path: item.path }; });
  requireValid(typeof input.message?.headline === 'string' && input.message.headline.length <= 300);
  // Build the input again: no author impersonation, repository IDs, or unsupported
  // mutation options supplied by the browser are forwarded.
  const safeInput = {
    branch: { repositoryNameWithOwner: REPOSITORY, branchName: CONTENT_BRANCH },
    expectedHeadOid: input.expectedHeadOid,
    fileChanges: { additions: safeAdditions, deletions: safeDeletions },
    message: { headline: input.message.headline.replace(/[\r\n\u0000]/g, ' '), body: `Website account: ${actor}` },
  };
  return { body: { query: body.query, variables: { [key]: safeInput } }, paths: [...safeAdditions, ...safeDeletions].map(item => item.path) };
}

export function allowedRestPath(path) {
  const prefix = `/repos/${REPOSITORY}`;
  if (path.toLowerCase() === prefix.toLowerCase()) return prefix;
  if (!path.toLowerCase().startsWith(prefix.toLowerCase() + '/')) return null;
  const suffix = path.slice(prefix.length);
  if (/^\/git\/(trees|blobs)\/[0-9a-f]{40}$/.test(suffix)) return prefix + suffix;
  if (suffix === `/git/trees/${encodeURIComponent(CONTENT_BRANCH)}` || suffix === `/git/trees/${CONTENT_BRANCH}`) return prefix + suffix;
  return null;
}

export async function cmsGateway({ request, env }, fetcher = fetch) {
  try {
    const account = await sessionAccount(request, env);
    if (!account) return reply({ message: 'Your sign-in expired. Please sign in again.' }, 401);
    if (!env.CMS_GITHUB_TOKEN) return reply({ message: 'Content editing needs its GitHub connection. The owner can finish this under Accounts.' }, 503);
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/admin\/github/, '');
    const upstreamHeaders = { Authorization: `Bearer ${env.CMS_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'User-Agent': 'GetFlexSpace-CMS-Gateway', 'X-GitHub-Api-Version': '2022-11-28' };
    let upstream, options, changes = [];
    if (path === '/graphql' && request.method === 'POST') {
      if (!sameOrigin(request)) return reply({ message: 'Invalid origin.' }, 403);
      const validated = validateGraphQL(await readBody(request, 20 * 1024 * 1024), account.username);
      changes = validated.paths;
      upstream = 'https://api.github.com/graphql';
      options = { method: 'POST', body: JSON.stringify(validated.body), headers: { ...upstreamHeaders, 'Content-Type': 'application/json' } };
    } else if (path.startsWith('/api/v3') && request.method === 'GET') {
      const rest = path.slice('/api/v3'.length);
      if (rest === '/user') return reply({ id: account.id, login: account.username, name: account.display_name,
        html_url: new URL('/admin/', url).href, avatar_url: new URL('/favicon.svg', url).href });
      const allowed = allowedRestPath(rest);
      if (!allowed) return reply({ message: 'This API is not available to website accounts.' }, 403);
      const query = new URLSearchParams();
      if (url.searchParams.get('recursive') === '1') query.set('recursive', '1');
      upstream = `https://api.github.com${allowed}${query.size ? `?${query}` : ''}`;
      if (request.headers.get('Accept')?.includes('application/vnd.github.raw')) upstreamHeaders.Accept = 'application/vnd.github.raw';
      options = { headers: upstreamHeaders };
    } else return reply({ message: 'This action is not available to website accounts.' }, 403);
    const response = await fetcher(upstream, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (changes.length && response.ok) {
      const data = await response.clone().json();
      if (data.data?.createCommitOnBranch?.commit?.oid) await audit(env.LEADS_DB, account.username, 'content_saved', changes.join(', '));
    }
    return new Response(response.body, { status: response.status, headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
    } });
  } catch { return reply({ message: 'This content request could not be completed. Check that it only changes website text, photos, or PDFs, then try again.' }, 400); }
}
