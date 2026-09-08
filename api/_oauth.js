import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const STATE_COOKIE = 'moran_cms_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_ORIGIN = 'https://moran.is-a.dev';

export function getOAuthConfig(env = process.env) {
  const config = {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    cookieSecret: env.OAUTH_COOKIE_SECRET,
    origin: (env.CMS_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, ''),
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => key !== 'origin' && !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing OAuth configuration: ${missing.join(', ')}`);
  }

  const origin = new URL(config.origin);
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    throw new Error('CMS_ORIGIN must use HTTPS');
  }

  return {
    ...config,
    callbackUrl: `${config.origin}/api/callback`,
    hostname: origin.hostname,
  };
}

function signState(state, secret) {
  return createHmac('sha256', secret).update(state).digest('base64url');
}

export function createOAuthState(secret) {
  const state = randomBytes(32).toString('base64url');
  return {
    state,
    cookieValue: `${state}.${signState(state, secret)}`,
  };
}

export function validateOAuthState(state, cookieValue, secret) {
  if (!state || !cookieValue) return false;

  const separator = cookieValue.lastIndexOf('.');
  if (separator < 1) return false;

  const cookieState = cookieValue.slice(0, separator);
  const cookieSignature = cookieValue.slice(separator + 1);
  const expectedSignature = signState(cookieState, secret);

  const stateBuffer = Buffer.from(state);
  const cookieStateBuffer = Buffer.from(cookieState);
  const signatureBuffer = Buffer.from(cookieSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    stateBuffer.length === cookieStateBuffer.length &&
    timingSafeEqual(stateBuffer, cookieStateBuffer) &&
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const separator = part.indexOf('=');
        const key = separator === -1 ? part : part.slice(0, separator);
        const value = separator === -1 ? '' : part.slice(separator + 1);
        try {
          return [key, decodeURIComponent(value)];
        } catch {
          return [key, value];
        }
      }),
  );
}

export function stateCookie(value, { clear = false, secure = true } = {}) {
  const parts = [
    `${STATE_COOKIE}=${clear ? '' : encodeURIComponent(value)}`,
    'Path=/api/callback',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${clear ? 0 : STATE_TTL_SECONDS}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readStateCookie(request) {
  return parseCookies(request.headers.cookie)[STATE_COOKIE];
}

export function applySecurityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}

export function isAllowedSite(request, config) {
  const siteId = request.query.site_id;
  return !siteId || siteId === config.hostname;
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildAuthResultPage({ origin, token, error }) {
  const nonce = randomBytes(18).toString('base64url');
  const status = token
    ? `authorization:github:success:${safeJson({ token, provider: 'github' })}`
    : `authorization:github:error:${safeJson({ message: error || 'GitHub authentication failed' })}`;

  const html = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GitHub 登录</title></head>
  <body>
    <p id="status">正在完成 GitHub 登录…</p>
    <script nonce="${nonce}">
      (() => {
        const targetOrigin = ${safeJson(origin)};
        const result = ${safeJson(status)};
        const statusNode = document.getElementById('status');
        if (!window.opener) {
          statusNode.textContent = '登录窗口已失去与后台的连接，请关闭后重试。';
          return;
        }
        const finish = event => {
          if (event.origin !== targetOrigin || event.source !== window.opener || event.data !== 'authorizing:github') return;
          window.removeEventListener('message', finish);
          window.opener.postMessage(result, targetOrigin);
          window.close();
        };
        window.addEventListener('message', finish);
        window.opener.postMessage('authorizing:github', targetOrigin);
      })();
    </script>
  </body>
</html>`;

  return { html, nonce };
}

export async function exchangeGitHubCode({ code, config, fetchImpl = fetch }) {
  const response = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'moran-blog-decap-cms',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.callbackUrl,
    }),
  });

  if (!response.ok) throw new Error('GitHub token exchange failed');
  const payload = await response.json();
  if (!payload.access_token) throw new Error('GitHub did not return an access token');
  return payload.access_token;
}

