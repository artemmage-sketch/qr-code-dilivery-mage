// netlify/functions/auth.js
// Логін і пароль зберігаються в Netlify Environment Variables:
// APP_LOGIN і APP_PASSWORD

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ ok: false }) };
  }

  const { login, password } = body;
  const correctLogin    = process.env.APP_LOGIN;
  const correctPassword = process.env.APP_PASSWORD;

  if (login === correctLogin && password === correctPassword) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: true }),
    };
  }

  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify({ ok: false }),
  };
};
