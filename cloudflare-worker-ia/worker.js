// GymTrack — Worker de Cloudflare para el plan de fitness con IA (Parte 6, ver CHANGELOG.md del
// repo principal). Proyecto APARTE de index.html — se despliega por su cuenta en Cloudflare
// (ver README.md en esta misma carpeta). Nunca importa nada de index.html ni al revés: la
// única conexión es la URL pública que index.html llama por fetch(), y el JSON que va y viene.
//
// Qué hace, en resumen:
//   1. Recibe un POST del navegador del cliente (o del panel de staff) con datos NO sensibles
//      del miembro: edad, peso actual, estatura, IMC, su meta (metaFitness), el ritmo real de
//      cambio si ya hay suficiente historial (tendenciaSemanal, kg/semana), y el plan actual si
//      ya tenía uno (planActual, con qué hábitos/hitos ya están marcados como completados).
//      Nunca recibe nombre, teléfono, ni ningún dato que identifique a la persona.
//   2. Arma un prompt para Gemini con un system prompt fijo (ver SYSTEM_PROMPT abajo) que fuerza
//      español, tono motivador pero realista, prohíbe diagnósticos médicos, pide un plan en
//      formato JSON con hitos por periodo + hábitos accionables, e instruye a NUNCA reescribir
//      ni desmarcar los hitos/hábitos que ya vienen marcados como completados en planActual.
//   3. Llama a la API de Gemini (capa gratuita) usando la API key guardada como SECRETO de
//      Cloudflare (nunca en este archivo, nunca en el navegador — ver README.md), pidiendo
//      salida JSON estructurada (responseMimeType + responseSchema) para minimizar el riesgo de
//      que la IA devuelva texto que no se pueda parsear.
//   4. Devuelve { resumenTexto, hitos } como JSON al navegador — index.html es quien arma el
//      objeto final planFitnessIA (agrega generadoEn, basadaEnDatosReales, y el estado
//      completado/completadoPor/completadoEn de cada hábito, que la IA nunca decide).
//
// CORS: solo se permite llamar a este Worker desde el dominio de GitHub Pages de GymTrack (ver
// ALLOWED_ORIGIN abajo) — así una página cualquiera no puede usar tu cuota gratuita de Gemini
// escondida detrás del navegador de un visitante tuyo. Esto NO es autenticación real (cualquiera
// que llame directo al Worker con curl/Postman sí puede usarlo) — para una app gratuita de un
// gym esto es un balance razonable de esfuerzo vs. riesgo, pero es una limitación real: si algún
// día ves consumo raro de tu cuota de Gemini, ese es el motivo más probable.

const ALLOWED_ORIGIN = 'https://gymtrack1.github.io';

const SYSTEM_PROMPT = `Eres un asistente de fitness para GymTrack, una app de gestión de gimnasios. Un cliente del gimnasio (o el propio staff en su nombre) te pide un plan hacia una meta personal, organizado en hitos por periodo con hábitos accionables que se pueden ir marcando como completados.

REGLAS OBLIGATORIAS:
- Responde ÚNICAMENTE con el JSON solicitado (según el esquema dado) — sin texto, explicación ni bloques de código markdown fuera de él.
- resumenTexto: 2-4 oraciones en español, con un tono motivador pero realista y honesto — nunca prometas resultados garantizados ni uses lenguaje sensacionalista. Sin formato markdown (sin **negritas**, sin listas con guiones) — es texto plano que se muestra directo en pantalla.
- NO des diagnósticos médicos, ni recomendaciones de salud fuera del fitness general (nutrición clínica, suplementación específica, condiciones médicas, lesiones). Si la meta implícita se acerca a eso, redirige brevemente (dentro de resumenTexto) a consultar a un profesional de la salud.
- Si te dan un "ritmo real" (tendenciaSemanal, calculado del propio historial del cliente), ÚSALO TAL CUAL para estimar los periodos de los hitos — nunca inventes ni calcules otro ritmo distinto al que te dieron.
- Si NO te dan un ritmo real (historial insuficiente todavía), estima con tu conocimiento general de fitness, pero deja explícito en resumenTexto que es un estimado inicial que se irá afinando conforme haya más historial registrado — nunca lo presentes como si fuera un cálculo preciso.
- Si la meta implica un cambio de peso corporal significativo (más de aproximadamente 5% del peso actual, en cualquier dirección), incluye en resumenTexto una nota breve de que esto no sustituye a un entrenador personal ni a un médico.
- Si te dan un "plan actual" con hitos/hábitos ya marcados como completados, NUNCA los reescribas, renombres, elimines ni los des por pendientes — trátalos como fijos e inamovibles, ni siquiera los repitas en tu respuesta. Genera o ajusta SOLO hitos nuevos para lo que sigue pendiente o para periodos futuros, considerando el progreso real ya mostrado.
- Genera entre 3 y 5 hitos con periodos secuenciales y realistas (ej. "Semana 1-2", "Semana 3-4", "Mes 2"), cada uno con una meta intermedia concreta (metaIntermedia) y de 2 a 4 hábitos breves y accionables (texto de cada hábito: máximo ~10 palabras).`;

// Esquema de salida estructurada de Gemini (subset de OpenAPI): fuerza a la API a devolver JSON
// con esta forma exacta, en vez de confiar solo en la instrucción del prompt — reduce mucho el
// riesgo de una respuesta que no se pueda parsear. id/texto de cada hábito son intencionalmente
// lo único que la IA controla de cada hábito — completado/completadoPor/completadoEn los agrega
// index.html, nunca la IA.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    resumenTexto: { type: 'string' },
    hitos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          periodo: { type: 'string' },
          metaIntermedia: { type: 'string' },
          habitos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                texto: { type: 'string' },
              },
              required: ['id', 'texto'],
            },
          },
        },
        required: ['id', 'periodo', 'metaIntermedia', 'habitos'],
      },
    },
  },
  required: ['resumenTexto', 'hitos'],
};

