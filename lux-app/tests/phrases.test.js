/**
 * Unit tests for components/phrases.js: the literal translation catalogue for the commentary
 * phrase bank (SPEC.md § 8 race view, § 12). The catalogue must cover every phrase key in
 * lib/theme-config.js and nothing else, and each literal must still read exactly like its theme
 * text, so a phrase edited in one place and not the other fails here.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {themeConfig} from '../lib/theme-config.js';
import {
  PHRASE_CATALOGUE,
  fillPlaceholders,
  translateCue,
  phraseText,
  translatePhrase
} from '../components/phrases.js';

/**
 * @description Every phrase in the theme, both banks, flattened.
 * @returns {Array<{key: string, text: string}>} The phrases.
 */
function themePhrases() {
  return Object.values(themeConfig.phrases)
    .flatMap((bank) => Object.values(bank))
    .flat();
}

/**
 * @description An i18n stub that records the literal and the values it was given.
 * @returns {{getMessage: function(string, Object): {message: string, values: Object}}} The stub.
 */
function recordingI18n() {
  return {getMessage: (message, values) => ({message, values})};
}

/**
 * @description An i18n stub that fills named placeholders the way the AIUX service does.
 * @returns {{getMessage: function(string, Object): string}} The stub.
 */
function fillingI18n() {
  return {getMessage: (message, values) => fillPlaceholders(message, values)};
}

test('the catalogue covers every theme phrase key and nothing else', () => {
  const themeKeys = themePhrases().map((phrase) => phrase.key).sort();
  const catalogueKeys = Object.keys(PHRASE_CATALOGUE).sort();
  assert.deepEqual(catalogueKeys, themeKeys);
});

test('each catalogue literal is its theme text, word for word', () => {
  const stub = recordingI18n();
  themePhrases().forEach((phrase) => {
    const values = {name: 'Alex', other: 'Sam'};
    const result = PHRASE_CATALOGUE[phrase.key](stub, values);
    assert.equal(result.message, phrase.text, phrase.key);
    assert.deepEqual(result.values, values, phrase.key);
  });
});

test('every catalogue entry is a function', () => {
  Object.entries(PHRASE_CATALOGUE).forEach(([key, entry]) => {
    assert.equal(typeof entry, 'function', key);
  });
});

test('translateCue fills both names from the cue', () => {
  const cue = {
    templateKey: 'classic_neck_1',
    template: '{name} and {other} are neck and neck.',
    params: {name: 'Alex', other: 'Sam'}
  };
  assert.equal(translateCue(fillingI18n(), cue), 'Alex and Sam are neck and neck.');
});

test('translateCue falls back to the theme text for an unknown key', () => {
  const cue = {
    templateKey: 'not_in_the_catalogue',
    template: '{name} waves.',
    params: {name: 'Jo'}
  };
  assert.equal(translateCue(fillingI18n(), cue), 'Jo waves.');
});

test('translateCue copes with a missing cue or service', () => {
  assert.equal(translateCue(fillingI18n(), null), '');
  const cue = {templateKey: 'classic_lead_1', template: '{name} takes the lead!', params: {}};
  assert.equal(translateCue(null, cue), '{name} takes the lead!');
});

test('phraseText finds every theme phrase by key, and nothing for an unknown key', () => {
  themePhrases().forEach((phrase) => {
    assert.equal(phraseText(themeConfig.phrases, phrase.key), phrase.text, phrase.key);
  });
  assert.equal(phraseText(themeConfig.phrases, 'not_a_phrase'), '');
  assert.equal(phraseText(null, 'classic_lead_1'), '');
});

test('translatePhrase translates a key, and an unknown key to nothing', () => {
  const first = themePhrases()[0];
  assert.equal(translatePhrase(fillingI18n(), themeConfig.phrases, first.key), first.text);
  assert.equal(translatePhrase(fillingI18n(), themeConfig.phrases, 'not_a_phrase'), '');
  const bank = {extra: {verdicts: [{key: 'not_in_the_catalogue', text: 'Play on, {name}!'}]}};
  const line = translatePhrase(fillingI18n(), bank, 'not_in_the_catalogue', {name: 'Jo'});
  assert.equal(line, 'Play on, Jo!');
});

test('fillPlaceholders keeps names as text and never expands a name twice', () => {
  const name = '<img src=x onerror=alert(1)>';
  assert.equal(fillPlaceholders('{name} wins it!', {name}), `${name} wins it!`);
  const sneaky = fillPlaceholders('{name} pips {other}!', {name: '{other}', other: 'Sam'});
  assert.equal(sneaky, '{other} pips Sam!');
  assert.equal(fillPlaceholders('{unknown} stays', {name: 'Alex'}), '{unknown} stays');
});
