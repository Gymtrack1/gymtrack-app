// Cloud Function de GymTrack — Recomendación IA (Parte 20, ver CHANGELOG.md del repo).
//
// Este archivo vive APARTE de index.html a propósito (misma idea que
// cloudflare-worker-ia/): es el ÚNICO lugar donde vive la API key de Anthropic. index.html
// nunca la ve — solo llama a esta function vía el SDK de Firebase (httpsCallable), que ya
// maneja la sesión de Firebase Auth actual (incluida una sesión anónima del portal) sin nada
// más que configurar del lado cliente.
//
// Qué hace, en orden:
//   1. Verifica que quien llama tenga una sesión de Firebase Auth válida (cualquiera, incluida
//      anónima — mismo nivel de confianza que el resto del portal de GymTrack, documentado en
//      firestore.rules: no hay forma de verificar criptográficamente "esta sesión anónima SÍ es
//      ese miembro concreto" sin backend propio adicional).
//   2. Si ya existe una recomendación de los últimos 7 días y no se pidió `forzar:true`, la
//      regresa tal cual SIN llamar a la IA — este control de costo vive aquí (servidor), no solo
//      en index.html, para que no se pueda saltar llamando a la function directo.
//   3. Si hace falta generar: lee (Admin SDK, sin pasar por firestore.rules)
//      `registrosProgreso` del cliente y arma la fuerza estimada por grupo muscular — MISMA
//      fórmula de Epley que usa index.html (estimar1RM), pero SIN necesitar el catálogo de
//      ejercicios (BIBLIOTECA_EJERCICIOS): cada registro de fuerza ya trae su propio campo
//      `musculo` guardado, así que agrupar aquí no duplica el catálogo — ver
//      fuerzaPorMusculoServer(). La única lista que sí hay que mantener sincronizada a mano es
//      GRUPOS_MUSCULARES_FUERZA (los NOMBRES de los 9 grupos musculares de fuerza que ya existen
//      en index.html) — pero solo si algún día se agrega un grupo muscular COMPLETAMENTE NUEVO,
//      nunca por agregar un ejercicio dentro de uno que ya existe.
//   4. Arma un prompt para Claude (Anthropic) pidiendo una recomendación breve en español.
//   5. Guarda el resultado en usuarios/{uid}/recomendacionesIA/{miembroId} y lo regresa.

const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');

admin.initializeApp();
const db = admin.firestore();

// Se configura con: firebase functions:secrets:set ANTHROPIC_API_KEY
// (ver README de este mismo directorio para el paso a paso completo).
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const MODEL_ID = 'claude-opus-5';
const RECOMENDACION_VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

// Misma fórmula de Epley que estimar1RM en index.html — se duplica aquí porque index.html es un
// archivo único que no se puede "importar" desde Node (decisión de arquitectura del proyecto),
// pero es solo una fórmula de una línea, no un catálogo grande — no hay riesgo real de que se
// desincronice en la práctica.
function estimar1RM(peso, reps) {
  return reps && reps > 1 ? peso * (1 + reps / 30) : peso;
}

// Los 9 grupos musculares "de fuerza" que existen hoy en BIBLIOTECA_EJERCICIOS de index.html
// (todas sus claves EXCEPTO 'Cardio'). Se usa solo para que el prompt le pueda decir a la IA
// "el cliente NUNCA ha trabajado este músculo" — sin esta lista, la function solo vería los
// músculos que YA aparecen en los registros del cliente, nunca los que le faltan del todo.
const GRUPOS_MUSCULARES_FUERZA = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Glúteo', 'Abdomen', 'Funcional'];

