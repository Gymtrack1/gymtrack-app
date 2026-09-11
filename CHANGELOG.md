# Changelog

Registro de cambios funcionales de GymTrack (`index.html`). Cada entrada indica qué se hizo, por qué, y qué se verificó antes de darlo por terminado.

Este archivo no existía antes de la entrada de 2026-08-24 — se crea a partir de ahí.

## 2026-09-11 — Bitácora de progreso: tarjetas + badges + resumen de "ayer" con expandir (Parte 16)

**Qué se hizo:** las tablas de Fecha/Tipo/Peso/Reps/Series (perfil del miembro en staff, "Mi
progreso" en el portal) y Ejercicio/Fecha/Tipo/Detalle/Sugerencia (Vista de Progreso del staff)
se desbordaban y cortaban texto en celular — nombres largos como "Extensión de tríceps a un
brazo" quedaban ilegibles. Las 3 se rediseñaron:

1. **Tarjetas en vez de tabla**: cada registro es ahora una tarjeta (`_tarjetaProgresoHtml`,
   helper compartido por las 3 vistas) con más espaciado y sin scroll horizontal ni columnas
   apretadas — el nombre del ejercicio ya no depende de caber en una celda de tabla.
2. **Badge de color por tipo de serie** (`_badgeTipoSerieHtml`, reusa las clases `.badge-*` que
   ya existían en el archivo — sin paleta nueva): Calentamiento/Súper serie en gris (los dos
   tipos que nunca traen sugerencia de sobrecarga), Normal en azul, PR en verde, Dropset en
   naranja, Al fallo en rojo. Cardio no trae badge (no tiene "tipo de serie").
3. **Resumen de "ayer" por default + expandir**: el perfil del miembro (staff) y "Mi progreso"
   (portal) ahora arrancan mostrando SOLO los registros de ayer del ejercicio seleccionado, con
   un botón "Ver historial completo" que expande a todo el historial (y "‹ Ver solo ayer" para
   volver a colapsar) — reusa `_rangoAyer()`, la misma función que ya usaba la Vista de Progreso
   del staff para su filtro "Solo los que entrenaron ayer". Sin registros de ayer, mensaje claro
   ("Sin registros de ayer") en vez de dejar la sección vacía. Los filtros que ya existían
   (selector de Ejercicio, Tipo de serie, buscador) se mantienen funcionando sobre la vista
   expandida — se resetea a "solo ayer" al cambiar de ejercicio, para partir siempre del resumen.
   La gráfica de Chart.js NO se filtra por esto (sigue mostrando el historial completo del
   ejercicio+filtro de tipo) — una gráfica de un solo día no serviría para ver tendencia.

Se quitaron `_filaProgresoHtml`/`_headerProgresoHtml`/`_colspanProgreso` (Parte 15) por quedar
sin uso — sus 2 usos se reemplazaron por tarjetas; `_detalleRegistroTexto` se conservó (sigue
compartido por las 3 vistas). Modelo de datos sin cambios — es solo la forma de mostrarlo.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- `grep` confirma cero referencias colgantes a los 3 helpers eliminados.
- Playwright (Chromium, viewport de celular 390px), llamando a las funciones reales: la vista
  resumida muestra solo el registro de ayer (no uno de anteayer) con badge azul "Normal" y el
  botón "Ver historial completo"; al expandir aparecen AMBOS registros con sus badges correctos
  (verde PR) y el botón cambia a "‹ Ver solo ayer"; sin registros de ayer muestra el mensaje
  claro; el portal (cardio) muestra tarjetas sin badge y sin selector de Tipo de serie; la Vista
  de Progreso del staff con fuerza+cardio mezclados usa tarjetas, ya no `<table>`, el nombre de
  ejercicio largo se lee completo, badge rojo para "Al fallo" con su sugerencia "Mismo peso", y
  cardio sin sección de sugerencia — **20 OK / 0 FAIL**.
- Capturas de pantalla reales confirmando visualmente el resumen "ayer" → tarjetas expandidas →
  colapsar, y la Vista de Progreso del staff con nombres de ejercicio completos y badges.

## 2026-09-11 — Cardio: distancia (km) en vez de velocidad (km/h)

**Qué se hizo:** el usuario pidió el mismo feature de cardio de la Parte 15 pero especificando
"tiempo y distancia" en vez de "tiempo y velocidad" — se renombró el campo en todo el flujo:
formulario del portal (`portal-serie-distancia`, label "Distancia (km)"), `portalGuardarSerie`
(guarda `distancia` en vez de `velocidad`), `_filaProgresoHtml`/`_detalleRegistroTexto` ("5 km" en
vez de "5 km/h"), y `_chartConfigProgreso` (grafica "Distancia (km)"). Mismo campo compartido
entre las 3 vistas (Vista de Progreso del staff, perfil del miembro, "Mi progreso" del portal) —
al vivir en los helpers comunes de la Parte 15, un solo cambio los actualiza a los tres.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- `grep -i velocidad` sobre todo `index.html`: cero referencias restantes.
- Playwright (Chromium), llamando a las funciones reales: el formulario de cardio ya no
  menciona "velocidad" en ningún lado y sí trae el campo `portal-serie-distancia`; un guardado
  real de un registro de cardio (mock de `addDoc`) confirma que el documento queda con
  `distancia` y sin `velocidad`; `_filaProgresoHtml`/`_detalleRegistroTexto`/
  `_chartConfigProgreso` para cardio usan y muestran `distancia` correctamente — **10 OK / 0
  FAIL**.
- `rules-test/test.mjs` actualizado (mismo campo en el documento de prueba) — corrido contra el
  emulador real de Firestore: **67 OK / 0 FAIL** (sin cambio en el total, solo se actualizó el
  nombre del campo en el caso ya existente).

## 2026-09-10 — Series en registros de fuerza + registro de cardio aparte (Parte 15)

**Qué se hizo:**
1. **Número de series**: nuevo campo opcional `series` en el formulario de registro del portal
   (`portalGuardarSerie`) — un solo registro puede representar "3 series de 10 reps a 80kg" en
   vez de tener que mandar el formulario 3 veces. Opcional a propósito: dejarlo vacío sigue
   significando "una sola serie" (default 1), igual que funcionaba antes de que existiera el
   campo — no se vuelve obligatorio escribir "1" cada vez.
2. **Cardio vs fuerza**: nuevo campo `tipo:'fuerza'|'cardio'` en cada entrada de
   `BIBLIOTECA_EJERCICIOS`, derivado automáticamente del músculo `'Cardio'` que ya existía
   (`Object.entries(...).forEach(...)` justo después de definir la biblioteca — no se listó
   ejercicio por ejercicio a mano). El formulario de registro (`renderPortalRegistrarSerieSeccion`)
   y el guardado (`portalGuardarSerie`) ahora son COMPLETAMENTE APARTES según el tipo:
   - Fuerza: Tipo de serie + Peso + Repeticiones + Series (como antes, más series).
   - Cardio: Duración (minutos) + Velocidad (km/h) — sin tipo de serie, sin peso, sin
     repeticiones, sin series. El documento guardado refleja esto: `tiempoMinutos`/`velocidad` en
     vez de `peso`/`repeticiones`/`series`.

**Partes existentes revisadas para que cardio no las rompa (pedido explícito del usuario):**
- **Meta de fitness IA** (`_opcionesEjercicioSelectHtml`): el selector de "ejercicio objetivo" ya
  NO ofrece ejercicios de cardio — una meta de "levantar X kg" no aplica a una caminadora. Un
  músculo cuyos ejercicios sean todos de cardio simplemente no aparece en la lista de optgroups.
- **`_historialParaMeta`**: filtro defensivo adicional (`typeof r.peso==='number'`) por si una
  meta vieja sigue apuntando a un ejercicio de cardio (ya no se puede crear una nueva así, pero
  una existente de antes de esta parte sigue siendo posible) — sin el filtro, un registro de
  cardio mezclado en el historial metería un `valor:undefined`.
- **Sugerencia de sobrecarga progresiva** (`_sugerenciaPesoHoy`, Vista de Progreso del staff):
  nuevo guard `typeof r.peso!=='number'` → `null` — nunca calcula `undefined*1.025` (NaN). La
  columna "Sugerencia hoy" muestra `—` para filas de cardio en vez de un dato sin sentido.
- **Vista de Progreso del staff** (`_portalStaffTarjetaMiembro`): la tabla puede mezclar
  ejercicios de fuerza y cardio de un mismo cliente en la misma sesión, así que se cambiaron las
  columnas "Peso"/"Reps" por una sola columna "Detalle" (`_detalleRegistroTexto`) que arma
  "60kg × 10 reps × 3 series" o "30 min · 8 km/h" según corresponda; "Tipo" muestra `—` en cardio.
- **Perfil del miembro (staff) y "Mi progreso" (portal)**: tabla, filtro "Tipo de serie" y
  gráfica de línea (`_perfilProgresoResultadosHtml`/`_portalProgresoResultadosHtml`,
  `dibujarChartProgresoPerfil`/`dibujarChartPortalProgreso`) ahora se ramifican por tipo del
  ejercicio SELECCIONADO (constante para toda la tabla, ya que lo decide el ejercicio, no cada
  registro): cardio muestra Fecha/Tiempo/Velocidad y grafica velocidad en vez de peso, sin
  selector de "Tipo de serie". Se extrajeron 6 helpers COMPARTIDOS entre las dos vistas
  (`_esCardioEjercicio`, `_filaProgresoHtml`, `_headerProgresoHtml`, `_colspanProgreso`,
  `_chartConfigProgreso`, `_opcionesChartProgreso`) para que nunca diverjan — antes ya eran dos
  implementaciones casi idénticas copiadas, ahora comparten una sola fuente para la parte cardio.
- **`worker.js` (agente de IA)**: revisado, sin cambios necesarios — nunca recibe registros
  crudos, solo `tendenciaSemanal` (un número ya calculado) y `meta`, así que queda cubierto por
  los dos puntos de arriba.
- **`firestore.rules`**: sin cambios — la regla de `registrosProgreso` (`allow read, create: if
  isSignedIn()`) nunca validó campos por nombre, así que un documento con forma distinta
  (cardio) ya pasaba igual que uno de fuerza.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- Simulación con Playwright (Chromium) llamando a las funciones reales del script (no
  reimplementadas aparte): clasificación de la biblioteca (todos los ejercicios quedan
  `fuerza`/`cardio`, caminadora=cardio, press de banca=fuerza), selector de meta sin Cardio,
  `_historialParaMeta` descarta el registro de cardio mezclado, `_sugerenciaPesoHoy(cardio)` es
  `null` en vez de NaN, formulario del portal muestra los campos correctos según tipo, y guardado
  real de un registro de cardio (tiempoMinutos/velocidad, sin peso/reps/series) y uno de fuerza
  con series — **30 OK / 0 FAIL**.
- Capturas de pantalla reales (Playwright) de: la Vista de Progreso del staff con un cliente que
  tiene un registro de fuerza Y uno de cardio en la misma tabla (columna Detalle correcta en
  ambos), y el perfil del staff mostrando solo cardio (Fecha/Tiempo/Velocidad, sin Tipo/Peso,
  selector "Ejercicio" a ancho completo sin el de "Tipo de serie").
- `rules-test/test.mjs`: nuevo caso — un registro de cardio (tiempoMinutos/velocidad, sin peso)
  se crea igual que uno de fuerza — corrido contra el emulador real de Firestore: **67 OK / 0
  FAIL** (antes 66).

## 2026-09-10 — FIX: checkbox "Solo los que entrenaron ayer" se desbordaba de la tarjeta

**El bug (reportado por el usuario con captura desde WhatsApp/celular):** el texto "Solo los que
entrenaron ayer" aparecía apilado palabra por palabra, saliéndose del borde derecho de la
tarjeta, en vez de quedarse en una línea junto al checkbox dentro de la tarjeta.

**Causa real:** hay una regla CSS global en `index.html`
(`input,select,textarea{width:100%;...}`) que le pone `width:100%` a TODOS los `<input>` —
pensada para los campos de texto de los formularios, pero que también afecta a
`<input type="checkbox">` si no se le pone un estilo aparte que lo cancele. El checkbox de
"Solo los que entrenaron ayer" (agregado en la Parte 14, Vista de Progreso del staff) era el
único checkbox de todo el archivo al que se le olvidó ese estilo — la app ya tenía el patrón
correcto en otros dos checkboxes (el de "Cobrar inscripción" en Pagos y el de marcar hábitos del
plan de IA), solo faltaba aplicarlo aquí. Al estirarse el checkbox a 100% del ancho del `<label>`
flex, el texto quedaba con casi nada de espacio y se apilaba palabra por palabra, desbordando la
tarjeta (que no recorta contenido que se sale).

**Qué se hizo:** se le agregó al checkbox el mismo estilo inline que ya usan los otros dos
(`flex:0 0 auto;width:auto;min-width:0;height:auto;margin:0;padding:0;background:none;border:
none;border-radius:0`), que lo regresa a su tamaño nativo de checkbox.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- Reproducción real con Playwright en viewport de celular (390px): se armó el mismo estado que
  deja `portalStaffVerificarPin()` tras un PIN correcto (sin depender de Firebase) y se llamó a
  `renderPortalStaffProgreso()` directo — la captura confirma que el checkbox ya se ve de tamaño
  normal y el texto queda en una sola línea, dentro de la tarjeta.

## 2026-09-10 — El contenido de cada pestaña se centra en el espacio a la derecha del menú

**Qué se hizo:** tras el cambio a barra lateral, el usuario notó que el contenido quedaba pegado
justo a la derecha del menú en pantallas anchas, en vez de centrado — se veía "muy a la
izquierda". `main` ahora es `display:flex;justify-content:center` (antes solo tenía
`margin-left:220px` para no quedar debajo del menú, sin centrar nada dentro de ese espacio
sobrante); el `.tab` activo se limita a `width:100%;max-width:1100px` (mismo ancho máximo que ya
tenía antes) para que `justify-content:center` lo centre en vez de que empiece pegado a la
izquierda. En celular no cambia nada (`margin-left:0` ahí, y como el contenido ya casi siempre
ocupa el 100% del ancho angosto, centrar o no da igual visualmente).

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- Capturas con Playwright en 1920px (ancho, donde antes se notaba más el problema), 1400px y
  390px (celular, sin cambios) — confirma visualmente que el contenido queda centrado en el
  espacio a la derecha del menú, sin quedar debajo de él ni desbordarse.

## 2026-09-10 — La barra de navegación pasa de horizontal (arriba) a vertical (izquierda)

**Qué se hizo:**
- El `nav` del panel de staff (logo, las 9 pestañas, y los controles de la derecha: plan,
  Personalizar, Sincronizar plan, email, Salir) ya no es una barra horizontal arriba — ahora es
  una columna fija del lado izquierdo, con todo apilado de arriba hacia abajo en el mismo orden
  que tenía antes de izquierda a derecha. `main` se corre a la derecha (`margin-left:220px`) para
  no quedar debajo. Solo afecta a `#app-screen` (el panel del dueño del gym) — el portal público
  del cliente y el panel de super-admin tienen su propio layout aparte, sin tocar.
- En pantallas angostas (`max-width:860px`, primera media query que usa este proyecto — antes
  no había ninguna) la columna queda oculta fuera de pantalla por defecto y se abre con un botón
  ☰ fijo arriba a la izquierda (`toggleSidebar()`), con un fondo oscuro (`sidebar-overlay`) detrás
  que la cierra al tocarlo fuera del menú (`closeSidebar()`). Elegir cualquier pestaña también
  cierra el menú solo (se agregó la llamada al final de `activarTab()`), para no tener que cerrarlo
  a mano después de navegar.
- Bug de orden de cascada encontrado y corregido durante la verificación visual: la regla
  `main{padding-top:70px}` de la media query quedaba ANTES en el archivo que la regla
  incondicional `main{padding:24px 16px;...}` — en CSS, una regla incondicional posterior gana
  sobre una condicional anterior con la misma especificidad, así que el padding-top nunca se
  aplicaba y el botón ☰ tapaba el título de cada pestaña en celular. Se reordenó (incondicional
  primero, media query después) y se confirmó con captura de pantalla que ya no se encima.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- Verificación visual real con Playwright (Chromium), forzando `#app-screen` visible sin depender
  de un login real: capturas de escritorio (1400px) y celular (390px, cerrado y abierto).
- Interacción real (no simulada) en el navegador: clic en `#sidebar-toggle` abre el menú
  (`toggleSidebar()`), clic en el overlay FUERA del ancho del menú lo cierra (`closeSidebar()`,
  probado a propósito en una posición fuera de los 220px del nav para no toparse con que el nav
  intercepta los clics ahí — comportamiento correcto, no un bug), y clic en "Dashboard" también lo
  cierra solo (confirma que `activarTab()` sí llama a `closeSidebar()`).
- `grep` confirma que no queda ningún otro lugar del código (JS o CSS) que asuma la altura vieja
  de 60px del nav horizontal.


## 2026-09-10 — Se elimina la pestaña "Reportes"

**Qué se hizo:**
- Se quitó por completo la pestaña "Reportes" (botón de nav, contenedor `tab-reportes`,
  `renderReportes()` y su helper exclusivo `calcTasaRenovacion()` — no se usaba en ningún otro
  lado) y todas sus llamadas (`loadAll`, el listener de plan, `corregirFechasImportadasAuto`,
  `saveMiembro`/`delMiembro`, `savePago`).
- Se quitó `{id:'reportes',...}` de `TODAS_SECCIONES` (la lista que controla el menú, el
  `lockedFeature` por plan, y los checkboxes de "Secciones activas" del panel admin — todo eso
  se ajustó solo, sin tocarlo, porque ya era genérico sobre esa lista). `PLAN_LIMITE.premium`
  bajó de 9 a 8 para que el contador del admin ("X/8, todas") siga siendo exacto — Sencillo (3) y
  Pro (6) no cambian, porque Reportes nunca estuvo dentro de su límite (era la sección #7, solo
  Premium con 9 la alcanzaba).
- Ninguna cuenta pierde otra sección por esto: los datos ya guardados en Firestore
  (`usuarios/{id}.funciones`) pueden seguir teniendo la palabra `"reportes"` suelta en cuentas
  viejas — es inofensivo, ya no hay ningún botón ni `if` que la lea.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- `grep` confirma cero referencias restantes a "reportes"/"Reportes" en todo `index.html`
  (código, HTML y comentarios).
