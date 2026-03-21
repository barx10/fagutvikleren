const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_BYTES = 20 * 1024 * 1024;

const GOOGLE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
];
const OPENAI_MODELS = [
  'gpt-5-mini',
  'gpt-5.4-nano',
  'gpt-5.4-mini',
];
const ALL_MODELS = [...GOOGLE_MODELS, ...OPENAI_MODELS];

function validateFile(mimeType, size) {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return 'Ugyldig filtype. Last opp PDF eller DOCX.';
  }
  if (size > MAX_BYTES) {
    return 'Filen er for stor. Maks 20MB.';
  }
  return null;
}

function buildPrompt(audience) {
  const audienceInstruction = audience === 'elev'
    ? '\nTilpass språket for en elev på 13 år: korte setninger, enkle ord, hverdagslige eksempler, og forklar fagbegreper med en gang de dukker opp.\n'
    : '';

  return `Du er en fagperson med bred og dyp kunnskap. Du forklarer presist, korrekt og med gode eksempler. Analyser fagstoffet og generer et strukturert læringsverktøy på norsk.
${audienceInstruction}
Returner KUN gyldig JSON uten markdown-formatering eller forklaringer:
{
  "title": "Fagstoff-tittel",
  "subject": "Fag/emne",
  "flashcards": [
    { "front": "Spørsmål eller begrep", "back": "Svar eller definisjon", "cat": "kjerne|fakta|begrep|eksempel" }
  ],
  "sammendrag": [
    { "tema": "Temaoverskrift", "punkter": ["Punkt 1", "Punkt 2"] }
  ],
  "qa": [
    { "sporsmal": "Forståelsesspørsmål", "svar": "Utdypende svar", "hint": "Hint til eleven" }
  ],
  "argumentasjon": [
    { "pastand": "Hovedpåstand fra fagstoffet", "argumenter": ["Argument 1", "Argument 2"], "evidens": "Fakta eller kildehenvisning som støtter", "motargument": "Mulig innvending eller alternativt perspektiv" }
  ],
  "ordforklaring": [
    { "ord": "Fremmedord eller fagterm fra teksten", "forklaring": "Kort, presis definisjon", "eksempel": "Ordet brukt i en setning fra fagstoffet" }
  ],
  "tverrfaglig": [
    { "begrep": "Begrep fra fagstoffet", "fagfelt": "Konkret navngitt fagfelt", "parallell": "Tilsvarende fenomen i det andre fagfeltet", "innsikt": "Hva du lærer av å se det gjennom denne linsen" }
  ]
}

Trekk ut fremmedord, fagtermer og tekniske begreper som faktisk forekommer i teksten for ordforklaring. Ikke inkluder allmenne ord. Hvis teksten ikke inneholder fremmedord, returner en tom liste.
Koble sentrale begreper til konkrete paralleller i andre navngitte fagfelt for tverrfaglig. Forklar hva koblingen tilfører av forståelse.

Generer minimum: 15 flashcards, 3-5 sammendrag-temaer (3-6 punkter hver), 10 Q&A-par, 4-6 argumentasjoner, 6-15 ordforklaringer, 5-8 tverrfaglige koblinger.`;
}

async function callGemini(apiKey, model, prompt, text) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const contents = [{ text: prompt + '\n\nFagstoff:\n' + text }];

  const response = await ai.models.generateContent({ model, contents });
  return (response.text ?? '').trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
}

async function callOpenAI(apiKey, model, prompt, text) {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: [{ type: 'text', text: 'Fagstoff:\n' + text }] },
    ],
  });

  return response.choices[0].message.content.trim();
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mimeType, size, text, apiKey, model, audience } = req.body;

  if (mimeType) {
    const validationError = validateFile(mimeType, size);
    if (validationError) return res.status(400).json({ error: validationError });
  }

  if (!text || !text.trim()) return res.status(400).json({ error: 'Ingen tekst mottatt.' });
  if (!apiKey) return res.status(400).json({ error: 'Mangler API-nokkel.' });
  if (!model || !ALL_MODELS.includes(model)) return res.status(400).json({ error: 'Ugyldig modell.' });

  const prompt = buildPrompt(audience);
  const isGoogle = GOOGLE_MODELS.includes(model);

  try {
    const raw = isGoogle
      ? await callGemini(apiKey, model, prompt, text)
      : await callOpenAI(apiKey, model, prompt, text);

    const result = JSON.parse(raw);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);

    if (err.status === 401 || err.code === 401 || (err.message && err.message.includes('API key'))) {
      return res.status(401).json({ error: 'Ugyldig API-nokkel. Sjekk at nokkelen er riktig.' });
    }
    if (err.status === 429 || err.code === 429) {
      return res.status(429).json({ error: 'API-kvote overskredet. Prov igjen senere.' });
    }
    res.status(500).json({ error: 'Noe gikk galt under generering. Prov igjen.' });
  }
}

module.exports = { validateFile, buildPrompt };
module.exports.default = handler;
