// GymTrack — Cloud Function receptora del protocolo ADMS (ZKTeco), control de acceso biométrico.
//
// PRIMER uso de Cloud Functions en este proyecto (ver CHANGELOG.md) — hasta ahora GymTrack corría
// 100% del lado del cliente (Firestore + Auth vía index.html, sin backend propio). Esta carpeta es
// un proyecto de Node aparte, igual que firestore.rules/storage.rules ya son archivos aparte de
// index.html — NO se toca la regla de "index.html es un solo archivo", esto vive fuera de él.
//
// QUÉ HACE: un equipo ZKTeco SenseFace 7A (huella/rostro) se configura en su propio menú con la
// dirección de este servidor y, a partir de ahí, manda por su cuenta (HTTP, sin que nadie lo
// consulte) un evento cada vez que alguien pasa. El protocolo que usa (ADMS/push de ZKTeco) es de
// texto plano, no JSON — las rutas y el formato de aquí siguen la sintaxis documentada en
// implementaciones de referencia públicas del protocolo ADMS (ej. proyectos "adms-server" /
// "zkteco-adms" de código abierto), porque ZKTeco no publica una spec oficial descargable. El
// firmware EXACTO del SenseFace 7A puede variar algún detalle menor (separadores, campos extra al
// final de cada línea) — si algo no cuadra al conectar el equipo real, revisar el log de Cloud
// Functions (cada línea recibida se loguea) y ajustar parseAttLogLine más abajo.
//
// VINCULACIÓN MIEMBRO <-> CREDENCIAL: manual (ver index.html) — el staff enrola a la persona en el
// equipo, ve/anota el ID (PIN) que el equipo le asignó, y lo captura a mano en
// miembros/{id}.accesoCredencialId. Una versión automática (mandarle el ID de GymTrack al equipo)
// queda pendiente como mejora futura, ya conversada y evaluada aparte — no se implementa aquí.
//
// MULTI-TENENCIA: cada gimnasio es usuarios/{gymId} (gymId = su uid de Auth), igual que en
// index.html/firestore.rules. Este endpoint no tiene login (el equipo no puede hacer uno), así que
// el gimnasio se resuelve por el SN (número de serie) del equipo: usuarios/{gymId}.equiposAutorizados
// es un array de SNs — se busca qué gimnasio tiene ese SN registrado (where('equiposAutorizados',
// 'array-contains', SN) sobre la colección usuarios, ver resolveGymBySN). Un SN que no está
// registrado en NINGÚN gimnasio se rechaza con 403 antes de tocar cualquier dato — así no se
// aceptan eventos de cualquier IP que le pegue al endpoint. El staff agrega el SN de su equipo
// desde el panel (ver index.html, sección Empleados o donde se agregue el campo — ver CHANGELOG.md
// de esa parte).
//
// FORMATO DE asistencias: EXACTAMENTE el mismo que ya usa el botón manual "Registrar" en
// index.html (registrarAsistencia): { miembroId, fecha } (fecha en epoch ms). Aquí se usa la
// fecha/hora que mandó el EQUIPO, no la del servidor — el check-in ya había pasado en el momento
// real, no en el momento en que se procesa el POST.
//
// accesoCredencialId sin dueño: se guarda en accesosNoIdentificados (NUNCA se descarta), con
// { credencialId, equipoId, fechaHora, gimnasioUid, resuelto:false } — el staff lo resuelve desde
// index.html (sección "Accesos sin asignar" en Alertas).

// El equipo manda la fecha/hora como texto SIN zona horaria (ej. "2024-03-05 09:15:22") — es su
// hora local. Cloud Functions corre el contenedor en UTC por defecto (el `region` del deploy es
// solo DÓNDE corre el servidor, no en qué huso horario interpreta un new Date() sin zona) — sin
// esto, "09:15:22" se leería como 9:15am UTC en vez de 9:15am hora de México, corriendo cada
// asistencia ~6 horas. Se fija ANTES de cualquier require/Date para que tome efecto en todo el
// proceso. LÍMITE CONOCIDO: asume que el equipo está en huso horario de Ciudad de México — un
// gimnasio en otro huso (ej. Tijuana) necesitaría esto configurable por gimnasio, no implementado.
process.env.TZ = 'America/Mexico_City';