- Simulación en Node aislada de `TODAS_SECCIONES`/`PLAN_LIMITE`/`defaultFunciones`: Sencillo y Pro
  devuelven exactamente las mismas secciones que antes (Reportes no estaba en su alcance);
  Premium ahora devuelve las 8 secciones restantes, en el mismo orden, sin `reportes` — **7 OK /
  0 FAIL**.

## 2026-09-10 — Vista de Progreso del staff: muestra TODAS las series de la sesión más reciente

**Qué se hizo:** el usuario notó que cada "serie" que registra el cliente ya es un documento
aparte en `registrosProgreso` (el formulario del portal literalmente se llama "Guardar serie" y
se manda una vez por serie) — pero `_portalStaffTarjetaMiembro` solo mostraba el registro MÁS
RECIENTE de cada ejercicio, ocultando que el cliente pudo haber hecho 2-3 series ese mismo día.
Se cambió para agrupar por ejercicio y quedarse con el DÍA calendario más reciente de cada uno,
pero mostrando TODAS las series de ese día (ordenadas cronológicamente), no solo la última — así
el staff ve la sesión completa ("3 series de press banca hoy: 60/62/65kg"), con su propia
sugerencia de peso por fila (cada serie conserva su propio tipo/peso, así que la sugerencia sigue
calculándose por fila, no por ejercicio).

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- Simulación en Node aislada del agrupamiento (sin DOM/Firestore): 3 series de un mismo
  ejercicio/día quedan juntas y en orden cronológico; una sesión vieja del mismo ejercicio NO se
  mezcla con la más reciente; dos ejercicios distintos generan dos grupos ordenados por el más
  reciente primero; un ejercicio con una sola serie no rompe — **6 OK / 0 FAIL**.

## 2026-09-10 — FIX: una pestaña del portal (QR) podía tumbar la sesión del dueño en otra pestaña

**El bug (reportado por el usuario):** "de la nada" el Dashboard mostraba 0 miembros y el plan
caía a "Sencillo", bloqueando secciones. No era pérdida de datos ni un problema del plan real en
Firestore — era la sesión de la pestaña la que cambiaba de identidad sola.

**Causa real:** Firebase Auth persiste la sesión en `localStorage` por defecto
(`browserLocalPersistence`), que se COMPARTE entre TODAS las pestañas del mismo sitio. El portal
público (`?gym=...`, incluida la nueva Vista de Progreso del staff, `?gym=...&staff=1`) se
autentica con `signInAnonymously()` para tener una sesión válida de Firestore — pero al escribir
esa sesión anónima en el mismo `localStorage` compartido, CUALQUIER OTRA pestaña abierta del
mismo sitio (ej. el Dashboard del dueño en otra pestaña del mismo navegador) recibía ese cambio
vía `onAuthStateChanged` y quedaba viendo la cuenta anónima en vez de la suya — de ahí el "0
miembros" y el plan "Sencillo" (fallback por defecto cuando no encuentra doc de esa cuenta). Esto
YA era un riesgo latente desde que existe el portal (Parte 1), pero la Vista de Progreso del staff
lo hizo mucho más probable: ahora es común que el propio dueño abra su link de staff en una
pestaña nueva del MISMO navegador donde tiene su Dashboard abierto (para copiarlo/probarlo/
mandarlo por WhatsApp), algo que un cliente normal nunca hacía con el QR de acceso.

**Qué se hizo:** se agrega `setPersistence(auth, browserSessionPersistence)` justo antes de
`signInAnonymously()` en la rama del portal — fuerza que esa sesión anónima se guarde en
`sessionStorage` (exclusivo de ESA pestaña, nunca sincronizado con otras) en vez de
`localStorage`. El flujo normal del dueño (login con email/contraseña, rama `else`) no se tocó —
sigue usando `browserLocalPersistence` por defecto, así que sigue quedando logueado entre
recargas como siempre.

**Si tu pestaña del Dashboard ya quedó afectada:** cierra sesión (🚪 Salir) y vuelve a entrar con
tu email/contraseña — eso reescribe tu sesión real en `localStorage` sobre la anónima que la
pisó. De ahí en adelante, con este fix, un link del portal en otra pestaña ya no puede volver a
pasar esto.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- `grep` confirma que `signInAnonymously` solo se llama en un único lugar (la rama del portal,
  `if(_portalGym)`), y que ahora siempre va precedido de `setPersistence(...,browserSessionPersistence)`.
- Revisión de la rama `else` (login normal del dueño): no se tocó, sin llamadas a
  `setPersistence` ahí — mantiene `browserLocalPersistence` (comportamiento de siempre).

## 2026-09-10 — Vista de Progreso del staff: link (sin QR) + botón de WhatsApp por empleado

**Qué se hizo:**
- El usuario pidió explícitamente un LINK, sin QR para descargar/imprimir. Se quitó
  `descargarQRStaff()` y su botón; en su lugar, la tarjeta de Empleados ahora tiene un botón
  "🔗 Copiar link" (`copiarLinkStaff()`, `navigator.clipboard.writeText` con fallback a `prompt()`
  si el navegador bloquea el clipboard) — el link es UNO SOLO por gimnasio (`?gym=...&staff=1`),
  no cambia por empleado.
- Nuevo botón 📱 por fila en la tabla de Empleados (`enviarLinkStaffWhatsApp`, mismo mecanismo
  `wa.me` que ya usan Alertas/Recordatorios/Promociones) que arma un mensaje con el link + el PIN
  de ESE empleado y abre WhatsApp con el número de su fila — deshabilitado si no tiene teléfono;
  si le falta el PIN, avisa con `alert` en vez de mandar un link sin forma de entrar.
- Sin cambios en `firestore.rules` ni en la lógica de identificación/progreso (`portalStaff*`):
  la regla de `empleadosPublicos` y todo el flujo de PIN/progreso de la Parte 14 original quedan
  igual, esto solo cambió CÓMO se distribuye el link.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` — sintaxis válida.
- Simulación en Node aislada de `_linkStaff`/`enviarLinkStaffWhatsApp` (sin DOM real): arma bien
  la URL de wa.me con el teléfono limpio de espacios, el mensaje incluye el link Y el PIN
  correctos, y los casos sin teléfono / sin PIN / empleado inexistente devuelven error en vez de
  abrir wa.me con datos incompletos — **10 OK / 0 FAIL**.
- `git diff` revisado: `grep` confirma cero referencias restantes a `descargarQRStaff` en todo el
  archivo; los otros dos QR (acceso normal, buzón de sugerencias) no se tocaron.

## 2026-09-10 — Vista de Progreso del staff, de solo lectura (Parte 14)

**Qué se hizo:**
- Nueva vista pública, un QR/link aparte (`?gym=...&staff=1`), donde cualquier empleado se
  identifica con su nombre + PIN y ve, de SOLO LECTURA, el progreso reciente de TODOS los
  clientes del gym (registro más reciente por ejercicio, con fecha/peso/reps/tipo de serie, y una
  sugerencia de peso para hoy) — buscador por nombre y filtro "Solo los que entrenaron ayer".
  Nunca edita nada desde ahí.
- Nuevo campo `pinAcceso` (4-6 dígitos, opcional) en el modal de Empleados, validado con
  `/^\d{4,6}$/` antes de guardar. Nueva columna "PIN de acceso" en la tabla de Empleados
  (muestra "Sin PIN" si no tiene) y nueva tarjeta arriba de la tabla con el botón para
  descargar el QR de esta vista — mismo mecanismo (`_generarYDescargarQR`) que los otros dos QR.
- Nuevo espejo público `usuarios/{gymId}/empleadosPublicos/{id}` (solo `nombre`+`pinAcceso`),
  mantenido por `sincronizarEmpleadoPublico()` desde `saveEmpleado`/`delEmpleado` — mismo patrón
  que `sincronizarMiembroPublico`. Necesario porque el cliente anónimo necesita listar los
  nombres para mostrarlos como botones y comparar el PIN escrito, y Firestore no puede ocultar
  campos dentro de un documento vía reglas (por eso el mirror en vez de abrir `empleados/` completo).
- **Punto clave verificado antes de tocar reglas:** `registrosProgreso` y `miembrosPublicos` YA
  eran legibles SIN FILTRO por cualquier sesión anónima desde antes de esta parte (la regla no
  depende de `resource.data`) — la vista de staff no necesitó ampliar esas dos colecciones, solo
  construir la UI sobre lo que ya estaba abierto. Lo único nuevo en `firestore.rules` es
  `empleadosPublicos` (lectura pública, sin escritura pública). Documentado explícitamente en
  `firestore.rules` el aviso de confianza que pidió el usuario: el PIN es una barrera de UI, no
  una regla a prueba de manipulación técnica directa — mismo nivel que el resto del portal
  público de GymTrack, aplicado aquí a un alcance de datos mayor (todos los clientes, no uno).
- Sugerencia de peso (`_sugerenciaPesoHoy`): Normal/PR sugiere subir 2.5-5% sobre el último
  peso registrado; Al fallo/Dropset sugiere repetir el mismo peso; Calentamiento/Súper serie no
  trae sugerencia.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` de `index.html` — sintaxis válida.
- Simulación en Node aislada (sin Firestore) de `_sugerenciaPesoHoy`/`_sugerenciaPesoHoyTexto`
  (los 6 tipos de serie), del rango "ayer" en hora local, y de la regex de validación del PIN:
  **20 OK / 0 FAIL**.
- `rules-test/firestore.rules` sincronizado con la raíz; `rules-test/test.mjs` con 8 casos
  nuevos — corrido contra el emulador real de Firestore: **66 OK / 0 FAIL**, incluyendo que un
  cliente anónimo SÍ puede leer/listar `empleadosPublicos` pero NO escribirlo, que NO puede leer
  el documento completo de `empleados/` (sueldo/teléfono), y la confirmación explícita (con un
  registro de un miembro que no es "el propio" de nadie en sesión) de que `registrosProgreso`/
  `miembrosPublicos` ya eran legibles sin filtro desde antes de esta parte.
- `git diff` revisado: el portal del cliente (`portalIdentificar`/`renderPortalHome`) y el buzón
  de sugerencias no se tocaron — la vista de staff vive en su propio bloque de funciones
  (`portalStaff*`), activado solo por `?staff=1`, con su propio dispatch en el listener de
  `portalReady`.

## 2026-09-09 — Se eliminan los botones manuales "Corregir Fechas Importadas" y "Sincronizar Portal QR"

**Qué se hizo:**
- Ambos procesos llevaban ya un tiempo corriendo solos (Parte 12 y Parte 13, ver entradas de abajo)
  y el usuario confirmó que ya no hacen falta como respaldo manual — se quitaron los dos botones de
  la pestaña Miembros y sus funciones (`corregirFechasImportadas()` y
  `sincronizarTodosLosMiembrosPublicos()`), junto con los comentarios que ya no aplicaban por
  mencionar "el botón manual".
- Las versiones automáticas (`corregirFechasImportadasAuto()` y
  `sincronizarTodosLosMiembrosPublicosAuto()`), que siguen llamándose desde `loadAll()`, NO se
  tocaron — siguen corriendo solas en cada carga (la primera) o una sola vez por cuenta (la
  segunda), igual que antes.

**Qué se verificó:**
- `node --check` sobre el bloque `<script type="module">` de `index.html` — sintaxis válida tras
  quitar ambas funciones.
- `grep` confirma cero referencias restantes a `corregirFechasImportadas()` /
  `sincronizarTodosLosMiembrosPublicos()` (ni definición ni `onclick`) en todo el archivo; las
  variantes `...Auto()` siguen intactas y se siguen invocando desde `loadAll()`.

## 2026-09-09 — La sincronización automática del Portal QR solo cubre miembros vigentes

**Qué se hizo:**
- Respuesta a un contra real que se señaló de la Parte 13 (sincronizar TODOS los miembros gasta
  escrituras de más, incluso las de quien nunca va a usar el portal): `sincronizarTodosLos
  MiembrosPublicosAuto()` ahora solo sincroniza a los miembros VIGENTES (`getEstado` = `'activo'`
  o `'por-vencer'`) en el backfill inicial — no a los vencidos ni a los que nunca han pagado.
- No se pierde cobertura real: un miembro vencido/sin-pago que quede fuera de este backfill se
  sincroniza solo en cuanto vuelva a tener actividad — `savePago()` ya llama a
  `sincronizarMiembroPublico()` en cada pago nuevo, y `saveMiembro()` en cada edición de perfil
  (ambos mecanismos ya existían desde antes de esta parte, no se tocaron). Es decir: en cuanto un
  miembro inactivo vuelve a pagar, queda sincronizado automáticamente igual que siempre.
- El botón manual "Sincronizar Portal QR" NO se tocó — sigue sincronizando a todos sin filtrar,
  a propósito: su razón de ser es justamente ser el respaldo de "fuerza un resync completo de
  absolutamente todos" si algún día hace falta, sin las limitaciones del backfill automático.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node con 4 miembros en los 4 estados posibles: activo y por-vencer SÍ se
  sincronizan en el backfill automático; vencido y sin-pago NO se sincronizan ahí (menos
  escrituras); confirma que de 4 miembros totales, solo se tocan los 2 vigentes.
- `git diff` revisado: cambio acotado al filtro dentro de
  `sincronizarTodosLosMiembrosPublicosAuto` — el botón manual y `sincronizarMiembroPublico` (la
  sincronización incremental por pago/edición) quedan intactos.

## 2026-09-09 — "Sincronizar Portal QR" también se dispara sola, una vez por cuenta (Parte 13)

**Qué se hizo:**
- Mismo espíritu que la Parte 12 (fechas importadas), pero para el otro botón que el usuario
  preguntó si de verdad seguía haciendo falta: "🔄 Sincronizar Portal QR". A diferencia de las
  fechas, esta sí reescribe TODOS los miembros sin filtrar (no solo los que hacen falta) — para un
  gym con miles de miembros es una operación cara, así que NO puede correr en cada carga como la
  de fechas. Se automatizó como un backfill de **una sola vez por cuenta**: nueva bandera
  `qrSincronizado` en el doc del gym (mismo patrón que `pinFinanzas`/`montoInscripcion` — se carga
  en `loadPlan()` y en el listener en tiempo real).
- `sincronizarTodosLosMiembrosPublicosAuto()` se llama sola al final de `loadAll()`: si
  `qrSincronizado` ya es `true`, no hace nada (ni una sola lectura/escritura de más); si es la
  primera vez, sincroniza todo en silencio y guarda la bandera para nunca repetirse sola después.
  El botón manual "Sincronizar Portal QR" sigue ahí tal cual, como respaldo por si algún día hace
  falta forzar un resync completo — y si el staff lo usa manualmente, también deja la bandera en
  `true` para que la automática no lo repita innecesariamente después.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node de `sincronizarTodosLosMiembrosPublicosAuto`: con `qrSincronizado=false`
  (cuenta nueva o de antes de esta parte) sincroniza todos los miembros y deja la bandera en
  `true` (local y en el doc del gym); una segunda llamada en la misma sesión con la bandera ya en
  `true` NO vuelve a tocar Firestore; una cuenta que ya traía `qrSincronizado=true` cargado desde
  Firestore nunca dispara la sincronización automática.
- `git diff` revisado: cambios acotados a la nueva bandera (declaración + carga en los dos
  lugares donde ya se carga `pinFinanzas`), la nueva función automática, una línea en `loadAll()`,
  y que el botón manual también marque la bandera al usarse — sin tocar
  `sincronizarMiembroPublico` (la sincronización incremental por miembro, que ya funcionaba bien).
- Sin cambios en `firestore.rules`: el dueño del gym ya tiene permiso de escritura sin restricción
  de campos sobre su propio doc `usuarios/{uid}`.

## 2026-09-09 — "Corregir Fechas Importadas" ahora se corre solo, sin necesitar el botón (Parte 12)

**Qué se hizo:**
- El usuario preguntó si los botones junto a "Plantilla" (Miembros) de verdad se seguían usando.
  Al revisar: `_guardarImportados` (la importación de Excel actual) YA calcula bien la fecha de
  pago desde hace tiempo (`fechaFin - duración del plan`) — el botón manual "Corregir Fechas
  Importadas" es una utilidad de reparación para pagos que se importaron ANTES de ese arreglo, no
  algo que la importación de hoy siga necesitando. El usuario pidió no quitarlo todavía, pero sí
  que su función pudiera pasar sola en vez de depender de un clic manual.
- Se extrajo la detección de "qué pagos importados tienen la fecha mal calculada" a una función
  compartida (`_pagosImportadosPorCorregir`), usada tanto por el botón manual como por la nueva
  `corregirFechasImportadasAuto()` — así la fórmula de qué está mal y cómo arreglarlo vive en un
  solo lugar, no duplicada.
- `corregirFechasImportadasAuto()` se llama sola al final de `loadAll()` (cada vez que se cargan
  los datos del gym, ej. al iniciar sesión), sin bloquear la carga si falla (mismo criterio que
  `sincronizarMiembroPublico`) y sin pedir confirmación — si no hay nada que corregir (el caso
  normal de aquí en adelante), no hace nada ni molesta con ningún aviso; si sí corrige algo, avisa
  con un toast breve.
- El botón manual "Corregir Fechas Importadas" SIGUE ahí, sin quitarse — ahora es un respaldo
  visible por si la corrección automática falla (ej. sin conexión justo al cargar), no la vía
  principal. En la práctica, para cualquier cuenta que ya haya abierto la app una vez desde este
  cambio, el botón manual va a decir "Todas las fechas importadas ya están correctas" casi
  siempre.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node de `_pagosImportadosPorCorregir` (la lógica compartida): detecta un pago
  importado con la fecha vieja/mal calculada; confirma que un pago importado por el flujo YA
  arreglado (como los que se crean hoy) NO necesita corrección — prueba directa de que el import
  actual ya está bien; los pagos normales (no importados) nunca se tocan; en una mezcla de varios
  pagos, detecta solo los que de verdad hacen falta corregir.
- `git diff` revisado: cambios acotados a extraer la detección compartida, la nueva función
  automática, y una línea en `loadAll()` — el botón manual conserva su confirm y sus toasts de
  progreso tal cual estaban, solo reutiliza la detección compartida en vez de duplicarla.

## 2026-09-09 — Autocompleta "Edad" al poner la Fecha de Nacimiento (Parte 11)

**Qué se hizo:**
- El formulario de alta/edición de miembro pedía "Edad" Y "Fecha de Nacimiento" por separado,
  obligando al staff a calcular la edad a mano — aunque `calcularEdad()`/`edadMostrar()` ya
  existían y se usan en todos lados (perfil, IA, etc.) para calcular la edad real a partir de la
  fecha de nacimiento cuando está disponible.
