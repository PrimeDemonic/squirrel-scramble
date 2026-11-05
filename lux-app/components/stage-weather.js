/**
 * The race stage's weather, as plain data (Chaos v2 contract § 14): the rain's three depth
 * layers, its splashes on the grass, the per-race wind slant, and the small thunderclouds that
 * roll in for a lightning strike in a sky without storm clouds.
 *
 * Everything is a pure function of the race seed, the plan and the sky preset, so a replay rains
 * the same. The weather draws from its own generator, offset from the race seed (as the
 * commentary and the confetti do), so it never touches the race's own sequence: the events,
 * the order and the times never change.
 *
 * The rain is drawn as static SVG sheets (components/sprites/scenery.js, rainSheetSprite), one
 * per depth, each holding its tile twice, one above the other, so a sheet that moves down by one
 * tile loops without a seam. stage-weather-layer.js puts each sheet in an HTML layer whose CSS
 * loop moves transform only, so the compositor runs it (contract § 10).
 *
 * No DOM, no Lit and no clock in here.
 */
import {themeConfig} from '../lib/theme-config.js';
import {createRng} from '../lib/rng.js';
import {laneAt} from '../lib/choreography.js';

// The weather's own generator is offset from the race seed by this much.
export const RAIN_SEED_OFFSET = 13;

// A rain tile in viewBox units: 280 wide and 100 tall. A sheet is one tile wide and two tiles
// tall; its layer is a little wider than its box (windOverhang, to cover the wind's slant), and
// one tile is as tall as the box.
export const RAIN_TILE = Object.freeze({width: 280, height: 100});

// The wind's slant, chosen per race from the seed, and how far a streak may lean from it,
// either way (degrees).
export const WIND_SLANT_DEG = Object.freeze({min: 8, max: 18});
export const STREAK_TILT_DEG = 3;

// The depth layers, back to front, at full (storm) strength: streaks per tile, streak length in
// tile units, screen thickness in px, opacity, and how long the layer takes to fall one tile
// (far slow, near fast, for parallax). Far and mid sit behind the trees; near sits in front of
// the field, sparse, and the layer itself is drawn at 0.3 opacity (contract § 8).
export const RAIN_DEPTH_ORDER = Object.freeze(['far', 'mid', 'near']);
export const RAIN_DEPTHS = Object.freeze({
  far: Object.freeze({
    count: 70,
    length: [4, 8],
    width: [1, 1.4],
    opacity: [0.2, 0.35],
    fallMs: 2600
  }),
  mid: Object.freeze({
    count: 44,
    length: [8, 14],
    width: [1.3, 1.9],
    opacity: [0.3, 0.5],
    fallMs: 1600
  }),
  near: Object.freeze({
    count: 14,
    length: [15, 24],
    width: [1.8, 2.5],
    opacity: [0.4, 0.6],
    fallMs: 900
  })
});

// Splash ripples along the grass strip at full strength: how many, how long one ripple takes,
// and the band of the strip they land in (per cent of its height from the top).
export const SPLASHES = Object.freeze({count: 7, loopMs: 1100, band: [10, 45]});

// A thundercloud for a lightning strike in a clear sky: it rolls in this long before the strike
// and leaves this long after it, building up over the first share of its window and fading over
// the last.
export const THUNDERCLOUD = Object.freeze({
  leadMs: 900,
  tailMs: 1100,
  inShare: 0.3,
  outShare: 0.7
});

/**
 * @description Rounds a number to two decimals, for compact path data and inline styles.
 * @param {number} value - The number.
 * @returns {number} The rounded number.
 * @since 2.2.0
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * @description Rounds a number to the nearest step.
 * @param {number} value - The number.
 * @param {number} step - The step.
 * @returns {number} The rounded number (to two decimals).
 * @since 2.2.0
 */
function toStep(value, step) {
  return round2(Math.round(value / step) * step);
}

