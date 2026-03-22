# Kildekritikk-utvidelse: Kildetype + Språk og virkemidler

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Utvide kildekritikk-fanen med to nye kort og et bredere formål-felt for å dekke klassisk kildekritikk bedre.

**Architecture:** Tre endringer: (1) utvide `finansiering`-feltet til `formål` i prompt og rendering, (2) nytt kort «Kildetype» i gruppe 1, (3) nytt kort «Språk og virkemidler» i gruppe 2. Alt er additivt — ingen eksisterende kort fjernes.

**Tech Stack:** Vanilla JS, Vercel serverless (Node.js)

---

### Task 1: Oppdater AI-prompten

**Files:**
- Modify: `api/generate.js:29-101`

**Step 1: Utvid kildevurdering-objektet**

Erstatt `finansiering`-feltet med `formål`:

```json
"kildevurdering": {
  "forfatter": "...",
  "publiseringskanal": "...",
  "formål": "Tekstens formål og agenda — hvorfor ble den skrevet, hvem er målgruppen, og finnes det interessekonflikter eller finansieringskilder som kan påvirke innholdet",
  "aktualitet": "..."
}
```

**Step 2: Legg til `kildetype` i kildekritikk-objektet**

Nytt felt rett etter `kildevurdering`:

```json
"kildetype": {
  "type": "primærkilde|sekundærkilde",
  "sjanger": "Sjanger og form — fagfellevurdert artikkel, lærebok, kronikk, rapport, nyhetsartikkel osv.",
  "begrunnelse": "Kort begrunnelse for klassifiseringen"
}
```

**Step 3: Legg til `sprak_og_virkemidler` i kildekritikk-objektet**

Nytt felt etter `perspektiv`:

```json
"sprak_og_virkemidler": {
  "tone": "Overordnet beskrivelse av tekstens tone — nøytral, engasjert, polemisk, akademisk osv.",
  "ladede_ord": ["Konkret eksempel på ladet ordvalg med forklaring av effekten"],
  "retoriske_grep": ["Konkret retorisk grep brukt i teksten — f.eks. appell til autoritet, følelsesappell, gjentakelse"]
}
```

**Step 4: Oppdater instruksjonsteksten i prompten**

Legg til etter eksisterende kildekritikk-instruksjoner:

```
For kildetype: klassifiser alltid som primær- eller sekundærkilde med begrunnelse. Angi sjanger presist — ikke bruk generiske termer som «artikkel» når du kan spesifisere «fagfellevurdert originalartikkel» eller «populærvitenskapelig kronikk».
For språk og virkemidler: beskriv tonen presist. Identifiser 2-3 konkrete ladede ord eller formuleringer med forklaring av effekten de har. Identifiser 2-3 retoriske grep med eksempler fra teksten.
```

**Step 5: Oppdater minimumskrav**

Endre siste punkt til:

```
- Komplett kildekritikk med alle åtte deler utfylt (kildevurdering, kildetype, metodekritikk, samlet_kilde, pastandsanalyse, perspektiv, sprak_og_virkemidler, samlet_innhold)
```

**Step 6: Kjør testene**

Run: `npm test`
Expected: Tester passerer (ingen test sjekker promptinnholdet for disse feltene spesifikt)

**Step 7: Commit**

```bash
git add api/generate.js
git commit -m "feat: utvid kildekritikk-prompt med kildetype, formål og språk/virkemidler"
```

---

### Task 2: Oppdater rendering — utvid kildevurdering-kortet

**Files:**
- Modify: `app.js` — `renderKildekritikk()`

**Step 1: Endre «Finansiering» til «Formål» i fields-arrayet**

I kildevurdering-kortet, endre:

```js
{ label: 'Finansiering', value: kv.finansiering },
```

til:

```js
{ label: 'Formål', value: kv.formål || kv.finansiering },
```

Fallback til `finansiering` for bakoverkompatibilitet med allerede genererte data.

**Step 2: Commit**

```bash
git add app.js
git commit -m "feat: endre finansiering til formål i kildevurdering-kortet"
```

---

### Task 3: Oppdater rendering — nytt «Kildetype»-kort

**Files:**
- Modify: `app.js` — `renderKildekritikk()`

**Step 1: Legg til kildetype-kort i grid1, etter kildevurdering-kortet**

Rett etter `grid1.appendChild(card)` for kildevurdering (linje ~593), legg til:

