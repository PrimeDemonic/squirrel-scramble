/**
 * Unit tests for lib/outfits.js (SPEC.md § 7 outfit validation, § 9, § 14 M5).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRng} from '../lib/rng.js';
import {themeConfig} from '../lib/theme-config.js';
import {
  OUTFIT_ID_PATTERN,
  isLegendary,
  itemRarity,
  outfitForDrawing,
  outfitRarity,
  rerollOutfits,
  rollOutfit,
  rollOutfits,
  toPayload
} from '../lib/outfits.js';

const SLOTS = ['hat', 'cape', 'accessory', 'fur'];

test('rarity shares per slot sit within 2 points of 80 / 17 / 3 over 20,000 rolls', () => {
  const rng = createRng(20261022);
  const rolls = 20000;
  const counts = {};
  SLOTS.forEach((slot) => {
    counts[slot] = {common: 0, rare: 0, legendary: 0};
  });
  for (let roll = 0; roll < rolls; roll += 1) {
    const outfit = rollOutfit(rng);
    SLOTS.forEach((slot) => {
      counts[slot][itemRarity(slot, outfit[slot])] += 1;
    });
  }
  SLOTS.forEach((slot) => {
    Object.entries(themeConfig.outfits.rarityWeights).forEach(([rarity, weight]) => {
      const share = (counts[slot][rarity] / rolls) * 100;
      assert.ok(Math.abs(share - weight) <= 2, `${slot} ${rarity}: ${share.toFixed(2)}%`);
    });
  });
});

test('a rolled outfit uses catalogue ids in every slot', () => {
  const rng = createRng(5);
  rollOutfits(rng, 200).forEach((outfit) => {
    assert.deepEqual(Object.keys(outfit), SLOTS);
    SLOTS.forEach((slot) => {
      assert.ok(themeConfig.outfits.slots[slot].some((item) => item.id === outfit[slot]));
    });
  });
});

test('rolling is deterministic for a seed', () => {
  assert.deepEqual(rollOutfits(createRng(77), 12), rollOutfits(createRng(77), 12));
});

test('padlocked outfits survive a re-roll; the input is untouched (M5)', () => {
  const rng = createRng(31);
  const outfits = Object.freeze(rollOutfits(rng, 10).map((outfit) => Object.freeze(outfit)));
  const before = JSON.stringify(outfits);
  const locked = [1, 4, 7];
  const rerolled = rerollOutfits(rng, outfits, locked);
  assert.equal(rerolled.length, outfits.length);
  locked.forEach((index) => {
    assert.deepEqual(rerolled[index], outfits[index]);
    assert.notEqual(rerolled[index], outfits[index]);
  });
  assert.equal(JSON.stringify(outfits), before);
});

test('rarity and legendary detection', () => {
  assert.equal(outfitRarity({hat: 'none', cape: 'red', accessory: 'scarf', fur: 'grey'}), 'common');
  assert.equal(outfitRarity({hat: 'halo', fur: 'red'}), 'rare');
  assert.equal(isLegendary({hat: 'crown'}), true);
  assert.equal(isLegendary({fur: 'rainbow'}), true);
  assert.equal(isLegendary({hat: 'halo', fur: 'golden'}), false);
  assert.equal(isLegendary({}), false);
  assert.equal(itemRarity('hat', 'not_a_hat'), 'common');
});

test('toPayload always satisfies the server rule (5,000 junk outfits)', () => {
  const rng = createRng(404);
  const alphabet = 'abcXYZ019_-<>/"\' script';
  const randomText = () => Array.from(
    {length: rng.intBetween(0, 30)},
    () => alphabet[rng.intBetween(0, alphabet.length - 1)]
  ).join('');
  const junkValue = () => rng.pick([randomText(), randomText(), 42, null, undefined, {}, ['x']]);
  for (let sample = 0; sample < 5000; sample += 1) {
    const junk = {hat: junkValue(), cape: junkValue(), accessory: junkValue(), fur: junkValue()};
    junk[randomText() || 'extra'] = junkValue();
    const payload = toPayload(junk);
    Object.entries(payload).forEach(([key, value]) => {
      assert.ok(SLOTS.includes(key), `key ${key}`);
      assert.match(value, OUTFIT_ID_PATTERN);
    });
    assert.ok(JSON.stringify(payload).length <= 255);
  }
});

test('toPayload keeps good ids and drops a <script> value', () => {
  const outfit = {hat: 'viking', cape: 'royal', accessory: 'monocle', fur: 'grey'};
  assert.deepEqual(toPayload(outfit), outfit);
  assert.deepEqual(toPayload({hat: '<script>alert(1)</script>', fur: 'red'}), {fur: 'red'});
  assert.deepEqual(toPayload(null), {});
  assert.deepEqual(toPayload({hat: 'a'.repeat(25)}), {});
});

test('outfitForDrawing fills missing or unknown slots with defaults', () => {
  assert.deepEqual(outfitForDrawing({}), themeConfig.outfits.defaults);
  assert.deepEqual(
    outfitForDrawing({hat: 'crown', cape: 'jetpack', fur: 'rainbow'}),
    {hat: 'crown', cape: 'none', accessory: 'none', fur: 'rainbow'}
  );
});
