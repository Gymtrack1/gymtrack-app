# Changelog

Registro de cambios funcionales de GymTrack (`index.html`). Cada entrada indica qué se hizo, por qué, y qué se verificó antes de darlo por terminado.

Este archivo no existía antes de la entrada de 2026-08-24 — se crea a partir de ahí.

## 2026-08-25 — Campo "Zona" en Equipo del Gym (Inventario)

**Qué se hizo:**
- Nuevo campo `zona` (texto libre, ej. "Área de pesas", "Cardio", "Vestidores") en el modal de Nuevo/Editar Artículo de Equipo, dentro de la pestaña "🏋️ Equipo del Gym" de Inventario — no se tocó la pestaña "🛒 Tienda / Venta".
- `saveInventario()` guarda `zona` junto con el resto de los campos del artículo; `editInventario()` la precarga al editar.
- El campo tiene un `<datalist>` (`zonas-inventario`) que `openModal('modal-inventario')` rellena en cada apertura con las zonas ya usadas en el inventario actual (sin duplicados), para que se pueda escribir libre o elegir una zona existente y mantener nombres consistentes (ej. no terminar con "Cardio" y "cardio" como zonas distintas por error de tipeo).
- La tabla de Equipo y Maquinaria ahora muestra una columna "Zona" (con "—" si el artículo no la tiene, para no romper equipo ya existente antes de este cambio).

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Revisado `git diff` completo: el cambio queda contenido a la sección de Equipo del Gym (modal, `saveInventario`, `editInventario`, `openModal`, tabla), sin afectar Tienda/Venta, Asistencia u otras pestañas.
- Artículos existentes sin `zona` guardada siguen mostrando "—" en la tabla y el campo vacío en el modal de edición, sin romper nada.

## 2026-08-25 — Horas Pico de Compras y Top Compradores en Inventario/Tienda

**Qué se hizo:**
- **Horas Pico de Compras**: mismo patrón que Horas Pico de Asistencia, pero contando `ventas` en vez de `asistencias`. `renderHorasPicoCompras()` recorre todo el array `ventas` (ya en memoria, sin lecturas nuevas a Firestore), cuenta por hora con `new Date(v.fecha).getHours()`, y arma una barra con Chart.js coloreada por intensidad reutilizando `colorPorIntensidad`/`fmtHora12`/`chartHorasPico`-mismo-patrón (variable de módulo `chartHorasPicoCompras`, destruir antes de recrear, guard si Chart.js no cargó). Estado vacío si no hay ventas todavía.
- **Top Compradores**: `topCompradoresHtml()` agrupa `ventas` por `miembroId`, suma el gasto total y cuenta las compras de cada uno, y muestra el top 10 ordenado por monto gastado (no por número de compras — alguien con una sola compra grande sale antes que alguien con varias compras chicas). Las ventas sin miembro asociado ("— Sin miembro —" en el modal de venta) no cuentan para nadie, y un miembro borrado después de la venta se filtra en silencio en vez de romper la tabla.
- Ambas secciones se agregaron dentro de la pestaña "🛒 Tienda / Venta" de Inventario, después de "Últimas Ventas", sin tocar la pestaña "🏋️ Equipo del Gym" ni reordenar nada existente.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Conteo por hora probado con 6 ventas simuladas en 3 horas distintas — el conteo por hora y el total coinciden.
- Ranking de compradores probado con 3 miembros: uno con una sola compra grande ($350) quedó primero por encima de otro con 3 compras chicas que suman menos ($210) — confirma que ordena por monto total, no por frecuencia.
- Una venta sin `miembroId` no aparece en el ranking (se descuenta del total de personas listadas).
- Un `miembroId` que ya no existe en `miembrosPorId` (miembro borrado) se filtra sin romper el resto del ranking.

## 2026-08-25 — Color verde→rojo por intensidad en la gráfica de Horas Pico

