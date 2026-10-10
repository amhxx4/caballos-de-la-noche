```javascript
const ALLOWED_ORIGINS = [
  'https://amhxx4.github.io',
];

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin)
    ? origin
    : 'https://amhxx4.github.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=UTF-8',
    };

    const jsonResponse = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response(null, { status: 403, headers });
      }

      return new Response(null, { status: 204, headers });
    }

    // Permitir solamente el origen autorizado
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse(
        { ok: false, error: 'Origen no autorizado.' },
        403
      );
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        { ok: false, error: 'Método no permitido.' },
        405
      );
    }

    try {
      const body = await request.json();
      const message = String(body.message || '').trim();
      const mode = String(body.mode || 'chat').toLowerCase();
      const htmlSnapshot = String(body.htmlSnapshot || '').slice(0, 18000);

      if (!message) {
        return jsonResponse(
          { ok: false, error: 'Escribí un mensaje válido.' },
          400
        );
      }

      if (message.length > 1800) {
        return jsonResponse(
          { ok: false, error: 'El mensaje es demasiado largo.' },
          400
        );
      }

      if (!env.GEMINI_API_KEY) {
        return jsonResponse(
          { ok: false, error: 'Falta la variable GEMINI_API_KEY en Cloudflare.' },
          500
        );
      }

      const systemPrompt = `
Eres un asistente de Caballos de la Noche.
Habla en español rioplatense y con tono de amigo, pero con criterio.
Nunca inventes anécdotas, historia o miembros que no aparezcan en el sitio.
Debés usar solo el lore público visible en la página: grupo creado por Israel, comunidad de JTCO, roles de administradores, moderadores, Caballo de San Martín, clips como "Pero corréte del medio" y los links a Medal.tv.
La identidad visual de la página es negra con azul marino y detalles dorados.
Guardá la estructura actual del sitio y no destruyas contenido existente salvo que el usuario lo pida explícitamente.
`;

      const modePrompt = mode === 'developer'
        ? `
Modo: desarrollador.
El usuario quiere proponer cambios en la web actual.
Tu tarea es:
1) Analizar el HTML entregado.
2) Entender qué quiere cambiar el usuario.
3) Generar una propuesta coherente que respete la estructura actual.
4) Devolver JSON válido con estas claves exactas:
   - summary: resumen breve
   - proposedChanges: array de strings
   - notes: array de strings
   - previewHtml: un documento HTML completo listo para mostrarse en una vista previa aislada
   - downloadName: nombre de archivo sugerido
5) No publiques automáticamente cambios en GitHub ni en el sitio real.
6) Conservá todo lo existente salvo que el usuario pida cambiarlo.
7) Devolvé SOLO el JSON, sin markdown ni texto extra.
`
        : `
Modo: conversación normal.
Responde en español rioplatense, con onda de amigo, corto y útil.
Habla sobre la historia, miembros, roles, clips y lore visible de la página.
Si no sabés algo, decilo sin inventar.
No escribas más de 4-6 párrafos.
No uses markdown complejo.
`;

      const prompt = `${systemPrompt}

${modePrompt}

Consulta del usuario:
${message}

HTML actual de la página:
${htmlSnapshot}`;

      const geminiResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
          encodeURIComponent(env.GEMINI_API_KEY),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: prompt }],
            }],
          }),
        }
      );

      const geminiData = await geminiResponse.json();

      if (
        !geminiResponse.ok ||
        !geminiData?.candidates?.[0]?.content?.parts
      ) {
        return jsonResponse(
          { ok: false, error: 'La API de Gemini falló o no devolvió contenido válido.' },
          502
        );
      }

      const rawText = geminiData.candidates[0].content.parts
        .map((part) => part.text || '')
        .join('\n')
        .trim();

      if (mode === 'developer') {
        let parsed;

        try {
          const cleaned = rawText
            .replace(/^```json\s*/i, '')
            .replace(/```$/i, '')
            .trim();

          parsed = JSON.parse(cleaned);
        } catch {
          parsed = {
            summary: 'Propuesta generada a partir del HTML actual.',
            proposedChanges: [rawText],
            notes: [
              'La respuesta no vino en JSON puro; se devolvió como texto de respaldo.',
            ],
            previewHtml: `<html><body style="font-family:Arial,sans-serif;background:#0b0f1c;color:#e7e9f1;padding:24px;"><h2 style="color:#d9a94a;">Propuesta</h2><pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(rawText)}</pre></body></html>`,
            downloadName: 'caballos-dev-propuesta.html',
          };
        }

        return jsonResponse({ ok: true, data: parsed });
      }

      return jsonResponse({ ok: true, reply: rawText });
    } catch {
      return jsonResponse(
        { ok: false, error: 'Error interno del Worker al procesar la solicitud.' },
        500
      );
    }
  },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```
