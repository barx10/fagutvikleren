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

Viktig om tidslinjer: Skille tydelig mellom tidsperioden kildematerialet dekker og den faktiske tidslinjen for hendelsene. Hvis en artikkel siterer dokumenter fra 2011-2014, betyr det IKKE at hendelsene kun fant sted i den perioden — det betyr bare at dokumentene dekker denne perioden. Ikke overforenkle tidsangivelser. Bruk formuleringer som «dokumentene dekker perioden...» eller «artikkelen belyser perioden...» fremfor «relasjonen varte fra X til Y» med mindre kilden eksplisitt fastslår dette.

Returner KUN gyldig JSON uten markdown-formatering eller forklaringer:
{
  "title": "Fagstoff-tittel på norsk",
  "subject": "Fag/emne",
  "originalTitle": "Originaltittel på kildens språk (hvis annet enn norsk, ellers samme som title)",
  "authors": "Forfatter(e) hvis nevnt i teksten, ellers tom streng",
  "published": "Publiseringsår eller dato hvis nevnt, ellers tom streng",
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
      "formål": "Tekstens formål og agenda — hvorfor ble den skrevet, hvem er målgruppen, og finnes det interessekonflikter eller finansieringskilder som kan påvirke innholdet",
      "aktualitet": "Når publisert og om funnene fortsatt er relevante"
    },
    "kildetype": {
      "type": "primærkilde|sekundærkilde",
      "sjanger": "Sjanger og form — fagfellevurdert artikkel, lærebok, kronikk, rapport, nyhetsartikkel osv.",
      "begrunnelse": "Kort begrunnelse for klassifiseringen"
    },
    "metodekritikk": ["Konkret svakhet 1", "Konkret svakhet 2"],
    "samlet_kilde": {
      "styrke": "sterk|middels|svak",
      "vurdering": "Helhetlig kvalitativ vurdering av kildens troverdighet og akademiske kvalitet",
      "bruksomrade": "Hva denne kilden kan brukes til",
      "begrensninger": "Hva denne kilden IKKE kan brukes til"
    },
    "pastandsanalyse": [
      {
        "pastand": "Nøkkelpåstand fra teksten",
        "underbygging": "Vurdering av om evidensen i teksten faktisk underbygger påstanden",
        "konsensus": "Hvordan påstanden står seg mot etablert forskning og konsensus i feltet"
      }
    ],
    "perspektiv": {
      "ramme": "Overordnet teoretisk eller ideologisk posisjon teksten opererer innenfor",
      "eksempler": ["Konkret eksempel på bias — ordvalg, framing eller kildeseleksjon"],
      "utelatt": ["Perspektiv eller vinkling som mangler i teksten"]
    },
    "sprak_og_virkemidler": {
      "tone": "Overordnet beskrivelse av tekstens tone — nøytral, engasjert, polemisk, akademisk osv.",
      "ladede_ord": ["Konkret eksempel på ladet ordvalg med forklaring av effekten"],
      "retoriske_grep": ["Konkret retorisk grep brukt i teksten — f.eks. appell til autoritet, følelsesappell, gjentakelse"]
    },
    "samlet_innhold": {
      "styrke": "sterk|middels|svak",
      "vurdering": "Kvalitativ helhetsvurdering av innholdets troverdighet og balanse"
    }
  }
}

