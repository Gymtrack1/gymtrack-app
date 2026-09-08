// GymTrack — Worker de Cloudflare para la recomendación de IA (Parte 6, ver CHANGELOG.md del
// repo principal). Proyecto APARTE de index.html — se despliega por su cuenta en Cloudflare
// (ver README.md en esta misma carpeta). Nunca importa nada de index.html ni al revés: la
// única conexión es la URL pública que index.html llama por fetch(), y el JSON que va y viene.
//
// Qué hace, en resumen:
//   1. Recibe un POST del navegador del cliente (o del panel de staff) con datos NO sensibles
//      del miembro: edad, peso actual, estatura, IMC, su meta (metaFitness) y — si ya hay
//      suficiente historial — el ritmo real de cambio (tendenciaSemanal, kg/semana). Nunca
//      recibe nombre, teléfono, ni ningún dato que identifique a la persona.
//   2. Arma un prompt para Gemini con un system prompt fijo (ver SYSTEM_PROMPT abajo) que fuerza
//      español, tono motivador pero realista, prohíbe diagnósticos médicos, y siempre agrega el
//      aviso de que esto no sustituye a un entrenador o médico si la meta implica un cambio de
//      peso significativo.
//   3. Llama a la API de Gemini (capa gratuita) usando la API key guardada como SECRETO de
//      Cloudflare (nunca en este archivo, nunca en el navegador — ver README.md).
//   4. Devuelve { texto: "..." } como JSON al navegador.
//
// CORS: solo se permite llamar a este Worker desde el dominio de GitHub Pages de GymTrack (ver
// ALLOWED_ORIGIN abajo) — así una página cualquiera no puede usar tu cuota gratuita de Gemini
// escondida detrás del navegador de un visitante tuyo. Esto NO es autenticación real (cualquiera
// que llame directo al Worker con curl/Postman sí puede usarlo) — para una app gratuita de un
// gym esto es un balance razonable de esfuerzo vs. riesgo, pero es una limitación real: si algún
// día ves consumo raro de tu cuota de Gemini, ese es el motivo más probable.

const ALLOWED_ORIGIN = 'https://gymtrack1.github.io';

const SYSTEM_PROMPT = `Eres un asistente de fitness para GymTrack, una app de gestión de gimnasios. Un cliente del gimnasio (o el propio staff en su nombre) te pide una recomendación de entrenamiento hacia una meta personal.

REGLAS OBLIGATORIAS:
- Responde SIEMPRE en español, con un tono motivador pero realista y honesto — nunca prometas resultados garantizados ni uses lenguaje sensacionalista.
- NO des diagnósticos médicos, ni recomendaciones de salud fuera del fitness general (nutrición clínica, suplementación específica, condiciones médicas, lesiones). Si la pregunta implícita se acerca a eso, redirige brevemente a consultar a un profesional de la salud.
- Si en el contexto te dan un "ritmo real" (tendenciaSemanal, en kg o carga por semana, calculado del propio historial del cliente), ÚSALO TAL CUAL para estimar cuánto tiempo falta para la meta — nunca inventes ni calcules otro ritmo distinto al que te dieron. Haz la cuenta simple: (valor objetivo - valor actual) / ritmo semanal = semanas estimadas, y comunícalo de forma clara y aproximada (ej. "a este ritmo, unas 8 semanas").
- Si NO te dan un ritmo real (tendenciaSemanal es null, historial insuficiente todavía), estima con tu conocimiento general de fitness UNA recomendación y un rango de tiempo razonable, pero deja explícito en el propio texto que es un estimado inicial que se irá afinando conforme haya más historial registrado — nunca lo presentes como si fuera un cálculo preciso.
- Si la meta implica un cambio de peso corporal significativo (más de aproximadamente 5% del peso actual, en cualquier dirección), SIEMPRE incluye al final una nota breve dejando claro que esto no sustituye a un entrenador personal ni a un médico.
- Sé breve: 3-5 oraciones o un párrafo corto. No uses formato markdown (sin **negritas**, sin listas con guiones) — es texto plano que se muestra directo en pantalla.`;

function buildUserPrompt(datos) {
  const partes = [];
  if (datos.edad != null) partes.push(`Edad: ${datos.edad} años.`);
  if (datos.pesoActual != null) partes.push(`Peso actual: ${datos.pesoActual} kg.`);
  if (datos.estatura != null) partes.push(`Estatura: ${datos.estatura} cm.`);
  if (datos.imc != null) partes.push(`IMC actual: ${datos.imc}.`);

  const meta = datos.meta || {};
  if (meta.tipo === 'pesoCorporal') {
    partes.push(`Meta: llegar a ${meta.valorObjetivo} kg de peso corporal.`);
  } else if (meta.tipo === 'ejercicio') {
    partes.push(`Meta: levantar ${meta.valorObjetivo} kg en el ejercicio "${meta.ejercicioObjetivo || 'no especificado'}".`);
  }
  if (meta.fechaObjetivo) {
    const dias = Math.round((meta.fechaObjetivo - Date.now()) / 86400000);
    if (dias > 0) partes.push(`Se puso como fecha objetivo dentro de aproximadamente ${dias} días.`);
  }

  if (typeof datos.tendenciaSemanal === 'number') {
    partes.push(`Ritmo real medido de su propio historial: ${datos.tendenciaSemanal} kg por semana (usa este número tal cual para tu estimado, no calcules otro).`);
  } else {
    partes.push('Todavía no hay suficiente historial para medir un ritmo real — este cliente es nuevo o tiene pocos registros. Da un estimado inicial general y dilo explícitamente.');
  }

  partes.push('Redacta una recomendación breve y el estimado de tiempo hacia la meta, siguiendo las reglas del system prompt.');
  return partes.join(' ');
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin === ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
  return headers;
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Solo se acepta POST' }, 405, origin);
    }

    let datos;
    try {
      datos = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'JSON inválido' }, 400, origin);
    }
    if (!datos || typeof datos !== 'object') {
      return jsonResponse({ error: 'Cuerpo de la petición inválido' }, 400, origin);
    }
    if (!datos.meta || !datos.meta.tipo) {
      return jsonResponse({ error: 'Falta la meta (metaFitness)' }, 400, origin);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'El Worker no tiene configurada GEMINI_API_KEY (ver README.md)' }, 500, origin);
    }

    const modelo = env.GEMINI_MODEL || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${env.GEMINI_API_KEY}`;

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(datos) }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
    };

    let geminiResp;
    try {
      geminiResp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return jsonResponse({ error: 'No se pudo contactar a Gemini' }, 502, origin);
    }

    if (!geminiResp.ok) {
      const detalle = await geminiResp.text().catch(() => '');
      return jsonResponse({ error: `Gemini respondió ${geminiResp.status}`, detalle: detalle.slice(0, 300) }, 502, origin);
    }

    const data = await geminiResp.json();
    const texto = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!texto || !texto.trim()) {
      return jsonResponse({ error: 'Gemini no devolvió texto (puede que haya bloqueado la respuesta por seguridad)' }, 502, origin);
    }

    return jsonResponse({ texto: texto.trim() }, 200, origin);
  },
};