- En cuanto el staff pone o cambia la Fecha de Nacimiento, "Edad" se autocompleta sola
  (`actualizarEdadDesdeFechaNacimiento`, reutiliza `calcularEdad` tal cual, sin duplicar la
  cuenta). Sigue siendo un campo editable — el staff puede corregirlo a mano después, y si no
  pone fecha de nacimiento (no la sabe con exactitud), el campo de Edad no se toca y se puede
  seguir llenando a mano como siempre.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node de `actualizarEdadDesdeFechaNacimiento`: una fecha de hace exactamente 25
  años autocompleta 25; una fecha donde el cumpleaños todavía no llega este año resta 1 año
  correctamente (29, no 30 — mismo cálculo exacto que ya usa `calcularEdad` en el resto de la
  app); después de autocompletarse, el staff puede seguir editando el valor a mano sin que nada lo
  sobreescriba; borrar la fecha de nacimiento no borra una edad ya puesta.
- `git diff` revisado: dos cambios quirúrgicos — el `onchange` en el input de fecha de nacimiento,
  y la función nueva — sin tocar `calcularEdad`/`edadMostrar` ni ningún otro cálculo existente.

## 2026-09-09 — Al elegir una promoción, autocompleta Plan y Monto (Parte 10)

**Qué se hizo:**
- Mismo patrón que las mensualidades por categoría de ayer, pero para Promociones: cada
  promoción ahora puede traer una **duración** (una de las 6 de siempre: Quincenal/Mensual/
  Bimestral/Trimestral/Semestral/Anual) y un **monto** propio — ej. "2x1 verano" = Bimestral a
  $400. Ambos son opcionales; una promoción sin ninguno de los dos configurados se sigue
  comportando exactamente como antes (un badge puramente informativo).
- El modal "Promociones" (donde ya se agregan/editan/borran) ahora muestra, debajo de cada
  promoción, un selector de duración + un campo de monto + su propio botón "Guardar" — se guardan
  en la misma colección `promociones` que ya existía (`dias`, `monto`), sin reglas de Firestore
  nuevas.
- En el modal de "Registrar Pago" (reutilizado tal cual), al elegir una promoción del dropdown
  "Promoción aplicada": si trae duración configurada, cambia "Plan" a esa duración automáticamente;
  y `actualizarMontoAutomatico()` (ya existente, de Parte 9) ahora le da **prioridad al monto de la
  promoción** sobre el precio de categoría — una promoción es un precio especial a propósito, no
  debe perderse solo porque la categoría del miembro también tenga un precio para esa misma
  duración. Sin promoción seleccionada, todo sigue funcionando igual que ayer (precio por
  categoría).

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node: sin promoción usa el precio de categoría; al elegir una promoción con
  duración+monto propios, cambia el Plan Y el monto gana sobre el precio de categoría (aunque la
  categoría tenga un precio distinto para esa misma duración); una promoción con monto pero SIN
  duración configurada no toca el Plan, solo el monto; una promoción sin dias/monto configurados
  (como las que ya existían antes de esta parte) cae al precio de categoría, comportándose como
  badge puro — no rompe promociones creadas antes de este cambio; al volver a "Ninguna" se
  restablece el precio de categoría normal.
- `git diff` revisado: cambios acotados al modal de Promociones (selects/inputs nuevos por fila +
  `guardarDetallePromocion`) y a `actualizarMontoAutomatico`/nueva `aplicarPromocionSeleccionada`
  en el modal de pago — sin tocar `savePago` ni Finanzas/Reportes.

## 2026-09-09 — Autocompleta "Monto ($)" según el precio de la categoría del miembro y el plan (Parte 9)

**Qué se hizo:**
- Igual que con la inscripción de ayer, pero para las mensualidades: los gimnasios cobran precios
  distintos según la categoría de membresía (ej. "Full access" vs. "Solo pesas"), así que en vez
  de un solo monto global, el precio se configura por **categoría + duración de plan** (las mismas
  6 duraciones que ya existían: Quincenal/Mensual/Bimestral/Trimestral/Semestral/Anual).
- El modal "Categorías de Membresía" (donde ya se configuran los beneficios de cada categoría)
  ahora tiene también un toggle "▼ Precios (N)" por categoría, con un campo numérico por cada
  duración — ninguno es obligatorio, una categoría puede tener precio solo para "Mensual" y dejar
  el resto vacío. Se guarda como `precios:{15,30,60,90,180,365}` en el doc de esa categoría
  (`categoriasMembresia/{id}`, colección que ya existía) — no hace falta ninguna regla nueva de
  Firestore, el dueño del gym ya tiene permiso de escritura ahí.
- En el modal de "Registrar Pago" (reutilizado tal cual), el campo "Monto ($)" ahora se
  autocompleta solo con el precio configurado para la categoría del miembro seleccionado y la
  duración de plan elegida — se recalcula tanto al elegir el miembro como al cambiar el Plan. Si
  el miembro no tiene categoría, o esa categoría no tiene precio para esa duración específica, el
  campo queda vacío (nunca deja pegado el monto de una selección anterior) y el staff lo escribe a
  mano, como siempre — sigue siendo 100% editable después de autocompletarse.
- De paso se corrigieron dos vacíos que ya existían en `openModal('modal-pago')`: ni "Monto ($)"
  ni "Plan" se reseteaban al abrir el modal normalmente, así que podía quedar pegado el valor de
  un pago anterior. Ahora "Plan" vuelve a "Mensual" (default) y "Monto" se limpia, cada vez que el
  modal se abre desde cero.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node de `actualizarMontoAutomatico`: dos categorías con precios distintos por
  duración autocompletan el monto correcto cada una; cambiar de plan en el mismo miembro
  autocompleta el precio de la NUEVA duración (no deja el de la anterior); cambiar de miembro
  autocompleta el precio de SU categoría (no arrastra el de la selección anterior); miembro sin
  categoría, con categoría borrada, o con categoría sin ningún precio configurado — los tres casos
  dejan el monto vacío sin reventar.
- Simulación en Node de `guardarPreciosCategoria`: valores vacíos, negativos, cero, o texto no
  numérico en cualquiera de las 6 duraciones se guardan como `null` (nunca como `NaN` ni un precio
  inválido); valores válidos se guardan tal cual.
- `git diff` revisado: cambios acotados al modal de Categorías de Membresía (nueva sección de
  precios), al modal de pago (autocompletado + reset de Monto/Plan al abrir) — sin tocar
  Finanzas/Reportes ni la lógica de guardado de `savePago` en sí.

## 2026-09-09 — Agrega cuota de inscripción opcional (Parte 8), premarcada al dar de alta un miembro

**Qué se hizo:**
- No todos los gimnasios cobran una cuota única de "inscripción" al dar de alta a un miembro
  (aparte de la mensualidad) — así que se agregó como un único monto opcional por gimnasio, no
  como algo obligatorio ni por categoría de membresía.
- Nuevo botón "🎫 Inscripción" en la pestaña Pagos (junto a "🏷️ Promociones") abre un modal chico
  con un solo campo numérico. Si se deja vacío, significa que ese gimnasio no la cobra. Se guarda
  como `montoInscripcion` directo en el doc de la cuenta (`usuarios/{uid}`) — mismo patrón que
  `pinFinanzas`/`msgWhatsApp` (nada de colecciones nuevas ni reglas de Firestore adicionales: el
  dueño del gym ya tiene permiso de escritura sobre su propio doc).
- El modal de "Registrar Pago" (el mismo de siempre, reutilizado tal cual) ahora tiene un checkbox
  "🎫 Cobrar inscripción" con su campo de monto — oculto hasta que se marca. Se premarca
  automáticamente con el monto configurado SOLO cuando el modal se abre desde el flujo de "Nuevo
  Miembro" (ver la entrada de ayer) y el gym sí tiene inscripción configurada; en cualquier otro
  caso (Renovar desde Alertas, "+ Registrar Pago" normal) arranca desmarcado — sigue siendo 100%
  opcional, el staff puede desmarcarlo o marcarlo a mano en cualquier momento.
- Al guardar, el monto de inscripción se SUMA al total del pago (así Finanzas/Reportes, que ya
  suman `monto`, no necesitaron ningún cambio) y se guarda aparte en `inscripcion` solo como
  referencia — la tabla de Pagos muestra "incl. $X inscripción" debajo del monto cuando aplica.
- El nuevo checkbox usa los mismos estilos inline defensivos (`width:auto;flex:0 0 auto;
  background:none;border:none`) que se le pusieron ayer al checkbox de hábitos del plan IA, para
  no reintroducir el mismo bug de layout en celular con la regla CSS global de `input`.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node con un DOM mínimo: alta de miembro nuevo con inscripción configurada premarca
  el checkbox y prellena el monto; sin inscripción configurada nunca premarca aunque sea alta
  nueva; "Renovar" (sin el contexto `nuevoMiembro`) nunca premarca aunque el gym sí cobre
  inscripción; el staff puede desmarcar el checkbox aunque venga premarcado y el total no incluye
  la inscripción; una apertura normal del modal de pago siempre resetea todo (checkbox, monto,
  visibilidad) sin importar el estado previo.
- `git diff` revisado: cambios acotados a la sección de Pagos (botón, modal nuevo, checkbox en
  modal-pago, `savePago`, `preRegPago`, `openModal`) y a la carga inicial de `montoInscripcion`
  junto con `pinFinanzas` — sin tocar Finanzas/Reportes (siguen sumando `monto`, que ya incluye la
  inscripción si aplica).

## 2026-09-09 — Al dar de alta un miembro, ofrece registrar su pago ya con el modal preseleccionado

**Qué se hizo:**
- Tras guardar exitosamente un "Nuevo Miembro" (nunca al editar uno existente), `saveMiembro()`
  ahora abre el modal de "Registrar Pago" ya existente con ese miembro preseleccionado —
  reutilizado tal cual, sin duplicar la lógica de `savePago()`. Antes había que salir de
  Miembros, ir a Pagos, y volver a buscar al miembro recién creado.
- El botón "Cancelar" del modal de pago cambia a **"Omitir por ahora"** solo en este flujo (mismo
  botón, mismo `closeModal('modal-pago')`, solo el texto), para dejar claro al staff que
  registrar el pago ahí mismo es opcional — no bloquea nada, el miembro ya quedó guardado antes
  de que este modal se abriera. Si el staff cancela el modal de ALTA (nunca llega a guardar), no
  pasa nada de esto — el flujo vive dentro de `saveMiembro()`, nunca se dispara desde el botón
  Cancelar de "Nuevo Miembro".
- Bug encontrado y corregido de paso: `preRegPago(mid)` (ya usado por el botón "Renovar" de
  Alertas) preseleccionaba el miembro y LUEGO llamaba a `openModal('modal-pago')` — pero
  `openModal` resetea el buscador de miembro (`populateMiembrosSelect()` sin `selectedId`), así
  que ese reset borraba la preselección justo después de fijarla. Nunca se notó porque el
  buscador de todas formas deja escribir para buscar de nuevo. Se corrigió el orden (`openModal`
  primero, preselección después) — esto también arregla "Renovar" desde Alertas, que ahora sí
  preselecciona al miembro de una vez.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node con un DOM mínimo simulado: `preRegPago(id,'nuevoMiembro')` deja el miembro
  preseleccionado (id y nombre en el buscador) y el botón en "Omitir por ahora"; `preRegPago(id)`
  sin contexto (como lo llama "Renovar") también preselecciona correctamente y el botón queda en
  "Cancelar"; abrir el modal de pago de la forma normal ("+ Registrar Pago") restaura el botón a
  "Cancelar" y resetea el buscador, sin quedar pegado en "Omitir por ahora" de un uso anterior.
- `git diff` revisado: cambios acotados a `saveMiembro` (dispara el flujo solo al crear), el
  reordenamiento de `preRegPago`, el `id` nuevo del botón Cancelar, y su reset en `openModal` —
  `savePago()` no se tocó en absoluto.

## 2026-09-09 — Corrige: el checkbox de cada hábito del plan IA rompía el layout en celular

**Qué se hizo:**
- Reportado por el usuario: en el roadmap de hitos ("MES 1/2/3" con checklist de hábitos), en
  pantalla de celular el checkbox de cada hábito quedaba a la izquierda pero el texto (ej.
  "REGISTRAR TODAS LAS COMIDAS DIARIAS") se salía del contenedor visible en vez de ir junto al
  checkbox y hacer wrap. En desktop se veía bien.
- Causa: la regla CSS global `input,select,textarea{width:100%;background:...;border:...;
  padding:...}` (pensada para los campos de texto de los formularios) también le pegaba al
  `<input type="checkbox">` de cada hábito — lo agrandaba a 100% del ancho de la fila y le
  agregaba fondo/borde/padding de campo de texto, dejándole poquísimo o nada de espacio al
  `<span>` del texto dentro del `label` flex. En un modal ancho de escritorio el efecto se
  disimulaba; en una pantalla angosta de celular se notaba feo.
- `renderPlanFitnessIA` (`index.html`, compartida por el perfil de staff y el portal): el
  checkbox ahora trae estilos inline que anulan explícitamente esa regla global
  (`width:auto;flex:0 0 auto;background:none;border:none;padding:0;border-radius:0`) y el
  `<span>` del texto usa `flex:1;min-width:0` para hacer wrap normal dentro del ancho disponible
  del contenedor, en vez de salirse.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` — sintaxis válida.
- Simulación en Node del HTML generado para una fila de hábito: confirma que el checkbox anula el
  `width:100%`/fondo/borde globales, que no crece dentro del flex (`flex:0 0 auto`), y que el
  texto usa `flex:1;min-width:0` para poder hacer wrap.
- `git diff` revisado: cambio acotado a los estilos inline de esa fila — sin tocar la lógica de
  marcar/desmarcar hábitos ni el resto del roadmap.

## 2026-09-08 — Confirmado: gemini-3.5-flash-lite funciona en esta cuenta con 500 peticiones/día

**Qué se hizo:**
- Revisando la tabla completa de "Rate Limit" en aistudio.google.com/apikey (con "All models"
  activado), se encontró que `gemini-3.1-flash-lite` y `gemini-3.5-flash-lite` muestran 500
  peticiones/día y 15/minuto en esta cuenta — 25x más que las 20/día de `gemini-3.6-flash` — sin
  ser modelos de una generación ya cerrada para cuentas nuevas (a diferencia de `gemini-2.5-flash`,
  que mostraba cuota en el dashboard pero daba 404 al llamarlo de verdad).
- En vez de cambiar el default en `worker.js` (arriesgando otro 404 como con 2.5-flash), se probó
  con la variable de entorno `GEMINI_MODEL=gemini-3.5-flash-lite` en Cloudflare — así, si fallaba,
  bastaba con borrar la variable para volver al default seguro (`gemini-3.6-flash`) sin tocar
  código ni redesplegar. **Confirmado por el usuario: funciona.**
- `worker.js` NO se modificó — el default en código sigue siendo `gemini-3.6-flash` (el más
  universalmente disponible), y `gemini-3.5-flash-lite` queda activo vía la variable de entorno
  específica de esta cuenta. Este es justo el propósito de que `GEMINI_MODEL` sea configurable:
  cada cuenta de Google puede tener acceso/cuota distinta, así que el ajuste fino vive en la
  variable de entorno, no en el código del repo.

**Qué se verificó:**
- El usuario confirmó que "Actualizar recomendación" ya funciona con esta configuración.
- Pendiente de que el usuario confirme también el flujo completo del roadmap (Parte 7): que
  aparezcan las tarjetas de hitos con checkboxes, que marcar un hábito lo guarde, y que al
  regenerar el plan el progreso ya marcado se conserve.

## 2026-09-08 — Revierte a gemini-3.6-flash: gemini-2.5-flash está cerrado a cuentas nuevas

**Qué se hizo:**
- El cambio de la entrada anterior (default a `gemini-2.5-flash` por su cuota gratis más alta)
  rompió el Worker por completo: Gemini respondió 404 — `"models/gemini-2.5-flash is no longer
  available to new users. Please update your code to use models/gemini-3.6-flash"`. La cuenta de
  Google del usuario es nueva, y Google ya cerró el acceso a `gemini-2.5-flash` para cuentas
  nuevas, sin importar lo que muestre el dashboard de cuotas (ese dashboard lista el límite del
  modelo en general, no si tu cuenta específica puede usarlo).
- `cloudflare-worker-ia/worker.js`: default revertido a `gemini-3.6-flash` — es el único modelo
  que Google confirma que sí responde en esta cuenta, aunque su cuota gratis real sea baja (20
  peticiones/día, 5/minuto — ver la entrada anterior). `cloudflare-worker-ia/README.md`
  actualizado en consecuencia, y se agregaron dos casos nuevos a la sección de troubleshooting:
  error 429 (cuota agotada — cómo revisarla de verdad, y la opción de activar facturación) y
  error 404 (modelo ya no disponible para tu cuenta — cómo diagnosticarlo).
- Conclusión práctica para este proyecto: con la cuenta de Google actual, 20 peticiones/día es la
  cuota gratis real disponible. Si no alcanza para el uso real del gym, la opción más simple es
  activar facturación en el proyecto de Google Cloud (Gemini Flash es muy barato por consulta) en
  vez de seguir buscando un modelo gratis con mejor cuota — ya se intentó y el "mejor" resultó no
  estar disponible para esta cuenta.

**Qué se verificó:**
- `node --check cloudflare-worker-ia/worker.js` — sintaxis válida.
- `git diff` revisado: solo el modelo por default, sus comentarios, y las adiciones al README —
  sin tocar el resto del Worker (la lógica de razonamiento/parseo/reintentos sigue intacta y ya
  verificada en las entradas anteriores).
- Pendiente de confirmar por el usuario en producción: requiere volver a copiar/pegar `worker.js`
  en el dashboard de Cloudflare y desplegar.

## 2026-09-08 — Cambia el modelo por default de gemini-3.6-flash a gemini-2.5-flash: mucha más cuota gratis

**Qué se hizo:**
- El usuario seguía topándose con error 429 ("quota exceeded") con muy pocos intentos, muy lejos
  de los ~1,500/día que se había documentado como cuota gratis típica de Gemini Flash. Revisando
  el dashboard real de la cuenta (aistudio.google.com/apikey → Rate Limit), el límite real de
  `gemini-3.6-flash` en esa cuenta es de solo **20 peticiones/día y 5/minuto** — mientras que
  `gemini-2.5-flash`, en la misma cuenta, tiene **1,500/día**. Un modelo más nuevo no siempre
  trae más cuota gratis; en este caso trae bastante menos.
