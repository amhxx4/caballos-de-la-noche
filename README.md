# Caballos de la Noche

Sitio web estático de la comunidad Caballos de la Noche, mantenido en GitHub Pages.

## Qué incluye
- Página principal con historia, miembros, clips y secciones existentes.
- Chat flotante con IA.
- Modo desarrollador `/dev` para propuestas y vista previa.
- Backend seguro para Gemini con Cloudflare Worker.

## Seguridad
- Nunca guardes la API key de Gemini en JavaScript público.
- La clave debe ir en Cloudflare como secret con el nombre `GEMINI_API_KEY`.
- La web solo debe apuntar a un endpoint del Worker, nunca a la API de Gemini directamente.

## Configuración del worker
1. Instalar Wrangler:
   ```bash
   npm install -g wrangler
   ```
2. En la carpeta del repo:
   ```bash
   wrangler login
   wrangler secret put GEMINI_API_KEY
   ```
3. Desplegar:
   ```bash
   wrangler deploy
   ```
4. Copiar la URL del worker, por ejemplo:
   ```text
   https://caballos-chat.tu-subrepo.workers.dev/api/chat
   ```
5. En `index.html`, antes de abrir la web, define la URL del worker:
   ```html
   <script>
     window.CABALLOS_CHAT_API_URL = 'https://caballos-chat.tu-subrepo.workers.dev/api/chat';
   </script>
   ```
   O, si preferís, editá la constante `CHAT_API_URL` dentro del `script` del archivo `index.html`.

## Modo de uso
- Chat normal: escribí una pregunta.
- Modo desarrollador: escribí `/dev` seguido de lo que querés cambiar.
- La IA analiza el HTML actual, propone cambios y muestra una vista previa aislada.
- En esta primera versión, no se publican cambios automáticamente salvo que vos los apruebes manualmente.

## Reglas importantes
- La IA debe usar el lore que ya aparece en la web, sin inventar historias.
- La identidad visual actual se conserva: fondo negro, azul marino y detalles dorados.
- El formulario de sugerencias se mantiene funcionando.
- No se destruye el contenido existente ni se reconstruye la página desde cero.

## Estructura recomendada
- `index.html`: sitio actual + chat + modo /dev
- `worker.js`: Cloudflare Worker para llamar a Gemini de forma segura
- `wrangler.toml`: configuración del Worker

## Previsualización local
Si querés probarlo en local con una URL de desarrollo del worker:
```html
<script>
  window.CABALLOS_CHAT_API_URL = 'http://localhost:8787/api/chat';
</script>
```

## Importante
Esta primera versión no publica en GitHub automáticamente. La propuesta se genera y se previsualiza, pero vos decidís si la aceptás.