/**
 * @description A sky preset's rain settings (density, speed, opacity and colour), or null for a
 *   dry sky.
 * @param {string} skyId - The plan's sky.
 * @param {Object} [theme] - The theme config.
 * @returns {{density: number, speed: number, opacity: number, colour: string}|null} The rain.
 * @example
 *   rainOf('drizzle');
 *   // {density: 0.4, speed: 0.6, opacity: 0.7, colour: '#5E7489'}
 * @since 2.2.0
 */
export function rainOf(skyId, theme = themeConfig) {
  const preset = theme.skies.presets[skyId];
  const rain = preset ? preset.rain : null;
  return rain && rain.density > 0 ? rain : null;
}

/**
 * @description Says whether a sky draws storm clouds of its own (a lightning strike then needs
 *   no extra cloud).
 * @param {string} skyId - The plan's sky.
 * @param {Object} [theme] - The theme config.
 * @returns {boolean} True when the preset lists storm clouds.
 * @example
 *   hasStormClouds('storm');
 *   // true
 * @since 2.2.0
 */
export function hasStormClouds(skyId, theme = themeConfig) {
  const preset = theme.skies.presets[skyId];
  const extras = preset && Array.isArray(preset.extras) ? preset.extras : [];
  return extras.includes('storm_clouds');
}

/**
 * @description The rain for one race: the wind slant, each depth layer's streaks and fall time,
 *   and the splash ripples, all drawn from the race seed. A lighter rain (drizzle) has fewer
 *   streaks, falls more slowly and is fainter. Null for a dry sky.
 * @param {number} seed - The race seed.
 * @param {{density: number, speed?: number, opacity?: number}|null} rain - From rainOf.
 * @returns {{windDeg: number, layers: Array<{depth: string, fallMs: number,
 *   streaks: Array<{x: number, y: number, length: number, width: number, opacity: number,
 *   tiltDeg: number}>}>, splashes: Array<{x: number, y: number, size: number, durationMs: number,
 *   delayMs: number}>}|null} The layout: streak x and y in tile units, length in tile units,
 *   width in screen px; splash x and y in per cent of the grass strip.
 * @example
 *   rainLayout(plan.seed, rainOf(plan.sky));
 * @since 2.2.0
 */
export function rainLayout(seed, rain) {
  if (!rain || !(rain.density > 0)) {
    return null;
  }
  const rng = createRng(Number(seed) + RAIN_SEED_OFFSET);
  const speed = rain.speed > 0 ? rain.speed : 1;
  const fade = Number.isFinite(rain.opacity) ? Math.min(1, Math.max(0, rain.opacity)) : 1;
  const windDeg = round2(rng.floatBetween(WIND_SLANT_DEG.min, WIND_SLANT_DEG.max));
  const layers = RAIN_DEPTH_ORDER.map((depth) => {
    const spec = RAIN_DEPTHS[depth];
    const count = Math.max(1, Math.round(spec.count * rain.density));
    const streaks = Array.from({length: count}, () => ({
      x: round2(rng.floatBetween(0, RAIN_TILE.width)),
      y: round2(rng.floatBetween(0, RAIN_TILE.height)),
      length: round2(rng.floatBetween(spec.length[0], spec.length[1])),
      width: round2(rng.floatBetween(spec.width[0], spec.width[1])),
      opacity: round2(rng.floatBetween(spec.opacity[0], spec.opacity[1]) * fade),
      tiltDeg: round2(rng.floatBetween(-STREAK_TILT_DEG, STREAK_TILT_DEG))
    }));
    return {depth, fallMs: Math.round(spec.fallMs / speed), streaks};
  });
  const splashCount = Math.max(1, Math.round(SPLASHES.count * rain.density));
  const loopMs = SPLASHES.loopMs / speed;
  // Spread along the strip (one per stretch, jittered inside it), each on its own loop.
  const splashes = Array.from({length: splashCount}, (_value, index) => {
    const durationMs = Math.round(loopMs * rng.floatBetween(0.85, 1.25));
    return {
      x: round2(((index + rng.floatBetween(0.15, 0.85)) / splashCount) * 100),
      y: round2(rng.floatBetween(SPLASHES.band[0], SPLASHES.band[1])),
      size: round2(rng.floatBetween(0.7, 1.2)),
      durationMs,
      // Negative: every ripple is already part-way through its loop when the race appears.
      delayMs: -Math.round(rng.floatBetween(0, durationMs))
    };
  });
  return {windDeg, layers, splashes};
}