**Qué se hizo:**
- `colorPorIntensidad(ratio)`: interpola color entre `--green` (0), `--orange` (0.5) y `--red` (1) — los mismos 3 colores que ya usa la app para "bien/regular/mal" en badges y otros indicadores — reutilizando `hexToRgb`/`rgbToHex`, ya definidos para la personalización visual.
- En `renderHorasPico()`, cada barra ahora recibe su propio color según qué tan concurrida es esa hora **en relación con las demás** (min = verde puro, max = rojo puro, todo lo demás interpolado): `ratio = (conteo - min) / (max - min)`.
- Se agregó una leyenda corta debajo de la gráfica ("🟢 Menos tránsito · 🔴 Más tránsito") para que el significado del color sea explícito.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- `colorPorIntensidad` probado en los 3 puntos exactos (0, 0.5, 1) — dan el verde/naranja/rojo exactos de las variables de la app, no aproximados.
- Probado con un conteo por hora simulado (pico realista a las 6pm): la hora con más asistencias sale en rojo puro, las horas en 0 salen en verde puro, y una hora intermedia sale en un tono naranja proporcional — confirma que la escala es relativa a los datos reales, no a un umbral fijo.

## 2026-08-25 — Horas Pico: gráfica de tránsito por hora en la pestaña de Asistencia

**Qué se hizo:**
- Nueva sección "🕐 Horas de Mayor Tránsito" al final del tab de Asistencia (después del Historial, sin reordenar ni tocar la tabla de registro de hoy ni el historial existentes).
- `renderHorasPico()`: recorre **todo** el array `asistencias` ya cargado en memoria (agregado histórico completo, sin filtrar por período) y cuenta cuántos registros caen en cada una de las 24 horas con `new Date(a.fecha).getHours()`. No hace ninguna lectura nueva a Firestore.
- Gráfica de barras con Chart.js (mismo patrón que `renderEstadoCuenta`: variable de módulo `chartHorasPico`, se destruye antes de recrearse, y el mismo guard `if(typeof Chart==='undefined')return;` por si el CDN no cargó). Eje X = hora formateada legible ("6am", "7pm", etc. vía nuevo helper `fmtHora12(h)`), eje Y = número de asistencias en esa hora.
- Si `asistencias` está vacío (o no cae ningún registro, lo cual en la práctica es lo mismo dado que se cuenta el array completo), se muestra el estado vacío `.empty`/`.empty-icon` de siempre en vez de una gráfica en blanco.
- Se llama desde el final de `renderAsistencia()`, así se recalcula junto con el resto de la pestaña (carga inicial, después de registrar una asistencia, etc.) sin necesitar un gancho aparte.

**Por qué:**
El gym quiere saber a qué horas conviene tener más personal o equipo disponible, a partir de su propio historial real de check-ins — no una estimación, un conteo directo de lo que ya pasó.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- `fmtHora12` probado con 8 horas (0,1,6,11,12,13,18,23) — los bordes de mediodía/medianoche (12am, 12pm) salen correctos, no solo los casos fáciles.
- Conteo por hora probado con un array simulado de 9 asistencias en 6 horas distintas (incluida una a medianoche y otra a las 23:59, los extremos del día): el total coincide (9), cada hora individual coincide con lo esperado, y la hora pico calculada (6pm, 3 registros) es la correcta.
- Array vacío probado por separado: el total da 0 y dispara la rama del estado vacío, no una gráfica en blanco.
- Revisión manual de que `registrarAsistencia`, `calcularPatronAsistencia` (patrón individual por miembro, usado en Alertas) y el resto de las pestañas no aparecen en el diff — el cambio está acotado a la pestaña de Asistencia.

## 2026-08-25 — El campo de PIN ya no dispara el "¿Quieres guardar la contraseña?" de Chrome

**Qué pasó:**
Cada vez que se registraba algo en la app (ej. una venta), Chrome ofrecía guardar una "contraseña" sin relación con lo que se acababa de hacer.

**Causa:**
`index.html` no tiene ninguna etiqueta `<form>` en todo el archivo — todos los inputs de todos los modales viven sueltos en el DOM (ocultos con CSS, no removidos). El campo de **PIN** para entrar a Finanzas/Empleados usaba `type="password"`, aunque en realidad es solo un código numérico corto, no una contraseña real. Chrome detecta cualquier `input type="password"` presente en la página (esté visible o no) y, sin un `<form>` que delimite el contexto, lo asocia con cualquier campo de texto cercano al momento de "enviar" algo — de ahí el pop-up aparentemente aleatorio.

