const { validateFile } = require('../generate');
const { buildPrompt } = require('../generate');

describe('validateFile', () => {
  test('godtar pdf', () => {
    expect(validateFile('application/pdf', 1024)).toBe(null);
  });

  test('godtar docx', () => {
    expect(validateFile(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      1024
    )).toBe(null);
  });

  test('avviser ugyldig type', () => {
    expect(validateFile('image/png', 1024)).toMatch(/filtype/i);
  });

  test('avviser for stor fil', () => {
    expect(validateFile('application/pdf', 21 * 1024 * 1024)).toMatch(/stor/i);
  });
});

describe('buildPrompt', () => {
  test('inkluderer JSON-instruksjon', () => {
    expect(buildPrompt()).toMatch(/JSON/);
  });

  test('spesifiserer alle fire seksjoner', () => {
    const prompt = buildPrompt();
    ['sammendrag', 'qa', 'argumentasjon', 'kildekritikk']
      .forEach(key => expect(prompt).toMatch(key));
  });

  test('inneholder ikke flashcards', () => {
    const prompt = buildPrompt();
    expect(prompt).not.toMatch(/"flashcards"/);
  });

  test('inneholder ikke ordforklaring eller tverrfaglig', () => {
    const prompt = buildPrompt();
    expect(prompt).not.toMatch(/"ordforklaring"/);
    expect(prompt).not.toMatch(/"tverrfaglig"/);
  });

  test('inneholder ingen elevtilpasning', () => {
    const prompt = buildPrompt();
    expect(prompt).not.toMatch(/elev på 13 år/);
  });

  test('kildekritikk inkluderer kildevurdering, metodekritikk, samlet_kilde, pastandsanalyse, perspektiv og samlet_innhold', () => {
    const prompt = buildPrompt();
    expect(prompt).toMatch(/kildevurdering/);
    expect(prompt).toMatch(/metodekritikk/i);
    expect(prompt).toMatch(/samlet_kilde/);
    expect(prompt).toMatch(/pastandsanalyse/);
    expect(prompt).toMatch(/perspektiv/);
    expect(prompt).toMatch(/samlet_innhold/);
    expect(prompt).not.toMatch(/"argumentasjonskritikk"/);
  });

  test('samlet vurdering inkluderer styrke-indikator for både kilde og innhold', () => {
    const prompt = buildPrompt();
    const matches = prompt.match(/sterk\|middels\|svak/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(2);
  });

  test('prompt inneholder instruksjoner for påstandsanalyse og perspektiv', () => {
    const prompt = buildPrompt();
    expect(prompt).toMatch(/påstandsanalyse/i);
    expect(prompt).toMatch(/perspektiv/i);
    expect(prompt).toMatch(/konsensus/i);
    expect(prompt).toMatch(/bias/i);
  });
});
