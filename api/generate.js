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

function buildPrompt() {
  return `Du er en fagperson med bred og dyp kunnskap, og du leser akademisk litteratur med et kritisk blikk. Analyser fagstoffet og generer et strukturert læringsverktøy på norsk.

Viktig: Vær akademisk kritisk gjennom hele analysen. Ikke gjengi forfatternes konklusjoner ukritisk. Identifiser metodologiske svakheter, konfounders, begrensninger i utvalg og generaliserbarhet. Skille mellom hva evidensen faktisk viser og hva forfatterne hevder. Påpek hva studien IKKE viser.

Returner KUN gyldig JSON uten markdown-formatering eller forklaringer:
{
  "title": "Fagstoff-tittel på norsk",
  "subject": "Fag/emne",
  "originalTitle": "Originaltittel på kildens språk (hvis annet enn norsk, ellers samme som title)",
  "authors": "Forfatter(e) hvis nevnt i teksten, ellers tom streng",
  "published": "Publiseringsår eller dato hvis nevnt, ellers tom streng",
  "flashcards": [
    { "front": "Spørsmål eller begrep", "back": "Svar eller definisjon", "cat": "kjerne|fakta|begrep|eksempel" }
  ],
  "sammendrag": [
    { "tema": "Temaoverskrift", "punkter": ["Punkt 1", "Punkt 2"] }
  ],
  "qa": [
    { "sporsmal": "Kritisk eller utfordrende spørsmål", "svar": "Utdypende svar med nyanser", "hint": "Ledetråd" }
  ],
  "argumentasjon": [
    { "pastand": "Hovedpåstand fra fagstoffet", "argumenter": ["Argument 1", "Argument 2"], "evidens": "Fakta eller kildehenvisning som støtter", "motargumenter": ["Innvending 1 med begrunnelse", "Innvending 2 med begrunnelse"], "vurdering": "Kort akademisk vurdering av påstandens styrke og begrensninger" }
  ],
  "kildekritikk": {
    "kildevurdering": {
      "forfatter": "Vurdering av forfatterens autoritet, tilknytning og mulige interessekonflikter",
      "publiseringskanal": "Type publikasjon — fagfellevurdert tidsskrift, forlag, rapport, blogg osv.",
      "finansiering": "Hvem finansierte forskningen og mulige implikasjoner for objektivitet",
      "aktualitet": "Når publisert og om funnene fortsatt er relevante"
    },
    "metodekritikk": ["Konkret svakhet 1", "Konkret svakhet 2"],
    "argumentasjonskritikk": ["Konkret logisk feilslutning eller gap 1", "Konkret gap 2"],
    "samlet": {
      "styrke": "sterk|middels|svak",
      "vurdering": "Helhetlig kvalitativ vurdering av kildens troverdighet og akademiske kvalitet",
      "bruksomrade": "Hva denne kilden kan brukes til",
      "begrensninger": "Hva denne kilden IKKE kan brukes til"
    }
  }
}

For flashcards: inkluder også fagtermer og fremmedord fra teksten som cat "begrep" — forsiden er fagtermen, baksiden er kort definisjon. Trekk kun ut ord som ville kreve forklaring for en person utenfor fagfeltet.
For argumentasjon: identifiser ALLE sentrale påstander i teksten — en fagartikkel har alltid flere enn én. Presenter et balansert akademisk overblikk for hver. Hver påstand skal ha minst 2 motargumenter med begrunnelse — inkluder metodologisk kritikk (utvalg, design, konfounders, ekstern validitet), ikke bare alternative perspektiver. Vurderingen skal eksplisitt adressere evidensstyrke og hva som mangler for å trekke sikre konklusjoner. Det er KRITISK at du genererer minst 4 argumentasjoner — aldri bare 1.
For sammendrag: presenter 3-5 temaer med nøkkelpunkter. IKKE inkluder metodekritikk her — det dekkes av kildekritikk-seksjonen.
For Q&A: minst 3 av spørsmålene skal utfordre premissene i teksten (f.eks. «Er det rimelig å konkludere X basert på dette designet?»), ikke bare be om gjengivelse av funn.
For kildekritikk: vær spesifikk og konkret i alle vurderinger. Metodekritikk skal adressere forskningsdesign, utvalg, operasjonalisering, konfounders og generaliserbarhet. Argumentasjonskritikk skal identifisere konkrete logiske feilslutninger, gap mellom evidens og konklusjon, og utelatte perspektiver. Samlet styrke skal være «sterk» kun for fagfellevurderte studier med solid design, «middels» for studier med noen svakheter, «svak» for studier med vesentlige metodologiske problemer. Generer minst 3 punkter for metodekritikk og minst 2 for argumentasjonskritikk.

Minimumskrav (ALLE må oppfylles, ingen unntak):
- 15 flashcards fordelt på alle fire kategorier (kjerne, fakta, begrep, eksempel — minst 2 av hver)
- 3-5 sammendrag-temaer (3-6 punkter hver)
- 10 Q&A-par (ALDRI færre enn 10, minst 3 kritiske)
- 4-6 argumentasjoner (ALDRI færre enn 4)
- Komplett kildekritikk med alle fire deler utfylt`;
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

  const { mimeType, size, text, apiKey, model } = req.body;

  if (mimeType) {
    const validationError = validateFile(mimeType, size);
    if (validationError) return res.status(400).json({ error: validationError });
  }

  if (!text || !text.trim()) return res.status(400).json({ error: 'Ingen tekst mottatt.' });
  if (!apiKey) return res.status(400).json({ error: 'Mangler API-nokkel.' });
  if (!model || !ALL_MODELS.includes(model)) return res.status(400).json({ error: 'Ugyldig modell.' });

  const prompt = buildPrompt();
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
