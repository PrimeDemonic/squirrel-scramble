/**
 * Static checks on lib/: the pure modules must run under plain Node and stay deterministic
 * (SPEC.md § 9, § 11.1, § 20). Only api.js may import from the platform, and only rng.js may ask
 * for fresh entropy.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';

const LIB_DIRECTORY = new URL('../lib/', import.meta.url);
const files = readdirSync(LIB_DIRECTORY).filter((file) => file.endsWith('.js'));

/**
 * @description A lib file's source.
 * @param {string} file - The file name.
 * @returns {string} The source.
 */
function sourceOf(file) {
  return readFileSync(new URL(file, LIB_DIRECTORY), 'utf8');
}

const FORBIDDEN_EVERYWHERE = [
  {pattern: /Math\.random/, reason: 'unseeded randomness'},
  {pattern: /\bwindow\.[A-Za-z_]/, reason: 'the browser window'},
  {pattern: /\bdocument\.[A-Za-z_]/, reason: 'the DOM'},
  {pattern: /\blocalStorage\b|\bsessionStorage\b/, reason: 'browser storage'},
  {pattern: /Date\.now\(|new Date\(|performance\.now\(/, reason: 'the clock (time is an input)'},
  {pattern: /\beval\(|new Function\(/, reason: 'eval or the Function constructor'},
  {pattern: /from 'lit/, reason: 'Lit'}
];

test('lib/ holds the expected modules', () => {
  const expected = ['api.js', 'chaos.js', 'chaos-events.js', 'chaos-late.js', 'chaos-tornado.js',
    'choreography.js', 'climb.js', 'commentary.js', 'names.js', 'outfits.js', 'race-builder.js',
    'rng.js', 'simulate.js', 'theme-config.js'];
  expected.forEach((file) => assert.ok(files.includes(file), file));
});

test('no lib module uses randomness, the DOM, the clock, eval or Lit', () => {
  files.forEach((file) => {
    const source = sourceOf(file);
    FORBIDDEN_EVERYWHERE.forEach(({pattern, reason}) => {
      assert.ok(!pattern.test(source), `${file} uses ${reason}`);
    });
  });
});

test('only api.js imports the platform; the rest import relative modules only', () => {
  files.forEach((file) => {
    const source = sourceOf(file);
    // Every "from '...';" counts, so a multi-line import is checked too.
    const imports = [...source.matchAll(/\bfrom '([^']+)';/g)];
    const specifiers = imports.map((match) => match[1]);
    specifiers.forEach((specifier) => {
      const allowed = specifier.startsWith('./')
        || (file === 'api.js' && specifier === '@servicenow/aiux/aiux-components-core');
      assert.ok(allowed, `${file} imports ${specifier}`);
    });
  });
});

test('only rng.js asks for fresh entropy', () => {
  files.forEach((file) => {
    const usesEntropy = /getRandomValues/.test(sourceOf(file));
    assert.equal(usesEntropy, file === 'rng.js', file);
  });
});
