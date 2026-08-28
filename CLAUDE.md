# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

GymTrack: app SaaS multi-tenant de gestión de gimnasios (miembros, pagos, asistencia,
inventario/tienda, finanzas, empleados). Es **un solo archivo HTML** (`index.html`, ~3500
líneas) con todo el frontend (HTML + CSS + JS) inline — sin build step, sin framework,
sin npm en el proyecto principal. Backend: Firebase (Firestore + Auth + Storage), cargado
vía CDN con imports de módulo ES directo en el `<script type="module">` al inicio del archivo.

No hay bundler, no hay transpilación. Lo que está en `index.html` es literalmente lo que
corre en el navegador.

## Comandos

No hay `npm install` ni build para la app principal. Para editar/probar:

- **Chequeo de sintaxis** (obligatorio antes de dar por terminado cualquier cambio de JS):
  `node --check index.html` no funciona directo porque el archivo es HTML — el patrón usado
  en este repo es extraer el bloque `<script>` principal (el que no es `type="module"`) y
  correrle `node --check` a eso. Revisa `CHANGELOG.md` para ver el patrón exacto que se ha
  usado en cambios anteriores.
- **Probar en navegador**: abrir `index.html` directo (usa Firebase real vía CDN, no hay
  emulador para la app en sí — solo para las reglas, ver abajo).
- **Reglas de Firestore** (`rules-test/`, proyecto npm aparte):
  ```
  cd rules-test
  npm install
  npm test
  ```
  Corre `firestore.rules` contra el emulador local de Firestore y verifica aislamiento
  entre gimnasios, acceso admin, usuario no autenticado, y el flujo de migración
  `pending_<email>` → uid real. Requiere Node 18+ y Java 21+ (o Java 11+ si se usa
  `firebase-tools@13.15.4`, ya fijado en `package.json`). Ver `rules-test/README.md` para
  el detalle y para el simulador manual en Firebase Console como alternativa sin instalar nada.
- **Deploy de reglas**: `firebase deploy --only firestore:rules` (o pegar el contenido en
  Firebase Console → Firestore → Reglas → Publicar).