const {onRequest, onCall, HttpsError} = require('firebase-functions/v2/https');
const {logger} = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

const app = express();
// El body de ADMS es texto plano (líneas separadas por \n, campos por tab), nunca JSON — se
// fuerza a interpretar CUALQUIER content-type como texto (el equipo no siempre manda uno correcto).
app.use(express.text({type: () => true, limit: '5mb'}));

// Resuelve a qué gimnasio pertenece un SN de equipo, o null si no está registrado en ninguno.
// usuarios/{gymId}.equiposAutorizados es un array de SNs (ver Parte 2, index.html) — como es un
// campo del propio doc usuarios/{gymId} (no una subcolección), una query directa sobre la
// colección usuarios con array-contains basta, sin necesitar una collectionGroup query.
async function resolveGymBySN(sn) {
  if (!sn) return null;
  const snap = await db.collection('usuarios')
    .where('equiposAutorizados', 'array-contains', sn)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

function parseFechaHora(str) {
  if (!str) return null;
  const ms = new Date(str.trim().replace(' ', 'T')).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Cada línea de ATTLOG trae, separados por TAB: PIN, fecha/hora ("YYYY-MM-DD HH:mm:ss"), estado,
// modo de verificación, work code, y a veces más campos reservados según firmware — solo se usan
// los dos primeros. Si por algún motivo el tab se pierde en tránsito (algunos gateways/proxies lo
// normalizan a espacios), se cae a un fallback por regex que ubica el patrón de fecha/hora y toma
// todo lo anterior como PIN.
const DATETIME_RE = /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/;
function parseAttLogLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const tabParts = trimmed.split('\t');
  let pin, dateTimeStr;
  if (tabParts.length >= 2) {
    pin = tabParts[0].trim();
    dateTimeStr = tabParts[1].trim();
  } else {
    const m = trimmed.match(DATETIME_RE);
    if (!m) return null;
    dateTimeStr = m[1];
    pin = trimmed.slice(0, m.index).trim();
  }
  if (!pin) return null;
  const fecha = parseFechaHora(dateTimeStr);
  if (fecha === null) return null;
  return {pin, fecha};
}

// Id determinista para asistencias creadas desde ADMS: si el equipo reenvía el mismo evento tras
// un corte de conexión (el propio protocolo lo prevé, ver getrequest), un set() con este mismo id
// sobreescribe con el mismo contenido en vez de duplicar el check-in. NO se hace lo mismo para
// accesosNoIdentificados (ver procesarEvento) porque ahí sí importaría pisar un resuelto:true ya
// resuelto por el staff.
function idempotentAsistenciaId(sn, pin, fecha) {
  return crypto.createHash('sha1').update(`${sn || ''}|${pin}|${fecha}`).digest('hex');
}

async function procesarEvento(gymId, sn, pin, fecha) {
  const miembrosCol = db.collection('usuarios').doc(gymId).collection('miembros');
  const miembrosSnap = await miembrosCol.where('accesoCredencialId', '==', pin).limit(1).get();
  if (!miembrosSnap.empty) {
    const miembroId = miembrosSnap.docs[0].id;
    const docId = idempotentAsistenciaId(sn, pin, fecha);
    await db.collection('usuarios').doc(gymId).collection('asistencias').doc(docId)
      .set({miembroId, fecha});
    logger.info('ADMS: asistencia registrada', {gymId, miembroId, pin, fecha});
  } else {
    await db.collection('usuarios').doc(gymId).collection('accesosNoIdentificados').add({
      credencialId: pin,
      equipoId: sn || null,
      fechaHora: fecha,
      gimnasioUid: gymId,
      resuelto: false,
    });
    logger.info('ADMS: credencial sin dueño, guardada en accesosNoIdentificados', {gymId, pin, fecha});
  }
}

// GET /iclock/cdata — "handshake" inicial: el equipo pregunta su configuración de conexión al
// arrancar/reconectar. La respuesta replica el bloque de opciones estándar del protocolo push de
// ZKTeco (ver nota de cabecera sobre la fuente). Se valida el SN aquí también (no solo en el POST)
// para no darle ni siquiera esta respuesta a un equipo no registrado.
app.get('/iclock/cdata', async (req, res) => {
  const sn = req.query.SN || req.query.sn;
  const gymId = await resolveGymBySN(sn);
  if (!gymId) {
    logger.warn('ADMS: handshake de SN no autorizado', {sn});
    return res.status(403).type('text/plain').send('ERROR: dispositivo no autorizado');
  }
  logger.info('ADMS: handshake', {sn, gymId});
  const body = [
    `GET OPTION FROM: ${sn}`,
    'Stamp=9999',
    'OpStamp=9999',
    'ErrorDelay=30',
    'Delay=30',
    'TransTimes=00:00;14:05',
    'TransInterval=1',
    'TransFlag=1111000000',
    'Realtime=1',
    'Encrypt=0',
    '',
  ].join('\n');
  res.status(200).type('text/plain').send(body);
});

// POST /iclock/cdata — el equipo sube los registros de asistencia (y otras tablas, ver `table`).
// Puede traer varias líneas de una sola vez (típico tras un corte de conexión: manda todo lo
// acumulado en un solo POST) — se procesan todas, una por una.
app.post('/iclock/cdata', async (req, res) => {
  const sn = req.query.SN || req.query.sn;
  const gymId = await resolveGymBySN(sn);
  if (!gymId) {
    logger.warn('ADMS: POST de SN no autorizado', {sn});
    return res.status(403).type('text/plain').send('ERROR: dispositivo no autorizado');
  }
  const table = req.query.table || req.query.Table;
  if (table && String(table).toUpperCase() !== 'ATTLOG') {
    // OPERLOG (log de operaciones del equipo), BIODATA (fotos de rostro), etc. — fuera de alcance
    // de esta parte; se confirma recepción para no bloquear al equipo, sin guardar nada.
    logger.info('ADMS: tabla no procesada, solo se confirma recepción', {table, sn, gymId});
    return res.status(200).type('text/plain').send('OK');
  }
  const body = typeof req.body === 'string' ? req.body : '';
  const lineas = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let procesadas = 0;
  for (const linea of lineas) {
    const parsed = parseAttLogLine(linea);
    if (!parsed) {
      logger.warn('ADMS: línea de ATTLOG no reconocida, se ignora', {sn, gymId, linea});
      continue;
    }
    await procesarEvento(gymId, sn, parsed.pin, parsed.fecha);
    procesadas++;
  }
  // Formato de respuesta esperado por el protocolo: una línea confirmando cuántos se procesaron.
  res.status(200).type('text/plain').send(`OK:${procesadas}`);
});

// GET /iclock/getrequest — el equipo hace ping preguntando si hay comandos pendientes (ej. para
// mandarle una orden de alta/edición de usuario). Por ahora siempre "OK" (sin comandos) — la
// vinculación automática del ID (que sí usaría esto) queda pendiente como mejora futura.
app.get('/iclock/getrequest', async (req, res) => {
  const sn = req.query.SN || req.query.sn;
  const gymId = await resolveGymBySN(sn);
  if (!gymId) {
    logger.warn('ADMS: getrequest de SN no autorizado', {sn});
    return res.status(403).type('text/plain').send('ERROR: dispositivo no autorizado');
  }
  res.status(200).type('text/plain').send('OK');
});

// URL a configurar en el equipo como "Server Address" (o "Cloud Server Address" según el menú del
// SenseFace 7A): la de esta función, SIN /iclock al final — el equipo agrega /iclock/cdata y
// /iclock/getrequest por su cuenta. Ver CHANGELOG.md para el link exacto tras el primer deploy
// (algo como https://REGION-PROJECT_ID.cloudfunctions.net/adms).
exports.app = app; // expuesto para pruebas (levantar un servidor http real contra él), no cambia nada del deploy
exports.adms = onRequest({region: 'us-central1'}, app);

// RESETEAR CONTRASEÑA DE LOGIN DE UN GIMNASIO (panel de Admin, ver CHANGELOG.md) — segundo uso de
// Cloud Functions del proyecto, sin relación con el control de acceso biométrico de arriba.
//
// POR QUÉ HACE FALTA UNA CLOUD FUNCTION PARA ESTO: Firebase Auth guarda las contraseñas cifradas
// de forma irreversible — nadie (ni el admin, ni este código) puede "ver" la contraseña real de un
// gimnasio, y el SDK de cliente (el que usa index.html) solo puede cambiar la contraseña de LA
// PROPIA cuenta ya autenticada, nunca la de otra cuenta. Cambiarle la contraseña a OTRO usuario
// requiere el Admin SDK (admin.auth().updateUser), que solo puede correr en un backend de
// confianza — de ahí esta función. La consola de Firebase tampoco permite fijar una contraseña
// nueva directamente, solo mandar un correo de restablecimiento (que el dueño del gym tendría que
// revisar y confirmar) — esto genera la contraseña nueva al instante para que el admin se la pueda
// pasar directo (ej. por WhatsApp), igual que ya se hace con los PIN de empleados.
//
// SEGURIDAD: valida que quien llama esté autenticado Y que su correo sea exactamente el del admin
// (mismo criterio que ADMIN_EMAIL en index.html/firestore.rules) — usa el token de Firebase Auth
// que el SDK de cliente manda automáticamente en una función onCall, nunca un valor que el cliente
// pueda falsificar a mano. Verifica además que el uid recibido corresponda a un documento real en
// usuarios/, para no resetear por error la contraseña de una cuenta de Firebase Auth ajena a este
// proyecto por un typo.
const ADMIN_EMAIL = 'luismolinac06@gmail.com';

function generarPasswordAleatoria(len = 12) {
  // Alfabeto sin caracteres ambiguos (0/O, 1/l/I) — la contraseña se lee y se copia a mano/por
  // WhatsApp, así que debe distinguirse fácil a simple vista. crypto.randomInt (no Math.random)
  // porque esto genera una credencial real de login, no un identificador cualquiera.
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < len; i++) pass += alfabeto[crypto.randomInt(alfabeto.length)];
  return pass;
}