- `cloudflare-worker-ia/worker.js`: modelo por default cambiado de `gemini-3.6-flash` a
  `gemini-2.5-flash` (ambos con "thinking" — la lógica de filtrar `thought:true` y el
  `maxOutputTokens:3072` de las entradas anteriores siguen aplicando igual, no son específicas de
  un modelo). `cloudflare-worker-ia/README.md` actualizado con la misma advertencia: antes de
  cambiar `GEMINI_MODEL` a otro modelo, vale la pena revisar su cuota real en el dashboard, no
  asumir que "más nuevo = más cuota".

**Qué se verificó:**
- `node --check cloudflare-worker-ia/worker.js` — sintaxis válida.
- `git diff` revisado: solo el modelo por default y los comentarios/README relacionados — sin
  tocar la lógica de razonamiento/parseo ya verificada en las entradas anteriores.
- Pendiente de confirmar por el usuario en producción: requiere volver a copiar/pegar `worker.js`
  en el dashboard de Cloudflare y desplegar.

## 2026-09-08 — El agente de IA ahora genera un plan de fitness con hitos marcables (Parte 7), no solo texto libre

**Qué se hizo:**
- Evoluciona el agente de IA (Parte 6) de "un párrafo de texto libre" a un roadmap estructurado:
  Gemini ahora responde en JSON (`{resumenTexto, hitos:[{id, periodo, metaIntermedia,
  habitos:[{id, texto}]}]}`) en vez de texto libre, usando el modo de salida estructurada de
  Gemini (`responseMimeType:'application/json'` + `responseSchema` en
  `cloudflare-worker-ia/worker.js`) para que la API misma fuerce esa forma, con parseo
  `try/catch` + validación de forma del lado del Worker como red de seguridad (nunca hay que
  confiar ciegamente en que un modelo de IA respete el formato pedido al 100%).
- Nuevo campo `planFitnessIA` en el documento del miembro (reemplaza a `ultimaRecomendacionIA`,
  que ya no se usa — no había datos reales guardados con la forma vieja, los intentos previos
  habían fallado): `{resumenTexto, generadoEn, basadaEnDatosReales, hitos:[{id, periodo,
  metaIntermedia, habitos:[{id, texto, completado, completadoPor, completadoEn}]}]}`.
  `completado`/`completadoPor`(`'staff'`|`'cliente'`)/`completadoEn` los agrega y controla
  SIEMPRE `index.html`, nunca la IA (el esquema JSON que le pide el Worker a Gemini ni siquiera
  incluye esos campos).
- El perfil del miembro (staff) y "Mi Meta" del portal del cliente ahora muestran el plan como
  una línea de tiempo de tarjetas por hito (periodo + meta intermedia), cada una con su checklist
  de hábitos marcable (`renderPlanFitnessIA`, compartida entre ambos lados). Marcar/desmarcar un
  hábito (`toggleHabitoPerfil` en staff, `portalToggleHabito` en el portal) reescribe el campo
  `planFitnessIA` completo con el hábito actualizado — mismo patrón que ya usan
  `agregarNotaPlan`/`guardarMetaPerfil` en esta misma sección, porque Firestore no permite
  actualizar un elemento de un array anidado por índice. Ambos lados pueden marcar.
- Al darle "Actualizar recomendación" con un plan ya existente, se manda a la IA el plan actual
  completo (`planActual` en el payload, incluyendo qué hábitos ya están marcados) y el prompt del
  Worker instruye explícitamente a NUNCA reescribir ni desmarcar lo ya completado — pero eso es
  solo el primer nivel de defensa. La garantía real es del lado de `index.html`
  (`_mergePlanFitnessIA`): cualquier hito del plan viejo con al menos un hábito completado se
  preserva TAL CUAL (mismo id, periodo, meta intermedia y hábitos, intactos), sin importar qué
  haya devuelto la IA para ese mismo id — el plan nuevo solo aporta hitos que no correspondan a
  uno ya "congelado". Nunca hay que confiar ciegamente en que un modelo de IA respete una
  instrucción al 100%, así que la regla de negocio real vive en código determinista, no en el
  prompt.
- Ids de hitos/hábitos: nunca se usa tal cual el `id` que proponga la IA (podría traer comillas u
  otros caracteres que rompan los atributos `onclick` donde se usan para marcar el hábito
  correspondiente) — se valida contra un patrón simple (`_idSeguro`) y si no calza se genera uno
  propio (`_idAleatorio`), en vez de intentar escapar cualquier string arbitrario de un modelo de
  IA para incrustarlo en JS embebido en HTML.
- `firestore.rules` (y su copia en `rules-test/firestore.rules`, usada por el emulador):
  `planFitnessIA` reemplaza a `ultimaRecomendacionIA` en la misma excepción de escritura acotada
  que ya usan `estatura`/`fechaNacimiento`/`metaFitness` (tanto en `miembros` como en
  `miembrosPublicos`) — sigue siendo el mismo mecanismo de "reescritura del campo completo", sin
  regla aparte para marcar/desmarcar hábitos. `sincronizarMiembroPublico` ahora replica
  `planFitnessIA` al espejo público en vez de `ultimaRecomendacionIA`.
- De paso, se subió `maxOutputTokens` de 2048 a 3072: la respuesta ahora es un JSON con varios
  hitos/hábitos (más grande que el párrafo de texto libre de antes), y en modelos con "thinking"
  (`gemini-3.6-flash`) el razonamiento interno se descuenta del mismo presupuesto que la
  respuesta final (ver la entrada de más abajo sobre ese mismo tema).

**Qué se verificó:**
- `node --check` sobre `cloudflare-worker-ia/worker.js` y sobre ambos bloques `<script>` de
  `index.html` (extraídos a archivos temporales) — sintaxis válida en los tres.
- Simulación en Node de `buildUserPrompt` del Worker: sin plan previo instruye a generar uno
  desde cero; con un plan previo con hábitos completados, describe cada hábito con su estado
  (`[COMPLETADO, no lo toques]`/`[pendiente]`) e instruye explícitamente a no reescribirlos; con
  `planActual.hitos` vacío se trata igual que sin plan previo.
- Simulación en Node del parseo/validación del Worker: JSON válido con la forma esperada pasa;
  JSON mal formado da un error claro sin reventar; JSON válido pero sin `hitos` (o con `hitos` que
  no es array) da error de forma; con una part de `thought:true` sigue descartando el
  razonamiento y parseando el JSON real; con `finishReason:'MAX_TOKENS'` da error ANTES de
  intentar parsear un JSON cortado a medias.
- Simulación en Node de las funciones nuevas de `index.html`: `_idSeguro` conserva ids
  alfanuméricos simples y reemplaza los que traen espacios/comillas; `_normalizarPlanIA` recorta
  espacios, descarta hitos sin periodo/meta/hábitos y hábitos con texto vacío, e inicializa todo
  hábito nuevo con `completado:false`; `_mergePlanFitnessIA` — el caso central — conserva TAL
  CUAL un hito con progreso aunque la IA mande una versión distinta para el mismo id, agrega los
  hitos nuevos de la IA, y descarta los hitos viejos SIN progreso que la IA no volvió a mandar;
  `_marcarHabitoEnPlan` marca/desmarca sin mutar el objeto original.
- `rules-test`: `npm test` contra el emulador real de Firestore — 58/58 casos OK (55 previos + 3
  nuevos), incluyendo: el cliente anónimo SÍ puede guardar `planFitnessIA` completo y SÍ puede
  marcar un hábito como completado (reescritura del campo completo) en `miembros` y en
  `miembrosPublicos`, pero sigue sin poder colar `telefono`/`numero` junto con él.
- Pendiente de confirmar en producción: requiere volver a copiar/pegar `worker.js` en el
  dashboard de Cloudflare y desplegar (este archivo vive fuera de `index.html` — ver
  `cloudflare-worker-ia/README.md`); `index.html` se publica solo vía GitHub Pages como siempre.

## 2026-09-08 — Corrige (de raíz): la recomendación IA seguía saliendo truncada — el límite de tokens era insuficiente para el "thinking" del modelo

**Qué se hizo:**
- Después del fix anterior (filtrar `parts` marcadas `thought:true`), el usuario reportó que
  seguía viendo texto truncado tipo "*Format Constraints:* NO markdown (no" en vez de la
  recomendación — ya con el Worker actualizado y desplegado en Cloudflare, así que no era el
  mismo bug. Causa real: en los modelos con "thinking" (`gemini-3.6-flash`), los tokens que el
  modelo gasta razonando internamente se descuentan del MISMO presupuesto que `maxOutputTokens`
  — el Worker lo tenía en 400, tan bajo que el modelo gastaba casi todo pensando y se quedaba sin
  espacio para escribir la respuesta final, cortándose a la mitad de una frase.
- `cloudflare-worker-ia/worker.js`: `maxOutputTokens` subido de 400 a 2048 (deja margen de sobra
  para razonamiento + respuesta completa). Además, ahora revisa `finishReason` de la respuesta de
  Gemini: si viene `'MAX_TOKENS'` (se quedó sin espacio antes de terminar, aunque sea con el nuevo
  límite más alto), devuelve un error claro pidiendo reintentar en vez de mostrarle al usuario un
  fragmento de texto cortado a medias.

**Qué se verificó:**
- `node --check cloudflare-worker-ia/worker.js` — sintaxis válida.
- Simulación en Node combinando ambas protecciones: una respuesta con `finishReason:'MAX_TOKENS'`
  y texto cortado da error (nunca se le muestra el fragmento al usuario); una respuesta completa
  (`finishReason:'STOP'`) pasa el texto normal; una respuesta con `thought:true` + `STOP` sigue
  descartando el razonamiento y devolviendo solo la respuesta real (no se rompió el fix anterior).
- `git diff` revisado: cambio acotado a `maxOutputTokens` y la nueva verificación de
  `finishReason` — sin tocar el resto del Worker.
- Pendiente de confirmar por el usuario en producción tras volver a desplegar el Worker en
  Cloudflare (este archivo vive fuera de `index.html`, requiere copiar/pegar manual — ver
  `cloudflare-worker-ia/README.md`).

## 2026-09-08 — Corrige: la recomendación IA mostraba el "razonamiento interno" del modelo en vez de la respuesta real, y reintenta una vez si Gemini está saturado

**Qué se hizo:**
- Reportado por el usuario: la tarjeta de recomendación mostraba texto tipo "Rule Check: Spanish?
  Yes. Tone: Motivating/realistic" en vez de una recomendación real. Causa: `gemini-3.6-flash`
  (modelo actualizado en el fix anterior) es de la nueva generación con "thinking" — razona
  internamente antes de responder — y la respuesta de la API puede traer varias `parts`: unas
  marcadas `thought:true` (el razonamiento interno, nunca se le debe mostrar al usuario) y la
  parte final con la respuesta real. `cloudflare-worker-ia/worker.js` solo leía `parts[0]`, así
  que en esos casos devolvía el razonamiento interno en vez de la recomendación.
- `worker.js`: ahora recorre todas las `parts`, descarta las marcadas `thought:true` y concatena
  el resto — en modelos sin "thinking" (una sola part, sin ese campo) el comportamiento es
  idéntico al de antes.
- De paso, también se vio un error 503 ("modelo saturado temporalmente", del lado de Google, no
  un bug nuestro) — se agregó un solo reintento automático con ~1.2s de espera antes de darlo por
  fallido, ya que esos picos de demanda suelen ser momentáneos.

**Qué se verificó:**
- `node --check cloudflare-worker-ia/worker.js` — sintaxis válida.
- Simulación en Node de la extracción de texto: con una respuesta que trae una part de
  `thought:true` seguida de la respuesta real, devuelve SOLO la respuesta real (nunca el
  razonamiento interno); con una respuesta de un modelo sin thinking (una sola part simple) el
  resultado es idéntico al comportamiento anterior; con una respuesta sin `candidates`, no revienta.
- `git diff` revisado: cambios acotados a la llamada a Gemini (reintento en 503) y a la extracción
  del texto de la respuesta — sin tocar el resto del Worker.

## 2026-09-08 — Evita doble consulta a la IA por doble clic en "Actualizar recomendación"

**Qué se hizo:**
- Tras el fix del modelo de Gemini, salió un error 429 ("exceeded your current quota") en pruebas.
  Revisando el código, ni `pedirRecomendacionIAPerfil()` (perfil del miembro, staff) ni
  `portalPedirRecomendacionIA()` (portal del cliente) deshabilitaban el botón mientras la petición
  estaba en curso — un doble clic (o clic repetido por impaciencia mientras carga) disparaba dos o
  más consultas a Gemini en paralelo, consumiendo la cuota gratuita más rápido de lo esperado.
- Ambas funciones ahora reciben el botón (`onclick="...(this)"`, mismo patrón que ya usa
  `saveNuevoGym()` para su botón de guardar) y lo deshabilitan (`disabled=true`, texto
  "Consultando...") antes de armar el payload y llamar a `_solicitarRecomendacionIA`, y lo
  restauran en un bloque `finally` (así se re-habilita tanto si la petición tiene éxito como si
  falla). Un clic mientras el botón ya está deshabilitado no hace nada.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` (extraídos a archivos temporales)
  — sintaxis válida.
- `git diff` revisado: solo se movió el armado del payload dentro del `try` y se agregó el
  deshabilitado/rehabilitado del botón alrededor — la lógica de negocio (payload, llamada a la IA,
  guardado del resultado) queda idéntica a antes.

## 2026-09-08 — Corrige: recomendación IA fallaba porque Google descontinuó el modelo por default

**Qué se hizo:**
- El botón "🤖 Actualizar recomendación" empezó a fallar con error 502 porque Google descontinuó
  `gemini-2.0-flash` (el modelo que usaba el Worker de Cloudflare por default cuando no hay
  variable `GEMINI_MODEL` configurada). El propio error de la API de Gemini indica el reemplazo
  vigente: `gemini-3.6-flash`.
- `cloudflare-worker-ia/worker.js`: default de `env.GEMINI_MODEL` cambiado de `gemini-2.0-flash`
  a `gemini-3.6-flash`. `cloudflare-worker-ia/README.md` actualizado para reflejar el mismo
  default en las dos menciones (capa gratuita y nota de la variable opcional `GEMINI_MODEL`).
- Nadie necesita redeploy manual si usa la variable `GEMINI_MODEL`; quien depende del default
  (no configuró esa variable) sí necesita volver a pegar `worker.js` en el dashboard de
  Cloudflare y desplegar de nuevo para recoger el nuevo default.

**Qué se verificó:**
- `node --check cloudflare-worker-ia/worker.js` — sintaxis válida.
- `git diff` revisado: solo el valor del modelo por default en `worker.js` y las dos menciones
  equivalentes en `README.md` — sin ningún otro cambio.

## 2026-09-08 — Corrige: la meta se guardaba pero el perfil la mostraba borrada (staff)

**Qué se hizo:**
- Bug reportado por el usuario tras desplegar: en el perfil del miembro (staff), al guardar la meta salía "Meta guardada ✓" pero la tarjeta se veía como si no hubiera nada guardado, y "Actualizar recomendación" decía "Primero guarda una meta" aunque sí se había guardado.
- Causa real: `guardarMetaPerfil()` y `pedirRecomendacionIAPerfil()` actualizaban el array `miembros` en memoria con `_actualizarLocal(...)`, pero nunca reconstruían el índice `miembrosPorId` (el Map que usan para buscar al miembro por id) con `recalcMiembrosPorId()` — así que `miembrosPorId.get(id)` seguía devolviendo el objeto VIEJO, sin la meta recién guardada, aunque el array y Firestore sí la tenían. Mismo patrón que ya usan correctamente `agregarNotaPlan`/`eliminarNotaPlan` (llamar `recalcMiembrosPorId()` justo después de `_actualizarLocal`), que se me había olvidado en las tres llamadas nuevas de esta función. El portal del cliente no tenía este bug (usa `portalMiembro={...portalMiembro,...}` directo, sin Map intermedio).

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Reproducción del bug en Node con el mismo patrón real (`_actualizarLocal` sin `recalcMiembrosPorId()` después dejaba el Map viendo el objeto viejo) y confirmación de que, con la llamada agregada, el Map ya refleja la meta guardada de inmediato.
- `git diff` revisado: son exactamente 3 líneas agregadas (`recalcMiembrosPorId();`), una en cada rama donde faltaba — sin ningún otro cambio.

## 2026-09-08 — Agente de IA: meta de fitness + recomendación de Gemini vía Worker de Cloudflare (Parte 6)

**Qué se hizo:**
- Nuevo campo `metaFitness` en el documento del miembro (`{tipo:'pesoCorporal'|'ejercicio', valorObjetivo, ejercicioObjetivo, fechaObjetivo, creadaEn}`), editable en una tarjeta nueva "🎯 Meta y Recomendación IA" — tanto en el perfil del miembro del panel de staff (mismo patrón que peso corporal/notas de plan: se edita directo en `modal-perfil`, no en el modal de alta) como en una tarjeta nueva "🎯 Mi Meta" del portal del cliente, justo después de "Mi progreso". `ejercicioObjetivo` reutiliza los ids de `BIBLIOTECA_EJERCICIOS` (mismo catálogo del registro de progreso), con un selector agrupado por músculo (`_opcionesEjercicioSelectHtml`, compartido).
- `calcularTendenciaMeta(mid)` (staff) y `portalCalcularTendenciaMeta()` (portal): ritmo real de cambio (kg/semana, o carga/semana si la meta es de un ejercicio) calculado sobre el propio historial del miembro — peso corporal si `tipo==='pesoCorporal'`, o los registros de `registrosProgreso` de ese ejercicio si `tipo==='ejercicio'`. Mismo patrón de confiabilidad que `calcularPatronAsistencia`/`calcularPatronCompra`: exige un mínimo de puntos (`META_MIN_REGISTROS=3`) Y de días de separación entre el primero y el último (`META_MIN_DIAS_HISTORIAL=10`); si no se cumple, `null`. Núcleo compartido (`_historialParaMeta`/`_tendenciaMetaDesdeHistorial`) entre las dos variantes.
- Botón "🤖 Actualizar recomendación" (perfil del miembro y portal): junta edad, peso actual, estatura, IMC, la meta y el resultado de `calcularTendenciaMeta`, y lo manda por `fetch()` a un Worker de Cloudflare — proyecto NUEVO y APARTE de `index.html` (`cloudflare-worker-ia/` en este mismo repo, con su propio `worker.js`, `wrangler.toml` y `README.md` de despliegue paso a paso). El Worker guarda la API key de Gemini como secreto de Cloudflare (nunca llega al navegador), arma el prompt (system prompt fijo: español, tono motivador pero realista, prohíbe diagnósticos médicos, usa el ritmo real tal cual si se lo dan — nunca inventa otro —, y si no hay ritmo real deja explícito que es un estimado inicial; siempre agrega el aviso de "no sustituye a un entrenador o médico" si la meta implica un cambio de peso significativo) y llama a Gemini (`gemini-2.0-flash`, capa gratuita). El resultado se cachea en `ultimaRecomendacionIA: {texto, basadaEnDatosReales, generadaEn}` en el documento del miembro, para no tener que regenerar si se vuelve a abrir la vista.
- `index.html` solo necesita `IA_WORKER_URL` (constante con un placeholder claro, `REEMPLAZA-CON-TU-WORKER`, que produce un error explícito en vez de fallar en silencio mientras no se configure) — el despliegue del Worker y la API key de Gemini son pasos que el usuario hace fuera de esta sesión, documentados en `cloudflare-worker-ia/README.md`.
- `firestore.rules`: se agregaron `metaFitness`/`ultimaRecomendacionIA` a la misma excepción de escritura acotada que ya usan `estatura`/`fechaNacimiento` (tanto en `miembros` como en `miembrosPublicos`) — no son colecciones nuevas, son campos más del documento existente. `sincronizarMiembroPublico` ahora también replica esos dos campos al espejo público que lee el portal.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` de `index.html` y sobre `cloudflare-worker-ia/worker.js` — sintaxis válida en los tres.
- `npm test` en `rules-test/` contra el emulador real de Firestore: 56/56 casos OK (51 previos + 5 nuevos), incluyendo: el cliente anónimo SÍ puede guardar `metaFitness`/`ultimaRecomendacionIA` en `miembros` y en `miembrosPublicos`, pero NO puede colar `telefono`/`numero` junto con esos campos.
- Simulación en Node del núcleo de `calcularTendenciaMeta`: sin `metaFitness` da `null`; con historial suficiente (4 puntos en 20 días) da el ritmo exacto esperado (kg/semana); con menos de `META_MIN_REGISTROS` puntos o con historial de menos de `META_MIN_DIAS_HISTORIAL` días de separación, da `null` aunque haya suficientes puntos; una meta de ejercicio filtra correctamente por `ejercicioObjetivo` e ignora registros de otros ejercicios.
- Simulación en Node de `buildUserPrompt` del Worker (copiada tal cual, verificada idéntica por `diff` contra el archivo real): con tendencia real, el prompt incluye el número EXACTO y le instruye a la IA a no calcular otro; sin tendencia, incluye la instrucción de "estimado inicial, cliente nuevo" y ningún número inventado; meta de ejercicio menciona el nombre del ejercicio objetivo; fecha objetivo futura menciona los días restantes, una fecha ya pasada no genera una cuenta sin sentido; payload mínimo no revienta.
- `git diff` revisado: los 15 nombres de función nuevos son únicos en todo el archivo (sin colisiones ni redefiniciones), y el balance de `<div>`/`</div>` del HTML no cambió respecto al que ya tenía antes de este cambio.