For argumentasjon: identifiser ALLE sentrale påstander i teksten — en fagartikkel har alltid flere enn én. Presenter et balansert akademisk overblikk for hver. Hver påstand skal ha minst 2 motargumenter med begrunnelse — inkluder metodologisk kritikk (utvalg, design, konfounders, ekstern validitet), ikke bare alternative perspektiver. Vurderingen skal eksplisitt adressere evidensstyrke og hva som mangler for å trekke sikre konklusjoner. Det er KRITISK at du genererer minst 4 argumentasjoner — aldri bare 1.
For sammendrag: presenter 4-5 temaer med nøkkelpunkter (4-6 punkter per tema). Hvert punkt skal være substansielt og spesifikt — ikke generelle oppsummeringer. Inkluder konkrete detaljer, tall, navn og funn fra teksten. IKKE inkluder metodekritikk her — det dekkes av kildekritikk-seksjonen. Sammendraget skal gi leseren en grundig forståelse av innholdet uten å måtte lese originalteksten.
For Q&A: minst 3 av spørsmålene skal utfordre premissene i teksten (f.eks. «Er det rimelig å konkludere X basert på dette designet?»), ikke bare be om gjengivelse av funn.
For kildekritikk: vær spesifikk og konkret i alle vurderinger. Metodekritikk skal adressere forskningsdesign, utvalg, operasjonalisering, konfounders og generaliserbarhet. Samlet kilde-styrke skal være «sterk» kun for fagfellevurderte studier med solid design, «middels» for studier med noen svakheter, «svak» for studier med vesentlige metodologiske problemer. Generer minst 3 punkter for metodekritikk.
For påstandsanalyse: identifiser 2-4 nøkkelpåstander, vurder om evidensen i teksten faktisk underbygger dem (intern konsistens), og plasser dem mot etablert konsensus i feltet (ekstern validering).
For perspektiv og bias: beskriv først den overordnede teoretiske eller ideologiske rammen teksten opererer innenfor, gi deretter 2-3 konkrete eksempler på hvordan dette viser seg (ordvalg, kildeseleksjon, framing av resultater), og list 2-3 perspektiver som er utelatt.
Samlet innholdsvurdering: «sterk» kun dersom påstandene er godt underbygget internt OG i tråd med feltets konsensus, «middels» dersom noe er ubalansert eller mangelfullt underbygget, «svak» dersom vesentlige påstander mangler evidens eller strider mot konsensus.
For kildetype: klassifiser alltid som primær- eller sekundærkilde med begrunnelse. Angi sjanger presist — ikke bruk generiske termer som «artikkel» når du kan spesifisere «fagfellevurdert originalartikkel» eller «populærvitenskapelig kronikk».
For språk og virkemidler: beskriv tonen presist. Identifiser 2-3 konkrete ladede ord eller formuleringer med forklaring av effekten de har. Identifiser 2-3 retoriske grep med eksempler fra teksten.

Minimumskrav (ALLE må oppfylles, ingen unntak):
- 4-5 sammendrag-temaer (4-6 punkter hver, ALDRI færre enn 4 temaer)
- 10 Q&A-par (ALDRI færre enn 10, minst 3 kritiske)
- 4-6 argumentasjoner (ALDRI færre enn 4)
- Komplett kildekritikk med alle åtte deler utfylt (kildevurdering, kildetype, metodekritikk, samlet_kilde, pastandsanalyse, perspektiv, sprak_og_virkemidler, samlet_innhold)`;
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

function getAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  if (origin === 'https://fagdykk.vercel.app'
    || origin.endsWith('.vercel.app')
    || origin.startsWith('http://localhost')) return origin;
  return '';
}

async function handler(req, res) {
  var allowed = getAllowedOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', allowed);
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

  let raw;
  try {
    raw = isGoogle
      ? await callGemini(apiKey, model, prompt, text)
      : await callOpenAI(apiKey, model, prompt, text);
  } catch (err) {
    console.error('API call error:', err.status || err.code, err.message);

    if (err.status === 401 || err.code === 401 || (err.message && err.message.includes('API key'))) {
      return res.status(401).json({ error: 'Ugyldig API-nokkel. Sjekk at nokkelen er riktig.' });
    }
    if (err.status === 429 || err.code === 429) {
      return res.status(429).json({ error: 'API-kvote overskredet. Prov igjen senere.' });
    }
    return res.status(500).json({ error: 'Feil ved kontakt med AI-tjenesten: ' + (err.message || 'ukjent feil') });
  }

  try {
    const result = JSON.parse(raw);
    res.status(200).json(result);
  } catch (err) {
    console.error('JSON parse error. Raw response (first 500 chars):', raw ? raw.substring(0, 500) : 'empty');
    res.status(500).json({ error: 'AI-en returnerte ugyldig JSON. Prov igjen.' });
  }
}

module.exports = { validateFile, buildPrompt };
module.exports.default = handler;