**Qué se hizo:**
- `pin-input` y `pin-confirm-input` cambiaron de `type="password"` a `type="text"` con `autocomplete="off"` y la propiedad CSS `-webkit-text-security:disc` (más el estándar `text-security:disc`, para navegadores que lo soporten) — se sigue viendo como puntitos igual que antes, pero Chrome ya no lo reconoce como un campo de contraseña.
- Se dejó intacto `login-pass` (el campo de contraseña del login real) — ahí sí es correcto y deseable que Chrome ofrezca guardarla.

**Qué se verificó:**
- `grep` confirmó que no hay otro `type="password"` suelto en el archivo, y que ningún JS dependía de que el PIN fuera específicamente `type="password"` (solo se lee/escribe `.value`, nunca `.type`).
- `node --check` — sintaxis válida.
- Nota de compatibilidad: `-webkit-text-security` no lo soporta Firefox — ahí el PIN se vería en texto plano en vez de puntos (el valor sigue siendo correcto, solo cambia lo visual). No afecta a Chrome/Safari/Edge.

## 2026-08-25 — Gráficas de línea en Finanzas: tendencia real de ingresos, no dos puntos fijos

**Qué pasó:**
En cada tarjeta de período de Finanzas (Hoy/Semana/Quincena/Mes) ya existía un toggle Pastel/Línea. El pastel muestra bien de dónde vino el ingreso (Membresías vs Tienda) — eso se queda igual. Pero la "línea" solo graficaba esos mismos 2 valores (Membresías, Tienda) como si fueran una serie de tiempo, lo cual no tenía sentido como tendencia.

**Qué se hizo:**
- Nuevas funciones `tendenciaPorHora(pagos, ventas)` y `tendenciaPorDia(inicioPeriodo, pagos, ventas)`: agrupan pagos+ventas (mismo criterio de "ingreso" que ya usa el total de cada tarjeta) en buckets reales de tiempo.
- **Hoy**: la línea ahora muestra el ingreso por hora, desde las 0:00 hasta la hora actual (sin horas futuras) — "lo que llevan hoy", como se pidió.
- **Semana**: por día, desde el **lunes** de esta semana hasta hoy.
- **Quincena**: por día, desde el día 1 o el día 16 del mes (el inicio de quincena que ya usaba la app) hasta hoy.
- **Mes**: por día, desde el día 1 del mes hasta hoy.
- `crearGraficaPeriodo` ahora arma dos tipos de gráfica completamente distintos según el toggle: pastel (Membresías vs Tienda, sin cambios) o línea (tendencia real en el tiempo), en vez de forzar los mismos 2 datos en ambos tipos de chart.

**Corrección relacionada — la semana ahora empieza en lunes, no domingo:**
`inicioSemana` (en Finanzas) e `inicioSemanaActualTs()` (meta semanal de asistencia) ya estaban deliberadamente sincronizados por diseño (había un comentario explícito en el código pidiendo no romper esa consistencia). Como la tendencia semanal pedida debía empezar en lunes, se corrigieron **ambas** funciones juntas (de domingo-a-sábado a lunes-a-domingo) para no introducir una inconsistencia nueva entre Finanzas y meta semanal. Esto cambia también el rango de "ESTA SEMANA" en las tarjetas de Finanzas y el corte de caja semanal (antes empezaban domingo, ahora lunes).

**Qué se verificó:**
- `node --check` — sintaxis válida.
- `tendenciaPorHora` probado con pagos/ventas a horas específicas — los buckets caen en la hora correcta, la suma total coincide, y no aparecen horas futuras.
- Cálculo de inicio de semana probado de forma aislada — confirmado que ahora cae en lunes (antes cayía en domingo).
- `tendenciaPorDia` probado para semana (arranca lunes), quincena (arranca día 1 o 16, sin cambios respecto al criterio que ya existía) y mes (arranca día 1) — el número de días y las etiquetas coinciden con lo esperado en cada caso.
- Revisión manual de que el pastel (Membresías vs Tienda) no cambió su lógica ni su estilo.

## 2026-08-25 — Contraste de texto automático sobre los 3 colores editables

**Qué pasó:**
El usuario notó el riesgo: si elige un color de tarjetas oscuro (ej. negro), el texto —fijo en negro (`--text`)— se vuelve invisible encima. El mismo problema existe con el color de fondo y con el de acento (varios botones tenían el texto hardcodeado en `#000`).

