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

  test('spesifiserer alle fem seksjoner', () => {
    const prompt = buildPrompt();
    ['flashcards', 'sammendrag', 'qa', 'argumentasjon', 'kildekritikk']
      .forEach(key => expect(prompt).toMatch(key));
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

  test('kildekritikk inkluderer kildevurdering, metodekritikk, argumentasjonskritikk og samlet', () => {
    const prompt = buildPrompt();
    expect(prompt).toMatch(/kildevurdering/);
    expect(prompt).toMatch(/metodekritikk/i);
    expect(prompt).toMatch(/argumentasjonskritikk/);
    expect(prompt).toMatch(/samlet/);
  });

  test('samlet vurdering inkluderer styrke-indikator', () => {
    const prompt = buildPrompt();
    expect(prompt).toMatch(/sterk\|middels\|svak/);
  });
});
