/**
 * Outfit rolling for Squirrel Scramble (SPEC.md § 9). Outfits are cosmetic: rolled in the browser
 * from a seeded generator, stored with the entrant at draw time, and drawn again on replay.
 *
 * Each slot (hat, cape, accessory, fur) rolls a rarity first (common 80, rare 17, legendary 3)
 * and then picks uniformly among that slot's items of that rarity. The catalogue lives in the
 * theme config, so a new hat is a data entry and an SVG fragment, never a server change.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {themeConfig} from './theme-config.js';

// The server accepts exactly these keys (SPEC.md § 7, outfit validation).
const PAYLOAD_SLOTS = ['hat', 'cape', 'accessory', 'fur'];

/** Every outfit id the server accepts (SPEC.md § 7). */
export const OUTFIT_ID_PATTERN = /^[a-z0-9_]{1,24}$/;

/**
 * @description Rolls one rarity by the catalogue's weights.
 * @param {{nextFloat: function(): number, weightedIndex: function(number[]): number}} rng -
 *   A seeded generator from createRng().
 * @param {Object} catalogue - The theme's outfits section.
 * @returns {string} A rarity name.
 * @since 1.0.0
 */
function rollRarity(rng, catalogue) {
  const weights = catalogue.rarityOrder.map((rarity) => catalogue.rarityWeights[rarity] || 0);
  return catalogue.rarityOrder[rng.weightedIndex(weights)];
}

/**
 * @description Returns a slot's items of the given rarity. A slot with no item of that rarity
 *   falls back to the next more common tier, so a short catalogue still rolls.
 * @param {Array<{id: string, rarity: string}>} slotItems - The slot's catalogue entries.
 * @param {string} rarity - The rolled rarity.
 * @param {string[]} rarityOrder - Rarities from most to least common.
 * @returns {Array<{id: string, rarity: string}>} The candidates (never empty for a non-empty
 *   slot).
 * @since 1.0.0
 */
function itemsOfRarity(slotItems, rarity, rarityOrder) {
  for (let rank = rarityOrder.indexOf(rarity); rank >= 0; rank -= 1) {
    const matches = slotItems.filter((item) => item.rarity === rarityOrder[rank]);
    if (matches.length > 0) {
      return matches;
    }
  }
  return slotItems;
}

/**
 * @description Finds a catalogue entry by slot and id.
 * @param {string} slot - The slot name.
 * @param {*} id - The item id.
 * @param {Object} catalogue - The theme's outfits section.
 * @returns {{id: string, label: string, rarity: string}|null} The entry, or null.
 * @since 1.0.0
 */
function findItem(slot, id, catalogue) {
  const items = catalogue.slots[slot] || [];
  return items.find((item) => item.id === id) || null;
}

/**
 * @description Rolls a whole outfit: one item per slot, in the catalogue's slot order. Uses two
 *   generator draws per slot (rarity, then item), always in that order.
 * @param {Object} rng - A seeded generator from createRng().
 * @param {Object} [catalogue] - The theme's outfits section.
 * @returns {{hat: string, cape: string, accessory: string, fur: string}} Item ids.
 * @example
 *   const outfit = rollOutfit(createRng(randomSeed()));
 * @since 1.0.0
 */
export function rollOutfit(rng, catalogue = themeConfig.outfits) {
  const outfit = {};
  catalogue.slotOrder.forEach((slot) => {
    const rarity = rollRarity(rng, catalogue);
    const candidates = itemsOfRarity(catalogue.slots[slot], rarity, catalogue.rarityOrder);
    outfit[slot] = rng.pick(candidates).id;
  });
  return outfit;
}

/**
 * @description Rolls one outfit per squirrel.
 * @param {Object} rng - A seeded generator from createRng().
 * @param {number} count - How many outfits.
 * @param {Object} [catalogue] - The theme's outfits section.
 * @returns {Array<Object>} The outfits.
 * @example
 *   const outfits = rollOutfits(rng, names.length);
 * @since 1.0.0
 */
export function rollOutfits(rng, count, catalogue = themeConfig.outfits) {
  return Array.from({length: Math.max(0, count)}, () => rollOutfit(rng, catalogue));
}

/**
 * @description Re-rolls every outfit except the padlocked ones ("Shuffle outfits"). Returns a new
 *   array; the input array and its outfits are untouched.
 * @param {Object} rng - A seeded generator from createRng().
 * @param {Array<Object>} outfits - The current outfits, one per squirrel.
 * @param {Iterable<number>} [lockedIndexes] - Indexes to keep.
 * @param {Object} [catalogue] - The theme's outfits section.
 * @returns {Array<Object>} The new outfits.
 * @example
 *   const next = rerollOutfits(rng, outfits, [0, 3]);
 * @since 1.0.0
 */
