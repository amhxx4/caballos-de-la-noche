export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const message = String(body.message || '').trim();
      const mode = String(body.mode || 'chat').toLowerCase();
      const htmlSnapshot = String(body.htmlSnapshot || '').slice(0, 18000);

      if (!message) {
        return new Response(JSON.stringify({ ok: false, error: 'Escribí un mensaje válido.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (message.length > 1800) {
        return new Response(JSON.stringify({ ok: false, error: 'El mensaje es demasiado largo.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!env.GEMINI_API_KEY) {
        return new Response(JSON.stringify({ ok: false, error: 'Falta la variable GEMINI_API_KEY en Cloudflare.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const systemPrompt = `
      Eres un asistente de Caballos de la Noche.
      Habla en español rioplatense y con tono de amigo, pero con criterio.
      Nunca inventes anécdotas, historia o miembros que no aparezcan en el sitio.
      Debés usar solo el lore público visible en la página: grupo creado por Israel, comunidad de JTCO, roles de administradores, moderadores, Caballo de San Martín, clips como "Pero corréte del medio", "Filósofo el tipo", "Lo sigue con la cabeza!!" y "¡Ole temonio!".
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
          4) Devolver JSON válidamente formateado con estas claves exactas:
             - summary: resumen breve
             - proposedChanges: array de strings
             - notes: array de strings
             - previewHtml: un documento HTML completo listo para mostrarse en una vista previa aislada
             - downloadName: nombre de archivo sugerido
          5) No publiques automáticamente cambios en GitHub ni en el sitio real.
          6) Conservá todo lo existente salvo que el usuario pida cambiarlo.
          7) Devuelve SOLO el JSON, sin markdown ni texto extra.
        `
        : `
          Modo: conversación normal.
          Responde en español rioplatense, con onda de amigo, corto y útil.
          Habla sobre la historia, miembros, roles, clips y lore visible de la página.
          Si no sabés algo, decilo sin inventar.
          No escribas más de 4-6 párrafos.
          No uses markdown complejo.
        `;

      const prompt = `${systemPrompt}\n\n${modePrompt}\n\nConsulta del usuario:\n${message}\n\nHTML actual de la página:\n${htmlSnapshot}`;

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }]
        })
      });

      const geminiData = await geminiResponse.json();

      if (!geminiResponse.ok || !geminiData?.candidates?.[0]?.content?.parts) {
        return new Response(JSON.stringify({ ok: false, error: 'La API de Gemini falló o no devolvió contenido válido.' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const rawText = geminiData.candidates[0].content.parts
        .map((part) => part.text || '')
        .join('\n')
        .trim();

      if (mode === 'developer') {
        let parsed;
        try {
          const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
          parsed = JSON.parse(cleaned);
        } catch (error) {
          parsed = {
            summary: 'Propuesta generada a partir del HTML actual.',
            proposedChanges: [rawText],
            notes: ['La respuesta no vino en JSON puro, así que se devolvió como texto de fallback.'],
            previewHtml: `<html><body style="font-family:Arial,sans-serif;background:#0b0f1c;color:#e7e9f1;padding:24px;"><h2 style="color:#d9a94a;">Propuesta</h2><pre style="white-space:pre-wrap;">${escapeHtml(rawText)}</pre></body></html>`,
            downloadName: 'caballos-dev-propuesta.html'
          };
        }

        return new Response(JSON.stringify({ ok: true, data: parsed }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ ok: true, reply: rawText }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ ok: false, error: 'Error interno del Worker: ' + (error?.message || 'Desconocido') }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