## 2026-09-04 — Selector kg/lb al registrar una serie (repeticiones ya existía)

**Qué se hizo:**
- Nuevo toggle kg/lb junto al campo de peso en "Registrar serie" (portal del cliente): dos botones chicos, "kg" seleccionado por defecto. Al cambiar de unidad, si ya había un número escrito, se convierte en el propio input (no se pierde lo tecleado) sin volver a pintar el resto del formulario (no se pierde el foco de reps ni del campo "Otro" de tipo de serie).
- `registrosProgreso` SIEMPRE guarda `peso` en kg (no cambia ningún cálculo ni comparación histórica existente) más un campo nuevo `unidadOriginal` ('kg' o 'lb') con la unidad en la que el cliente lo capturó. Conversión con la fórmula pedida, `kgALb(kg)=kg*2.20462` y `lbAKg(lb)=lb/2.20462`, redondeada a 1 decimal.
- En la bitácora/tabla de "Mi progreso" (portal) y "Progreso por Ejercicio" (perfil del miembro, staff), cada fila muestra el peso en SU PROPIA `unidadOriginal` (`formatearPeso`) — un registro capturado en lb se ve en lb, uno en kg se ve en kg, tal cual como el cliente lo pensó al capturarlo. Registros de antes de este cambio (sin `unidadOriginal`) se tratan como kg, sin cambio de comportamiento.
- En la gráfica de línea (Chart.js) no se pueden mezclar kg y lb en el mismo eje, así que usa una sola unidad para toda la línea: la del registro más reciente de ese ejercicio (convirtiendo los demás puntos a esa unidad, sin pérdida porque `peso` siempre es kg canónico). La etiqueta del eje ("Peso (kg)" o "Peso (lb)") cambia según corresponda.
- El campo de repeticiones YA estaba implementado de antes (input, guardado como `repeticiones`, columna "Reps" en ambas tablas de historial) — no hizo falta agregarlo, solo se confirmó que sigue funcionando junto a los cambios de esta entrada.
- Sin cambios en el peso corporal del miembro (card "Peso Corporal"/IMC): sigue solo en kg, sin selector, tal como se pidió explícitamente.
- `firestore.rules` no necesitó cambios: la regla de `registrosProgreso` ya permitía cualquier campo (sin `hasOnly`), así que agregar `unidadOriginal` no requiere republicar reglas.

**Qué se verificó:**
- `node --check` sobre el bloque `<script>` principal — sintaxis válida.
- Simulación en Node de `kgALb`/`lbAKg`/`formatearPeso` extraídas tal cual del archivo real: fórmula exacta y redondeo a 1 decimal (100kg→220.5lb, 60lb→27.2kg); `portalGuardarSerie` guarda siempre en kg con `unidadOriginal` correcto según lo capturado; el toggle convierte el valor ya escrito al cambiar de unidad; la tabla muestra cada fila en su propia unidad (incluye compatibilidad con registros viejos sin `unidadOriginal`); la gráfica elige la unidad del registro más reciente y convierte TODOS los puntos a esa unidad de forma consistente, con kg por defecto si no hay ningún registro.
- `git diff` revisado: cero referencias a `pesoCorporal`/`agregarPesoCorporalPerfil`/`renderPesoCorporalPerfil` en el cambio — confirmado que el peso corporal del miembro no se tocó.

## 2026-09-04 — Biblioteca de ejercicios mucho más amplia + buscador de ejercicio para registrar

**Qué se hizo:**
- El usuario aclaró que el pedido de "catálogo con buscador" era sobre EJERCICIOS, no sobre "máquinas" (ese modelo de dar de alta máquinas con QR por máquina ya no existe, se reemplazó por el menú fijo músculo→ejercicio). Se descartó la idea de un buscador para Inventario/Equipo del Gym.
- `BIBLIOTECA_EJERCICIOS` creció de 42 a 94 ejercicios y de 8 a 10 categorías: se agregaron varios ejercicios más a cada grupo muscular existente (Pecho, Espalda, Hombro, Bíceps, Tríceps, Pierna, Glúteo, Abdomen — incluye ahora pantorrilla y aductor dentro de Pierna) y dos categorías nuevas, Cardio (caminadora, elíptica, bicicleta, escaladora...) y Funcional (kettlebell swing, TRX, burpees, battle ropes...), para cubrir la gran mayoría de equipo/ejercicios de un gym comercial típico.
- Nuevo buscador de texto en el menú "Registrar serie" del portal (antes de elegir músculo): al escribir, busca por nombre en TODA la biblioteca (cruza categorías) y muestra una lista plana de coincidencias con su músculo y parte; tocar una va directo al formulario de registrar serie, sin pasar por la lista intermedia de ejercicios de ese músculo. Si el campo está vacío, se ve el menú de músculos de siempre (sin cambio). Reutiliza `coincideBusquedaEjercicio` (agregado ayer para el buscador del historial de progreso) — misma búsqueda simple por palabras, insensible a mayúsculas/acentos, sin backend ni librerías nuevas.
- El buscador vive en un contenedor separado del que se reemplaza en cada tecla (mismo patrón ya usado en "Mi progreso"), así el `<input>` nunca se recrea mientras se escribe y no pierde el foco ni cierra el teclado.

**Qué se verificó:**
- `node --check` sobre el bloque `<script>` principal — sintaxis válida.
- `BIBLIOTECA_EJERCICIOS` extraída del archivo real y evaluada en Node: 10 categorías (incluye Cardio y Funcional), 94 ejercicios, ids únicos en toda la biblioteca, cada uno con nombre/parte/músculo presentes.
- Simulación en Node del buscador del menú: "sentadilla" encuentra varias coincidencias cruzando categorías (Pierna y Glúteo); "curl" encuentra tanto los de Bíceps como "Curl femoral" (Pierna) — coincidencia correcta por nombre, no por músculo; "martillo" encuentra únicamente "Curl martillo" sin falsos positivos; el buscador también encuentra ejercicios de Cardio y Funcional; sin resultados no revienta; elegir un resultado de búsqueda decide músculo+ejercicio de una sola vez y lleva directo al formulario de registrar serie.

## 2026-09-04 — "Súper serie" como tipo, y buscador de ejercicio en el historial de progreso

**Qué se hizo:**
- Nuevo tipo de serie "Súper serie", agregado a `TIPOS_SERIE` (ahora: Calentamiento, Normal, PR, Dropset, Al fallo, Súper serie, Otro) con su propia ayuda chica. Se guarda exactamente igual que cualquier otro tipo — un registro de Súper serie sigue siendo la serie de UN SOLO ejercicio (`{miembroId, ejercicioId, musculo, tipo:'Súper serie', peso, repeticiones, fecha}`), no se modela ningún vínculo entre dos ejercicios distintos.
- Buscador de texto en "Mi progreso" (portal del cliente) y en "Progreso por Ejercicio" (perfil del miembro, panel de staff): filtra qué ejercicios aparecen en el selector por coincidencia de nombre, combinable con el filtro de tipo de serie que ya existía. Búsqueda simple, sin backend ni librerías nuevas — reutiliza `normalizarNombreComparacion` (ya existente) y agrega `coincideBusquedaEjercicio(nombre, busqueda)`: cada PALABRA de lo escrito debe aparecer en algún lado del nombre (sin importar el orden), insensible a mayúsculas/acentos. Así "press banca" encuentra "Press de banca plano" aunque el nombre real lleve una preposición en medio.
- Ambos buscadores están separados del contenido que se vuelve a pintar en cada tecla/cambio de filtro (nuevos contenedores `#portal-progreso-resultados` y `#p-progreso-resultados`) — el `<input>` de búsqueda nunca se recrea mientras se escribe, así que no pierde el foco/cursor ni cierra el teclado en cada letra.

**Qué se verificó:**
- `node --check` sobre el bloque `<script>` principal — sintaxis válida.
- Simulación en Node de `coincideBusquedaEjercicio` con nombres reales del catálogo: "press banca" encuentra "Press de banca plano" pero NO "Press inclinado"/"Press declinado" (su nombre visible no dice "banca", aunque su id sí); orden de las palabras no importa; falta una sola palabra de la búsqueda -> no hay match; insensible a mayúsculas y acentos ("biceps" encuentra "bíceps"); búsqueda vacía muestra todo.
- Simulación de la selección por defecto tras buscar: prioriza el ejercicio que se está navegando/registrando si sigue en los resultados filtrados; si la selección previa queda excluida por la búsqueda, cae al primer resultado nuevo; si sigue siendo válida, se respeta; sin resultados, se muestra el estado vacío en vez de romper el selector.
- Confirmado que un registro de "Súper serie" tiene exactamente los mismos 7 campos que cualquier otro tipo (sin campos extra de vínculo entre ejercicios).

## 2026-09-03 — Renombra la pestaña a "QR y Sugerencias" y mueve ahí la tarjeta de sugerencias

**Qué se hizo:**
- La pestaña nueva del panel ya no se llama solo "QR" — ahora es "QR y Sugerencias" (mismo id interno `qr`, solo cambió el texto del botón de nav y el título de la página).
- Se movió la tarjeta "💬 Sugerencias de clientes" (filtro por categoría, lista, marcar como leída, borrar) desde Alertas hacia esta misma pestaña, justo debajo de las dos tarjetas de QR — así todo lo relacionado con sugerencias (generar el QR y leer lo que llega) queda junto en un solo lugar. Ya no vive nada de sugerencias en Alertas.
- `activarTab()` ahora llama `renderSugerencias()` al entrar a la pestaña `qr` en vez de a `alertas`.
- Textos ajustados para reflejar la nueva ubicación (ya no dicen "en Alertas" ni "pestaña QR" a secas).

**Qué se verificó:**
- `node --check` sobre el bloque `<script>` principal — sintaxis válida.
- `git diff` revisado: el HTML de la tarjeta de sugerencias se movió tal cual (mismos ids `sugerencias-titulo`/`sugerencias-content`, misma lógica de `renderSugerencias()`), no se duplicó ni se dejó nada huérfano en Alertas.
- Búsqueda confirma cero referencias colgantes a "de Alertas" o "en Alertas" relacionadas con sugerencias en todo el archivo.

## 2026-09-03 — Nueva pestaña "QR" en el panel: mueve ahí los dos botones de descarga de QR

**Qué se hizo:**
- Nueva pestaña "QR" en el menú principal del panel de staff (junto a Dashboard, Miembros, Pagos... Inventario), con dos tarjetas: "🏋️ QR de Acceso" (el QR normal del portal — identificación, músculo/ejercicio, peso corporal) y "💬 QR de Sugerencias" (el buzón anónimo). Cada una con su botón de descarga.
- Se movieron ahí los dos botones "Descargar mi QR de acceso" y "Descargar QR de Sugerencias" que antes vivían dentro del modal de 🎨 Personalización — ya no están duplicados, solo cambiaron de lugar. Las funciones `descargarQRAcceso()`/`descargarQRSugerencias()` no cambiaron, solo los botones que las llaman.
- La pestaña QR es de acceso libre para cualquier gimnasio sin importar su plan (igual que Dashboard, o el botón "🎨 Personalizar") — no se agregó a `TODAS_SECCIONES`/`userFunciones` a propósito, porque eso es el sistema de secciones de pago que el admin activa por plan, y descargar estos QR no es una función premium. `showTab()` ahora deja pasar `'qr'` igual que ya dejaba pasar `'dashboard'`.
- Actualizado el texto de "Sugerencias de clientes" en Alertas (cuando aún no hay ninguna) para apuntar a la pestaña QR en vez de a Personalización.

**Qué se verificó:**
- `node --check` sobre el bloque `<script>` principal — sintaxis válida.
- Simulación en Node de la lógica de `showTab`: la pestaña `qr` es accesible aunque el gimnasio tenga `funciones:[]` (plan mínimo) o cualquier combinación de funciones; `dashboard` sigue igual que antes; una sección de plan real (`inventario`) sigue bloqueada si no está en `funciones` — confirma que no se rompió el gating existente para el resto de pestañas.
- `git diff` revisado: no quedó ningún botón ni texto duplicado de "Descargar... QR" en Personalización; búsqueda confirma cero referencias colgantes al texto/ubicación anterior.

## 2026-09-03 — Buzón de sugerencias anónimo, QR aparte (Parte 4)

