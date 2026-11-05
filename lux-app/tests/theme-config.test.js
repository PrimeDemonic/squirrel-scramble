/**
 * Unit tests for lib/theme-config.js: the phrase bank, the outfit catalogue, the palette and the
 * other data the SPEC asks the one theme object to hold (SPEC.md § 9, § 10, § 12).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {themeConfig} from '../lib/theme-config.js';
import {OUTFIT_ID_PATTERN} from '../lib/outfits.js';

const PLACEHOLDER = /\{([a-z]+)\}/g;

/**
 * @description Every phrase in one bank, flattened.
 * @param {Object} bank - A phrase bank section.
 * @returns {Array<{key: string, text: string}>} The phrases.
 */
function phrasesIn(bank) {
  return Object.values(bank).flat();
}

test('the phrase bank holds 25 to 30 Classic lines and at least the original 20 Chaos ones', () => {
  const classic = phrasesIn(themeConfig.phrases.classic);
  const chaos = phrasesIn(themeConfig.phrases.chaos);
  assert.ok(classic.length >= 25 && classic.length <= 30, `classic: ${classic.length}`);
  // Chaos v2 (contract § 4) adds lines for every new event and combo on top of SPEC.md § 12's.
  assert.ok(chaos.length >= 20, `chaos: ${chaos.length}`);
});

test('phrase keys are unique and placeholders are only {name} and {other}', () => {
  const all = phrasesIn(themeConfig.phrases.classic).concat(phrasesIn(themeConfig.phrases.chaos));
  assert.equal(new Set(all.map((phrase) => phrase.key)).size, all.length);
  all.forEach((phrase) => {
    assert.equal(typeof phrase.text, 'string');
    const names = [...phrase.text.matchAll(PLACEHOLDER)].map((match) => match[1]);
    names.forEach((name) => assert.ok(['name', 'other'].includes(name), phrase.key));
  });
});

test('every trigger the commentary uses has phrases', () => {
  const classicGroups = ['opening', 'solo', 'legendary', 'newLeader', 'neckAndNeck', 'nutStop',
    'slip', 'burst', 'finalStretch', 'winner', 'photoFinish'];
  const chaosGroups = ['opening', 'tornado', 'hunterHit', 'hunterMiss', 'suitorKiss',
    'suitorSlap', 'eagle', 'beaver', 'lightning', 'openingCarnage', 'sharknado', 'catLady',
    'goldenAcorn', 'leafBlower', 'ufo', 'earthquake', 'flood', 'disco', 'acornHail', 'var',
    'varVerdict', 'trenchCoat', 'woodpecker', 'hunterVsTornado', 'eagleIntoFunnel',
    'suitorSwept', 'catVsEagle', 'finale'];
  classicGroups.forEach((group) => assert.ok(themeConfig.phrases.classic[group].length > 0, group));
  chaosGroups.forEach((group) => assert.ok(themeConfig.phrases.chaos[group].length > 0, group));
});

test('copy is UK English', () => {
  const text = JSON.stringify(themeConfig).toLowerCase();
  ['color', 'favorite', 'gray', 'center', 'behavior', 'organization'].forEach((word) => {
    assert.ok(!text.includes(word), `found "${word}"`);
  });
});

test('outfit catalogue: four slots, every tier present, ids pass the server rule', () => {
  const {outfits} = themeConfig;
  assert.deepEqual(outfits.slotOrder, ['hat', 'cape', 'accessory', 'fur']);
  const weights = outfits.rarityOrder.map((rarity) => outfits.rarityWeights[rarity]);
  assert.deepEqual(weights, [80, 17, 3]);
  outfits.slotOrder.forEach((slot) => {
    const items = outfits.slots[slot];
    assert.equal(new Set(items.map((item) => item.id)).size, items.length, slot);
    outfits.rarityOrder.forEach((rarity) => {
      assert.ok(items.some((item) => item.rarity === rarity), `${slot} has no ${rarity}`);
    });
    items.forEach((item) => assert.match(item.id, OUTFIT_ID_PATTERN));
    assert.ok(items.some((item) => item.id === outfits.defaults[slot]), `${slot} default`);
  });
});

test('the SPEC catalogue is present with its rarities', () => {
  const itemOf = (slot, id) => themeConfig.outfits.slots[slot].find((item) => item.id === id);
  const hats = ['none', 'top_hat', 'crown', 'propeller', 'viking', 'wizard', 'cowboy', 'party',
    'chef', 'beanie', 'pirate', 'traffic_cone', 'halo'];
  hats.forEach((id) => assert.ok(itemOf('hat', id), id));
  assert.equal(itemOf('hat', 'halo').rarity, 'rare');
  assert.equal(itemOf('hat', 'crown').rarity, 'legendary');
  assert.equal(itemOf('fur', 'golden').rarity, 'rare');
  assert.equal(itemOf('fur', 'rainbow').rarity, 'legendary');
});

