/**
 * Unit tests for lib/names.js (SPEC.md § 7 draw step 2, § 8 setup view, § 14 M5).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanName, parseNames, truncateLabel} from '../lib/names.js';

test('commas, semicolons and newlines all split names (M5)', () => {
  const parsed = parseNames('Alex, Sam\nJo; Priya');
  assert.deepEqual(parsed.names, ['Alex', 'Sam', 'Jo', 'Priya']);
  assert.equal(parsed.valid, true);
});

test('"Sam" and "sam " are duplicates, listed once by the first spelling (M2, M5)', () => {
  const parsed = parseNames('Sam\nsam \nAlex\nSAM');
  assert.deepEqual(parsed.problems.duplicates, ['Sam']);
  assert.equal(parsed.valid, false);
});

test('markup is just text here (M5)', () => {
  const name = '<img src=x onerror=alert(1)>';
  const parsed = parseNames(name);
  assert.deepEqual(parsed.names, [name]);
  assert.equal(parsed.valid, true);
});

test('cleaning trims, collapses whitespace and strips control characters', () => {
  assert.equal(cleanName('  Jo \t  Bloggs '), 'Jo Bloggs');
  assert.equal(cleanName('A\u0007lex'), 'Alex');
  assert.equal(cleanName('Jo \u0001 Bloggs'), 'Jo Bloggs');
  assert.equal(cleanName(' Priya '), 'Priya');
  assert.equal(cleanName(undefined), '');
  // A cleaned name cleans to itself, so the server stores exactly what the marshal sees.
  ['Jo Bloggs', 'Alex', 'Ünal Çelik'].forEach((name) => assert.equal(cleanName(name), name));
});

test('blank entries are dropped and an empty box is not valid', () => {
  const parsed = parseNames(' ,\n;\n  ,Alex,, ');
  assert.deepEqual(parsed.names, ['Alex']);
  const empty = parseNames('  \n ; ');
  assert.equal(empty.problems.noNames, true);
  assert.equal(empty.valid, false);
});

test('names over 40 characters are problems', () => {
  const longName = 'A'.repeat(41);
  const parsed = parseNames(`${longName}\n${'B'.repeat(40)}`);
  assert.deepEqual(parsed.problems.tooLong, [longName]);
  assert.equal(parsed.valid, false);
});

test('more names than the cap is a problem', () => {
  const fifty = Array.from({length: 50}, (_value, index) => `Racer ${index}`).join('\n');
  assert.equal(parseNames(fifty).problems.overCap, false);
  assert.equal(parseNames(`${fifty}\nOne more`).problems.overCap, true);
  assert.equal(parseNames('Alex, Sam, Jo', 2).problems.overCap, true);
});

test('truncateLabel keeps 14 characters, ellipsis included', () => {
  assert.equal(truncateLabel('Priya'), 'Priya');
  assert.equal(truncateLabel('Fourteen chars'), 'Fourteen chars');
  const short = truncateLabel('Bartholomew Fitzwilliam');
  assert.equal(short, 'Bartholomew F…');
  assert.equal(Array.from(short).length, 14);
  assert.equal(truncateLabel('Alexandra Jo Smith', 10), 'Alexandra…');
  assert.equal(Array.from(truncateLabel('🐿️🐿️🐿️🐿️🐿️🐿️🐿️🐿️', 5)).length <= 5, true);
});
