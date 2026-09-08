import {
  applySecurityHeaders,
  createOAuthState,
  getOAuthConfig,
  isAllowedSite,
  stateCookie,
} from './_oauth.js';

export default function handler(request, response) {
  applySecurityHeaders(response);

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).send('Method Not Allowed');
  }

  try {
    const config = getOAuthConfig();
    if (request.query.provider && request.query.provider !== 'github') {
      return response.status(400).send('Unsupported OAuth provider');
    }
    if (!isAllowedSite(request, config)) {
      return response.status(403).send('Invalid CMS site');
    }

    const { state, cookieValue } = createOAuthState(config.cookieSecret);
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      scope: 'repo',
      state,
    }).toString();

    response.setHeader(
      'Set-Cookie',
      stateCookie(cookieValue, { secure: new URL(config.authOrigin).protocol === 'https:' }),
    );
    return response.redirect(302, authorizeUrl.toString());
  } catch {
    return response.status(500).send('OAuth is not configured correctly');
  }
}