function calcularEdad(fechaNacimientoMs) {
  if (!fechaNacimientoMs) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimientoMs);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const diffMes = hoy.getMonth() - nac.getMonth();
  if (diffMes < 0 || (diffMes === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

// Agrupa los registros de FUERZA (peso es number — los de cardio no lo traen, ver
// portalGuardarSerie/portalStaffGuardarSerie en index.html) por el campo `musculo` que cada
// registro ya trae guardado, y se queda con el de mayor 1RM estimado por músculo. Equivalente a
// _fuerzaPorMusculo() del lado cliente, pero sin necesitar el catálogo de ejercicios.
function fuerzaPorMusculoServer(registros) {
  const porMusculo = new Map();
  let totalFuerza = 0;
  registros.forEach((r) => {
    if (typeof r.peso !== 'number' || !r.musculo) return; // cardio, o dato incompleto/viejo
    totalFuerza++;
    const valor = Math.round(estimar1RM(r.peso, r.repeticiones) * 10) / 10;
    const actual = porMusculo.get(r.musculo);
    if (!actual || valor > actual.valor) porMusculo.set(r.musculo, {valor, fecha: r.fecha});
  });
  return {porMusculo, totalFuerza};
}

function armarPrompt(miembro, porMusculo, totalFuerza) {
  const edad = calcularEdad(miembro.fechaNacimiento);
  const resumenFuerza = GRUPOS_MUSCULARES_FUERZA.map((musculo) => {
    const d = porMusculo.get(musculo);
    return d ? `- ${musculo}: 1RM estimado ${d.valor}kg` : `- ${musculo}: sin registros todavía`;
  }).join('\n');

  const datos = [
    `Edad: ${edad != null ? edad + ' años' : 'no registrada'}`,
    `Categoría de membresía: ${miembro.categoriaMembresia || 'sin categoría'}`,
    `Meta semanal de asistencia: ${miembro.metaSemanal ? miembro.metaSemanal + ' días/semana' : 'sin meta definida'}`,
    `Total de registros de fuerza en su historial: ${totalFuerza}`,
    'Fuerza estimada por grupo muscular (1RM vía fórmula de Epley, el mayor registrado por músculo):',
    resumenFuerza,
  ].join('\n');

  const system = `Eres un entrenador de gimnasio experimentado. Respondes SIEMPRE en español, en tono
directo y motivador, dirigiéndote al cliente de tú. Da una recomendación de rutina/ejercicios
BREVE: entre 3 y 5 puntos, cada uno en una línea corta (usa guiones "-" al inicio de cada punto).
Prioriza los grupos musculares con menos desarrollo relativo frente a los demás, o que todavía no
tienen ningún registro — esos necesitan más atención que los que ya están fuertes. Si el cliente
tiene pocos registros de fuerza en total (o ninguno), trátalo como principiante: ejercicios
básicos, pesos conservadores, énfasis en la técnica antes que en la carga. No repitas los datos
que se te dieron ni expliques tu razonamiento — ve directo a los puntos de la recomendación.`;

  return {system, user: datos};
}

// Exportadas para poder probarlas aisladas en Node (sin desplegar, sin credenciales de Firebase
// ni de Anthropic) — mismo criterio que cloudflare-worker-ia/, ver README.md de este directorio.
exports._test = {estimar1RM, calcularEdad, fuerzaPorMusculoServer, armarPrompt, GRUPOS_MUSCULARES_FUERZA};

exports.generarRecomendacionIA = onCall({secrets: [ANTHROPIC_API_KEY]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Necesitas una sesión válida.');
  }
  const {uid, miembroId, forzar} = request.data || {};
  if (!uid || typeof uid !== 'string' || !miembroId || typeof miembroId !== 'string') {
    throw new HttpsError('invalid-argument', 'Faltan uid (del gimnasio) o miembroId.');
  }

  const gymRef = db.collection('usuarios').doc(uid);
  const miembroRef = gymRef.collection('miembros').doc(miembroId);
  const recRef = gymRef.collection('recomendacionesIA').doc(miembroId);

  const [miembroSnap, recSnap] = await Promise.all([miembroRef.get(), recRef.get()]);
  if (!miembroSnap.exists) {
    throw new HttpsError('not-found', 'Ese cliente no existe en este gimnasio.');
  }

  // Control de costo: si ya hay una recomendación reciente y no se pidió "forzar" explícito, se
  // regresa la que ya existe sin gastar una llamada a la IA. Vive aquí (servidor) y no solo en
  // index.html para que llamar a la function directo (sin pasar por la UI) no lo salte.
  if (recSnap.exists && !forzar) {
    const existente = recSnap.data();
    if (existente.generadoEn && Date.now() - existente.generadoEn < RECOMENDACION_VIGENCIA_MS) {
      return {id: recRef.id, ...existente};
    }
  }

  const miembro = miembroSnap.data();
  const registrosSnap = await gymRef.collection('registrosProgreso').where('miembroId', '==', miembroId).get();
  const registros = registrosSnap.docs.map((d) => d.data());
  const {porMusculo, totalFuerza} = fuerzaPorMusculoServer(registros);
  const {system, user} = armarPrompt(miembro, porMusculo, totalFuerza);

  const anthropic = new Anthropic({apiKey: ANTHROPIC_API_KEY.value()});
  let texto;
  try {
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system,
      messages: [{role: 'user', content: user}],
    });
    const bloque = response.content.find((b) => b.type === 'text');
    texto = bloque ? bloque.text.trim() : '';
    if (!texto) throw new Error('La IA no devolvió texto.');
  } catch (err) {
    console.error('generarRecomendacionIA: error llamando a Claude', err);
    throw new HttpsError('internal', 'No se pudo generar la recomendación. Intenta de nuevo.');
  }

  const data = {texto, generadoEn: Date.now(), basadoEnRegistros: totalFuerza};
  await recRef.set(data);
  return {id: recRef.id, ...data};
});