**Qué se hizo:**
- Nueva función `colorTextoContraste(hex)`: calcula la luminancia perceptual (fórmula YIQ: `(299*r+587*g+114*b)/1000`) de un color y devuelve blanco o negro casi puro, el que dé más contraste. Sin tablas de casos ni umbrales mágicos por color — un solo cálculo que sirve para cualquier tono que elija el gym.
- Los 3 colores editables ahora recalculan su propio texto de contraste al aplicarse: `aplicarColorFondo` → `--text` (texto que vive directo sobre el fondo de la app, fuera de tarjetas — ej. los títulos grandes de cada pestaña); `aplicarColorTarjetas` → `--text-surface` (texto dentro de tarjetas/tablas/modales/inputs); `aplicarColorAcento` → `--text-accent` (texto sobre botones/elementos con fondo de acento, ej. "+ Nuevo Miembro", "Guardar mensaje"). Los 3 se limpian junto con su color al resetear o en el panel de super-admin.
- Se auditaron y corrigieron ~20 lugares del CSS/HTML que tenían `color:var(--text)` o `color:#000` hardcodeado encima de un fondo `--surface`/`--surface2`/`--accent` — cada uno ahora usa la variable de contraste que corresponde a SU fondo, no una genérica. Se agregaron además `color:var(--text-surface)` a los contenedores tipo tarjeta que no tenían ningún color explícito (stat-card, ec-card, modal, alert-card, gym-card, admin-header, admin-stat, locked-overlay, login-box), para que todo su contenido lo herede automáticamente sin tener que tocar cada elemento hijo uno por uno.
- Nuevos defaults en `:root`: `--text-surface:#16160F` y `--text-accent:#000000` — coinciden exactamente con los valores que ya estaban hardcodeados hoy, así que una cuenta sin personalizar no cambia ni un píxel.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- `colorTextoContraste` probado con 8 colores (blanco, negro, casi-negro, verde lima default, crema default, azul medio, gris medio, dorado) — todos los oscuros/saturados dan texto blanco, todos los claros dan texto negro, y los 3 colores default de la app (`#FFFFFF`, `#FAF9F5`, `#C6E600`) siguen dando negro — exactamente el comportamiento de hoy.
- `grep` de verificación: cero ocurrencias restantes de `color:var(--text)` o `color:#000` emparejadas con un fondo `--surface`/`--surface2`/`--accent` en todo el archivo.

## 2026-08-25 — Color de tarjetas editable (los recuadros blancos)

**Qué se hizo:**
- Tercer selector de color en Personalización: **"Color de tarjetas"**, mapeado a `--surface` (stat-card, ec-card, tablas, modales, gym-card, alert-card, etc. — los recuadros blancos de toda la app). `--surface2` (fondo de inputs, filas al pasar el mouse, badges) se calcula solo a partir de ese color con `oscurecerColor(hex, 0.06)`, mismo criterio que ya se usaba para derivar `--accent-dark` desde el color de acento — el gym vuelve a elegir un solo color, no dos.
- `aplicarColorTarjetas`/`resetColorTarjetas`, persistido en `usuarios/{uid}.colorTarjetas`, incluido en la cache de `localStorage` para la pantalla de login, y en el botón único "Guardar colores" / "Restaurar por defecto" junto a los otros dos.
- El reset del panel de super-admin también limpia `colorTarjetas`.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- `oscurecerColor('#FFFFFF', 0.06)` da `#f0f0f0`, muy cercano al `--surface2` por defecto actual (`#F0EFE8`) — confirma que el cálculo automático es razonable partiendo del blanco default.
- Revisión manual de que los 3 colores (acento, fondo, tarjetas) se cargan, aplican, guardan, resetean y cachean de forma simétrica — mismo patrón repetido tres veces sin casos sueltos.

## 2026-08-25 — Fondo a pantalla completa + color de fondo editable

**Qué pasó:**
Tras arreglar la subida (ver entrada anterior), el fondo por pestaña sí se subía y se veía, pero solo llenaba el bloque de contenido central — quedaban bordes blancos alrededor porque el fondo se aplicaba al `div` de cada pestaña, que vive dentro de `<main>` (que tiene `max-width:1100px` y padding). Además, la Personalización solo dejaba elegir el color de acento (botones/badges/texto destacado), no el color de fondo de la app.

