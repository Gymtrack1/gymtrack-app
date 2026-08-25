# Changelog

Registro de cambios funcionales de GymTrack (`index.html`). Cada entrada indica qué se hizo, por qué, y qué se verificó antes de darlo por terminado.

Este archivo no existía antes de la entrada de 2026-08-24 — se crea a partir de ahí.

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
