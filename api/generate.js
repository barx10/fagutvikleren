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
    ? '\nMålgruppen er en elev på 13 år. Bruk enkelt språk, korte setninger, og forklar vanskelige begreper.\n'
    : '';

  return `Du er en pedagogisk assistent. Analyser fagstoffet og generer et strukturert læringsverktøy på norsk.
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
  "utfordring": [
    { "sporsmal": "Testspørsmål", "svar": "Fasitsvar" }
  ],
  "nokkelBegreper": [
    { "begrep": "Begrep", "forklaring": "Forklaring", "sammenheng": "Sammenheng med andre begreper" }
  ],
  "sammenligning": [
    { "tema": "Begrep fra fagstoffet", "sammenlignetMed": "Noe fra et annet felt/verden", "forklaring": "Hvordan de ligner/skiller seg" }
  ]
}

Generer minimum: 15 flashcards, 3-5 sammendrag-temaer (3-6 punkter hver), 10 Q&A-par, 10 utfordringsspørsmål, 8-12 nøkkelbegreper, 6-10 sammenligninger.`;
}

async function callGemini(apiKey, model, prompt, mimeType, data, text) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const contents = mimeType === 'application/pdf'
    ? [{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data } }]
    : [{ text: prompt + '\n\nFagstoff:\n' + text }];

  const response = await ai.models.generateContent({ model, contents });
  return (response.text ?? '').trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
}

async function callOpenAI(apiKey, model, prompt, mimeType, data, text) {
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey });

  const userContent = mimeType === 'application/pdf'
    ? [
        { type: 'text', text: 'Analyser dette fagstoffet.' },
        { type: 'image_url', image_url: { url: 'data:application/pdf;base64,' + data } },
      ]
    : [{ type: 'text', text: 'Fagstoff:\n' + text }];

  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userContent },
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

  const { mimeType, size, data, text, apiKey, model, audience } = req.body;

  const validationError = validateFile(mimeType, size);
  if (validationError) return res.status(400).json({ error: validationError });

  if (!apiKey) return res.status(400).json({ error: 'Mangler API-nokkel.' });
  if (!model || !ALL_MODELS.includes(model)) return res.status(400).json({ error: 'Ugyldig modell.' });

  const prompt = buildPrompt(audience);
  const isGoogle = GOOGLE_MODELS.includes(model);

  try {
    const raw = isGoogle
      ? await callGemini(apiKey, model, prompt, mimeType, data, text)
      : await callOpenAI(apiKey, model, prompt, mimeType, data, text);

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
