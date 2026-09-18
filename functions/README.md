# Cloud Function de GymTrack — Recomendación IA (Parte 20)

Esto es un proyecto APARTE de `index.html` — un pequeño programa que corre en los
servidores de Firebase (Google Cloud), no en GitHub Pages ni en el navegador del
cliente, y es el único lugar donde vive tu API key de Anthropic (Claude).
`index.html` solo le manda una petición ("Recomendar" / "Actualizar recomendación")
y recibe de vuelta el texto de la recomendación.

No necesitas saber programar para desplegarlo — son comandos de copiar/pegar en una
terminal. Tiempo estimado: 15-20 minutos.

## ⚠️ Antes de empezar: esto tiene un costo nuevo, recurrente

Dos cosas distintas cuestan dinero aquí, y ambas son necesarias:

1. **El plan Blaze de Firebase (pago por uso).** Las Cloud Functions de Firebase
   (a diferencia de Firestore/Auth que ya usas) **requieren el plan Blaze** —
   no existe forma de desplegar una Cloud Function en el plan gratuito Spark.
   Blaze sigue teniendo una capa gratuita generosa (2 millones de invocaciones al
   mes, entre otras cosas) — lo normal es que un gimnasio no pague nada de más
   por esta parte de Firebase, pero técnicamente ya no estás en el plan 100%
   gratuito. Actívalo en la consola de Firebase: **Configuración del proyecto →
   Uso y facturación → Modificar plan → Blaze**.
2. **La API de Anthropic (Claude).** Cada vez que un cliente le da "Recomendar" o
   "Actualizar recomendación" (y no hay ya una reciente de los últimos 7 días —
   la function evita regenerar de más), se hace UNA llamada real a la API de
   Claude, que cobra por uso. Con el modelo que usa esta function
   (`claude-opus-5`), una recomendación típica (prompt corto + respuesta de 3-5
   puntos) cuesta muy poco — probablemente unos **centavos de dólar por
   recomendación generada** (el costo real depende de cuánto texto entra y sale;
   no hay forma de dar un número exacto sin medirlo con tráfico real). No es un
   costo fijo mensual — solo pagas por lo que realmente se genera.

Necesitas una cuenta de **Anthropic (consola.anthropic.com)** con facturación
activa para obtener la API key del Paso 2.

## Paso 1 — Instala el CLI de Firebase (si no lo tienes)

```bash
npm install -g firebase-tools
firebase login
```

## Paso 2 — Consigue tu API key de Anthropic

1. Entra a **https://console.anthropic.com/settings/keys** con tu cuenta.
2. Si no tienes facturación activa, la consola te va a pedir que agregues un
   método de pago antes de dejarte crear una key nueva — es normal, es como se
   paga el uso de la API (ver el aviso de costos arriba).
3. Dale clic a **"Create Key"**, ponle un nombre (ej. `gymtrack-recomendacion-ia`)
   y cópiala — empieza con `sk-ant-...`. Guárdala en un lugar seguro; no la vas
   a pegar en ningún archivo de este repo.

## Paso 3 — Instala las dependencias de la function

Desde este mismo directorio (`functions/`):

```bash
cd functions
npm install
```

## Paso 4 — Activa el plan Blaze (si no lo has hecho)

1. Entra a **https://console.firebase.google.com/project/mi-gimnasio-8d528/usage/details**
   (o busca tu proyecto y ve a "Uso y facturación").
2. Dale clic a **"Modificar plan"** y elige **Blaze (pago por uso)**.
3. Firebase te va a pedir vincular una cuenta de facturación de Google Cloud
   (tarjeta de crédito/débito) — es el mismo paso sea cual sea la Cloud Function,
   no es específico de esta.

## Paso 5 — Guarda tu API key de Anthropic como secreto (nunca en el código)

Desde la raíz del repo (donde está `firebase.json`), NO desde `functions/`:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

Te va a pedir que pegues el valor — pega la key que copiaste en el Paso 2
(`sk-ant-...`) y dale Enter. Esto la guarda cifrada en Google Secret Manager,
ligada a este proyecto de Firebase — el código de `index.js` solo la referencia
por nombre (`ANTHROPIC_API_KEY`), nunca la ve en texto plano fuera del propio
servidor de la function cuando corre.

> Si en algún tutorial viejo ves `firebase functions:config:set` — ese comando
> está **descontinuado** por Firebase (Google lo retiró en 2025/2026) y ya no
> funciona en proyectos nuevos. Este README usa el reemplazo oficial,
> `functions:secrets:set` (Secret Manager), que es el que espera el código de
> `index.js` (`defineSecret('ANTHROPIC_API_KEY')`).

## Paso 6 — Despliega la function

Desde la raíz del repo:

```bash
firebase deploy --only functions
```

La primera vez puede tardar unos minutos (activa APIs de Google Cloud
automáticamente si hace falta — Cloud Functions, Cloud Build, Artifact
Registry, Secret Manager). Si todo sale bien, verás algo como:

```
✔  functions[generarRecomendacionIA(us-central1)] Successful create operation.
```

No necesitas copiar ninguna URL a mano — `index.html` ya está configurado para
llamar a esta function por su nombre (`generarRecomendacionIA`) usando el SDK
de Firebase, que resuelve la URL real solo.

## Paso 7 — Prueba desde la app

1. Abre el portal del cliente (el link con `?gym=...`) o el Portal de Empleados
   (`?gym=...&staff=1` → "Ver recomendaciones IA" o "Recomendar" del lado
   cliente).
2. Dale clic a **"Recomendar"**. La primera vez tarda unos segundos (está
   llamando a Claude de verdad). Si algo sale mal, el mensaje de error incluye
   un código (ej. `permission-denied`, `unauthenticated`) — mándamelo si
   necesitas ayuda para diagnosticarlo.

## ¿Cómo sé cuánto estoy gastando?

- **Firebase/Google Cloud:** consola de Firebase → tu proyecto → "Uso y
  facturación" (o directo en console.cloud.google.com → Facturación).
- **Anthropic:** console.anthropic.com → "Usage" / "Billing" — ahí ves el gasto
  real acumulado por cada llamada a la API, día por día.

## Actualizar la function después de un cambio de código

Cada vez que se modifique `functions/index.js`, vuelve a correr:

```bash
firebase deploy --only functions
```

No hace falta repetir los pasos de la API key/Blaze una vez configurados —
esos quedan guardados en el proyecto.
