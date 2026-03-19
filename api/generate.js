const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_BYTES = 20 * 1024 * 1024;

function validateFile(mimeType, size) {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return 'Ugyldig filtype. Last opp PDF eller DOCX.';
  }
  if (size > MAX_BYTES) {
    return 'Filen er for stor. Maks 20MB.';
  }
  return null;
}

function buildPrompt() {
  return `Du er en pedagogisk assistent. Analyser fagstoffet og generer et strukturert læringsverktøy på norsk.

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
  "strategi": {
    "posisjonering": ["Faglig posisjonering"],
    "tips": ["Konkret tips for muntlig framføring"],
    "formuleringer": ["Forberedt formulering"]
  }
}

Generer minimum: 15 flashcards, 3-5 sammendrag-temaer (3-6 punkter hver), 10 Q&A-par, 10 utfordringsspørsmål, 8-12 nøkkelbegreper, 3 posisjoneringspunkter, 4-6 tips, 5-8 formuleringer.`;
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mimeType, size, data, text } = req.body;

  const validationError = validateFile(mimeType, size);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const contents = mimeType === 'application/pdf'
      ? [{ text: buildPrompt() }, { inlineData: { mimeType: 'application/pdf', data } }]
      : [{ text: buildPrompt() + '\n\nFagstoff:\n' + text }];

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents,
    });

    const raw = response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const result = JSON.parse(raw);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Noe gikk galt under generering. Prøv igjen.' });
  }
}

module.exports = { validateFile, buildPrompt };
module.exports.default = handler;