/**
 * @description How far a rain layer must reach past each side of its box, as a share of the
 *   box's height, so the wind's slant never leaves a dry corner: half the tangent of the slant
 *   (the layer is slanted about its centre).
 * @param {number} windDeg - The wind's slant in degrees, from rainLayout.
 * @returns {number} The overhang, a share of the box's height (three decimals); 0 for no slant.
 * @example
 *   windOverhang(12);
 *   // 0.106
 * @since 2.2.0
 */
export function windOverhang(windDeg) {
  const slant = Number(windDeg);
  if (!Number.isFinite(slant) || slant <= 0) {
    return 0;
  }
  return Math.round((Math.tan((Math.min(slant, 45) * Math.PI) / 180) / 2) * 1000) / 1000;
}

/**
 * @description Turns a layer's streaks into a few path groups for drawing: thickness rounded to
 *   half a pixel and opacity to 0.05, so a sheet is a handful of paths, not hundreds of lines.
 *   Each streak is drawn three times, a tile above, in place and a tile below, so the two-tile
 *   sheet repeats exactly (a streak that runs off the bottom of a tile carries on at its top).
 * @param {Array<{x: number, y: number, length: number, width: number, opacity: number,
 *   tiltDeg: number}>} streaks - From rainLayout.
 * @param {{width: number, height: number}} [tile] - The tile, in viewBox units.
 * @returns {Array<{width: number, opacity: number, d: string}>} Path groups, in the order their
 *   first streak came.
 * @example
 *   streakGroups(layout.layers[0].streaks);
 * @since 2.2.0
 */
export function streakGroups(streaks, tile = RAIN_TILE) {
  const groups = new Map();
  (Array.isArray(streaks) ? streaks : []).forEach((streak) => {
    const width = toStep(streak.width, 0.5);
    const opacity = toStep(streak.opacity, 0.05);
    const key = `${width}|${opacity}`;
    const lean = round2(Math.tan((streak.tiltDeg * Math.PI) / 180) * streak.length);
    const copies = [-tile.height, 0, tile.height]
      .map((shift) => `M${round2(streak.x)} ${round2(streak.y + shift)}l${lean} ${streak.length}`)
      .join('');
    const group = groups.get(key) || {width, opacity, d: ''};
    groups.set(key, {...group, d: group.d + copies});
  });
  return Array.from(groups.values());
}

/**
 * @description The thunderclouds for a race (contract § 14): one for each lightning strike when
 *   the sky has no storm clouds of its own, over the struck squirrel's tree at the strike, with
 *   its window in race time and the side it rolls in from (the nearer edge). Drawn only: the
 *   strike itself never changes.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} timeline - From prepareTimeline (its events are normalised).
 * @param {string} skyId - The plan's sky.
 * @param {Object} [theme] - The theme config.
 * @returns {Array<{key: string, lane: number, side: number, startMs: number,
 *   durationMs: number, inShare: number, outShare: number}>} The clouds (empty in a storm).
 * @example
 *   thundercloudsFor(plan, timeline, plan.sky);
 * @since 2.2.0
 */
export function thundercloudsFor(plan, timeline, skyId, theme = themeConfig) {
  if (hasStormClouds(skyId, theme)) {
    return [];
  }
  const count = plan.entrants.length;
  return timeline.events
    .filter((event) => (
      event.type === 'lightning'
      && Number.isInteger(event.entrants[0])
      && Boolean(plan.entrants[event.entrants[0]])
    ))
    .map((event) => {
      const {lane} = laneAt(plan, event.entrants[0], event.startMs);
      return {
        key: event.id,
        lane,
        side: lane > count / 2 ? 1 : -1,
        startMs: event.startMs - THUNDERCLOUD.leadMs,
        durationMs: THUNDERCLOUD.leadMs + THUNDERCLOUD.tailMs,
        inShare: THUNDERCLOUD.inShare,
        outShare: THUNDERCLOUD.outShare
      };
    });
}