function describirHabito(hab) {
  const estado = hab && hab.completado ? '[COMPLETADO, no lo toques]' : '[pendiente]';
  return `${estado} ${hab && hab.texto ? hab.texto : ''}`;
}

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
    partes.push('Todavía no hay suficiente historial para medir un ritmo real — este cliente es nuevo o tiene pocos registros. Da un estimado inicial general y dilo explícitamente en resumenTexto.');
  }

  const planActual = datos.planActual;
  if (planActual && Array.isArray(planActual.hitos) && planActual.hitos.length) {
    partes.push('Plan actual del cliente (respeta EXACTAMENTE lo ya marcado como completado, no lo reescribas ni lo desmarques — genera hitos nuevos solo para lo pendiente o periodos futuros):');
    planActual.hitos.forEach((h) => {
      const habitosDesc = (h.habitos || []).map(describirHabito).join('; ');
      partes.push(`- Hito "${h.periodo || ''}" (meta intermedia: ${h.metaIntermedia || ''}): ${habitosDesc || 'sin hábitos'}.`);
    });
  } else {
    partes.push('El cliente no tiene un plan previo — genera uno nuevo desde cero.');
  }

  partes.push('Genera el plan siguiendo el esquema JSON dado y las reglas del system prompt.');
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

    // gemini-2.5-flash por default (no gemini-3.6-flash): en la capa gratuita, la cuota de
    // gemini-3.6-flash puede ser mucho más baja que la de 2.5-flash (visto en la práctica: 20
    // peticiones/día contra 1,500/día en la misma cuenta) — un modelo "más nuevo" no siempre
    // tiene más cuota gratis. Si Google cambia esto en el futuro, se puede volver a ajustar acá o
    // con la variable GEMINI_MODEL, sin tocar el resto del Worker.
    const modelo = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${env.GEMINI_API_KEY}`;

    // maxOutputTokens en 3072: en modelos con "thinking" (ej. gemini-2.5-flash y más nuevos), el
    // razonamiento interno del modelo se descuenta del MISMO presupuesto que la respuesta final
    // — y ahora la respuesta es un JSON con varios hitos/hábitos, más grande que el texto libre
    // de antes.
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(datos) }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3072,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    const pedirAGemini = () => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let geminiResp;
    try {
      geminiResp = await pedirAGemini();
      // 503 = "modelo saturado temporalmente" del lado de Google (no un error nuestro) — un
      // solo reintento corto suele bastar, ya que estos picos de demanda son momentáneos.
      if (geminiResp.status === 503) {
        await new Promise((r) => setTimeout(r, 1200));
        geminiResp = await pedirAGemini();
      }
    } catch (e) {
      return jsonResponse({ error: 'No se pudo contactar a Gemini' }, 502, origin);
    }

    if (!geminiResp.ok) {
      const detalle = await geminiResp.text().catch(() => '');
      return jsonResponse({ error: `Gemini respondió ${geminiResp.status}`, detalle: detalle.slice(0, 300) }, 502, origin);
    }

    const data = await geminiResp.json();
    // Modelos con "thinking" (razonamiento interno antes de responder, ej. gemini-2.5-flash)
    // pueden devolver varias "parts": algunas marcadas thought:true (el razonamiento interno,
    // nunca se le debe mostrar al usuario) y la parte final con la respuesta real. Se descartan
    // las de razonamiento y se concatena el resto — en modelos sin thinking esto no cambia nada
    // (una sola part, sin el campo thought).
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts;
    const textoJson = Array.isArray(parts)
      ? parts.filter((p) => p && typeof p.text === 'string' && !p.thought).map((p) => p.text).join('')
      : null;

    // Si el modelo se quedó sin presupuesto de tokens (razonamiento interno + respuesta) antes de
    // terminar, finishReason viene 'MAX_TOKENS' — el JSON, si lo hay, viene cortado a medias y no
    // va a parsear. Mejor avisar con un error claro que intentar mostrar algo incompleto.
    if (data && data.candidates && data.candidates[0] && data.candidates[0].finishReason === 'MAX_TOKENS') {
      return jsonResponse({ error: 'Gemini se quedó sin espacio de respuesta (intenta de nuevo)' }, 502, origin);
    }

    if (!textoJson || !textoJson.trim()) {
      return jsonResponse({ error: 'Gemini no devolvió texto (puede que haya bloqueado la respuesta por seguridad)' }, 502, origin);
    }

    // A pesar de pedir salida JSON estructurada (responseMimeType + responseSchema), el parseo
    // se hace con try/catch y validación de forma — nunca hay que confiar ciegamente en que un
    // modelo de IA devuelva siempre exactamente lo pedido.
    let plan;
    try {
      plan = JSON.parse(textoJson);
    } catch (e) {
      return jsonResponse({ error: 'Gemini no devolvió un plan en formato JSON válido (intenta de nuevo)' }, 502, origin);
    }
    if (!plan || typeof plan.resumenTexto !== 'string' || !plan.resumenTexto.trim() || !Array.isArray(plan.hitos)) {
      return jsonResponse({ error: 'El plan de Gemini no tiene el formato esperado (intenta de nuevo)' }, 502, origin);
    }

    return jsonResponse({ resumenTexto: plan.resumenTexto.trim(), hitos: plan.hitos }, 200, origin);
  },
};