**Qué se hizo:**
- Nuevo modo del portal, completamente separado del flujo de identificación/músculo/ejercicio: `?gym={uid}&sugerencia=1`. Sin número de miembro, sin nombre, sin ningún paso de identificación — solo un selector de categoría (mismo patrón visual de botones que "Tipo de serie") y, al elegir una, un `textarea` de hasta 500 caracteres con contador y botón "Enviar sugerencia". Categorías: Máquinas y equipo, Limpieza, Instalaciones, Atención del personal, Clases y horarios, Precios y membresías, Estacionamiento, Otro.
- Sigue usando `signInAnonymously` (necesario para poder escribir en Firestore), pero el documento que se guarda en `usuarios/{gym}/sugerencias` NUNCA lleva miembroId, nombre, número, ni el uid anónimo — solo `{categoria, texto, fecha, leida:false}`. Tras enviar, muestra "¡Gracias! Tu sugerencia fue enviada.", limpia el formulario y regresa al selector de categoría por si quiere mandar otra. Se guarda en `localStorage` (por gimnasio) que ya envió una hoy — es solo una cortesía de UI para no repetir el aviso de agradecimiento; nunca bloquea un nuevo envío.
- `firestore.rules`: nueva regla acotada solo para `sugerencias` — cualquier autenticado (incluye anónimos) puede `create` validando que el documento traiga EXACTAMENTE `categoria`/`texto`/`fecha`/`leida` (`hasOnly`), que `categoria` esté en la lista fija (misma lista que ofrece el portal, `CATEGORIAS_SUGERENCIA` en `index.html`), que `texto` sea string no vacío de máximo 500 caracteres, y que `leida` venga en `false` — nunca se puede crear ya marcada como leída. Sin `read`/`list`/`update`/`delete` en esa regla: ni siquiera quien la mandó puede volver a leerla. Leer/marcar como leída/borrar sigue siendo solo del dueño del gimnasio (o admin), vía la regla genérica que ya cubre el resto de las colecciones — no hizo falta ninguna regla extra para eso.
- Panel de staff: dentro de "Alertas", nueva tarjeta "Sugerencias de clientes" (justo debajo de la de Alerta de Promoción/Paquete). Pestañas de filtro por categoría (incluida "Todas"), cada una mostrando cuántas sugerencias sin leer tiene esa categoría entre paréntesis; la lista de la categoría activa se ordena de más reciente a más antigua, mostrando solo categoría/texto/fecha (nunca quién la mandó, porque el dato ni existe). Cada sugerencia tiene botón "✓ Marcar como leída" (se atenúa visualmente y el botón desaparece) y botón de borrar. El título de la tarjeta muestra el total de sugerencias sin leer, ej. "💬 Sugerencias de clientes (5 nuevas)".
- Nueva colección `sugerencias` agregada a `loadAll()` (se lee una vez al iniciar sesión, igual que el resto); marcar-leída/borrar parchean el array en memoria con `_actualizarLocal`/`_eliminarLocal` en vez de releer toda la colección.
- En 🎨 Personalización, junto al botón existente "⬇️ Descargar mi QR de acceso", nuevo botón "⬇️ Descargar QR de Sugerencias" que genera un QR aparte apuntando a `?gym={uid}&sugerencia=1`. Se extrajo la lógica de generación de QR (antes duplicada) a un helper compartido `_generarYDescargarQR(url, nombreArchivo)`.

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` (módulo de Firebase en `<head>` y bloque principal) — sintaxis válida.
- `npm test` en `rules-test/` contra el emulador real de Firestore: 51/51 casos OK (39 previos + 12 nuevos), incluyendo: cliente anónimo SÍ puede crear una sugerencia válida; NO puede crear con categoría fuera de la lista, texto vacío, texto de más de 500 caracteres, `leida:true`, ni colando un campo extra como `miembroId`; NO puede leer ni listar sugerencias (ni siquiera la que acaba de crear); el staff SÍ puede leer/marcar como leída/borrar las suyas; y Gym B NO puede leer las sugerencias de Gym A.
- Comparación programática (Node) de `CATEGORIAS_SUGERENCIA` en `index.html` contra la lista `categoria in [...]` de `firestore.rules`: idénticas carácter por carácter (acentos incluidos) — cualquier categoría que ofrece el portal es válida para la regla, y viceversa.
- Simulación en Node de la lógica pura: el documento que arma `portalEnviarSugerencia` tiene exactamente 4 campos y nunca miembroId/nombre/numero/uid; validación de texto vacío/501 caracteres antes de enviar; el flujo de "elegir categoría -> aparece textarea" y "tras enviar -> vuelve a botones + mensaje de gracias"; la marca de `localStorage` es por gimnasio y nunca se consulta para bloquear un envío; y el conteo de sin-leer por categoría para las pestañas del staff.
- `git diff` revisado: el flujo de identificación por número+nombre y el menú de músculos/ejercicios existentes no se tocaron — el buzón vive en funciones y un `if` completamente aparte, activado solo por `?sugerencia=1`.

## 2026-09-03 — Portal QR: de "un QR por máquina" a "un solo QR por gimnasio" con menú de músculos y ejercicios (Parte 3)

**Qué se hizo:**
- Cambio de modelo del portal público del cliente: en vez de imprimir y pegar un código QR distinto en cada artículo de Equipo del Gym, ahora hay UN SOLO QR por gimnasio. El staff lo descarga desde "🎨 Personalización" ("⬇️ Descargar mi QR de acceso") y lo puede pegar donde quiera (entrada, recepción, varias copias) — ya no hay que generar ni reimprimir nada por cada máquina nueva.
- Se quitó por completo el modelo anterior: el botón "📷 Máquinas y QR" y su modal en Inventario, `renderMaquinasModal`/`abrirModalMaquinas`/`descargarQRMaquina`, y el parámetro `?maquina=` de la URL del portal (`window._portalMaquina`). `descargarQRAcceso()` genera un único QR codificando `?gym={uid}` (misma librería `qrcode-generator`, mismo mecanismo de antes).
- Nueva biblioteca de ejercicios `BIBLIOTECA_EJERCICIOS`: contenido estático embebido en `index.html` (8 músculos — Pecho, Espalda, Hombro, Bíceps, Tríceps, Pierna, Glúteo, Abdomen — con 42 ejercicios en total, cada uno con `id`, `nombre` y `parte` del músculo que ataca). NO vive en Firestore ni varía por gimnasio, así que no hay que darlo de alta ni sincronizarlo.
- Nueva navegación del portal tras identificarse: menú de músculos → lista de ejercicios de ese músculo (nombre + la `parte` en texto chico/gris) → mismo formulario de siempre (tipo de serie, peso, repeticiones) al elegir un ejercicio específico. Cada paso tiene un botón "‹ volver" al anterior. `registrosProgreso` ahora guarda `ejercicioId` y `musculo` en vez de `maquinaId`.
- "Mi progreso" (portal) y "Progreso por Ejercicio" (perfil del miembro en el panel de staff, antes "Progreso por Máquina") ahora agrupan y filtran por ejercicio en vez de por máquina, usando una nueva función `buscarEjercicioInfo(id)` que busca el ejercicio en toda la biblioteca (sin importar el músculo) para mostrar su nombre. Mismo comportamiento de antes: selector de ejercicio + filtro por tipo de serie + historial + gráfica; la primera vez que se abre "Mi progreso" prioriza el ejercicio que el cliente está viendo/registrando en ese momento, si ya tiene historial.
- `firestore.rules` simplificado: se quitó la regla de lectura pública de `inventario` (existía solo para que el portal mostrara el nombre de la "máquina" escaneada) — ya no hace falta, la biblioteca de ejercicios es estática y no vive en Firestore. `registrosProgreso` y `pesoCorporal` quedaron exactamente iguales, sin tocar. Actualizado también `rules-test/firestore.rules` y `rules-test/test.mjs` (registro de progreso de prueba ahora con `ejercicioId`/`musculo`, y nuevo caso: el cliente anónimo YA NO puede leer `inventario`).
- Sin cambios en: peso corporal, estatura, IMC, fecha de nacimiento (Parte 2 completa); la aplicación de personalización visual (colores/logo) en el portal; el resto del panel de staff (Finanzas, Empleados, etc.).

**Qué se verificó:**
- `node --check` sobre ambos bloques `<script>` del archivo (el módulo de Firebase en `<head>` y el bloque principal) — sintaxis válida en los dos.
- `npm test` en `rules-test/` contra el emulador real de Firestore: 39/39 casos OK, incluyendo el nuevo ("cliente anónimo NO puede leer inventario") y el actualizado (registro de progreso con `ejercicioId`/`musculo`) — confirma que la regla se quitó de verdad y que el resto de permisos (aislamiento entre gimnasios, admin, miembrosPublicos, etc.) sigue intacto.
- `BIBLIOTECA_EJERCICIOS` extraída del archivo real y evaluada en Node: 8 músculos, 42 ejercicios, IDs únicos en toda la biblioteca (sin duplicados entre músculos distintos) y cada uno con `nombre`+`parte` presentes.
- Simulación en Node de la lógica pura de navegación y agrupación: `buscarEjercicioInfo` encuentra el ejercicio correcto en cualquier músculo y devuelve `null` sin reventar si el id no existe; la navegación cae correctamente de "formulario" a "lista de ejercicios" si el `ejercicioId` ya no es válido; el documento que arma `portalGuardarSerie` trae `ejercicioId`+`musculo` y ya NO `maquinaId`; la selección por defecto de "Mi progreso" prioriza el ejercicio que se está navegando/registrando cuando tiene historial, respeta una selección manual previa válida, y se recalcula sola si esa selección ya no existe en el historial actual.
- `git diff` revisado: confirma que no quedó ninguna referencia a `maquinaId`, `portalMaquina`, `abrirModalMaquinas`, `modal-maquinas` ni `descargarQRMaquina` en todo el archivo, y que las secciones de peso corporal/estatura/IMC/fecha de nacimiento y personalización visual del portal no se tocaron.

## 2026-09-02 — Corrige XSS almacenado: escapa nombre/teléfono/notas/dirección/puesto/zona antes de insertarlos en `innerHTML`

**Qué se hizo:**
- Auditoría completa del archivo: varias pantallas (Dashboard, Miembros, Pagos, Asistencia, Alertas, Alerta de Promoción, Recordatorios, Empleados, Inventario —incluye el aviso de stock bajo/sin stock—, Ventas y Promociones) insertaban datos escritos por el staff (nombre, teléfono, notas, dirección/zona, puesto) directo en `innerHTML` sin escaparlos. Si cualquiera de esos campos llegara a contener HTML/script (a mano o vía importación de Excel), se ejecutaría en el navegador de cualquiera que abriera esa pantalla — XSS almacenado.
- Ya existía `escAttr()` (usado correctamente en el portal QR y en Seguimiento personalizado). Se envolvieron con `escAttr()` los ~20 puntos de inserción encontrados, sin cambiar nada visual ni de comportamiento cuando el dato no trae caracteres especiales. Incluye dos que no estaban en el reporte inicial pero caen en el mismo patrón: la tabla principal de Asistencia (nombre + el `title` de notas, que antes solo escapaba comillas) y los `<option>` de producto en el modal de Venta/Venta rápida.
- Bug aparte, mismo origen: en varios de estos lugares el patrón era `escAttr(x)||'—'` para mostrar `—` cuando el campo no existe. Pero `escAttr(undefined)` devuelve el string `"undefined"` (verdadero en JS), así que ese `||'—'` nunca se activaba — se veía literalmente la palabra "undefined". Se cambió a `x?escAttr(x):'—'` en todos los casos (teléfono, puesto, zona, notas).
- Fuera de alcance a propósito: `p.planNombre` y `p.promocionUsada` (vienen de datos internos que el staff arma desde selects/plantillas, no texto libre) y el selector de búsqueda de miembro para pagos (`filtrarMiembrosSearch`), que ya tenía su propio escapado local desde antes.

**Qué se verificó:**
- `node --check` sobre el bloque `<script>` principal extraído — sintaxis válida.
- `git diff` revisado línea por línea: cada cambio es un `escAttr(...)` o `x?escAttr(x):'—'` envolviendo un campo existente — cero cambios de HTML/CSS/lógica fuera de eso.
- Simulación en Node con `escAttr` real: confirma el bug original (`escAttr(undefined)||'—'` da `"undefined"`), confirma que el patrón nuevo sí cae a `'—'` sin telefono/vacío y no cambia nada cuando el dato existe, y confirma que un nombre malicioso (`<script>alert(1)</script>`) queda convertido a entidades HTML y ya no se ejecutaría.

## 2026-09-01 — Marca visual (color claro) en los botones de WhatsApp ya usados

**Qué se hizo:**
- El usuario pidió que, al darle clic a un botón de WhatsApp en Alertas o Recordatorios, quede alguna señal de que ya se le picó — para no perder de vista a quién ya se le contactó en la sesión de trabajo — con un color más claro en el botón.
- Nueva clase CSS `.btn-whatsapp-enviado` (verde claro, texto verde oscuro) como variante de `.btn-whatsapp` (verde sólido). Dos sets nuevos en memoria, `whatsappEnviadoAlerta` y `whatsappEnviadoRecordatorio` — por separado porque son mensajes distintos (uno es el de cobro vencido, el otro el de recordatorio de asistencia), así que marcar uno no marca el otro para el mismo miembro.
- `enviarWhatsApp(mid)` (Alertas: vencidos/por vencer) y `enviarWhatsAppRecordatorio(mid)` (Recordatorios de meta semanal) ahora, después de abrir la pestaña de WhatsApp, agregan el id del miembro al set correspondiente y vuelven a pintar esa sección — el botón que se acaba de usar cambia a verde claro de inmediato, sin recargar la página.
- Igual que `promoEnviados` (la cola de envío de promociones ya existente), esta marca vive SOLO en memoria del navegador — se reinicia si se recarga la página. Es un recordatorio visual para el staff dentro de la sesión, no un registro de que el mensaje se envió de verdad (eso GymTrack no lo puede saber una vez que abre WhatsApp, solo que se le dio clic al botón) ni queda guardado en Firestore.
- El botón NO se deshabilita ni desaparece — sigue siendo clickeable por si hay que reenviar, solo cambia de color.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- `git diff` revisado: cambios contenidos a los dos botones de WhatsApp de Alertas/Recordatorios y su CSS — sin tocar la cola de promociones, el editor de mensajes, ni ninguna otra pestaña.
- Simulación en Node de la lógica de selección de clase: antes de dar clic sale `btn-whatsapp` (verde sólido); después de dar clic en Alertas sale `btn-whatsapp-enviado` (verde claro) solo para Alertas, sin afectar Recordatorios del mismo miembro (y viceversa); otro miembro sin clic se mantiene sin marcar.

## 2026-09-01 — "Mi progreso" abre en la máquina que se acaba de escanear

**Qué se hizo:**
- El usuario pidió que "Mi progreso" muestre inicialmente solo el progreso de la máquina cuyo QR se acaba de escanear (con esa máquina ya seleccionada en el selector), y que desde ahí se pueda cambiar a ver el progreso de otras máquinas sin tener que volver a escanear — pero que para REGISTRAR una serie nueva sí siga haciendo falta escanear el QR de esa máquina específica.
- Lo último ya funcionaba así (la tarjeta "Registrar serie" solo aparece si la URL trae `?maquina=...`, y `portalGuardarSerie()` siempre usa esa máquina — no hay forma de registrar sin escanear). Lo que faltaba era el punto de partida de "Mi progreso": antes elegía la primera máquina que apareciera en el historial del miembro (orden del array, no necesariamente la que acaba de escanear).
- En `renderPortalProgresoSeccion()`, la primera vez que se decide qué máquina mostrar (`portalMaquinaSel` todavía vacío), ahora prioriza la máquina del QR escaneado (`window._portalMaquina`) si el miembro ya tiene progreso registrado en ella; si no (ej. acceso general sin `?maquina=`, o la máquina escaneada aún no tiene historial), cae al comportamiento de siempre (la primera disponible). Una vez que el cliente cambia la máquina a mano desde el selector, esa elección se respeta en los siguientes render (no se resetea sola).

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Simulación en Node de la lógica de selección: con historial en 2 máquinas, escanear el QR de la que NO es la primera del historial igual la selecciona; escanear la que sí es la primera también funciona; escanear una máquina sin historial (o entrar sin `?maquina=`) cae al primero disponible sin romperse; y una selección manual previa del cliente no se sobreescribe con la del QR en re-renders posteriores (ej. al guardar el peso, que también refresca toda la pantalla).

## 2026-09-01 — Causa real confirmada: reglas de Firestore desactualizadas (se quita el diagnóstico temporal)

**Qué se hizo:**
- El texto de diagnóstico temporal reveló la causa exacta: `permission-denied` al leer `config/personalizacion`. No era ningún bug de código — las reglas publicadas en el proyecto real de Firebase del usuario eran una versión anterior a la que agregó el permiso de lectura pública para esa colección (el archivo se fue actualizando varias veces durante esta conversación y esa pieza en particular no se había vuelto a publicar). El usuario publicó la versión correcta de `firestore.rules` y confirmó que ya funciona.
- Se quitó el texto de diagnóstico temporal (`#portal-debug-personalizacion` en el HTML, y la lógica de `debug` en `cargarPersonalizacionPortal()`) — ya cumplió su propósito. `cargarPersonalizacionPortal()` queda igual que antes de agregarlo: aplica los colores/logo si el doc existe, no hace nada visible si falla o no existe.

**Qué se verificó:**
- `node --check` — sintaxis válida; confirmado que no queda ninguna referencia a `portal-debug-personalizacion`.
- Confirmado por el usuario en producción: el portal QR ya se ve con los colores/logo reales del gimnasio.

## 2026-09-01 — Diagnóstico temporal: por qué el portal no toma los colores/logo

**Qué se hizo:**
- El usuario ya usó el botón "Sincronizar Portal QR" y el portal sigue sin verse con sus colores/logo. Dos intentos de arreglo (sincronizar en cada login, luego un botón explícito) no lo resolvieron, así que en vez de seguir adivinando causas a distancia, se agregó un texto de diagnóstico TEMPORAL visible directo en la página del portal (`#portal-debug-personalizacion`, debajo del formulario) — nada de consola ni devtools, que en un teléfono son difíciles de alcanzar.
- `cargarPersonalizacionPortal()` ahora escribe en ese texto exactamente uno de tres casos: (1) el documento `config/personalizacion` no existe todavía para ese gym, (2) si existe, qué valores trae exactamente (colorAcento/colorFondo/colorTarjetas/si hay logo), o (3) el código de error real si la lectura falló (ej. `permission-denied`).
- Es temporal — se quita en cuanto la próxima captura del usuario confirme la causa real.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Pendiente: que el usuario reintente y mande captura de lo que dice ahora `#portal-debug-personalizacion` para localizar la causa exacta.

## 2026-09-01 — El botón "Sincronizar Portal QR" también sincroniza colores/logo

**Qué se hizo:**
- El usuario probó de nuevo tras el fix anterior (sincronizar personalización en cada login) y el portal seguía sin verse con sus colores/logo. La sincronización automática al hacer login depende de que realmente se haya recargado con el código nuevo (Cmd+Shift+R en el momento correcto) — es difícil de confirmar desde afuera si en verdad ocurrió, así que en vez de seguir dependiendo de algo invisible en segundo plano, se le dio al usuario una acción explícita y verificable.
- El botón "🔄 Sincronizar Portal QR" (Miembros) ahora también sincroniza la personalización (colores/logo), no solo los miembros — un clic, un mensaje de confirmación, sin depender de que el login por sí solo haya disparado la sincronización a tiempo.
- `sincronizarPersonalizacionPublica()` ahora devuelve `true`/`false` según si la escritura tuvo éxito (antes no devolvía nada), igual que ya hacía `sincronizarMiembroPublico`, para que el botón pueda avisar si algo falló.
- La sincronización automática en cada login (agregada en la entrada anterior) se queda tal cual, como respaldo — este botón es la forma confiable y explícita de forzarla ahora mismo.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Flujo esperado: Miembros → "🔄 Sincronizar Portal QR" → confirmar → esperar el toast de progreso y el mensaje final "Miembros y personalización sincronizados con el portal QR ✓" → volver a escanear el QR.

## 2026-09-01 — Fix: portal QR sin colores/logo del gimnasio (mismo problema que miembrosPublicos)

**Qué se hizo:**
- El usuario reportó que, con el portal QR ya mostrando el formulario correctamente, seguía sin verse con los colores/logo de su gimnasio (colores default, sin logo) aunque ya tiene personalización configurada.
- Misma causa raíz que el problema anterior de "No encontramos tu registro": el gimnasio configuró su personalización ANTES de que existiera el espejo público `usuarios/{uid}/config/personalizacion`, así que ese documento nunca se creó — `sincronizarPersonalizacionPublica()` solo se disparaba al GUARDAR un cambio de personalización (colores/logo nuevos), no en cuentas que ya la tenían configurada de antes.
- A diferencia de `miembrosPublicos` (que puede ser cientos/miles de documentos y necesitó un botón manual de sincronización masiva), la personalización es UN SOLO documento chico por gimnasio — así que en vez de pedirle al usuario que sincronice algo a mano, se agregó la llamada a `sincronizarPersonalizacionPublica()` directo en `loadPlan()`, justo después de `aplicarPersonalizacion()`. Se dispara sola en CADA login del staff al panel, sin costo real (un solo `setDoc` chico), así que cualquier cuenta con personalización configurada de antes queda al día la próxima vez que el dueño entre a su panel — no hace falta ningún paso manual ni botón nuevo.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Flujo esperado: el dueño del gimnasio entra una vez a su panel de staff (aunque sea solo para revisar algo, no hace falta tocar Personalización) → eso ya sincroniza el espejo público → la próxima vez que se escanee el QR, el portal se ve con los colores/logo reales.