test('ten lane colours, each with its own bib pattern', () => {
  const palette = themeConfig.lanePalette;
  assert.equal(palette.length, 10);
  assert.equal(new Set(palette.map((entry) => entry.bibPattern)).size, 10);
  palette.forEach((entry) => {
    assert.match(entry.colour, /^#[0-9A-F]{6}$/);
    assert.match(entry.ink, /^#[0-9A-F]{6}$/);
    assert.ok(entry.bibShape);
  });
});

test('crowd, skies and timings are as the SPEC sets them', () => {
  const animals = themeConfig.crowd.animals.map((animal) => animal.id);
  assert.deepEqual(animals, ['hedgehog', 'rabbit', 'owl', 'badger', 'fox']);
  ['day', 'golden_hour', 'night', 'drizzle', 'storm'].forEach((sky) => {
    assert.ok(themeConfig.skies.presets[sky], sky);
  });
  // Chaos v2 contract § 14: one seeded pool for both modes, and the rainy skies say how it rains.
  assert.deepEqual(
    themeConfig.skies.seededChoices,
    ['day', 'day', 'golden_hour', 'night', 'drizzle', 'storm']
  );
  assert.equal(themeConfig.skies.chaos, undefined);
  const {drizzle, storm} = themeConfig.skies.presets;
  assert.equal(drizzle.top, '#8FA3B8');
  assert.equal(drizzle.bottom, '#D5DEE7');
  assert.ok(!drizzle.extras.includes('lightning_flashes'));
  assert.ok(drizzle.rain.density < storm.rain.density);
  assert.ok(drizzle.rain.speed < storm.rain.speed);
  assert.ok(drizzle.rain.opacity < storm.rain.opacity);
  [drizzle, storm].forEach((preset) => assert.match(preset.rain.colour, /^#[0-9A-F]{6}$/));
  const {timings} = themeConfig;
  assert.equal(timings.tickMs, 250);
  assert.equal(timings.handOffMs, 1500);
  assert.equal(timings.commentaryGapMs, 1500);
  assert.equal(timings.confettiMs, 4000);
  assert.deepEqual(themeConfig.race.lengths.classic.map((length) => length.seconds), [10, 20, 40]);
  assert.deepEqual(themeConfig.race.lengths.chaos.map((length) => length.seconds), [45, 60, 90]);
});

test('Chaos lengths are Short, Proper and Marathon (Chaos v2 contract § 1)', () => {
  const labels = themeConfig.race.lengths.chaos.map((length) => length.label);
  assert.deepEqual(labels, ['Short', 'Proper', 'Marathon']);
});

test('the three Chaos levels match the contract (§ 1)', () => {
  const {chaosLevels} = themeConfig;
  assert.deepEqual(chaosLevels.order, ['mild', 'silly', 'carnage']);
  assert.equal(chaosLevels.defaultLevel, 'silly');
  const expected = {
    mild: {label: 'Mild', maxOverlap: 2, maxStallPercent: 40},
    silly: {label: 'Silly', maxOverlap: 3, maxStallPercent: 45},
    carnage: {label: 'Absolute Carnage', maxOverlap: 5, maxStallPercent: 50}
  };
  Object.entries(expected).forEach(([levelId, wanted]) => {
    const level = chaosLevels.levels[levelId];
    assert.equal(level.label, wanted.label, levelId);
    assert.equal(level.maxOverlap, wanted.maxOverlap, levelId);
    assert.equal(level.maxStallPercent, wanted.maxStallPercent, levelId);
    assert.equal(typeof level.blurb, 'string');
  });
  assert.equal(chaosLevels.levels.mild.goldenAcornLeadUnits, 15);
  assert.equal(chaosLevels.levels.silly.goldenAcornLeadUnits, 15);
  assert.equal(chaosLevels.levels.carnage.goldenAcornLeadUnits, 10);
  assert.ok(chaosLevels.levels.carnage.finale, 'Absolute Carnage has a finale burst');
  assert.equal(chaosLevels.levels.silly.finale, null);
});

test('every level chance is a probability and every combo has a chance', () => {
  Object.values(themeConfig.chaosLevels.levels).forEach((level) => {
    const {deck} = level;
    const chances = Object.values(deck.chances).concat(Object.values(deck.combos),
      [deck.tornadoSecondChance, deck.sharkChance, deck.suitorChance, deck.trenchCoatChance]);
    chances.forEach((chance) => assert.ok(chance >= 0 && chance <= 1, `${level.label}: ${chance}`));
    assert.deepEqual(Object.keys(deck.combos).sort(),
      ['catVsEagle', 'eagleIntoFunnel', 'hunterVsTornado', 'suitorSwept']);
    assert.ok(deck.hunterCountWeights.some((weight) => weight > 0));
  });
});
