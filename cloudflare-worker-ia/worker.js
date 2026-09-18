// GymTrack — Worker de Cloudflare para las recomendaciones con IA (Parte 6 y Parte 20, ver
// CHANGELOG.md del repo principal). Proyecto APARTE de index.html — se despliega por su cuenta en
// Cloudflare (ver README.md en esta misma carpeta). Nunca importa nada de index.html ni al revés:
// la única conexión es la URL pública que index.html llama por fetch(), y el JSON que va y viene.
//
// Atiende DOS tipos de petición, distinguidos por el campo `tipo` del body (si no viene, se trata
// como el primero — así el caller original, que nunca mandó `tipo`, sigue funcionando igual):
//
// 1) PLAN DE FITNESS hacia una meta personal (Parte 6, tipo ausente o distinto de
//    'recomendacionFuerza'):
//   a. Recibe un POST con datos NO sensibles del miembro: edad, peso actual, estatura, IMC, su
//      meta (metaFitness), el ritmo real de cambio si ya hay suficiente historial
//      (tendenciaSemanal, kg/semana), y el plan actual si ya tenía uno (planActual, con qué
//      hábitos/hitos ya están marcados como completados). Nunca recibe nombre, teléfono, ni
//      ningún dato que identifique a la persona.
//   b. Arma un prompt para Gemini con SYSTEM_PROMPT que fuerza español, tono motivador pero
//      realista, prohíbe diagnósticos médicos, pide un plan en formato JSON con hitos por
//      periodo + hábitos accionables, e instruye a NUNCA reescribir ni desmarcar los
//      hitos/hábitos que ya vienen marcados como completados en planActual.
//   c. Devuelve { resumenTexto, hitos } — index.html arma el objeto final planFitnessIA (agrega
//      generadoEn, basadaEnDatosReales, y el estado completado/completadoPor/completadoEn de
//      cada hábito, que la IA nunca decide).
//
// 2) RECOMENDACIÓN basada en Fuerza por músculo (Parte 20, tipo:'recomendacionFuerza'):
//   a. Recibe edad, categoriaMembresia, metaSemanal, fuerzaPorMusculo (ya calculada del lado
//      cliente con la misma fórmula de Epley que usa la sección Fuerza del portal) y
//      gruposSinRegistro (los músculos que el cliente nunca ha trabajado). Tampoco recibe nombre
//      ni ningún dato identificable.
//   b. Arma un prompt con SYSTEM_PROMPT_FUERZA: recomendación breve (3-5 puntos), priorizando
//      músculos poco desarrollados o sin registros, tratando como principiante a quien tiene
//      poco o ningún historial.
//   c. Devuelve { texto } — index.html guarda el resultado directo en Firestore
//      (recomendacionesIA/{miembroId}), sin pasar por ningún backend adicional.
//
// Ambos casos: llama a la API de Gemini (capa gratuita) usando la API key guardada como SECRETO
// de Cloudflare (nunca en este archivo, nunca en el navegador — ver README.md), pidiendo salida
// JSON estructurada (responseMimeType + responseSchema) para minimizar el riesgo de que la IA
// devuelva texto que no se pueda parsear.
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

// RECOMENDACIÓN IA basada en Fuerza (Parte 20, ver CHANGELOG.md del repo principal) — segundo
// tipo de petición que atiende este mismo Worker, para no montar infraestructura aparte
// (Cloudflare Functions/Firebase Functions) solo para esto. Se distingue por datos.tipo ===
// 'recomendacionFuerza' (si no viene, o viene distinto, se trata como el plan de meta de
// siempre — así ningún caller existente se rompe). A diferencia del plan de meta, esta NO
// necesita salida estructurada compleja (hitos/hábitos): solo un texto breve de 3-5 puntos.
const SYSTEM_PROMPT_FUERZA = `Eres un entrenador de gimnasio experimentado, dentro de GymTrack (una app de gestión de gimnasios). Respondes ÚNICAMENTE con el JSON solicitado (según el esquema dado) — sin texto, explicación ni bloques de código markdown fuera de él.

REGLAS OBLIGATORIAS para el campo "texto":
- SIEMPRE en español, tono directo y motivador, dirigiéndote al cliente de tú.
- BREVE: entre 3 y 5 puntos, cada uno en una línea corta que empiece con un guion "-".
- Prioriza los grupos musculares con menos desarrollo relativo frente a los demás, o que
  todavía no tienen ningún registro — esos necesitan más atención que los que ya están fuertes.
- Si el cliente tiene pocos registros de fuerza en total (o ninguno), trátalo como principiante:
  ejercicios básicos, pesos conservadores, énfasis en la técnica antes que en la carga.
- No repitas los datos que se te dieron ni expliques tu razonamiento — ve directo a los puntos.
- Sin formato markdown además de los guiones de lista (sin **negritas**).
- NO des diagnósticos médicos ni recomendaciones de salud fuera del fitness general.`;

const RESPONSE_SCHEMA_FUERZA = {
  type: 'object',
  properties: {
    texto: { type: 'string' },
  },
  required: ['texto'],
};