## 2026-09-01 — Fix: portal QR en blanco (solo el encabezado "GYMTRACK", sin el formulario)

**Qué se hizo:**
- El usuario reportó que, tras la actualización de personalización visual del portal, la página se quedaba mostrando solo el encabezado "GYMTRACK" — el formulario de "Identifícate" nunca aparecía.
- Causa raíz: `portalReady` había quedado como `await cargarPersonalizacionPortal(); renderPortalIdentify();` — es decir, la app esperaba a que terminara la lectura a Firestore de los colores del gimnasio ANTES de mostrar el formulario. Si esa lectura se tarda o se traba (mala conexión, algún borde de la sesión anónima), `renderPortalIdentify()` nunca se llegaba a ejecutar y la pantalla se quedaba en blanco para siempre — sin ningún error visible, porque `cargarPersonalizacionPortal()` ya atrapa sus propios errores con try/catch (por diseño, para no romper el portal si falla la personalización), pero un `await` colgado no es un error, es simplemente una espera que nunca termina.
- Se quitó el `await`: ahora `cargarPersonalizacionPortal()` se dispara en paralelo (fire-and-forget) y `renderPortalIdentify()` se llama de inmediato, sin esperar nada. El formulario para identificarse aparece al instante siempre; si la personalización llega, los colores se aplican un momento después — y si nunca llega (conexión mala, lo que sea), el portal simplemente se queda con los colores por defecto en vez de quedarse en blanco.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Revisado que `cargarPersonalizacionPortal()` no cambió de lógica interna (sigue aplicando solo lo que el gimnasio configuró, sigue sin romper nada si falla) — el único cambio es que ya no bloquea el primer render del portal.

## 2026-09-01 — Un solo botón "Guardar" en Mi Perfil Físico del portal QR

**Qué se hizo:**
- El usuario preguntó si convenía un solo botón de guardar al final de toda la página del portal. Se acordó un punto medio: "Registrar serie" se queda con su propio botón (es la acción #1 por la que alguien escanea el QR, y quiere confirmación ahí mismo, no hasta el final de la página) — pero "Mi Perfil Físico" tenía dos botones ("Guardar datos" y "Guardar peso") para una sola tarjeta, lo cual sí era inconsistente y se fusionó en uno.
- `portalGuardarDatos()` y `portalGuardarPeso()` se reemplazaron por una sola `portalGuardarPerfilFisico()`: guarda lo que esté lleno (fecha de nacimiento/estatura hacia `miembros`+`miembrosPublicos`, peso hacia `pesoCorporal`) y no toca lo que quede vacío — ya no exige llenar los tres campos juntos cada vez. Si los tres campos están vacíos, avisa en vez de no hacer nada silenciosamente.
- El botón "Guardar" quedó al final de los campos editables de la tarjeta (antes del historial/gráfica de peso, que es solo informativo).

**Qué se verificó:**
- `node --check` — sintaxis válida; confirmado que no quedó ninguna referencia suelta a `portalGuardarDatos`/`portalGuardarPeso`.
- Simulación en Node de la lógica combinada: los 3 campos vacíos bloquea con aviso y no escribe nada; solo peso lleno escribe únicamente `pesoCorporal` sin tocar `miembros`; solo fecha+estatura escribe únicamente `miembros`/`miembrosPublicos` sin crear un registro de peso vacío; los 3 llenos escribe ambos destinos; y estatura sola (sin fecha de nacimiento) se guarda igual, sin exigir que los tres vengan juntos.

## 2026-09-01 — Personalización visual en el portal QR + reorganización y simplificación del portal

**Qué se hizo:**

*1) Personalización visual del gimnasio en el portal:*
- El portal ahora se pinta con los colores/logo del gimnasio, reutilizando EXACTAMENTE las mismas funciones que ya usa el panel de staff (`aplicarColorAcento`/`aplicarColorFondo`/`aplicarColorTarjetas`/`aplicarLogo`) — no se duplicó ninguna lógica de color.
- El doc real `usuarios/{uid}` (con `colorAcento`/`colorFondo`/`colorTarjetas`/`logoUrl`) sigue 100% cerrado a lectura anónima porque también trae `plan`, `pinFinanzas`, `email`, etc. Igual que se hizo para miembros (`miembrosPublicos`), se creó un espejo público mínimo nuevo `usuarios/{uid}/config/personalizacion` con SOLO esos 4 campos de color/logo. Nueva función `sincronizarPersonalizacionPublica()`, llamada (sin `await`, no bloquea el flujo principal si falla) desde los 4 lugares donde cambia la personalización: `guardarPersonalizacion`, `restaurarColorDefault`, `onLogoFileChange`, `quitarLogo`.
- Nueva `cargarPersonalizacionPortal()`, llamada al inicio de `portalReady` (antes de mostrar la pantalla de identificación, para que se vea personalizado desde el primer paso) — lee ese espejo y aplica solo lo que el gimnasio configuró; si no configuró nada, el doc no existe y el portal se ve exactamente como antes (cero cambio visual, sin forzar ningún color por default distinto al actual).
- **Ojo, decisión deliberada**: el portal NO usa `aplicarPersonalizacion()`/`guardarBrandingCache()` (las funciones que sí usa el panel de staff) — esas existen para precachear el branding de la pantalla de login del staff en `localStorage`, y usarlas en el portal sobreescribiría ese cache si alguien escanea un QR en el MISMO dispositivo que su staff a veces usa (ej. una tablet compartida en recepción).
- Logo: se agregaron `#portal-logo-img`/`#portal-logo-txt` al encabezado del portal (mismo patrón que `login-logo-img`/`nav-logo-img`) y se extendió `aplicarLogo()` para que también los controle — un gimnasio con `logoUrl` configurado ve su logo en vez del texto "GYMTRACK", igual que ya pasa en login/nav.
- `firestore.rules`: nueva regla `usuarios/{gymId}/config/{docId}` — lectura pública (`isSignedIn()`), sin escritura pública (el portal nunca cambia la personalización, solo la lee).

*2) Reorganización y simplificación del portal:*
- Se fusionaron "Mis datos" (fecha de nacimiento/estatura) y "Mi peso corporal" en una sola tarjeta nueva, "🧍 Mi Perfil Físico" — son datos relacionados y el IMC solo se puede calcular con los dos juntos, así que tenerlos separados obligaba a saltar entre tarjetas para ver el dato completo. `renderPortalDatosSeccion`/`renderPortalPesoSeccion` se reemplazaron por `renderPortalPerfilFisicoSeccion()` (una sola función); `portalGuardarDatos`/`portalGuardarPeso` no cambiaron de lógica, solo de dónde se renderizan sus campos.
- Orden de secciones ajustado por frecuencia de uso: 1° Registrar serie (lo que motivó escanear el QR), 2° Mi progreso (subida justo después, para revisar la bitácora de esa misma máquina sin bajar tanto), 3° Mi Perfil Físico al final (se edita con mucha menos frecuencia).
- Nuevo texto de ayuda chico (gris, una línea) debajo de los botones de "Tipo de serie", que muestra la definición del tipo que esté seleccionado en ese momento — solo para los términos menos obvios (Calentamiento, PR, Dropset, Al fallo); "Normal" no tiene texto porque ya es autoexplicativo. Nueva constante `DESCRIPCION_TIPO_SERIE`, actualizada en `portalElegirTipo()` y en el render inicial.
- "Guardar datos" (dentro de Mi Perfil Físico) pasó de `btn-ghost` a `btn-primary`, igual que "Guardar serie" y "Guardar peso" — los tres botones de acción del portal ahora usan el mismo color de acento en vez de verse uno apagado y dos resaltados.
- No se tocó ninguna colección, regla de Firestore existente, cálculo de IMC, ni el bloqueo por membresía vencida — esto es solo reorganización visual y personalización, tal como se pidió.

**Qué se verificó:**
- `node --check` sobre los 2 bloques `<script>` — sintaxis válida.
- `git diff` completo revisado: cambios contenidos al portal, `aplicarLogo`, y los 4 call-sites de personalización del staff — sin tocar Finanzas, Inventario, ni el resto del panel de administración.
- `rules-test/firestore.rules` sincronizado con la raíz y `rules-test/test.mjs` con 2 casos nuevos — corrido contra el emulador real de Firestore: **39 OK / 0 FAIL**, incluyendo que un cliente anónimo SÍ puede leer el espejo de personalización pública pero NO puede escribirlo/alterarlo.
- Simulación en Node de la lógica pura: `DESCRIPCION_TIPO_SERIE` da el texto correcto para cada tipo (vacío para "Normal" y sin selección, mensaje propio para "Otro"); la línea combinada "Edad · IMC" arma bien los 4 casos (ambos, solo uno, ninguno) sin dejar separadores colgando; `aplicarPersonalizacionPortal` (simulado) no hace ninguna llamada si el gimnasio no configuró nada (cero cambio visual) y aplica solo los campos que sí están configurados si el gimnasio configuró apenas uno; y la forma del espejo que arma `sincronizarPersonalizacionPublica` trae exactamente los 4 campos esperados, nunca `fondosPorTab`/`plan`/`pinFinanzas`/etc.

## 2026-09-01 — Fix: "No encontramos tu registro" para miembros que ya existían antes del portal QR

