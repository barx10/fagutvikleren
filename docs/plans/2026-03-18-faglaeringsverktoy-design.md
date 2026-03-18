# Design: Faglæringsverktøy med Gemini AI

**Dato:** 2026-03-18
**Status:** Godkjent

## Oversikt

Et verktøy der elever laster opp fagstoff (PDF eller DOCX) og får det differensiert til et interaktivt HTML-læringsverktøy. Fokus er helhetlig fagforståelse, ikke kun forberedelse til muntlig aktivitet — men med en egen strategifane for muntlig framføring.

## Arkitektur

**Tilnærming:** Single-page app med Vercel API-route (Tilnærming A)

```
frontend (index.html)
    └── POST fil/tekst
            ↓
/api/generate (Vercel serverless, Node.js)
    └── Gemini 3.1 Flash-Lite Preview API
            ↓
    Strukturert JSON
            ↓
frontend renderer faner + tilbyr nedlasting
```

**Modell:** `gemini-3.1-flash-lite-preview`
**Hosting:** Vercel (API-nøkkel som miljøvariabel, skjult for klient)

## Filstruktur

```
/
├── index.html          # Opplasting + resultatvisning (én fil, to tilstander)
├── api/
│   └── generate.js     # Vercel serverless funksjon
├── package.json
└── vercel.json
```

## Filhåndtering

| Format | Behandling |
|--------|-----------|
| PDF | Sendes som base64 inline til Gemini (støttes nativt) |
| DOCX | Tekst ekstraheres med mammoth.js klient-side, sendes som tekst |

Maksstørrelse: 20MB (Gemini-grense).

## Faner

| Fane | Innhold generert av Gemini |
|------|---------------------------|
| Flashcards | Begreper, definisjoner og nøkkelsetninger |
| Sammendrag | Strukturerte hovedpunkter per tema |
| Spørsmål & Svar | Forståelsesspørsmål med utdypende svar |
| Utfordring | Selvstest med 60-sekunders nedtellingstimer |
| Nøkkelbegreper | Sentrale begreper med forklaring og sammenhenger |
| Strategi | Tips for muntlig framføring basert på fagstoffet |

## Gemini-prompt

Én systemforespørsel returnerer all data som én JSON-struktur med seks seksjoner. Frontend mapper JSON direkte til fanene uten ekstra API-kall.

## UI/UX

**To tilstander i samme fil:**

1. **Upload-tilstand:** Sentrert kort med drag-and-drop sone, filnavn ved valg, "Generer"-knapp, spinner under generering.
2. **Resultat-tilstand:** Navigasjonsbar med faner, header med tittel og "Last ned HTML" + "Start på nytt"-knapper.

**Design:** Samme fargepalett og typografi som `debattforberedelse.html`:
- Farger: `--cream`, `--dg`, `--mg`, `--lg`, `--gold`
- Fonter: Playfair Display (serif/overskrifter) + Outfit (brødtekst)

## Feilhåndtering

- For stor fil (>20MB): Feilmelding klient-side før sending
- Ugyldig filtype: Klient-side validering
- Gemini API-feil: Lesbar feilmelding, fil beholdes for nytt forsøk
- Ugyldig JSON-respons: Fallback feilmelding

## Sikkerhet

- API-nøkkel kun på Vercel-server (miljøvariabel `GEMINI_API_KEY`)
- Ingen autentisering — verktøyet er åpent for alle elever
- Ingen lagring av opplastede filer (behandles i minnet)