exports.resetGymPassword = onCall({region: 'us-central1'}, async (request) => {
  if (!request.auth || request.auth.token.email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Solo el admin puede resetear contraseñas.');
  }
  const email = request.data && request.data.email;
  if (!email || typeof email !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta el correo del gimnasio.');
  }
  // Se resuelve por correo, NO por el id del documento en usuarios/: antes del primer login de
  // ese gimnasio, su doc vive en usuarios/pending_<email> (un id inventado, no un uid real de
  // Firebase Auth) — pero su cuenta de Auth (creada a mano por el admin en la consola de
  // Firebase al darlo de alta) puede ya existir. getUserByEmail encuentra el uid real en
  // cualquiera de los dos casos (antes o después de que el gym migre a su doc con uid real).
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (err) {
    throw new HttpsError('not-found', 'Ese gimnasio todavía no tiene una cuenta de acceso creada en Firebase Auth.');
  }
  const nuevaPassword = generarPasswordAleatoria();
  try {
    await admin.auth().updateUser(userRecord.uid, {password: nuevaPassword});
  } catch (err) {
    logger.error('resetGymPassword: fallo updateUser', {email, uid: userRecord.uid, error: err.message});
    throw new HttpsError('internal', 'No se pudo resetear la contraseña: ' + err.message);
  }
  logger.info('resetGymPassword: contraseña reseteada por el admin', {email, uid: userRecord.uid});
  return {password: nuevaPassword};
});
