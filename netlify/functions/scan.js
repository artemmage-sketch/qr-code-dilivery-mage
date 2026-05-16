// netlify/functions/scan.js

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {

  // Preflight OPTIONS запит від браузера
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'OPENAI_API_KEY не налаштований у Netlify' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Невалідний JSON' }),
    };
  }

  const { image, mime = 'image/jpeg' } = body;
  if (!image) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Поле image відсутнє' }),
    };
  }

  const prompt = `Ти — система розпізнавання чеків ресторану.
Уважно прочитай текст на зображенні чеку і витягни наступні поля.
Відповідай ТІЛЬКИ валідним JSON без жодного іншого тексту, без markdown, без коментарів.

Поля:
- establishment: назва закладу (рядок вгорі, наприклад "Temari Sushi Тернопіль")
- receipt_number: номер чеку (після "Чек №")
- cashier: ім'я касира (після "Касир")
- client_name: ім'я клієнта (після "Клієнт")
- client_phone: номер телефону клієнта
- delivery_address: ТІЛЬКИ вулиця і номер будинку — без під'їзду, поверху, квартири. Наприклад "Злуки 4, Під'їзд 3, кв 103" → "Злуки 4". "вул. Шевченка 12, кв 5" → "вул. Шевченка 12"
- entrance: номер під'їзду якщо є в адресі (шукай "під'їзд", "підїзд", "п/ї") — тільки цифра або null
- floor: поверх якщо є в адресі (шукай "поверх", "пов.") — тільки цифра або null
- apartment: номер квартири якщо є в адресі (шукай "кв", "кв.", "квартира") — тільки цифра або null
- total: сума до оплати — тільки число без символів, наприклад "1045.95"
- payment_method: тип оплати (наприклад "Безготівкова", "Готівка")
- city: ТІЛЬКИ назва міста — без області, без індексу (з "Тернопіль, Тернопільська область, 46002" → "Тернопіль")

Якщо поле відсутнє — повертай null.

Приклад:
{"establishment":"Temari Sushi Тернопіль","receipt_number":"86200","cashier":"Олена","client_name":"Ніка","client_phone":"+380689238487","delivery_address":"Богдана Хмельницького 3","entrance":"2","floor":null,"apartment":"103","total":"1045.95","payment_method":"Безготівкова","city":"Тернопіль"}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mime};base64,${image}`,
                detail: 'high',
              },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: err?.error?.message || `OpenAI HTTP ${response.status}` }),
      };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const clean = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'GPT повернув невалідний JSON: ' + clean.slice(0, 200) }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