No hay linter ni test runner para `index.html` mismo — la verificación es `node --check`
sobre el JS + simulación manual en Node de la lógica nueva (ver el patrón de "Qué se
verificó" en `CHANGELOG.md`) + prueba manual en navegador.

## Arquitectura

**Todo vive en `index.html`.** Estructura interna:
1. `<head>`: CDN de SheetJS (exportar Excel) y Chart.js (gráficas), luego un
   `<script type="module">` con el init de Firebase (`initializeApp`/`getFirestore`/
   `getAuth`/`getStorage`) y `onAuthStateChanged`, que dispara `firebaseReady` (usuario
   normal) o `adminReady` (si el email es el admin) como eventos en `window`.
2. `<body>`: todo el markup — login, `admin-screen` (panel del admin), `app-screen`
   (la app real, una pantalla por gimnasio con pestañas), y todos los `<div class="modal">`
   de creación/edición. **No hay ningún `<form>` en el archivo** — todos los inputs viven
   sueltos en el DOM, ocultos con CSS por modal/pestaña, nunca removidos. Ver la entrada de
   CHANGELOG del 2026-08-25 sobre el pin de Finanzas para por qué esto importa (Chrome
   detecta cualquier `input type="password"` en la página, sin `<form>` que lo delimite).
3. `<script>` principal (no-módulo, al final del `<body>`): todo el estado y la lógica de
   la app.

**Modelo de datos (Firestore, todo bajo `usuarios/{gymId}/...`)**:
`usuarios/{gymId}` es el doc de cuenta del gimnasio (contiene `plan`, `funciones`,
`pinFinanzas`, personalización visual). Antes del primer login existe como
`pending_<email>`; se migra a `usuarios/{uid real}` copiando plan/funciones (ver aviso de
límite conocido en `firestore.rules`: este paso lo hace el propio cliente, no una Cloud
Function, así que un gimnasio técnicamente puede reescribirse su propio plan — aislamiento
entre gimnasios sí está garantizado por las reglas, ese punto específico no).
Subcolecciones por gimnasio: `miembros`, `pagos`, `asistencias`, `empleados`, `inventario`,
`productos`, `ventas`, `gastos`.

**Aislamiento multi-tenant**: `firestore.rules` es la única barrera real (un cliente
podría saltarse la UI y pegarle al SDK directo). `isAdmin()` compara
`request.auth.token.email` contra el email hardcodeado del admin — el mismo patrón se
repite en el JS del cliente (`ADMIN_EMAIL`) solo para decidir qué pantalla mostrar, la
seguridad real está en las reglas, no en el cliente. Cualquier cambio a permisos/acceso
entre gimnasios debe verificarse con `rules-test/npm test`, no solo probando en el navegador.

**Estado del cliente**: todo en variables globales `let`/`const` al tope del `<script>`
principal (arrays `miembros/pagos/asistencias/empleados/inventario/productos/ventas/gastos`,
más caches derivados como `miembrosPorId`/`pagosPorMiembroFin` recalculados cada vez que se
recargan `miembros`/`pagos`). No hay estado reactivo ni framework: cada `save*()` escribe a
Firestore y luego llama al `render*()` correspondiente a mano; cada `load*()` llena un
array global y reconstruye sus caches. Al agregar un campo o colección nueva, seguir el
mismo patrón (array global + cache si aplica + `load*`/`save*`/`render*` explícitos).

**Planes y secciones**: `TODAS_SECCIONES` define las 9 pestañas posibles; `PLAN_LIMITE`
(`sencillo`/`pro`/`premium`) limita cuántas puede ver cada gimnasio; `userFunciones` (guardado
en el doc de usuario) es la lista real habilitada, `defaultFunciones(plan)` da el default al
migrar. `estadocuenta` (Finanzas) y `empleados` están además protegidas por PIN
(`PIN_PROTEGIDO`, `pinFinanzas` hasheado en el doc de usuario) — no confundir con el plan.

**Personalización visual por gym**: color de acento/fondo, logo y fondos por pestaña, todo
en `usuarios/{uid}` (`personalizacion`, `colorAcento`, `logoUrl`, `fondosPorTab`), aplicado
en cliente vía `aplicarPersonalizacion()`. Imágenes van a Storage bajo `logos/{uid}/...` y
`fondos/{uid}/...`, aisladas por gym vía `storage.rules`. Límite `MAX_IMAGEN_BYTES` (2MB).

**Patrones de "hábito" (recordatorios/compras)**: `calcularPatronAsistencia` y
`calcularPatronCompra` agrupan asistencias/ventas por miembro + día de la semana, ponderando
por antigüedad con `RECORDATORIO_DECAY_SEMANAL` y exigiendo un mínimo de eventos reales
(`RECORDATORIO_MIN_ASISTENCIAS`, `COMPRA_MIN_VENTAS`) antes de considerarlo un patrón real
en vez de una casualidad — mismo criterio replicado en ambas funciones a propósito, ver
`calcularPatronCompra` como plantilla si se agrega un tercer tipo de patrón.

**Paginación**: los arrays grandes (`miembros`, `asistencias`, `pagos`) se paginan solo en
el render (`MIEMBROS_PAGE_SIZE`, `ASISTENCIA_PAGE_SIZE`, `PAGOS_PAGE_SIZE`, todas 100) — los
datos completos siguen en memoria, la paginación es puramente de UI.

## Convenciones notadas en CHANGELOG.md

- `CHANGELOG.md` documenta cada cambio funcional con "Qué se hizo" / "Qué se verificó" (y a
  veces "Por qué"/"Causa"). Sigue ese formato al agregar entradas — es el registro real de
  decisiones del proyecto, léelo para contexto antes de tocar una feature ya existente
  (recordatorios, patrones de compra/asistencia, personalización visual, horas pico, etc.
  ya tienen historia ahí que explica por qué están como están).
- Cambios se verifican con `node --check` sobre el script principal (y sobre el bloque
  `type="module"` si se tocó) más una simulación en Node de la lógica nueva con datos falsos
  (no hay test runner formal para el archivo principal) — revisar siempre `git diff`
  completo para confirmar que el cambio quedó acotado a lo pedido, sin tocar pestañas o
  funciones no relacionadas.
- Cuando se agrega una sección/tarjeta condicionada a datos (ej. tarjeta de Compras en el
  perfil), el patrón es ocultarla por completo si el miembro no tiene datos de ese tipo, no
  mostrarla vacía — mismo criterio que las tarjetas de Beneficios/Seguimiento existentes.