**Qué se hizo:**
- El fondo de pestaña ahora se aplica a `<body>` (a pantalla completa, detrás del nav y del contenido) en vez de al `div` de cada tab. Nueva función `aplicarFondoActivo()` que lee la pestaña actualmente visible (`tabActivaId()`) y pone/quita `document.body.style.backgroundImage` — se llama al cargar la sesión y cada vez que `activarTab()` cambia de pestaña, así que solo se ve el fondo de la pestaña activa en cada momento.
- Nuevo selector de **color de fondo** (`--bg`), independiente del color de acento (`--accent`) — antes solo se podía cambiar el color de botones/badges/texto, no el fondo detrás de todo. Mismo patrón que el color de acento: `aplicarColorFondo`/`resetColorFondo`, persistido en `usuarios/{uid}.colorFondo`, con fallback a cero-cambios-visuales si nunca se configura.
- El modal de Personalización ahora tiene ambos selectores de color bajo un solo botón "Guardar colores" (antes solo existía el de acento).
- El reset del panel de super-admin (`adminReady`) también limpia `colorFondo` y cualquier imagen de fondo que hubiera quedado en `body`, por la misma razón que ya limpiaba color de acento y logo.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Prueba con DOM simulado de `aplicarFondoActivo()` en un flujo de 4 cambios de pestaña (dashboard con fondo → miembros sin fondo → pagos con fondo → dashboard de nuevo): el fondo se actualiza correctamente en cada cambio y se limpia cuando la pestaña no tiene fondo configurado.
- Confirmado con el usuario en producción que la carga de fondo ya funciona tras la corrección de CORS de la entrada anterior.

## 2026-08-25 — Fix: subida de logo/fondo se quedaba colgada (mensajes de error + CORS)

**Qué pasó:**
Al usar la Personalización visual en producción (app servida desde `https://gymtrack1.github.io`), subir un logo o fondo se quedaba en "Subiendo..." para siempre, sin ningún error visible en la UI.

**Causa real (confirmada con la consola del navegador):**
El bucket de Firebase Storage no tenía configurado CORS para el origen `https://gymtrack1.github.io` — el navegador bloqueaba la petición de subida en el preflight (`blocked by CORS policy: Response to preflight request doesn't pass access control check`). Esto es una configuración del bucket en Google Cloud, no un bug de `index.html`.

**Qué se hizo:**
- `mensajeError(e)`: extrae un mensaje legible de cualquier tipo de error (string, `Error` con o sin `.message`, objeto sin `.message`, hasta objetos circulares) sin volver a tronar dentro del propio `catch`. Antes, `'Error: '+e.message` podía lanzar una excepción no manejada si `e` no traía `.message`, dejando el toast de "Subiendo..." pegado para siempre — el síntoma reportado.
- `conTimeout(promesa, ms, mensaje)`: límite de 20s en la subida (`uploadBytes`) y en `getDownloadURL`, para que un problema de red/CORS/Storage-no-habilitado siempre termine en un mensaje de error visible en vez de un toast colgado indefinidamente.
- Se aplicó `mensajeError`/`conTimeout` en `onLogoFileChange`, `quitarLogo`, `onFondoFileChange`, `quitarFondo`, `guardarPersonalizacion` y `restaurarColorDefault`.
- Se agregó `storage-cors.json` en la raíz del repo con el origen `https://gymtrack1.github.io` (más `null`, para cuando la app se abre como archivo local) y las instrucciones exactas en `storage.rules` para aplicarlo vía `gsutil cors set storage-cors.json gs://<bucket>` — esto **no se resuelve con código ni con reglas de Firestore/Storage**, requiere correr ese comando una sola vez desde la terminal (Google Cloud SDK) con la cuenta dueña del proyecto.

**Qué se verificó:**
- `node --check` sobre el script principal — sintaxis válida.
- `mensajeError` probado con 6 casos (undefined, string, `Error` con `.message`, `Error` con `.code`+`.message`, objeto plano sin `.message`, objeto circular) — ninguno truena, todos devuelven un string usable.
- `conTimeout` probado con una promesa que nunca resuelve (simula el hang real reportado) y con una que resuelve rápido — el timeout dispara el mensaje esperado en el primer caso y no interfiere en el segundo.
- Pendiente de acción manual del usuario: correr `gsutil cors set` contra el bucket real (no ejecutable desde esta sesión — requiere sus credenciales de Google Cloud).

