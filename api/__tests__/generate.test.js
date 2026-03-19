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

  test('spesifiserer alle seks seksjoner', () => {
    const prompt = buildPrompt();
    ['flashcards', 'sammendrag', 'qa', 'utfordring', 'nokkelBegreper', 'strategi']
      .forEach(key => expect(prompt).toMatch(key));
  });
});
