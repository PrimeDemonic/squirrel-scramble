/**
 * Unit tests for the sound control's pure parts (Chaos v2 contract § 9 "Control"): the M shortcut
 * (components/audio/sound-shortcut.js) and the toggle's literal translation catalogue
 * (components/audio/sound-labels.js).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isSoundShortcut} from '../components/audio/sound-shortcut.js';
import {buildSoundLabels} from '../components/audio/sound-labels.js';

/**
 * @description A keydown-like object.
 * @param {Object} fields - Overrides (key, code, modifiers, the event path).
 * @returns {Object} The event.
 * @since 1.0.0
 */
function keydown(fields) {
  const path = fields.path || [{tagName: 'BODY'}];
  return {
    key: 'm',
    code: 'KeyM',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    ...fields,
    composedPath: () => path
  };
}

test('M and Shift+M toggle the sound', () => {
  assert.equal(isSoundShortcut(keydown({})), true);
  assert.equal(isSoundShortcut(keydown({key: 'M', shiftKey: true})), true);
});

test('modifiers, repeats, handled keys and other keys do not', () => {
  assert.equal(isSoundShortcut(keydown({ctrlKey: true})), false);
  assert.equal(isSoundShortcut(keydown({metaKey: true})), false);
  assert.equal(isSoundShortcut(keydown({altKey: true})), false);
  assert.equal(isSoundShortcut(keydown({repeat: true})), false);
  assert.equal(isSoundShortcut(keydown({defaultPrevented: true})), false);
  assert.equal(isSoundShortcut(keydown({key: 'n', code: 'KeyN'})), false);
  assert.equal(isSoundShortcut(keydown({key: ' ', code: 'Space'})), false);
  assert.equal(isSoundShortcut(null), false);
  assert.equal(isSoundShortcut({}), false);
});

test('typing an M in a field is a letter, not the shortcut', () => {
  const typingPaths = [
    [{tagName: 'TEXTAREA'}],
    [{tagName: 'INPUT', type: 'text'}],
    [{tagName: 'INPUT', type: 'search'}],
    [{tagName: 'INPUT'}],
    [{tagName: 'SELECT'}],
    [{tagName: 'DIV', isContentEditable: true}],
    [{tagName: 'SPAN'}, {tagName: 'SS-SETUP'}, {tagName: 'TEXTAREA'}]
  ];
  typingPaths.forEach((path) => {
    assert.equal(isSoundShortcut(keydown({path})), false, JSON.stringify(path));
  });
});

test('focus on a radio, a checkbox or a button still allows the shortcut', () => {
  ['radio', 'checkbox', 'button'].forEach((type) => {
    assert.equal(isSoundShortcut(keydown({path: [{tagName: 'INPUT', type}]})), true, type);
  });
  assert.equal(isSoundShortcut(keydown({path: [{tagName: 'BUTTON'}]})), true);
});

test('on a non-Latin layout the physical M key counts', () => {
  assert.equal(isSoundShortcut(keydown({key: 'ь', code: 'KeyM'})), true);
  assert.equal(isSoundShortcut(keydown({key: 'ь', code: 'KeyX'})), false);
  assert.equal(isSoundShortcut(keydown({key: ',', code: 'KeyM'})), false, 'punctuation never');
  assert.equal(isSoundShortcut(keydown({key: 'q', code: 'KeyM'})), false, 'a Latin letter wins');
});

test('without composedPath the target is checked', () => {
  const event = {key: 'm', target: {tagName: 'TEXTAREA'}};
  assert.equal(isSoundShortcut(event), false);
  assert.equal(isSoundShortcut({key: 'm', target: {tagName: 'BODY'}}), true);
});

test('the sound labels are literal catalogue entries in UK English', () => {
  const seen = [];
  const labels = buildSoundLabels({
    getMessage: (message) => {
      seen.push(message);
      return message;
    }
  });
  assert.deepEqual(labels, {
    sound: 'Sound',
    soundOn: 'Sound is on',
    soundOff: 'Sound is off',
    shortcut: 'Press M to turn the sound on or off.'
  });
  assert.equal(seen.length, 4);
  assert.equal(buildSoundLabels({getMessage: () => 'x'}).sound, 'x');
});