## 2026-08-25 — Personalización visual por gimnasio (color, logo, fondos por pestaña)

**Qué se hizo:**
- Se importó el SDK de Firebase Storage (`getStorage`, `ref`, `uploadBytes`, `getDownloadURL`, `deleteObject` desde `firebase-storage.js` 10.12.0, mismo patrón de import vía CDN de gstatic que ya se usaba para Firestore/Auth) y se creó `storage.rules` con aislamiento por gym equivalente a `firestore.rules`: cada gimnasio (por su uid) solo puede leer/escribir `logos/{uid}/...` y `fondos/{uid}/...`; el admin puede leer/escribir cualquiera; todo lo demás, denegado por default. Se agregó `"storage": {"rules": "storage.rules"}` a `firebase.json`.
- **Color de acento**: nuevo `input type="color"` en el modal "🎨 Personalización". El color elegido reemplaza `--accent` vía `document.documentElement.style.setProperty`, y se calcula automáticamente un tono ~24% más oscuro para `--accent-dark` (usado en el sombreado de botones primarios) — el gym solo elige un color, no dos. Se aplica al cargar la sesión (`loadPlan()` → `aplicarPersonalizacion()`), no solo mientras el modal está abierto.
- **Logo**: subida de imagen (máx. 2MB, tipos `image/*`) a `logos/{uid}/logo.<ext>`; la URL se guarda en `usuarios/{uid}.logoUrl` y reemplaza el texto "GymTrack" tanto en la pantalla de login como en el header de la app. Sin logo configurado, se sigue mostrando el texto exactamente como antes.
- **Fondos por pestaña**: subida de una imagen por sección (Dashboard, Miembros, Pagos, Asistencia, Finanzas, Inventario, Empleados — Alertas y Reportes quedan fuera, no se pidieron) a `fondos/{uid}/{tabId}.<ext>`; las URLs se guardan en `usuarios/{uid}.fondosPorTab` (objeto `{tabId: url}`) y se aplican como `background-image` de cada `div.tab` correspondiente.
- Nuevo botón "🎨 Personalizar" en el menú de la app (nav, junto a "Sincronizar plan") que abre el modal de gestión — accesible solo desde la cuenta del propio gimnasio, no desde el panel de super-admin.
- Cache local (`localStorage`, solo color+logo) para que la pantalla de login ya se vea personalizada antes de que termine de autenticar (en ese momento aún no se conoce el uid, así que no se puede leer Firestore todavía); se sobreescribe con el dato real de Firestore en cada login exitoso.

**Por qué:**
Cada gimnasio quiere que su instancia de GymTrack se sienta como su marca, no como una plantilla genérica. Todo vive en el propio doc `usuarios/{uid}` (branding, no datos operativos), y con un solo color elegido basta — no tiene sentido pedirle al gym que piense en "color" y "color oscuro" por separado.

**Fallback / aislamiento:**
- Una cuenta que nunca personalizó nada tiene `colorAcento`, `logoUrl` y `fondosPorTab` ausentes en su doc → se leen como `null`/`{}` → `resetColorAcento()` quita el override inline (el `:root` del CSS vuelve a mandar, mismo verde de siempre) y `aplicarLogo(null)`/`aplicarFondosPorTab({})` dejan todo igual a como se veía antes de este cambio. Cero cambios visuales para cuentas sin personalizar.
- El panel de super-admin (`adminReady`) resetea explícitamente color y logo al entrar, para no heredar por accidente el branding cacheado en `localStorage` de una sesión previa de algún gimnasio en el mismo navegador.
- `storage.rules` aísla por uid igual que `firestore.rules`: un gimnasio no puede leer ni escribir los archivos de otro.