export function rerollOutfits(rng, outfits, lockedIndexes = [], catalogue = themeConfig.outfits) {
  const locked = new Set(lockedIndexes);
  return outfits.map((outfit, index) => (
    locked.has(index) ? {...outfit} : rollOutfit(rng, catalogue)
  ));
}

/**
 * @description Returns the rarity of one item. Unknown ids count as the most common rarity.
 * @param {string} slot - The slot name.
 * @param {string} id - The item id.
 * @param {Object} [catalogue] - The theme's outfits section.
 * @returns {string} The rarity name.
 * @example
 *   itemRarity('hat', 'crown');
 *   // 'legendary'
 * @since 1.0.0
 */
export function itemRarity(slot, id, catalogue = themeConfig.outfits) {
  const item = findItem(slot, id, catalogue);
  return item ? item.rarity : catalogue.rarityOrder[0];
}

/**
 * @description Returns the rarest tier of any item in an outfit.
 * @param {Object} outfit - An outfit (missing slots and unknown ids count as common).
 * @param {Object} [catalogue] - The theme's outfits section.
 * @returns {string} The rarity name.
 * @example
 *   outfitRarity({hat: 'halo', fur: 'red'});
 *   // 'rare'
 * @since 1.0.0
 */
export function outfitRarity(outfit, catalogue = themeConfig.outfits) {
  const source = outfit && typeof outfit === 'object' ? outfit : {};
  const ranks = catalogue.slotOrder.map((slot) => (
    catalogue.rarityOrder.indexOf(itemRarity(slot, source[slot], catalogue))
  ));
  return catalogue.rarityOrder[Math.max(0, ...ranks)];
}

/**
 * @description Says whether an outfit has a legendary item, which earns the sparkle aura and a
 *   commentary line (SPEC.md § 9).
 * @param {Object} outfit - An outfit.
 * @param {Object} [catalogue] - The theme's outfits section.
 * @returns {boolean} True when any item is of the rarest tier.
 * @example
 *   isLegendary({fur: 'rainbow'});
 *   // true
 * @since 1.0.0
 */
export function isLegendary(outfit, catalogue = themeConfig.outfits) {
  const rarest = catalogue.rarityOrder[catalogue.rarityOrder.length - 1];
  return outfitRarity(outfit, catalogue) === rarest;
}

/**
 * @description Makes the outfit sent to POST /draw: only the four allowed keys, and only values
 *   that match the server's id rule, so the draw never fails with bad_outfit. A value that does
 *   not match is left out, and the server stores what remains.
 * @param {*} outfit - Any value.
 * @returns {{hat?: string, cape?: string, accessory?: string, fur?: string}} The payload outfit.
 * @example
 *   toPayload({hat: 'viking', cape: '<script>', extra: 'x'});
 *   // {hat: 'viking'}
 * @since 1.0.0
 */
export function toPayload(outfit) {
  const source = outfit && typeof outfit === 'object' ? outfit : {};
  const payload = {};
  PAYLOAD_SLOTS.forEach((slot) => {
    const value = Object.prototype.hasOwnProperty.call(source, slot) ? source[slot] : undefined;
    if (typeof value === 'string' && OUTFIT_ID_PATTERN.test(value)) {
      payload[slot] = value;
    }
  });
  return payload;
}

/**
 * @description Fills an outfit for drawing: a missing slot or an id this catalogue does not know
 *   (say, from an older theme) becomes the slot's default, so a stored {} draws a plain squirrel.
 * @param {*} outfit - A stored or rolled outfit.
 * @param {Object} [catalogue] - The theme's outfits section.
 * @returns {{hat: string, cape: string, accessory: string, fur: string}} A drawable outfit.
 * @example
 *   outfitForDrawing({});
 *   // {hat: 'none', cape: 'none', accessory: 'none', fur: 'red'}
 * @since 1.0.0
 */
export function outfitForDrawing(outfit, catalogue = themeConfig.outfits) {
  const source = outfit && typeof outfit === 'object' ? outfit : {};
  const drawable = {};
  catalogue.slotOrder.forEach((slot) => {
    const known = findItem(slot, source[slot], catalogue);
    drawable[slot] = known ? known.id : catalogue.defaults[slot];
  });
  return drawable;
}
