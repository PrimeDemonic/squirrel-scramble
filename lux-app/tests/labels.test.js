/**
 * Unit tests for components/labels.js: the literal translation catalogue must cover every outfit
 * item, sky, mode and race length in lib/theme-config.js, with the same English text, and must
 * hold nothing the theme has dropped (SPEC.md § 9, § 12).
 *
 * The catalogue takes the i18n service as a parameter, so a stub that returns the source string
 * stands in for it here and the English labels can be compared with the theme's.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {themeConfig} from '../lib/theme-config.js';
import {
  CHAOS_LEVEL_IDS,
  DEFAULT_CHAOS_LEVEL,
  buildLabels,
  labelFor,
  lengthLabel,
  normaliseChaosLevel,
  outfitItemLabel
} from '../components/labels.js';

// Returns the source string, as the real service does when no translation is loaded.
const sourceI18n = {getMessage: (message) => message};
const labels = buildLabels(sourceI18n);

/**
 * @description The keys of an object as a sorted list, for set comparisons.
 * @param {Object} source - Any object.
 * @returns {string[]} Its keys, sorted.
 */
function sortedKeys(source) {
  return Object.keys(source).sort();
}

test('every outfit item in the theme has a label with the theme’s English text', () => {
  themeConfig.outfits.slotOrder.forEach((slot) => {
    const slotLabels = labels.outfits[slot];
    assert.ok(slotLabels, `no labels for slot ${slot}`);
    themeConfig.outfits.slots[slot].forEach((item) => {
      assert.equal(slotLabels[item.id], item.label, `${slot}.${item.id}`);
    });
  });
});

test('the outfit labels hold no item the theme does not have', () => {
  assert.deepEqual(sortedKeys(labels.outfits), [...themeConfig.outfits.slotOrder].sort());
  themeConfig.outfits.slotOrder.forEach((slot) => {
    const themeIds = themeConfig.outfits.slots[slot].map((item) => item.id).sort();
    assert.deepEqual(sortedKeys(labels.outfits[slot]), themeIds, slot);
  });
});

test('every slot and rarity has a label', () => {
  themeConfig.outfits.slotOrder.forEach((slot) => {
    assert.equal(typeof labels.slots[slot], 'string', slot);
    assert.ok(labels.slots[slot].length > 0, slot);
  });
  themeConfig.outfits.rarityOrder.forEach((rarity) => {
    assert.equal(typeof labels.rarities[rarity], 'string', rarity);
    assert.ok(labels.rarities[rarity].length > 0, rarity);
  });
});

test('every sky preset has a label with the theme’s English text, and no more', () => {
  const presets = themeConfig.skies.presets;
  assert.deepEqual(sortedKeys(labels.skies), sortedKeys(presets));
  Object.entries(presets).forEach(([skyId, preset]) => {
    assert.equal(labels.skies[skyId], preset.label, skyId);
  });
});

test('every mode and race length in the theme has a label, and no more', () => {
  const lengths = themeConfig.race.lengths;
  assert.deepEqual(sortedKeys(labels.modes), sortedKeys(lengths));
  assert.deepEqual(sortedKeys(labels.lengths), sortedKeys(lengths));
  Object.entries(lengths).forEach(([mode, options]) => {
    const expectedSeconds = options.map((option) => String(option.seconds)).sort();
    assert.deepEqual(sortedKeys(labels.lengths[mode]), expectedSeconds, mode);
  });
});

test('Classic lengths keep the theme’s English text', () => {
  themeConfig.race.lengths.classic.forEach((option) => {
    assert.equal(labels.lengths.classic[option.seconds], option.label, `classic.${option.seconds}`);
  });
});

test('Chaos lengths are Short, Proper and Marathon (Chaos v2 contract § 1)', () => {
  // The contract wins over lib/theme-config.js, so the labels are checked against it directly.
  assert.deepEqual(labels.lengths.chaos, {45: 'Short', 60: 'Proper', 90: 'Marathon'});
});

test('Chaos levels have their contract labels and a description each', () => {
  assert.deepEqual([...CHAOS_LEVEL_IDS], ['mild', 'silly', 'carnage']);
  assert.ok(CHAOS_LEVEL_IDS.includes(DEFAULT_CHAOS_LEVEL));
  assert.equal(DEFAULT_CHAOS_LEVEL, 'silly');
  assert.deepEqual(labels.chaosLevels, {
    mild: 'Mild',
    silly: 'Silly',
    carnage: 'Absolute Carnage'
  });
  assert.deepEqual(labels.chaosLevelBlurbs, {
    mild: 'A few surprises',
    silly: 'Things get out of hand',
    carnage: 'Everything, all at once'
  });
});

test('normaliseChaosLevel keeps known levels and defaults the rest', () => {
  CHAOS_LEVEL_IDS.forEach((level) => assert.equal(normaliseChaosLevel(level), level));
  [null, undefined, '', 'turbo', 'MILD', 3].forEach((level) => {
    assert.equal(normaliseChaosLevel(level), 'silly', String(level));
  });
});

test('every label is a non-empty string', () => {
  const groups = [labels.slots, labels.rarities, labels.skies, labels.modes,
    labels.chaosLevels, labels.chaosLevelBlurbs]
    .concat(Object.values(labels.outfits), Object.values(labels.lengths));
  groups.forEach((group) => {
    Object.entries(group).forEach(([labelId, text]) => {
      assert.equal(typeof text, 'string', labelId);
      assert.ok(text.trim().length > 0, labelId);
    });
  });
});

test('the helpers fall back instead of returning undefined', () => {
  assert.equal(labelFor(labels.skies, 'storm', 'x'), 'Storm');
  assert.equal(labelFor(labels.skies, 'blizzard', 'blizzard'), 'blizzard');
  assert.equal(labelFor(undefined, 'storm', 'storm'), 'storm');
  assert.equal(outfitItemLabel(labels, 'hat', 'crown'), 'Crown');
  assert.equal(outfitItemLabel(labels, 'hat', 'fez'), 'fez');
  assert.equal(outfitItemLabel(labels, 'tail', 'fluffy'), 'fluffy');
  assert.equal(lengthLabel(labels, 'chaos', 90), 'Marathon');
  assert.equal(lengthLabel(labels, 'classic', 15), '15');
});

test('the catalogue passes its literals to the i18n service it is given', () => {
  const seen = [];
  buildLabels({
    getMessage: (message) => {
      seen.push(message);
      return message.toUpperCase();
    }
  });
  assert.ok(seen.includes('Absolute Carnage'));
  assert.ok(seen.includes('Marathon'));
  assert.ok(seen.includes('Royal ermine cape'));
  assert.equal(buildLabels({getMessage: () => 'x'}).modes.chaos, 'x');
});
