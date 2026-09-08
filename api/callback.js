import {
  applySecurityHeaders,
  buildAuthResultPage,
  exchangeGitHubCode,
  getOAuthConfig,
  readStateCookie,
  stateCookie,
  validateOAuthState,
} from './_oauth.js';

export default async function handler(request, response) {
  applySecurityHeaders(response);

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).send('Method Not Allowed');
  }

  let config;
  try {
    config = getOAuthConfig();
  } catch {
    return response.status(500).send('OAuth is not configured correctly');
  }

  response.setHeader(
    'Set-Cookie',
    stateCookie('', { clear: true, secure: new URL(config.authOrigin).protocol === 'https:' }),
  );

  const validState = validateOAuthState(
    request.query.state,
    readStateCookie(request),
    config.cookieSecret,
  );
  if (!validState) return response.status(400).send('Invalid or expired OAuth state');

  let token;
  let error;
  if (request.query.error) {
    error = 'GitHub authorization was cancelled';
  } else if (!request.query.code) {
    error = 'GitHub did not return an authorization code';
  } else {
    try {
      token = await exchangeGitHubCode({ code: request.query.code, config });
    } catch {
      error = 'Unable to complete GitHub authentication';
    }
  }

  const page = buildAuthResultPage({ origin: config.cmsOrigin, token, error });
  response.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${page.nonce}'; style-src 'none'; base-uri 'none'; form-action 'none'`,
  );
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  return response.status(token ? 200 : 401).send(page.html);
}