**Qué se verificó:**
- `node --check` sobre el script principal y sobre el bloque `<script type="module">` (imports de Storage) — sintaxis válida en ambos.
- `oscurecerColor` probado de forma aislada: el color default `#C6E600` calcula `#96af00`, prácticamente idéntico al `--accent-dark` hardcodeado actual (`#98AE00`) — confirma que el factor de oscurecido está bien calibrado. Probado también con rojo, azul en formato corto de 3 dígitos, blanco y negro.
- `aplicarLogo`, `aplicarColorAcento`/`resetColorAcento` y `aplicarFondosPorTab` probados con un DOM simulado mínimo (sin navegador real): sin personalización no cambia nada visualmente; con logo configurado se oculta el texto y se muestra la imagen en ambos lugares (login y nav); con color configurado se setea `--accent`; con fondo configurado solo en una pestaña, las demás quedan sin tocar; al quitar el logo, el texto vuelve a aparecer correctamente.
- Revisión manual de que ninguna función de miembros, categorías, promociones, pagos o asistencia fue tocada — el diff está acotado a: imports/bindings de Storage, CSS nuevo, HTML del modal y de los logos, y funciones nuevas de personalización.
- **Aviso importante**: Firebase Storage debe habilitarse manualmente en la consola de Firebase (Build → Storage → Comenzar) antes de que la subida de logo/fondos funcione — no se activa solo con tener `storageBucket` en `firebaseConfig` ni por tener `storage.rules` en el repo. Si alguien clona este repo para otro gimnasio/proyecto de Firebase distinto, tiene que habilitar Storage ahí primero.

## 2026-08-24 — Beneficios por categoría y seguimiento personalizado por miembro

**Qué se hizo:**
- `categoriasMembresia` ahora acepta un campo `beneficios` (array de strings, `[]` por default): cada gimnasio define libremente qué incluye cada una de sus categorías (ej. "Nutrición personalizada", "Casillero"), sin nada hardcodeado en el código.
- El modal de gestión de categorías (`modal-categorias`) permite expandir cada categoría para ver, agregar y quitar beneficios individuales, con el mismo patrón de interacción que el resto de la app (chips removibles, input + botón agregar).
- Nuevo helper `beneficiosDeCategoria(nombre)`: busca la categoría por nombre y devuelve sus beneficios, o `[]` si no hay match — no truena si la categoría fue renombrada o borrada después de asignarse a un miembro.
- En el perfil del miembro, nueva tarjeta "Este plan incluye" que muestra los beneficios de su categoría actual; se oculta por completo si la lista está vacía.
- Cada `miembro` ahora puede tener `notasPlan` (array de `{tema, contenido, creadoEn}`, texto libre en ambos campos, definido por el gym — no hay campos fijos tipo "nutrición" o días de la semana hardcodeados).
- Nueva sección "Seguimiento personalizado" en el perfil, para agregar/ver/quitar notas individuales por miembro (mismo patrón visual que los beneficios de categoría).

**Por qué:**
Cada gimnasio ofrece beneficios distintos según su plan, y necesita anotar seguimiento específico por cliente (nutrición particular, rutina día por día, etc.) sin que el código imponga una lista fija de conceptos. La solución es texto libre en ambos niveles: general (por categoría) e individual (por miembro).

**Regla de acceso, sin flag nuevo:**
La sección de seguimiento personalizado solo aparece si `beneficiosDeCategoria(categoriaMembresia del miembro).length > 0` — se reutiliza la misma señal de la Parte 1 en vez de agregar un campo booleano nuevo tipo "premium".

**Qué se verificó:**
- `node --check` sobre el script principal (sintaxis válida).
- `beneficiosDeCategoria` probado de forma aislada: categoría con beneficios, categoría con `beneficios:[]`, categoría antigua sin el campo (documentos creados antes de este cambio), categoría renombrada/borrada, y miembro sin categoría asignada — todos los casos devuelven `[]` sin excepción en vez de fallar.
- Revisión manual de que `agregarCategoriaMembresia`, `editarCategoriaMembresia`, `eliminarCategoriaMembresia` y `populateCategoriaMembresiaSelect` (alta/edición/borrado de categoría, asignación a miembro) siguen intactos — solo se añadió `beneficios:[]` al crear una categoría nueva.
- Revisión manual de que `saveMiembro`/`editMiembro` no cambiaron — `notasPlan` se administra únicamente desde el perfil (no desde el modal de alta/edición), y no se escribe al crear un miembro (se lee con fallback `m.notasPlan||[]` donde se usa, igual que `beneficios` en categorías).
- No se tocó `firestore.rules` (sin validación de esquema por campo) ni las funciones de exportar/importar Excel.