**Qué se hizo:**
- Con el mensaje de error real ya visible (ver entrada anterior), el usuario probó el portal QR con un miembro real (#001) y confirmó: ya no es error de conexión/permisos — ahora dice "No encontramos tu registro. Verifica tu número y tu nombre.".
- Causa raíz: `miembrosPublicos` (el espejo que usa el portal para buscar por número+nombre) solo se llena automáticamente en `saveMiembro`/`savePago`/`_guardarImportados` — es decir, en altas, ediciones y pagos NUEVOS a partir de que se agregó esta función. Un miembro que ya existía antes y a quien nadie le ha vuelto a tocar el registro o cobrado un pago nuevo, nunca generó su espejo, así que el portal no lo encuentra (no es un bug de la búsqueda en sí, es que el documento simplemente no existe todavía).
- Se agregó un botón nuevo "🔄 Sincronizar Portal QR" en la pestaña Miembros (junto a "🏷️ Categorías"), que llama a `sincronizarTodosLosMiembrosPublicos()`: recorre TODOS los miembros y crea/actualiza su espejo público de una sola vez. Solo hace falta usarlo una vez (para ponerse al día con los miembros existentes) — de ahí en adelante, cada alta/edición/pago nuevo se sigue sincronizando solo, como ya estaba.
- `sincronizarMiembroPublico` ahora devuelve `true`/`false` según si la escritura tuvo éxito (antes no devolvía nada), para que la sincronización masiva pueda avisar si algo falló en vez de asumir que todo salió bien.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Simulación en Node de la lógica de conteo (éxitos/fallos) del sincronizado masivo: cuenta bien con todos exitosos, con fallos mezclados, y con una lista vacía (sin miembros) sin romperse.
- Flujo esperado para el usuario: entrar a Miembros → clic en "🔄 Sincronizar Portal QR" → confirmar → esperar el toast de progreso → volver a intentar identificarse en el portal QR con el mismo número/nombre, que ahora sí debería encontrarlo.

## 2026-09-01 — Diagnóstico: mostrar el error real del portal ("No pudimos conectar")

**Qué se hizo:**
- El usuario reportó "No pudimos conectar" al identificarse en el portal QR desde su iPhone, ya con Anonymous Authentication activado y `firestore.rules` publicado (ambos confirmados por el usuario) — es decir, con los dos pasos manuales pendientes ya hechos, así que el error es otra cosa y no se podía seguir adivinando a ciegas.
- El mensaje de error era genérico a propósito (para no mostrarle un código técnico al cliente final), pero eso mismo hacía imposible diagnosticar desde un teléfono sin acceso fácil a la consola del navegador. Se cambió tanto en `portalIdentificar()` como en el catch de `signInAnonymously()` (script del `<head>`) para que el texto incluya el código/mensaje real del error entre paréntesis, ej. "No pudimos conectar. Intenta de nuevo. (permission-denied)".
- También se agregó `console.error` en ambos catch, por si en algún momento sí hay acceso a devtools (Mac + cable a un iPhone, por ejemplo).

**Qué se verificó:**
- `node --check` — sintaxis válida.
- No es un fix del bug en sí (todavía no se sabe la causa exacta) — es la herramienta para encontrarlo sin más rondas de "prueba y adivina". Pendiente: que el usuario reintente y mande el nuevo mensaje con el código de error real.

## 2026-09-01 — Fix: "No se pudo cargar el generador de QR" (la librería QR usada no existía)

**Qué se hizo:**
- El usuario reportó el error "No se pudo cargar el generador de QR" al intentar descargar el QR de un artículo desde Inventario → Máquinas y QR.
- Causa raíz confirmada (no solo sospechada): la librería QR que se había cargado en el `<head>`, `https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js`, apunta a un archivo que el paquete `qrcode@1.5.3` publicado en npm **no tiene** — se verificó descargando el `.tgz` real del registro de npm y confirmando que solo contiene `lib/` (código fuente sin empaquetar para navegador), sin ninguna carpeta `build/`. Ese `<script src>` siempre devolvía 404, por eso `typeof QRCode` daba `undefined` y el botón nunca podía generar nada.
- Se reemplazó por `qrcode-generator@2.0.4` (`https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.js`), verificado de la misma forma (descargando el `.tgz` real de npm) — este paquete SÍ trae `dist/qrcode.js`, un archivo plano que al cargarse como `<script>` normal crea el global `qrcode` (función), sin necesitar módulos ni bundler — mismo estilo que Chart.js/SheetJS ya usados en el `<head>`.
- `descargarQRMaquina(id)` se reescribió para la API real de esta librería: `qrcode(typeNumber, nivel)` + `.addData(url)` + `.make()` + `.createDataURL(cellSize, margin)`. A diferencia de la librería anterior, esta exige indicar de antemano el "typeNumber" (tamaño de cuadrícula QR) — no tiene modo automático — así que se prueba typeNumber creciente (4 a 40) hasta que la URL completa quepa, en vez de calcular a mano cuántos caracteres caben en cada tamaño. El archivo descargado ahora es `.gif` (formato real que genera esta librería) en vez de `.png`.

**Qué se verificó:**
- `node --check` — sintaxis válida; confirmado que no queda ninguna referencia al global `QRCode` roto.
- **Verificación real, no solo razonada**: se descargó el `.tgz` publicado de `qrcode-generator@2.0.4` desde el registro de npm, se extrajo `dist/qrcode.js`, y se cargó ese archivo REAL en Node (`require`) para generar un QR de una URL de prueba con el mismo largo que tendrá una real (uid de Firebase de 28 caracteres + id de documento de Firestore de 20 caracteres, ~103 caracteres totales) — la misma lógica de `descargarQRMaquina` (probar typeNumber creciente) encontró typeNumber=6 automáticamente y `createDataURL` devolvió un `data:image/gif;base64,...` válido.
- Se decodificó ese base64 a un archivo `.gif` real y se confirmó con `file` que es una imagen GIF válida de 336×336, y se inspeccionó visualmente: los tres patrones de esquina característicos de un QR están presentes y bien formados.
- No se tocó nada más de la Parte 1/2 del portal QR (identificación, registro de progreso, peso corporal, IMC, fecha de nacimiento) — el problema estaba aislado a la generación del QR en sí.

## 2026-09-01 — "Máquinas y QR" ahora usa directamente el Equipo del Gym (sin lista duplicada)

**Qué se hizo:**
- El usuario reportó que tener que dar de alta cada máquina por separado (colección `maquinas`) además de ya tenerlas registradas como "Equipo del Gym" (Inventario) era doble trabajo: pidió que un artículo ya existente apareciera directo en "Máquinas y QR", y que uno nuevo generara su QR automáticamente al agregarlo.
- Se eliminó la colección `maquinas` y su CRUD por separado (`agregarMaquina`/`editarMaquina`/`eliminarMaquina`/`loadMaquinas`). "Máquinas y QR" ahora lista directamente el array `inventario` (Equipo del Gym) ya cargado — cualquier artículo que ya tengas, o que agregues desde "+ Agregar Equipo", aparece ahí solo, con su botón "⬇️ Descargar QR". Renombrar/editar/eliminar sigue siendo desde el modal de Inventario de siempre (`editInventario`/`delInventario`) — no hay nada que mantener sincronizado a mano.
- El QR sigue codificando `?gym={uid}&maquina={id}`, solo que ahora `{id}` es el id del artículo de `inventario` en vez de un id de una colección aparte.
- Portal del cliente y la tarjeta "Progreso por Máquina" del perfil (staff) actualizados para leer el nombre de la máquina desde `inventario` en vez de `maquinas`.
- `firestore.rules`: la regla de lectura pública que antes era para `maquinas` ahora es para `inventario` (mismo alcance: solo lectura pública, alta/edición/borrado siguen siendo solo del staff vía la regla genérica existente).

**Qué se verificó:**
- `node --check` — sintaxis válida; grep confirma que no queda ninguna referencia a la colección `maquinas` en el código.
- `rules-test/firestore.rules` sincronizado con la raíz y `rules-test/test.mjs` actualizado (seed e inventario en vez de máquinas) — vuelto a correr contra el emulador real de Firestore: **37 OK / 0 FAIL**, incluyendo que el cliente anónimo puede LEER inventario (para mostrar el nombre del equipo al escanear el QR) pero NO puede crear/editar artículos de equipo (eso sigue siendo solo del staff).

## 2026-09-01 — Portal QR del cliente (progreso por máquina + peso corporal) y datos de salud (estatura, IMC, fecha de nacimiento)

**Qué se hizo:**

*Parte 1 — Registro de progreso por QR en cada máquina:*
- Nueva colección `usuarios/{uid}/maquinas` (nombre por máquina), con CRUD idéntico al patrón ya usado para `categoriasMembresia`/`promociones` (modal `modal-maquinas`, abierto desde un botón nuevo "📷 Máquinas y QR" en Inventario → Equipo del Gym).
- Cada máquina tiene un botón "⬇️ QR" que genera (librería `qrcode` vía CDN, mismo patrón que Chart.js/SheetJS en `<head>`, sin subir nada a Storage) y descarga un PNG con un QR que codifica `?gym={uid}&maquina={id}` — listo para imprimir y pegar en la máquina.
- **Portal público del cliente** (`#portal-screen`, nuevo, completamente separado del panel de staff): cuando la URL trae `?gym=...`, el `<script type="module">` del `<head>` desvía el arranque ANTES de tocar `onAuthStateChanged`/login — nunca se mezcla con una sesión de staff que ya esté abierta en el mismo navegador (ej. una tablet en recepción). Se autentica con `signInAnonymously` (nuevo import de `firebase-auth.js`) y dispara un evento `portalReady` (mismo patrón que `firebaseReady`/`adminReady`).
- Identificación: formulario de número de miembro + nombre (comparación tolerante a mayúsculas/acentos/espacios vía `normalizarNombreComparacion`, `String.normalize('NFD')`). Busca en la nueva colección `usuarios/{uid}/miembrosPublicos` (ver más abajo) — nunca en `miembros` directamente.
- Bloqueo por membresía vencida: si `vencimientoTs` del miembro encontrado ya pasó, el portal muestra un mensaje fijo y no deja continuar. Es una verificación del lado de la app (igual que el resto de GymTrack, sin backend propio) — no a prueba de manipulación técnica directa, documentado así en el propio `firestore.rules`.
- Registro de series: tipo (Calentamiento/Normal/PR/Dropset/Al fallo + "Otro" con texto libre) + peso + repeticiones, guardado en la nueva colección `usuarios/{uid}/registrosProgreso` con `{miembroId, maquinaId, tipo, peso, repeticiones, fecha}`.
- Vista de progreso (portal y perfil del miembro, lado staff): historial + gráfica Chart.js de evolución de peso, filtrable por máquina y por tipo de serie (para no mezclar un PR con la carga normal del día a día).
- Tarjeta nueva "📈 Progreso por Máquina" en el perfil del miembro (`modal-perfil`): mismo criterio que "Este plan incluye"/Compras — solo aparece si el miembro tiene al menos un registro; si nunca usó el QR, cero cambio visual.

*Parte 2 — Peso corporal, estatura, IMC y fecha de nacimiento:*
- Nueva colección `usuarios/{uid}/pesoCorporal` (`{miembroId, peso, fecha}`, con historial completo, no un solo valor). Registrable desde el perfil del miembro (tarjeta nueva "⚖️ Peso Corporal", SIEMPRE visible a diferencia de las condicionales, porque desde ahí mismo se registra el primer peso) y desde el portal del cliente. Historial + gráfica Chart.js en ambos lados.
- Estatura: campo simple `estatura` (cm) en el documento del miembro, sin historial. Editable desde `modal-miembro` (staff) y desde el portal (cliente).
- IMC: `calcularIMC(pesoKg, estaturaCm)` — se calcula a partir del peso corporal más reciente + estatura, se muestra como número plano ("IMC: 23.4"), sin categorías tipo bajo peso/normal/sobrepeso (fuera del alcance de la app, no es consejo médico). Si falta cualquiera de los dos datos, el campo `#p-imc-field` del perfil simplemente se oculta (`display:none`), sin mensaje de error.
- Fecha de nacimiento: campo nuevo y opcional `fechaNacimiento` (input `type="date"` en `modal-miembro`, junto a Edad). El campo `edad` viejo NO se toca ni se sobreescribe — sigue como respaldo. `edadMostrar(m)` usa `calcularEdad(fechaNacimiento)` si existe, si no cae de vuelta al `edad` guardado. Visible en perfil (staff) y portal (cliente).
- Excel: nueva columna "Fecha de Nacimiento" en `exportarMiembros`, `descargarPlantilla` e `importarMiembros` (alias de columna + reutiliza `_parseFechaES` ya existente, que ya soportaba tanto celdas de fecha reales de Excel como texto `dd/mm/yyyy`), sin quitar la columna de Edad.

*Espejo público mínimo (`miembrosPublicos`) — por qué existe:*
- Firestore no puede ocultar campos dentro de un mismo documento vía reglas: si se permite leer `miembros/{id}`, se lee TODO el documento (teléfono, dirección, notas incluidos). Por eso se creó `usuarios/{uid}/miembrosPublicos/{miembroId}` (mismo id que el miembro real), con SOLO `numero`, `nombre`, `vencimientoTs`, `estatura`, `fechaNacimiento` — nunca los campos sensibles.
- Lo mantiene `sincronizarMiembroPublico(miembroId)`, llamada (sin `await`, no bloquea el flujo principal si falla) desde `saveMiembro()` (alta/edición), `savePago()` (el vencimiento cambia con cada pago) y `_guardarImportados()` (import masivo por Excel, para que un miembro recién importado pueda usar el QR de inmediato sin que el staff tenga que volver a guardarlo o cobrarle a mano). `delMiembro()` también borra el espejo y los registros de progreso/peso huérfanos del miembro eliminado (mismo criterio que ya aplicaba a pagos/asistencias).
- El cliente SÍ puede actualizar estatura/fechaNacimiento en su propio miembro real y en el espejo (necesita escritura real, no solo mostrar) — pero acotado por regla a EXACTAMENTE esos dos campos vía `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`, el mecanismo nativo de Firestore para reglas de escritura por campo. Nunca puede tocar nombre/teléfono/notas/etc.

**`firestore.rules` — qué se abrió y por qué (documentado también en comentarios dentro del propio archivo):**
- `maquinas`: lectura pública (`isSignedIn()`, incluye anónimos). Alta/edición/borrado siguen solo para el staff vía la regla genérica existente.
- `miembrosPublicos`: lectura pública + escritura pública ACOTADA a `estatura`/`fechaNacimiento`.
- `registrosProgreso`, `pesoCorporal`: lectura + creación pública. Sin edición ni borrado desde el portal.
- `miembros`: se mantiene 100% cerrada a lectura anónima (de ahí el espejo). Se agregó una única excepción de ESCRITURA, acotada a `estatura`/`fechaNacimiento` con el mismo mecanismo `diff().affectedKeys().hasOnly(...)`.
- Nada de esto reemplaza la regla genérica existente (`isAdmin()||isOwnerDoc(gymId)`) — Firestore concede acceso si CUALQUIER regla que aplique a la ruta lo permite, así que el staff sigue teniendo control total sobre las 4 colecciones nuevas.
- `storage.rules` NO se tocó: los QR se generan y descargan en el navegador, nunca se suben a Storage — no hacía falta.

**Qué se verificó:**
- `node --check` sobre todo el JS embebido (2 bloques `<script>`, el módulo y el principal) — sintaxis válida.
- Simulación en Node de la lógica pura: `calcularEdad` (cumpleaños exacto/futuro/pasado, sin fecha), `edadMostrar` (usa `fechaNacimiento` si existe, cae a `edad` si no, `null` si no hay ninguno), `calcularIMC` (cálculo correcto, `null` si falta peso o estatura o cualquiera es 0), `fmtDateInputVal` (ida y vuelta sin corrimiento de zona horaria), `normalizarNombreComparacion` (tolera acentos/mayúsculas/espacios, pero SÍ distingue nombres genuinamente distintos), la lógica de bloqueo por vencimiento de `portalIdentificar` (encontrado y al corriente → pasa; vencido → bloqueado; `vencimientoTs` null/nunca pagó → NO se trata como vencido; número o nombre incorrecto → no encontrado), y la forma exacta del documento que arma `sincronizarMiembroPublico` (exactamente 5 campos, nunca teléfono/dirección/notas).
- **`firestore.rules` corrido contra el emulador real de Firestore** (`rules-test/`, ya existía de una entrega anterior — se sincronizó `rules-test/firestore.rules` con la raíz y se le agregaron 17 casos nuevos a `rules-test/test.mjs`): **37 OK / 0 FAIL**, incluyendo — cliente anónimo SÍ puede leer máquinas/miembrosPublicos y crear registrosProgreso/pesoCorporal; cliente anónimo NO puede leer el documento completo de `miembros/` (teléfono/dirección/notas quedan protegidos); cliente anónimo SÍ puede actualizar estatura/fechaNacimiento en `miembros/` pero NO puede colar el teléfono en esa misma escritura (`affectedKeys().hasOnly(...)` probado directamente, no solo razonado); cliente anónimo NO puede escribir en pagos/gastos/máquinas (nuevas); el staff sigue con control total sobre las 4 colecciones nuevas; un segundo gimnasio (Gym B) puede leer el espejo público de Gym A (por diseño, dato no sensible) pero sigue sin poder leer su `miembros/` completo.
- Revisado que no se tocó `calcularPatronAsistencia`, `calcularPatronCompra`, personalización visual, Finanzas ni Inventario (aparte del botón nuevo de Máquinas) — cambios aditivos.

**Pasos manuales pendientes (fuera del alcance de este cambio de código):**
- Verificar/activar **Authentication → Sign-in method → Anonymous** en Firebase Console (Build → Authentication) — no se pudo confirmar remotamente si ya está habilitado en el proyecto `mi-gimnasio-8d528`. Sin esto, `signInAnonymously()` falla y el portal muestra su pantalla de error de conexión en vez de la de identificación.
- Publicar el `firestore.rules` actualizado (Firestore Database → Reglas → pegar el contenido del archivo → Publicar, o `firebase deploy --only firestore:rules` si se usa la CLI) — el código ya asume estas reglas, pero el proyecto real de Firebase sigue con las reglas viejas hasta que se publiquen a mano.
- Imprimir los QR de cada máquina desde Inventario → Equipo del Gym → 📷 Máquinas y QR, una vez dadas de alta.

## 2026-09-01 — Alerta de Promoción/Paquete en Alertas (envío masivo por WhatsApp con cola resumible)

**Qué se hizo:**
- Nueva sección "🎉 Alerta de Promoción/Paquete" al final de la pestaña Alertas, después de Recordatorios de meta semanal. Sigue el mismo patrón visual que los otros editores de mensaje de esa pestaña (tarjeta con textarea) y que las tarjetas `.alert-card` de las demás listas.
- Textarea de mensaje libre (`wamsg-promo-textarea`): el staff escribe ahí la promoción del momento. **No se guarda en Firestore ni se conecta con la colección `promociones`** (esa se sigue usando solo al registrar pagos) — es una herramienta de aviso puntual, independiente. Se recuerda con `sessionStorage` mientras dure la pestaña del navegador (se pierde al cerrarla o reiniciar), no hay ningún valor hardcodeado.
- `promoMiembrosElegibles()`: mismo criterio que `recordatoriosPendientes()` — excluye a los miembros con `recibeRecordatorios===false`.
- Botón individual "📱" por miembro (`enviarWhatsAppPromo(mid)`): arma la URL `wa.me` con el teléfono del miembro y el texto del textarea (mismo patrón que la `enviarWhatsApp` ya existente — no se pudo reutilizar literalmente esa función porque su firma no acepta un mensaje arbitrario, siempre usa la plantilla de vencimiento `msgWA`; se replicó su mismo patrón de construcción de URL en vez de forzar un mensaje equivocado).
- Botón "🚀 Enviar a todos" / "▶ Siguiente": como GymTrack no tiene integración con WhatsApp Business API, no hay forma de mandar de verdad a todos con una sola acción silenciosa (cada `wa.me` abre una pestaña que el staff debe confirmar a mano, y los navegadores bloquean abrir muchas de golpe). Es la MISMA función (`enviarWhatsAppPromoSiguiente`) en cada clic: abre el WhatsApp del primer miembro con teléfono que todavía no se marcó como enviado. No hace falta un índice de cola aparte — el propio registro de "ya enviados" (`promoEnviados`, un `Set` en memoria) recuerda el lugar, así que retomar un envío a medias es simplemente volver a darle clic al mismo botón, incluso si el staff se fue a atender otra cosa. El botón muestra el progreso ("▶ Siguiente (2/5 enviados)") y se deshabilita cuando ya no queda nadie pendiente con teléfono.
- Cada miembro de la lista muestra "✅ Enviado" en vez del botón una vez que se le mandó el aviso (en esta sesión de la pestaña).
- `initPromoAlerta()` se llama solo al entrar a la pestaña Alertas (`activarTab`), igual que los otros dos editores de mensaje (`initMsgWAEditor`/`initMsgWARecordatorioEditor`) — deliberadamente NO se enganchó a los mismos `renderAlertas()`/`renderRecordatoriosPendientes()` que se disparan tras cada pago/asistencia/etc., para que el progreso de envío y el texto del mensaje no se borren si el staff registra un pago mientras está a la mitad de mandar la promoción.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- `git diff` completo revisado: cambios contenidos al HTML de la pestaña Alertas, las funciones nuevas de esta sección, y una sola línea agregada en `activarTab` — sin tocar `enviarWhatsApp`, `recordatoriosPendientes`, ni la colección `promociones`.
- Simulación en Node de la lógica completa (mockeando `window.open`): `recibeRecordatorios===false` se excluye de la lista; mensaje vacío bloquea el envío (individual y masivo) sin marcar a nadie como enviado; envío individual exitoso arma la URL `wa.me` con el teléfono y mensaje correctos y marca al miembro; un miembro sin teléfono nunca se puede marcar como enviado y no rompe el flujo; "Enviar a todos"/"Siguiente" toma siempre al primer pendiente con teléfono, saltando a los ya enviados y a los que no tienen teléfono; sin pendientes, avisa que ya se envió a todos en vez de fallar; y se confirmó la resumibilidad — con un `Set` de enviados ya poblado (simulando que el staff se detuvo a la mitad), volver a llamar a la función no reenvía a quien ya estaba marcado.

## 2026-08-25 — Ajuste de redacción: {producto} como oración separada en el recordatorio

**Qué se hizo:**
- El usuario reportó que la redacción anterior ("¡Te esperamos en el gym y no olvides tu Creatina de siempre 💪!") sonaba forzada, todo pegado en una sola oración larga.
- Se cambió a dos oraciones simples: `MSG_WA_RECORDATORIO_DEFAULT` pasó de `"...¡Te esperamos en el gym{producto}!"` a `"...¡Te esperamos en el gym!{producto}"`, y la frase que arma `{producto}` en `_aplicarMsgWARecordatorio`/`_updateMsgWARecordatorioPreview` pasó de `" y no olvides tu X de siempre 💪"` a `" Y no olvides tu X de siempre 💪"` (mayúscula inicial, oración propia). Resultado: `"¡Te esperamos en el gym! Y no olvides tu Creatina de siempre 💪"` en vez de una sola frase corrida. Sigue igual de limpio sin producto: `"¡Te esperamos en el gym!"`.
- Mismo comportamiento de fondo sin cambios (cuándo se rellena `{producto}`, `calcularPatronCompra`, etc.) — solo se ajustó el texto para que se lea más simple.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- Reejecutada la simulación en Node de `_aplicarMsgWARecordatorio`: con patrón de compra coincidente el mensaje termina en `"...gym! Y no olvides tu Creatina de siempre 💪"` (oración separada, sin espacios dobles); sin patrón o sin ventas, el mensaje sigue idéntico al de siempre (`"...gym!"`).

## 2026-08-25 — Patrón de compra: mención de producto en el recordatorio de asistencia + sección "Compras" en el perfil

**Qué se hizo:**
- Nueva `calcularPatronCompra(mid)`, calcada de `calcularPatronAsistencia`: agrupa las ventas de un miembro (`ventas`, filtrando por `miembroId`) por producto + día de la semana, ponderando por antigüedad con el mismo `RECORDATORIO_DECAY_SEMANAL`. Exige al menos `COMPRA_MIN_VENTAS` (3) compras reales de ese producto en ese día para considerarlo patrón; si no, devuelve `null` — cero cambio de comportamiento para miembros sin historial suficiente de compras.
- Nueva variable `{producto}` en `MSG_WA_RECORDATORIO_DEFAULT` y `msgWARecordatorio`. `_aplicarMsgWARecordatorio(m,patron)` calcula `calcularPatronCompra(m.id)` y solo la rellena (con una frase completa, ej. " y no olvides tu Creatina de siempre 💪") cuando el día de ese patrón de compra coincide con `patron.diaSemana` (el día del patrón de asistencia de ese mismo recordatorio); si no hay patrón o es de otro día, `{producto}` queda como cadena vacía. La plantilla por defecto quedó `"...¡Te esperamos en el gym{producto}!"` — la frase ya trae el espacio inicial, así que el mensaje se lee limpio en ambos casos (sin espacios ni puntuación colgando).
- `_updateMsgWARecordatorioPreview()` y el bloque de "Variables disponibles" del editor de mensaje (Alertas → Recordatorios) ahora incluyen `{producto}`, con el mismo texto de ejemplo en el preview estático.
- Nueva sección "🛒 Compras" en el perfil del miembro (`modal-perfil`): lista su historial de ventas ligadas (`ventas` filtradas por `miembroId`, más recientes primero), igual patrón visual que las demás tarjetas del perfil (`ec-card`/`ec-row`). Si `calcularPatronCompra(m.id)` detecta un patrón para cualquier día (no solo el del patrón de asistencia), se destaca arriba, ej. "🔁 Compra frecuentemente: Creatina los miércoles". Si el miembro no tiene ninguna venta ligada, la tarjeta se oculta (mismo criterio que las tarjetas de Beneficios/Seguimiento, que ya se ocultan sin datos).
- No se tocó `calcularPatronAsistencia`, `RECORDATORIO_MIN_ASISTENCIAS`, `RECORDATORIO_DECAY_SEMANAL` ni `recordatoriosPendientes()`; tampoco se replicó el patrón de compra en la tabla de Miembros ni en otra pantalla — solo en el mensaje de recordatorio y en el perfil, como se pidió.

**Qué se verificó:**
- `node --check` — sintaxis válida.
- `git diff` completo revisado: cambios contenidos a los puntos pedidos (constante nueva, `calcularPatronCompra`, `_aplicarMsgWARecordatorio`, preview, HTML de variables disponibles, HTML+función de la sección Compras del perfil, llamada agregada en `verPerfil`).
- Simulación en Node de `calcularPatronCompra` y `_aplicarMsgWARecordatorio` con datos falsos: menos de `COMPRA_MIN_VENTAS` ventas totales → `null`; 3 compras del mismo producto el mismo día → patrón correcto; compras dispersas en productos/días distintos sin ninguna combinación repetida 3 veces → `null`; entre dos productos con igual número de compras, gana el de compras más recientes (peso por antigüedad) igual que en el patrón de asistencia; ventas de otro miembro no contaminan el cálculo.
- Integración probada: cuando el día del patrón de compra coincide con el día del patrón de asistencia, el mensaje final incluye la mención de producto sin espacios dobles ni puntuación colgando; cuando el día no coincide, o el miembro no tiene ventas, el mensaje queda idéntico al de siempre ("...¡Te esperamos en el gym!").

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
