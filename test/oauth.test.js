import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAuthResultPage,
  createOAuthState,
  exchangeGitHubCode,
  getOAuthConfig,
  parseCookies,
  stateCookie,
  validateOAuthState,
} from '../api/_oauth.js';
import authHandler from '../api/auth.js';
import callbackHandler from '../api/callback.js';

const secret = 'test-cookie-secret';

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    redirect(code, location) {
      this.statusCode = code;
      this.headers.Location = location;
      return this;
    },
  };
}

async function withOAuthEnvironment(callback) {
  const previous = {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    OAUTH_COOKIE_SECRET: process.env.OAUTH_COOKIE_SECRET,
    CMS_ORIGIN: process.env.CMS_ORIGIN,
    AUTH_ORIGIN: process.env.AUTH_ORIGIN,
  };
  Object.assign(process.env, {
    GITHUB_CLIENT_ID: 'client',
    GITHUB_CLIENT_SECRET: 'client-secret',
    OAUTH_COOKIE_SECRET: secret,
    CMS_ORIGIN: 'https://example.com',
    AUTH_ORIGIN: 'https://auth.example.com',
  });
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('OAuth state round-trips and rejects tampering', () => {
  const { state, cookieValue } = createOAuthState(secret);
  assert.equal(validateOAuthState(state, cookieValue, secret), true);
  assert.equal(validateOAuthState(`${state}x`, cookieValue, secret), false);
  assert.equal(validateOAuthState(state, `${cookieValue}x`, secret), false);
  assert.equal(validateOAuthState('', cookieValue, secret), false);
});

test('cookie helpers encode values and parse cookie headers', () => {
  const header = stateCookie('value.with/signature', { secure: true });
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Secure/);
  assert.equal(parseCookies('one=1; moran_cms_oauth_state=value.with%2Fsignature').moran_cms_oauth_state, 'value.with/signature');
});

test('configuration keeps the CMS and authentication origins separate', () => {
  const config = getOAuthConfig({
    GITHUB_CLIENT_ID: 'client',
    GITHUB_CLIENT_SECRET: 'secret',
    OAUTH_COOKIE_SECRET: 'cookie',
    CMS_ORIGIN: 'https://example.com/',
    AUTH_ORIGIN: 'https://auth.example.com/',
  });
  assert.equal(config.cmsOrigin, 'https://example.com');
  assert.equal(config.authOrigin, 'https://auth.example.com');
  assert.equal(config.callbackUrl, 'https://auth.example.com/api/callback');
  assert.equal(config.cmsHostname, 'example.com');
  assert.throws(() => getOAuthConfig({}), /Missing OAuth configuration/);
});

test('callback page implements the Decap CMS handshake without unsafe HTML interpolation', () => {
  const page = buildAuthResultPage({
    origin: 'https://example.com',
    token: 'token</script>',
  });
  assert.match(page.html, /authorizing:github/);
  assert.match(page.html, /authorization:github:success/);
  assert.doesNotMatch(page.html, /token<\/script>/);
  assert.match(page.html, new RegExp(`nonce="${page.nonce}"`));
});

test('GitHub token exchange sends form data and returns the access token', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      async json() {
        return { access_token: 'github-token' };
      },
    };
  };
  const token = await exchangeGitHubCode({
    code: 'auth-code',
    config: {
      clientId: 'client',
      clientSecret: 'secret',
      callbackUrl: 'https://example.com/api/callback',
    },
    fetchImpl,
  });
  assert.equal(token, 'github-token');
  assert.equal(request.url, 'https://github.com/login/oauth/access_token');
  assert.match(request.options.body.toString(), /code=auth-code/);
});

test('auth handler sets a signed cookie and redirects to GitHub', async () => {
  await withOAuthEnvironment(() => {
    const response = mockResponse();
    authHandler(
      {
        method: 'GET',
        query: { provider: 'github', site_id: 'example.com' },
        headers: {},
      },
      response,
    );
    const location = new URL(response.headers.Location);
    assert.equal(response.statusCode, 302);
    assert.equal(location.origin, 'https://github.com');
    assert.equal(location.searchParams.get('client_id'), 'client');
    assert.equal(location.searchParams.get('scope'), 'repo');
    assert.ok(location.searchParams.get('state'));
    assert.match(response.headers['Set-Cookie'], /HttpOnly/);
  });
});

test('callback handler rejects invalid state before exchanging a token', async () => {
  await withOAuthEnvironment(async () => {
    const response = mockResponse();
    await callbackHandler(
      {
        method: 'GET',
        query: { code: 'code', state: 'invalid' },
        headers: { cookie: 'moran_cms_oauth_state=invalid.signature' },
      },
      response,
    );
    assert.equal(response.statusCode, 400);
    assert.equal(response.body, 'Invalid or expired OAuth state');
  });
});

test('callback handler returns a Decap-compatible error page after valid state', async () => {
  await withOAuthEnvironment(async () => {
    const { state, cookieValue } = createOAuthState(secret);
    const response = mockResponse();
    await callbackHandler(
      {
        method: 'GET',
        query: { error: 'access_denied', state },
        headers: { cookie: `moran_cms_oauth_state=${encodeURIComponent(cookieValue)}` },
      },
      response,
    );
    assert.equal(response.statusCode, 401);
    assert.match(response.body, /authorization:github:error/);
    assert.match(response.headers['Content-Security-Policy'], /script-src 'nonce-/);
    assert.match(response.headers['Set-Cookie'], /Max-Age=0/);
  });
});
