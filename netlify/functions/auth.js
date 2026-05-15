// netlify/functions/auth.js
// Користувачі зберігаються в Netlify Environment Variables як JSON:
// APP_USERS = [{"login":"courier1","password":"pass1"},{"login":"courier2","password":"pass2"}]

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

  // Читаємо список користувачів з ENV
  let users = [];
  try {
    users = JSON.parse(process.env.APP_USERS || '[]');
  } catch {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: 'APP_USERS має невалідний формат JSON' }),
    };
  }

  const found = users.find(u => u.login === login && u.password === password);

  if (found) {
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
