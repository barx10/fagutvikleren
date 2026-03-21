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
  "ordforklaring": [
    { "ord": "Fremmedord eller fagterm fra teksten", "forklaring": "Kort, presis definisjon", "eksempel": "Ordet brukt i en setning fra fagstoffet" }
  ],
  "tverrfaglig": [
    { "begrep": "Begrep fra fagstoffet", "fagfelt": "Konkret navngitt fagfelt", "parallell": "Utdypende beskrivelse av tilsvarende fenomen i det andre fagfeltet (2-3 setninger)", "innsikt": "Hva du lærer av å se det gjennom denne linsen" }
  ]
}

Trekk kun ut ord som ville kreve forklaring for en person utenfor fagfeltet. Inkluder ikke allmenne norske ord (f.eks. «kontekstuelt», «syntese»). Hvis teksten ikke inneholder spesialiserte fagtermer, returner en tom liste.
Koble sentrale begreper til konkrete paralleller i andre navngitte fagfelt for tverrfaglig. Beskriv parallellen utdypende (2-3 setninger), ikke bare med et stikkord.
For argumentasjon: identifiser ALLE sentrale påstander i teksten — en fagartikkel har alltid flere enn én. Presenter et balansert akademisk overblikk for hver. Hver påstand skal ha minst 2 motargumenter med begrunnelse — inkluder metodologisk kritikk (utvalg, design, konfounders, ekstern validitet), ikke bare alternative perspektiver. Vurderingen skal eksplisitt adressere evidensstyrke og hva som mangler for å trekke sikre konklusjoner. Det er KRITISK at du genererer minst 4 argumentasjoner — aldri bare 1.
For sammendrag: siste tema skal alltid være «Metodekritikk» med konkrete svakheter i studiens design, utvalg, operasjonalisering og generaliserbarhet. Vær spesifikk — ikke skriv «studien har begrensninger», men hvilke og hvorfor de betyr noe.
For Q&A: minst 3 av spørsmålene skal utfordre premissene i teksten (f.eks. «Er det rimelig å konkludere X basert på dette designet?»), ikke bare be om gjengivelse av funn.

Minimumskrav (ALLE må oppfylles, ingen unntak):
- 15 flashcards fordelt på alle fire kategorier (kjerne, fakta, begrep, eksempel — minst 2 av hver)
- 3-5 sammendrag-temaer pluss metodekritikk (3-6 punkter hver)
- 10 Q&A-par (ALDRI færre enn 10, minst 3 kritiske)
- 4-6 argumentasjoner (ALDRI færre enn 4)
- 6-15 ordforklaringer
- 5-8 tverrfaglige koblinger`;
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