function buildUserPromptFuerza(datos) {
  const partes = [];
  if (datos.edad != null) partes.push(`Edad: ${datos.edad} años.`);
  else partes.push('Edad: no registrada.');
  partes.push(`Categoría de membresía: ${datos.categoriaMembresia || 'sin categoría'}.`);
  partes.push(`Meta semanal de asistencia: ${datos.metaSemanal ? datos.metaSemanal + ' días/semana' : 'sin meta definida'}.`);

  const fuerza = Array.isArray(datos.fuerzaPorMusculo) ? datos.fuerzaPorMusculo : [];
  const totalRegistros = typeof datos.totalRegistrosFuerza === 'number' ? datos.totalRegistrosFuerza : 0;
  partes.push(`Total de registros de fuerza en su historial: ${totalRegistros}.`);
  partes.push('Fuerza estimada por grupo muscular (1RM vía fórmula de Epley, el mayor registrado por músculo):');
  if (fuerza.length) {
    fuerza.forEach((f) => {
      partes.push(f && f.musculo && typeof f.valor === 'number'
        ? `- ${f.musculo}: 1RM estimado ${f.valor}kg`
        : null);
    });
  }
  // Grupos musculares que el cliente nunca ha trabajado (no aparecen en fuerzaPorMusculo) — se
  // le pasan aparte porque el Worker no tiene forma de saber la lista completa de grupos
  // musculares posibles, index.html ya se la manda armada en gruposSinRegistro.
  const sinRegistro = Array.isArray(datos.gruposSinRegistro) ? datos.gruposSinRegistro : [];
  sinRegistro.forEach((musculo) => partes.push(`- ${musculo}: sin registros todavía`));

  partes.push('Genera la recomendación siguiendo el esquema JSON dado y las reglas del system prompt.');
  return partes.filter(Boolean).join(' ');
}

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
    // datos.tipo==='recomendacionFuerza' (Parte 20, ver CHANGELOG.md del repo principal): segundo
    // tipo de petición que atiende este mismo Worker — si no viene (o viene con otro valor), se
    // trata como el plan de meta de toda la vida, así ningún caller existente se rompe.
    const esFuerza = datos.tipo === 'recomendacionFuerza';
    if (esFuerza) {
      if (!Array.isArray(datos.fuerzaPorMusculo)) {
        return jsonResponse({ error: 'Falta fuerzaPorMusculo (puede venir vacío [], pero debe existir)' }, 400, origin);
      }
    } else if (!datos.meta || !datos.meta.tipo) {
      return jsonResponse({ error: 'Falta la meta (metaFitness)' }, 400, origin);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ error: 'El Worker no tiene configurada GEMINI_API_KEY (ver README.md)' }, 500, origin);
    }

    // gemini-3.6-flash por default: gemini-2.5-flash se probó como default más generoso en
    // cuota, pero Google ya no lo deja usar en cuentas nuevas ("no longer available to new
    // users", 404) — así que aunque su cuota gratis documentada sea mejor, no sirve como default
    // porque ni siquiera responde en una cuenta nueva. gemini-3.6-flash es el único que Google
    // confirma que SÍ funciona ahora mismo, aunque su cuota gratis real sea más baja (ver
    // CHANGELOG.md). Si tienes una cuenta con acceso a otro modelo con mejor cuota, usa la
    // variable GEMINI_MODEL — pero primero confirma que tu cuenta puede usarlo de verdad.
    const modelo = env.GEMINI_MODEL || 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${env.GEMINI_API_KEY}`;

    // maxOutputTokens en 3072: en modelos con "thinking" (ej. gemini-3.6-flash), el
    // razonamiento interno del modelo se descuenta del MISMO presupuesto que la respuesta final
    // — y ahora la respuesta es un JSON con varios hitos/hábitos (o, para recomendacionFuerza,
    // un texto corto — pero se deja el mismo margen por simplicidad, no cuesta más si no se usa).
    const body = {
      systemInstruction: { parts: [{ text: esFuerza ? SYSTEM_PROMPT_FUERZA : SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: esFuerza ? buildUserPromptFuerza(datos) : buildUserPrompt(datos) }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3072,
        responseMimeType: 'application/json',
        responseSchema: esFuerza ? RESPONSE_SCHEMA_FUERZA : RESPONSE_SCHEMA,
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
    // Modelos con "thinking" (razonamiento interno antes de responder, ej. gemini-3.6-flash)
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
    let resultado;
    try {
      resultado = JSON.parse(textoJson);
    } catch (e) {
      return jsonResponse({ error: 'Gemini no devolvió una respuesta en formato JSON válido (intenta de nuevo)' }, 502, origin);
    }

    if (esFuerza) {
      if (!resultado || typeof resultado.texto !== 'string' || !resultado.texto.trim()) {
        return jsonResponse({ error: 'La respuesta de Gemini no tiene el formato esperado (intenta de nuevo)' }, 502, origin);
      }
      return jsonResponse({ texto: resultado.texto.trim() }, 200, origin);
    }

    if (!resultado || typeof resultado.resumenTexto !== 'string' || !resultado.resumenTexto.trim() || !Array.isArray(resultado.hitos)) {
      return jsonResponse({ error: 'El plan de Gemini no tiene el formato esperado (intenta de nuevo)' }, 502, origin);
    }
    return jsonResponse({ resumenTexto: resultado.resumenTexto.trim(), hitos: resultado.hitos }, 200, origin);
  },
};
