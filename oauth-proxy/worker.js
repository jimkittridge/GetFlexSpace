// Decap CMS OAuth Proxy for GitHub — Cloudflare Worker
// Env vars required: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === '/auth') {
      return handleAuth(url, env);
    }

    if (url.pathname === '/callback') {
      return handleCallback(url, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

function handleAuth(url, env) {
  const scope = url.searchParams.get('scope') || 'repo,user';
  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `${url.origin}/callback`);
  authUrl.searchParams.set('scope', scope);

  return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(url, env) {
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Missing code parameter', { status: 400 });
  }

  // Exchange code for token
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await tokenRes.json();

  // Build the handshake message, then embed it as a properly escaped JS
  // string literal. Interpolating raw JSON here would emit unescaped double
  // quotes and break the inline script with a SyntaxError.
  const message = data.access_token
    ? `authorization:github:success:${JSON.stringify({ token: data.access_token, provider: 'github' })}`
    : `authorization:github:error:${JSON.stringify(data)}`;

  // Return HTML that sends the token back to the CMS via postMessage
  const html = `<!doctype html>
<html><body><script>
(function() {
  function sendMsg(msg) {
    var sent = false;
    function receive(e) {
      window.removeEventListener("message", receive, false);
      e.source.postMessage(msg, e.origin);
      sent = true;
    }
    window.addEventListener("message", receive, false);
    window.opener.postMessage("authorizing:github", "*");
    setTimeout(function() {
      if (!sent) window.close();
    }, 5000);
  }
  sendMsg(${JSON.stringify(message)});
})();
</script></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
