/**
 * The race stage's weather layers (Chaos v2 contract § 14): the rain in three depths, its splash
 * ripples on the grass, and the small thunderclouds a lightning strike comes out of in a sky
 * without storm clouds. components/stage-weather.js works out what to draw from the race seed;
 * this module turns that into templates and styles.
 *
 * Rain. Each depth is an HTML layer holding one static SVG sheet (rainSheetSprite), drawn once a
 * race. The layer is slanted by the race's wind (a static skew) and its sheet falls by one tile
 * on a CSS loop that moves transform only, so the compositor runs it: it is not driven at film
 * rate (it is no SVG part) and it never restyles a thing. The sheet holds its tile twice, so the
 * loop has no seam. Far and mid go in the sky, behind the trees; near goes in the field, in
 * front of the squirrels, at 0.3 opacity, and the leaderboard stays above it. The photo-finish
 * freeze-frame holds all three (the stage's is-freeze-frame class).
 *
 * Splashes. Small ripples on the grass strip that grow and fade (scale and opacity only), each
 * on its own loop, already part-way through when the race appears.
 *
 * Thunderclouds. One per lightning strike in a sky with no storm clouds, over the struck tree.
 * Each is a timed part (stage-scrubs.js, 'trunk-visit'): it rolls in from the nearer side and
 * fades in before the strike, and rolls back out after it, as a function of race time.
 *
 * Reduced motion: the streaks stand still (every animation stops) and there are no splashes. A
 * thundercloud still fades in and out, without moving.
 */
import {html, css, nothing} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {RAIN_DEPTH_ORDER, streakGroups, windOverhang} from './stage-weather.js';
import {drawRainSheet, drawSplash, drawThundercloud} from './stage-sprites.js';

/**
 * @description One rain layer: its slant wrapper and its falling sheet.
 * @param {{depth: string, fallMs: number, streaks: Array<Object>}} layer - From rainLayout.
 * @param {number} windDeg - The race's wind slant in degrees.
 * @param {string} colour - The streaks' colour.
 * @returns {import('lit').TemplateResult} The template.
 * @since 2.2.0
 */
function renderRainLayer(layer, windDeg, colour) {
  const style = `--rain-wind: ${windDeg}deg; --rain-overhang: ${windOverhang(windDeg)}; `
    + `--rain-fall: ${layer.fallMs}ms`;
  return html`<div class="rain rain-${layer.depth}" style=${style} data-depth=${layer.depth}>
    <div class="rain-skew">
      <div class="rain-fall">${drawRainSheet(streakGroups(layer.streaks), colour)}</div>
    </div>
  </div>`;
}

/**
 * @description The rain layers of the given depths, back to front. Draw it once a race (guard
 *   it on the layout): nothing in it changes while the race runs.
 * @param {{windDeg: number, layers: Array<Object>}|null} weather - From rainLayout (null for a
 *   dry sky).
 * @param {string[]} depths - Which depths: ['far', 'mid'] in the sky, ['near'] over the field.
 * @param {string} colour - The streaks' colour, a literal #RRGGBB (the sky preset's rain colour).
 * @returns {import('lit').TemplateResult|typeof nothing} The layers, or nothing when dry.
 * @example
 *   renderRain(weather, ['far', 'mid'], '#CFE3F2');
 * @since 2.2.0
 */
export function renderRain(weather, depths, colour) {
  if (!weather || !Array.isArray(weather.layers)) {
    return nothing;
  }
  const wanted = Array.isArray(depths) ? depths : RAIN_DEPTH_ORDER;
  const layers = weather.layers.filter((layer) => wanted.includes(layer.depth));
  if (layers.length === 0) {
    return nothing;
  }
  return html`${layers.map((layer) => renderRainLayer(layer, weather.windDeg, colour))}`;
}

/**
 * @description The splash ripples on the grass strip. Draw it once a race (guard it on the
 *   layout).
 * @param {{splashes: Array<{x: number, y: number, size: number, durationMs: number,
 *   delayMs: number}>}|null} weather - From rainLayout (null for a dry sky).
 * @returns {import('lit').TemplateResult|typeof nothing} The ripples, or nothing when dry.
 * @example
 *   renderSplashes(weather);
 * @since 2.2.0
 */
export function renderSplashes(weather) {
  const splashes = weather && Array.isArray(weather.splashes) ? weather.splashes : [];
  if (splashes.length === 0) {
    return nothing;
  }
  return html`<div class="rain-splashes">
    ${splashes.map((splash) => {
      const style = `--splash-x: ${splash.x}%; --splash-y: ${splash.y}%; `
        + `--splash-size: ${splash.size}; --splash-ms: ${splash.durationMs}ms; `
        + `--splash-delay: ${splash.delayMs}ms`;
      return html`<span class="rain-splash" style=${style}>${drawSplash()}</span>`;
    })}
  </div>`;
}