```js
// Kort: Kildetype
if (data.kildetype) {
  const ktCard = document.createElement('div');
  ktCard.className = 'begrep-card';
  const ktTitle = document.createElement('h3');
  ktTitle.className = 'begrep-title';
  ktTitle.textContent = 'Kildetype';
  ktCard.appendChild(ktTitle);

  var ktType = data.kildetype.type === 'primærkilde' ? 'Primærkilde' : 'Sekundærkilde';
  const ktBadge = document.createElement('div');
  ktBadge.className = 'kk-styrke kk-styrke--' + (data.kildetype.type === 'primærkilde' ? 'sterk' : 'middels');
  const ktDot = document.createElement('span');
  ktDot.className = 'kk-dot';
  const ktTxt = document.createElement('span');
  ktTxt.textContent = ktType;
  ktBadge.appendChild(ktDot);
  ktBadge.appendChild(ktTxt);
  ktCard.appendChild(ktBadge);

  if (data.kildetype.sjanger) {
    const sjRow = document.createElement('div');
    sjRow.className = 'kk-field';
    const sjLabel = document.createElement('span');
    sjLabel.className = 'kk-label';
    sjLabel.textContent = 'Sjanger: ';
    const sjVal = document.createElement('span');
    sjVal.textContent = data.kildetype.sjanger;
    sjRow.appendChild(sjLabel);
    sjRow.appendChild(sjVal);
    ktCard.appendChild(sjRow);
  }

  if (data.kildetype.begrunnelse) {
    const bgRow = document.createElement('div');
    bgRow.className = 'kk-field';
    const bgLabel = document.createElement('span');
    bgLabel.className = 'kk-label';
    bgLabel.textContent = 'Begrunnelse: ';
    const bgVal = document.createElement('span');
    bgVal.textContent = data.kildetype.begrunnelse;
    bgRow.appendChild(bgLabel);
    bgRow.appendChild(bgVal);
    ktCard.appendChild(bgRow);
  }

  grid1.appendChild(ktCard);
}
```

**Step 2: Commit**

```bash
git add app.js
git commit -m "feat: legg til kildetype-kort i kildekritikk"
```

---

### Task 4: Oppdater rendering — nytt «Språk og virkemidler»-kort

**Files:**
- Modify: `app.js` — `renderKildekritikk()`

**Step 1: Legg til språk-kort i grid2, etter perspektiv-kortet**

Rett etter `grid2.appendChild(card)` for perspektiv (linje ~730), legg til:

```js
// Kort: Språk og virkemidler
if (data.sprak_og_virkemidler) {
  const svCard = document.createElement('div');
  svCard.className = 'begrep-card';
  const svTitle = document.createElement('h3');
  svTitle.className = 'begrep-title';
  svTitle.textContent = 'Språk og virkemidler';
  svCard.appendChild(svTitle);

  if (data.sprak_og_virkemidler.tone) {
    const toneDiv = document.createElement('div');
    toneDiv.className = 'begrep-forklaring';
    toneDiv.textContent = data.sprak_og_virkemidler.tone;
    svCard.appendChild(toneDiv);
  }

  if (data.sprak_og_virkemidler.ladede_ord && data.sprak_og_virkemidler.ladede_ord.length) {
    const loLabel = document.createElement('div');
    loLabel.className = 'kk-list-label';
    loLabel.textContent = 'Ladede ord og formuleringer';
    svCard.appendChild(loLabel);
    const loUl = document.createElement('ul');
    loUl.className = 'arg-list';
    data.sprak_og_virkemidler.ladede_ord.forEach(function(lo) {
      const li = document.createElement('li');
      li.textContent = lo;
      loUl.appendChild(li);
    });
    svCard.appendChild(loUl);
  }

  if (data.sprak_og_virkemidler.retoriske_grep && data.sprak_og_virkemidler.retoriske_grep.length) {
    const rgLabel = document.createElement('div');
    rgLabel.className = 'kk-list-label';
    rgLabel.textContent = 'Retoriske grep';
    svCard.appendChild(rgLabel);
    const rgUl = document.createElement('ul');
    rgUl.className = 'arg-list';
    data.sprak_og_virkemidler.retoriske_grep.forEach(function(rg) {
      const li = document.createElement('li');
      li.textContent = rg;
      rgUl.appendChild(li);
    });
    svCard.appendChild(rgUl);
  }

  grid2.appendChild(svCard);
}
```

**Step 2: Commit**

```bash
git add app.js
git commit -m "feat: legg til språk og virkemidler-kort i kildekritikk"
```

---

### Task 5: Verifiser og kjør tester

**Step 1: Kjør testene**

Run: `npm test`
Expected: Alle tester passerer

**Step 2: Manuell verifisering**

Start dev-server og test med en faktisk tekst for å se at alle kort rendres korrekt.

Run: `npx vercel dev`

**Step 3: Commit eventuelle justeringer**

---

## Oppsummering av endringer

| Hva | Hvor | Endring |
|-----|------|---------|
| `finansiering` → `formål` | Prompt + rendering | Bredere felt som dekker formål, agenda og finansiering |
| Nytt kort: Kildetype | Gruppe 1 (Kilden) | Primær/sekundær + sjanger + begrunnelse |
| Nytt kort: Språk og virkemidler | Gruppe 2 (Innholdet) | Tone + ladede ord + retoriske grep |
