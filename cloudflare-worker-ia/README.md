# Worker de recomendación IA (Meta y Recomendación IA — Parte 6)

Esto es un proyecto APARTE de `index.html` — un pequeño programa que corre en los
servidores de Cloudflare (no en GitHub Pages, no en tu navegador) y es el único
lugar donde vive tu API key de Gemini. `index.html` solo le manda un `fetch()` con
los datos del cliente y recibe de vuelta el texto de la recomendación.

No necesitas saber programar para desplegarlo — son pasos de copiar/pegar en dos
páginas web. Tiempo estimado: 10-15 minutos.

## Paso 1 — Consigue tu API key gratuita de Gemini

1. Entra a **https://aistudio.google.com/apikey** con tu cuenta de Google.
2. Dale clic a **"Create API key"** (o "Crear clave de API").
3. Copia la clave que te da (empieza con `AIza...`) — la vas a necesitar en el Paso 3.
   Guárdala en un lugar seguro mientras tanto (nunca la pegues dentro de `index.html`
   ni la subas a GitHub).

La capa gratuita de Gemini (modelo `gemini-2.5-flash`) tiene un límite generoso de
peticiones gratis al día — más que suficiente para un gimnasio usando este botón de
vez en cuando. (Ojo: no todos los modelos de Gemini tienen la misma cuota gratis —
en la práctica, modelos más nuevos como `gemini-3.6-flash` pueden traer una cuota
mucho más baja en la misma cuenta. Si en algún momento cambias el modelo con la
variable `GEMINI_MODEL` de abajo, vale la pena revisar su cuota real en
https://aistudio.google.com/apikey antes de darlo por bueno.)

## Paso 2 — Crea tu cuenta de Cloudflare (gratis, sin tarjeta)

1. Entra a **https://dash.cloudflare.com/sign-up** y crea una cuenta (correo + contraseña).
2. No hace falta agregar ningún dominio propio ni tarjeta de crédito para este paso.

## Paso 3 — Crea el Worker y pega el código

1. Ya adentro del dashboard de Cloudflare, ve a **Workers & Pages** (menú de la
   izquierda) → botón **"Create"** / **"Create application"** → pestaña **"Workers"** →
   **"Create Worker"**.
2. Ponle un nombre (por ejemplo `gymtrack-ia`) y dale **"Deploy"** — te va a crear un
   Worker de ejemplo ("Hello World") primero, eso es normal.
3. Una vez creado, dale clic a **"Edit code"** (o entra al Worker y busca el botón de
   editar código / "Quick edit").
4. Borra TODO el código de ejemplo que trae por default.
5. Abre el archivo `worker.js` de esta misma carpeta (en tu repo de GitHub, o en tu
   computadora si lo descargaste), copia TODO su contenido, y pégalo en el editor de
   Cloudflare reemplazando lo que borraste.
6. Dale clic a **"Save and deploy"** (o "Deploy").
7. Cloudflare te va a mostrar la URL pública de tu Worker, algo como:
   `https://gymtrack-ia.TU-USUARIO.workers.dev`
   **Copia esa URL completa** — la vas a necesitar en el Paso 5.

## Paso 4 — Guarda tu API key de Gemini como secreto (nunca en el código)

1. Dentro de tu Worker en el dashboard de Cloudflare, ve a la pestaña
   **"Settings"** → **"Variables and Secrets"** (a veces aparece como
   "Environment Variables").
2. Agrega una variable nueva:
   - **Name / Nombre:** `GEMINI_API_KEY`
   - **Value / Valor:** pega la clave que copiaste en el Paso 1 (empieza con `AIza...`)
   - Marca la opción de que sea **"Secret"** / **"Encrypt"** (para que quede oculta,
     no como texto plano).
3. Guarda los cambios y vuelve a desplegar el Worker si te lo pide.

(Opcional: si en algún momento quieres probar otro modelo, puedes agregar otra
variable `GEMINI_MODEL` con su nombre — si no la agregas, usa `gemini-2.5-flash`
por default. Antes de cambiarlo, revisa su cuota gratis real en
https://aistudio.google.com/apikey: no todos los modelos tienen la misma cuota
en la capa gratuita, y un modelo "más nuevo" no siempre tiene más cuota.)

## Paso 5 — Dile a index.html cuál es la URL de tu Worker

1. Abre `index.html` (en GitHub, editando el archivo directo desde la web, como ya
   has hecho otras veces) y busca esta línea (con Ctrl+F / Cmd+F):

   ```
   const IA_WORKER_URL='https://REEMPLAZA-CON-TU-WORKER.tu-subdominio.workers.dev';
   ```

2. Reemplázala por la URL real que copiaste en el Paso 3, por ejemplo:

   ```
   const IA_WORKER_URL='https://gymtrack-ia.tu-usuario.workers.dev';
   ```

3. Guarda/haz commit del cambio y espera a que GitHub Pages lo publique (unos
   segundos a un par de minutos, igual que siempre).

## Listo — cómo probar que funciona

1. Entra al panel de staff, abre el perfil de cualquier miembro, baja hasta
   **"🎯 Meta y Recomendación IA"**, ponle una meta (ej. Peso corporal, 70 kg) y
   dale **"💾 Guardar meta"**.
2. Dale clic a **"🤖 Actualizar recomendación"**.
3. En unos segundos debería aparecer el texto de la IA. Si en vez de eso sale un
   error, revisa lo siguiente:
   - **"El gym todavía no configuró el Worker..."** → todavía no reemplazaste
     `IA_WORKER_URL` (Paso 5).
   - **Error 500 / "no tiene configurada GEMINI_API_KEY"** → falta el Paso 4, o el
     nombre de la variable no quedó exactamente `GEMINI_API_KEY`.
   - **Error 502 / "Gemini respondió..."** → revisa que la API key sea correcta y
     esté activa en https://aistudio.google.com/apikey.
   - Si no sale ningún error pero tampoco aparece nada, prueba primero desde una
     computadora con la consola del navegador abierta (F12 → pestaña "Console" o
     "Network") para ver el error real.

## Nota sobre seguridad (para que sepas la limitación real)

Este Worker solo acepta peticiones desde el dominio de tu GymTrack
(`gymtrack1.github.io`) — eso evita que una página web cualquiera use tu Worker sin
que te des cuenta. Pero no es una autenticación real: alguien que llame directo al
Worker (por fuera del navegador, con una herramienta como curl o Postman) sí podría
usarlo y consumir tu cuota gratuita de Gemini. Para una app gratuita de un gimnasio
esto es un balance razonable — si algún día notas que tu cuota se agota sin
explicación, ese sería el motivo más probable, y en ese caso podemos agregar una
protección más fuerte (por ejemplo, una contraseña compartida entre `index.html` y
el Worker).