/**
 * @description The thunderclouds over the struck trees, each a timed part the stage moves with
 *   race time (data-scrub, kind 'trunk-visit'). Hidden until its window opens.
 * @param {Array<{key: string, lane: number, side: number, startMs: number, durationMs: number,
 *   inShare: number, outShare: number}>} clouds - From thundercloudsFor.
 * @returns {import('lit').TemplateResult|typeof nothing} The clouds, or nothing when there are
 *   none.
 * @example
 *   renderThunderclouds(thundercloudsFor(plan, timeline, plan.sky));
 * @since 2.2.0
 */
export function renderThunderclouds(clouds) {
  if (!Array.isArray(clouds) || clouds.length === 0) {
    return nothing;
  }
  return html`<div class="weather-clouds" aria-hidden="true">
    ${repeat(clouds, (cloudPart) => cloudPart.key, (cloudPart) => html`<div
      class="weather-thundercloud"
      style="--lane: ${cloudPart.lane - 1}; --from-side: ${cloudPart.side}"
      data-scrub="race"
      data-scrub-kind="trunk-visit"
      data-scrub-start=${cloudPart.startMs}
      data-scrub-duration=${cloudPart.durationMs}
      data-scrub-in=${cloudPart.inShare}
      data-scrub-out=${cloudPart.outShare}
    >${drawThundercloud()}</div>`)}
  </div>`;
}

/** The weather's styles. Base values are each part's still frame (reduced motion). */
export const weatherStyles = css`
  /* A rain layer fills its box (the sky, or the field for the near layer) and clips its sheet.
     It is a size container, so its slant wrapper can reach past each side by the wind's overhang
     (a share of the box's height). */
  .rain {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    container-type: size;
  }

  .rain-skew {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--rain-overhang, 0.2) * -100cqh - 4px);
    right: calc(var(--rain-overhang, 0.2) * -100cqh - 4px);
    transform: skewX(var(--rain-wind, 12deg));
  }

  /* The sheet is two tiles tall and starts one tile up, so moving down by half its own height
     (one tile) brings it back to the same picture. */
  .rain-fall {
    position: absolute;
    top: -100%;
    left: 0;
    width: 100%;
    height: 200%;
    animation: stage-rain-fall var(--rain-fall, 1600ms) linear infinite;
    will-change: transform;
  }

  .rain-fall svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* The near layer: the field's top layer but two, in front of the squirrels, their visitors and
     the light accents (5), behind the VAR review (7) and the photo-finish stamp (8). Outside the
     shaker, so the earthquake never shakes the rain; inside the field, so the freeze-frame holds
     it and tints it with the rest. Sparse and faint; the leaderboard stays above it. */
  .rain-near {
    position: absolute;
    inset: 0;
    z-index: 6;
    opacity: 0.3;
    pointer-events: none;
  }

  .rain-splashes {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .rain-splash {
    --splash-w: calc(clamp(12px, 1.6vw, 26px) * var(--splash-size, 1));
    position: absolute;
    left: var(--splash-x, 50%);
    top: var(--splash-y, 30%);
    width: var(--splash-w);
    aspect-ratio: 20 / 9;
    margin-left: calc(var(--splash-w) / -2);
    opacity: 0;
    transform-origin: 50% 70%;
    animation: stage-rain-splash var(--splash-ms, 1100ms) ease-out var(--splash-delay, 0ms)
      infinite;
  }

  .rain-splash svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Thunderclouds sit with the back visitors, in front of the top of the lightning bolt, so the
     bolt comes out of the cloud. */
  .weather-clouds {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }

  .weather-thundercloud {
    --cloud-w: clamp(44px, calc(var(--lane-w) * 1.5), 200px);
    position: absolute;
    top: -5cqh;
    left: calc(var(--lane-w) * (var(--lane) + 0.5) - var(--cloud-w) / 2);
    width: var(--cloud-w);
    aspect-ratio: 44 / 24;
    opacity: 0;
    font-size: calc(var(--cloud-w) * 0.45);
  }

  .weather-thundercloud svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  @keyframes stage-rain-fall {
    from {
      transform: translate3d(0, 0, 0);
    }
    to {
      transform: translate3d(0, 50%, 0);
    }
  }

  @keyframes stage-rain-splash {
    0% {
      transform: scale(0.2);
      opacity: 0;
    }
    12% {
      opacity: 0.85;
    }
    45% {
      transform: scale(1);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }

  /* The photo-finish freeze-frame holds the weather too (the field's own rule only reaches the
     near layer). */
  .stage.is-freeze-frame :is(.rain-fall, .rain-splash) {
    animation-play-state: paused;
  }

  /* Reduced motion: no splashes (the streaks already stand still: every animation stops). */
  .reduce .rain-splashes,
  :host([reduced-motion]) .rain-splashes {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .rain-splashes {
      display: none;
    }
  }
`;
