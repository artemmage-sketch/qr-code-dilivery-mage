// netlify/functions/scan.js
// Проксі між браузером і OpenAI GPT-4o Vision
// Ключ API ніколи не потрапляє у браузер — зберігається в Netlify Environment Variables

exports.handler = async (event) => {
  // Дозволяємо тільки POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Читаємо ключ із змінної середовища Netlify
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'OPENAI_API_KEY не налаштований у Netlify' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Невалідний JSON' }) };
  }

  const { image, mime = 'image/jpeg' } = body;
  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Поле image відсутнє' }) };
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
- delivery_address: адреса доставлення (після "Адреса доставлення" або "Адреса доставки")
- total: сума до оплати — тільки число без символів, наприклад "1045.95"
- payment_method: тип оплати (наприклад "Безготівкова", "Готівка")
- city: ТІЛЬКИ назва міста — без області, без індексу (з "Тернопіль, Тернопільська область, 46002" → "Тернопіль")

Якщо поле відсутнє — повертай null.

Приклад:
{"establishment":"Temari Sushi Тернопіль","receipt_number":"86200","cashier":"Олена","client_name":"Ніка","client_phone":"+380689238487","delivery_address":"Богдана Хмельницького 3","total":"1045.95","payment_method":"Безготівкова","city":"Тернопіль"}`;

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
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mime};base64,${image}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: err?.error?.message || `OpenAI HTTP ${response.status}` }),
      };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    // Прибираємо можливі markdown-огорожі
    const clean = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GPT повернув невалідний JSON: ' + clean.slice(0, 200) }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
