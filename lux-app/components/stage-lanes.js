/**
 * The race stage's lanes (SPEC.md § 8 race view, § 12, § 13): one tree per entrant with a chestnut
 * on top, one squirrel per lane in its outfit with its bib, and the trunk-base labels. Chaos v2
 * (contract § 3, § 6): outfits change mid-race (outfit timeline), a squirrel can hide inside a
 * trench coat or wear one, and cats, the Golden Acorn and an over-sized nut fly around them.
 *
 * Geometry is pure CSS, so server rendering and the browser agree: the field is a size container,
 * a lane is 100cqw divided by the lane count, and a squirrel's box is one lane wide and one climb
 * tall. The element moves each squirrel every frame with transform: translate3d(x * 100%,
 * y * 100%, 0), x in lanes and y as a share of the climb, straight onto the cached element; these
 * templates never bind the squirrel's transform, so a re-render never fights the frame loop.
 *
 * Colour is never the only identifier (SPEC.md § 13): every bib also carries the squirrel's number
 * and its own pattern and shape. Names reach the page through Lit text bindings only.
 */
import {html, css, nothing} from 'lit';
import {guard} from 'lit/directives/guard.js';
import {repeat} from 'lit/directives/repeat.js';
import {classMap} from 'lit/directives/class-map.js';
import {themeConfig} from '../lib/theme-config.js';
import {outfitForDrawing, isLegendary} from '../lib/outfits.js';
import {truncateLabel} from '../lib/names.js';
import {
  drawSquirrel,
  drawHeart,
  drawKissMark,
  drawSlapHand,
  drawStars,
  drawSmoke,
  drawBolt,
  drawEagle,
  drawPositionBadge,
  drawTree,
  drawChestnut,
  drawFlyingCat,
  drawGoldenAcorn,
  drawHailNut,
  drawTrenchCoat,
  hasSprite,
  hasEffect
} from './stage-sprites.js';

/**
 * @description Reads a stored outfit: an object as it is, a JSON string parsed, anything else
 *   empty (which draws a plain squirrel).
 * @param {*} raw - The payload's outfit.
 * @returns {Object} The outfit object.
 * @example
 *   readOutfit('{"hat":"crown"}');
 *   // {hat: 'crown'}
 * @since 1.0.0
 */
export function readOutfit(raw) {
  if (raw && typeof raw === 'object') {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * @description Prepares how each entrant is drawn: name and label, bib number and colours, the
 *   outfit for this field size (hat and fur only from 13 squirrels, SPEC.md § 8 scale), the
 *   outfit at each step of its outfit timeline (Chaos v2 contract § 3: a hat chomped off, a UFO
 *   swap, a hat blown away), and the legendary sparkle.
 * @param {Object} plan - From buildRacePlan.
 * @param {Array<{outfit?: *}>} payloadEntrants - The race payload's entrants, in plan order.
 * @param {string} band - 'roomy', 'busy' or 'packed' (see scaleBand).
 * @param {Object} [theme] - The theme config.
 * @returns {Array<{index: number, name: string, label: string, number: number, colour: string,
 *   ink: string, pattern: string, shape: string, outfit: Object, outfits: Object[],
 *   fullOutfit: Object, hat: string, legendary: boolean}>} The cast, in plan order (outfit is
 *   what the lanes draw, outfits what they draw at each outfit-timeline step, fullOutfit what the
 *   podium draws).
 * @example
 *   const cast = buildCast(plan, payload.entrants, 'roomy');
 * @since 1.0.0
 */
export function buildCast(plan, payloadEntrants, band, theme = themeConfig) {
  const palette = theme.lanePalette;
  const {defaults} = theme.outfits;
  // From 13 squirrels only the hat and fur are drawn (SPEC.md § 8 scale).
  const forBand = (drawable) => (band === 'roomy'
    ? drawable
    : {...drawable, cape: defaults.cape, accessory: defaults.accessory});
  return plan.entrants.map((entrant, index) => {
    const stored = readOutfit((payloadEntrants[index] || {}).outfit);
    const drawable = outfitForDrawing(stored, theme.outfits);
    const outfit = forBand(drawable);
    const timeline = Array.isArray(entrant.outfitTimeline) ? entrant.outfitTimeline : [];
    const outfits = timeline.map((step) => {
      const changed = readOutfit(step ? step.outfit : null);
      return forBand(outfitForDrawing({...stored, ...changed}, theme.outfits));
    });
    const swatch = palette[(entrant.lane - 1) % palette.length];
    return {
      index,
      name: entrant.name,
      label: truncateLabel(entrant.name, theme.race.labelMaxChars),
      number: entrant.lane,
      colour: swatch.colour,
      ink: swatch.ink,
      pattern: swatch.bibPattern,
      shape: swatch.bibShape,
      outfit,
      outfits,
      fullOutfit: drawable,
      hat: drawable.hat,
      legendary: isLegendary(stored, theme.outfits)
    };
  });
}

/**
 * @description A bib chip: the squirrel's number on its lane colour, pattern and shape.
 * @param {Object} member - A cast member.
 * @param {string} [size] - 'chip' (labels, leaderboard) or 'bib' (on the squirrel).
 * @param {*} [name] - The name to print beside the number, when there is room.
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderBib(member, 'chip');
 * @since 1.0.0
 */
export function renderBib(member, size = 'chip', name = nothing) {
  return html`<span
    class="bib bib-size-${size} bib-shape-${member.shape} bib-pattern-${member.pattern}"
    style="--bib: ${member.colour}; --bib-ink: ${member.ink}"
    ><span class="bib-number">${member.number}</span>${name}</span
  >`;
}

/** The sprite kit's tree viewBox is this many units wide; its height is the caller's. */
const TREE_VIEW_WIDTH = 60;

/** Trees are at most this wide (CSS --tree-max says the same), so a two-squirrel race has trees,
 * not tree trunks the width of the screen. */
const TREE_BOX_MAX_PX = 160;

/**
 * @description The viewBox height for the kit's tree so it fills its lane from the ground to the
 *   top of the field without stretching (the kit draws it anchored at the bottom). Rounded up: a
 *   taller viewBox only makes the tree a little slimmer, never shorter than its lane.
 * @param {number} fieldWidth - The field's width in pixels.
 * @param {number} fieldHeight - The field's height in pixels.
 * @param {number} count - Lanes.
 * @returns {number} A viewBox height from 120 to 2000, in steps of 20.
 * @example
 *   treeViewHeight(1100, 600, 8);
 * @since 1.0.0
 */
export function treeViewHeight(fieldWidth, fieldHeight, count) {
  const laneWidth = fieldWidth / Math.max(1, count);
  const boxWidth = Math.max(1, Math.min(laneWidth, TREE_BOX_MAX_PX));
  const raw = (TREE_VIEW_WIDTH * fieldHeight) / boxWidth;
  return Math.min(2000, Math.max(120, Math.ceil(raw / 20) * 20));
}

/**
 * @description The trees, each with its chestnut on top. The winner's chestnut bounces once the
 *   result is in; a beaver's tree sways; a tornado bends them all; a woodpecker's tree (or every
 *   tree in an earthquake) wobbles. With the kit's tree the motion comes from the kit's classes;
 *   the plain fallback trunk animates itself.
 * @param {{count: number, swayLanes: number[], wobbleLanes?: number[], twisting: boolean,
 *   winnerLane: number, celebrate: boolean, treeHeight: number}} state - What the trees are
 *   doing, and the tree viewBox height (see treeViewHeight).
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
export function renderTrees({
  count,
  swayLanes,
  wobbleLanes = [],
  twisting,
  winnerLane,
  celebrate,
  treeHeight
}) {
  const withArt = hasSprite('treeSprite');
  const lanes = Array.from({length: count}, (_value, slot) => slot + 1);
  return html`<div class=${classMap({trees: true, 'is-twisting': twisting})} aria-hidden="true">
    ${lanes.map((lane) => {
      const swaying = swayLanes.includes(lane);
      const wobbling = wobbleLanes.includes(lane);
      const bouncing = celebrate && lane === winnerLane;
      // Each tree only rebuilds when its own state changes.
      return guard([swaying, wobbling, bouncing, twisting, treeHeight, withArt], () => {
        const treeClasses = {
          tree: true,
          'is-swaying': swaying,
          'is-wobbling': wobbling,
          'is-plain': !withArt
        };
        if (withArt) {
          const motion = [
            bouncing ? 'ss-anim-chestnut-bounce' : '',
            twisting ? 'ss-anim-tree-bend' : '',
            wobbling && !twisting ? 'ss-anim-tree-wobble' : ''
          ].filter(Boolean).join(' ');
          const art = drawTree({height: treeHeight, swaying, className: motion});
          return html`<div class=${classMap(treeClasses)} data-lane=${lane}>
            <span class="tree-art">${art}</span>
          </div>`;
        }
        const nutClasses = {'tree-nut': true, 'is-bouncing': bouncing};
        return html`<div class=${classMap(treeClasses)} data-lane=${lane}>
          <span class=${classMap(nutClasses)}>${drawChestnut()}</span>
        </div>`;
      });
    })}
  </div>`;
}

// The timed motion (stage-scrubs.js) for each timed decoration; the eagle's carry has none.
const DECOR_MOTION = Object.freeze({
  hearts: 'hearts-rise',
  kiss: 'pop',
  slap: 'slap',
  smoke: 'smoke-rise',
  'eagle:dive': 'eagle-dive',
  'eagle:away': 'eagle-away',
  'cat:fly': 'cat-fly',
  'cat:drop': 'drop-off',
  'acorn:home': 'acorn-home',
  'acorn:loop': 'acorn-loop',
  'big-nut': 'pop'
});

/**
 * @description The eagle, with the cat it caught instead of the squirrel (catVsEagle) dangling
 *   below and a puzzled question mark (drawn by the stylesheet).
 * @param {{phase: string, withCat?: boolean}} item - The eagle decoration.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderEagle(item) {
  const pose = {dive: 'dive', carry: 'carry', away: 'fly'}[item.phase] || 'carry';
  if (!item.withCat) {
    return html`${drawEagle(pose)}`;
  }
  return html`<span class="eagle-art">${drawEagle(pose)}</span
    ><span class="eagle-cat">${drawFlyingCat('drop')}</span
    ><span class="eagle-puzzled"></span>`;
}

/**
 * @description The decoration's own art.
 * @param {Object} item - The decoration from racerLook.
 * @returns {*} A Lit-renderable value, or nothing for an unknown kind.
 * @since 1.0.0
 */
function decorationArt(item) {
  const art = {
    hearts: () => html`<span class="heart heart-1">${drawHeart()}</span
      ><span class="heart heart-2">${drawHeart()}</span
      ><span class="heart heart-3">${drawHeart()}</span>`,
    kiss: () => drawKissMark(),
    slap: () => drawSlapHand(),
    smoke: () => drawSmoke(),
    eagle: () => renderEagle(item),
    cat: () => drawFlyingCat(item.phase === 'drop' ? 'drop' : 'fly'),
    acorn: () => drawGoldenAcorn(item.phase === 'loop' ? 'loop' : 'fly'),
    'big-nut': () => drawHailNut()
  };
  return art[item.kind] ? art[item.kind]() : nothing;
}

/**
 * @description Stand-ins for Chaos v2 squirrel effects the kit does not draw yet: a cat on the
 *   squirrel's back, nuts in its cheeks. Nothing once the kit draws them itself.
 * @param {string[]} effects - The look's effects.
 * @returns {Array<import('lit').TemplateResult>} The stand-ins.
 * @since 1.0.0
 */
function effectStandIns(effects) {
  const standIns = [];
  if (effects.includes('catClinging') && !hasEffect('catClinging')) {
    standIns.push(html`<span class="decor decor-cat-cling">${drawFlyingCat('cling')}</span>`);
  }
  if (effects.includes('chubby') && !hasEffect('chubby')) {
    standIns.push(html`<span class="decor decor-cheeks"
      ><span class="decor-cheek decor-cheek-left">${drawHailNut()}</span
      ><span class="decor-cheek decor-cheek-right">${drawHailNut()}</span></span
    >`);
  }
  return standIns;
}

/**
 * @description One decoration around a squirrel. Timed ones carry their race-time window and
 *   motion (data-scrub, data-scrub-kind), and the stage writes their transform and opacity every
 *   frame, so they look the same at the same moment of a replay.
 * @param {{kind: string, startMs: number, durationMs: number, phase?: string}} item - The
 *   decoration from racerLook.
 * @returns {import('lit').TemplateResult|typeof nothing} The template.
 * @since 1.0.0
 */
function renderDecoration(item) {
  const motion = DECOR_MOTION[item.phase ? `${item.kind}:${item.phase}` : item.kind] || '';
  const classes = {
    decor: true,
    [`decor-${item.kind}`]: true,
    [`decor-${item.kind}-${item.phase}`]: Boolean(item.phase),
    'has-cat': Boolean(item.withCat)
  };
  // Where a cat or the Golden Acorn flies in from, relative to the squirrel (stage-scrubs.js).
  const fromX = Number.isFinite(item.fromX) ? item.fromX : 0;
  const fromY = Number.isFinite(item.fromY) ? item.fromY : 0;
  const timed = (inner) => (motion
    ? html`<span
      class=${classMap(classes)}
      style="--from-x: ${fromX}; --from-y: ${fromY}"
      data-scrub="race"
      data-scrub-kind=${motion}
      data-scrub-start=${item.startMs}
      data-scrub-duration=${item.durationMs}
      >${inner}</span
    >`
    : html`<span class=${classMap(classes)}>${inner}</span>`);
  const art = decorationArt(item);
  if (art !== nothing) {
    return timed(art);
  }
  if (item.kind === 'stars') {
    // The kit's dizzy pose draws its own circling stars; these stand in only without the kit.
    return hasSprite('squirrelSprite')
      ? nothing
      : html`<span class="decor decor-stars">${drawStars()}</span>`;
  }
  if (item.kind === 'zap') {
    return html`<span class="decor decor-zap"
      ><span class="zap zap-1">${drawBolt()}</span
      ><span class="zap zap-2">${drawBolt()}</span></span
    >`;
  }
  return nothing;
}

/**
 * @description One squirrel: body (pose, motion and decorations), bib and, once home, its
 *   position badge. The initial transform comes from --start-lane, so the server's markup already
 *   has every squirrel at the foot of its own tree. It wears the outfit of its outfit-timeline
 *   step; inside a trench coat it is hidden (its box keeps moving, unseen), and the host draws
 *   the coat instead of itself.
 * @param {Object} member - The cast member.
 * @param {Object} look - From racerLook.
 * @param {{band: string, laneCount: number, cast: Object[]}} options - Scale band, lane count
 *   and the cast (for the furs in a trench coat).
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderRacer(member, look, {band, laneCount, cast}) {
  const step = Number.isInteger(look.outfitStep) ? look.outfitStep : -1;
  const outfit = step >= 0 && member.outfits[step] ? member.outfits[step] : member.outfit;
  // The outfit ids are in the key too: a rematch reuses the same racer elements.
  const outfitKey = [outfit.fur, outfit.hat, outfit.cape, outfit.accessory].join('/');
  const poseKey = `${look.pose}|${look.effects.join(',')}|${outfitKey}|${look.coat ? 'coat' : ''}`;
  const leanLeft = look.tree === laneCount && laneCount > 1;
  const classes = {
    racer: true,
    [`motion-${look.motion}`]: true,
    'lean-left': leanLeft,
    // In the right half, flyers (the eagle) come and go on the side away from the leaderboard.
    'is-east': laneCount > 1 && look.tree > laneCount / 2,
    'is-home': look.finished,
    'is-hidden': look.hidden === true,
    'is-coat': look.coat === true
  };
  const name = band === 'roomy'
    ? html`<span class="bib-name">${member.label}</span>`
    : nothing;
  // The coat shows each hidden squirrel's fur, top first.
  const coatFurs = (look.coatHeads || [])
    .filter((index) => cast[index])
    .map((index) => cast[index].outfit.fur);
  const drawBody = () => (look.coat
    ? drawTrenchCoat(coatFurs.length > 0 ? coatFurs : 3)
    : drawSquirrel({...outfit, pose: look.pose, effects: look.effects}));
  return html`<div
    class=${classMap(classes)}
    data-racer=${member.index}
    data-tree=${look.tree}
    style="--start-lane: ${member.number - 1}"
  >
    <div class="racer-body">
      <span class="racer-sprite">${guard([poseKey], drawBody)}</span>
      ${look.coat ? nothing : effectStandIns(look.effects)}
      ${look.decor.map((item) => renderDecoration(item))}
    </div>
    <span class="racer-bib">${renderBib(member, 'bib', name)}</span>
    ${look.finished
      ? html`<span class="racer-place">${drawPositionBadge(look.position)}</span>`
      : nothing}
  </div>`;
}

/**
 * @description Every squirrel on the stage. Hidden from assistive technology: the trunk labels,
 *   the leaderboard and the result announcement say in text what is happening.
 * @param {Object[]} cast - From buildCast.
 * @param {Object[]} looks - From sceneAt, one per entrant.
 * @param {string} band - The scale band.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
export function renderRacers(cast, looks, band) {
  const options = {band, laneCount: cast.length, cast};
  return html`<div class="racers" aria-hidden="true">
    ${repeat(
      cast,
      (member) => member.index,
      (member) => renderRacer(member, looks[member.index], options)
    )}
  </div>`;
}

/**
 * @description The labels at the foot of the trees: who is on each tree now, flipping after a
 *   tornado. Names truncate at 14 characters (the full name is there for screen readers and
 *   search) and rotate 45 degrees on narrow lanes (SPEC.md § 8).
 * @param {Object[]} cast - From buildCast.
 * @param {number[]} occupancy - Entrant index per tree (from sceneAt).
 * @param {boolean} rotated - Rotate the labels.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
export function renderTrunkLabels(cast, occupancy, rotated, i18n) {
  return html`<ol
    class=${classMap({'trunk-labels': true, 'is-rotated': rotated})}
    aria-label=${i18n.getMessage('Who is on each tree')}
  >
    ${occupancy.map((index, slot) => {
      const member = cast[index];
      if (!member) {
        return html`<li class="trunk-label" data-tree=${slot + 1}></li>`;
      }
      const spoken = i18n.getMessage('Tree {tree}: {name}, number {number}', {
        tree: slot + 1,
        name: member.name,
        number: member.number
      });
      return html`<li class="trunk-label" data-tree=${slot + 1} data-occupant=${member.index}>
        <span class="trunk-tag" aria-hidden="true" title=${member.name}
          >${renderBib(member, 'chip')}<span class="trunk-name">${member.label}</span></span
        >
        <span class="sr-only">${spoken}</span>
      </li>`;
    })}
  </ol>`;
}

/** The lanes' styles: trees, squirrels, bibs, decorations and labels. */
export const laneStyles = css`
  /* Field layers, back to front: trees 1, field-wide washes 1 (drawn after the trees,
     stage-field-layer.js), back overlays 2 (stage-chaos-layer.js), squirrels 3, front overlays 4,
     light accents 5, VAR review 7, photo-finish stamp 8 (stage-podium.js). Explicit, because with
     every layer at z-index auto the trees (each with a transformed tree-art) painted over the
     overlays. */
  .trees {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(var(--lanes), minmax(0, 1fr));
  }

  .tree {
    position: relative;
    height: 100%;
    transform-origin: 50% 100%;
  }

  .tree-art {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: var(--tree-w);
    transform: translateX(-50%);
  }

  .tree-art svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .tree.is-plain::before {
    content: '';
    position: absolute;
    left: 50%;
    top: calc(var(--climb-top) * 0.6);
    bottom: 0;
    width: clamp(4px, calc(var(--lane-w) * 0.22), 28px);
    transform: translateX(-50%);
    border-radius: 6px 6px 2px 2px;
    background: linear-gradient(90deg, var(--ss-bark-dark), var(--ss-bark), var(--ss-bark-dark));
  }

  .tree.is-plain::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 22%;
    width: clamp(10px, calc(var(--lane-w) * 0.5), 60px);
    height: 4px;
    transform: translateX(-10%) rotate(-18deg);
    border-radius: 2px;
    background: var(--ss-bark);
  }

  .tree-nut {
    position: absolute;
    top: 0;
    left: 50%;
    width: calc(var(--sprite) * 0.55);
    height: calc(var(--sprite) * 0.55);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--sprite) * 0.45);
  }

  .tree-nut svg {
    width: 100%;
    height: 100%;
  }

  .tree-nut.is-bouncing {
    animation: stage-nut-bounce 700ms var(--ease-heavy-bounce, ease-in-out) infinite;
  }

  .tree.is-plain.is-swaying {
    animation: stage-tree-sway 320ms ease-in-out infinite alternate;
  }

  .trees.is-twisting .tree.is-plain {
    animation: stage-tree-bend 520ms ease-in-out infinite alternate;
  }

  .tree.is-plain.is-wobbling {
    animation: stage-tree-wobble 90ms linear infinite alternate;
  }

  .racers {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }

  .racer {
    position: absolute;
    left: 0;
    top: var(--climb-top);
    width: var(--lane-w);
    height: var(--climb-span);
    transform: translate3d(calc(var(--start-lane) * 100%), 100%, 0);
    /* Which way the eagle dives in from and flies off to (stage-scrubs.js). */
    --away-x: 1;
  }

  .racer.is-east {
    --away-x: -1;
  }

  .racer-body {
    position: absolute;
    top: 0;
    left: 50%;
    width: var(--sprite);
    height: var(--sprite);
    margin-left: calc(var(--sprite) / -2);
    transform-origin: 50% 70%;
  }

  .racer-sprite {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--sprite) * 0.8);
    line-height: 1;
  }

  .racer-sprite svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Plain climbing needs no wrapper motion: the kit's climb pose wobbles and flicks its tail. */
  .racer.motion-burst .racer-body {
    animation: stage-wobble 160ms ease-in-out infinite alternate;
  }

  .racer.motion-burst .racer-body::after {
    content: '';
    position: absolute;
    left: 15%;
    right: 15%;
    top: 100%;
    height: 60%;
    background: repeating-linear-gradient(
      90deg,
      transparent 0 18%,
      var(--ss-speed-line) 18% 24%
    );
    opacity: 0.8;
  }

  .racer.motion-shake .racer-body {
    animation: stage-shake 120ms linear infinite;
  }

  .racer.motion-spin .racer-body {
    animation: stage-spin 420ms linear infinite;
  }

  .racer.motion-tumble .racer-body {
    animation: stage-tumble 500ms ease-in both;
  }

  .racer.motion-lean .racer-body {
    transform: translateX(18%) rotate(12deg);
  }

  .racer.motion-lean.lean-left .racer-body {
    transform: translateX(-18%) rotate(-12deg);
  }

  .racer.motion-cling .racer-body {
    animation: stage-tree-sway 320ms ease-in-out infinite alternate;
  }

  /* Chaos v2: weighed down by a cat, flapping like a flag in the leaf gust, bouncing in an
     earthquake, juddering under a woodpecker, floating in a UFO's beam. */
  .racer.motion-cling-cat .racer-body {
    animation: stage-heavy-wobble 600ms ease-in-out infinite alternate;
  }

  .racer.motion-flag .racer-body {
    animation: stage-flutter 140ms ease-in-out infinite alternate;
  }

  .racer.motion-quake .racer-body {
    animation: stage-bounce 220ms ease-in-out infinite alternate;
  }

  .racer.motion-vibrate .racer-body {
    animation: stage-vibrate 60ms linear infinite;
  }

  .racer.motion-beamed .racer-body {
    animation: stage-beamed 1200ms ease-in-out infinite alternate;
  }

  /* Inside a trench coat: the box keeps its place, unseen. */
  .racer.is-hidden {
    visibility: hidden;
  }

  /* The trench coat stands on the host's feet and towers over the trunk. */
  .racer.is-coat .racer-body {
    top: calc(var(--sprite) * -1.3);
    width: calc(var(--sprite) * 1.1);
    height: calc(var(--sprite) * 2.3);
    margin-left: calc(var(--sprite) * -0.55);
  }

  .racer.is-coat .racer-sprite {
    font-size: calc(var(--sprite) * 1.4);
  }

  .racer-bib {
    position: absolute;
    top: var(--sprite);
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(var(--lane-w) - 2px);
  }

  .racer-place {
    position: absolute;
    top: calc(var(--sprite) * -0.2);
    left: calc(50% + var(--sprite) * 0.3);
    width: calc(var(--sprite) * 0.5);
    min-width: 14px;
    height: calc(var(--sprite) * 0.5);
    min-height: 14px;
  }

  .racer-place svg {
    width: 100%;
    height: 100%;
  }

  .bib {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    max-width: 100%;
    padding: 0 4px;
    overflow: hidden;
    color: var(--bib-ink);
    background-color: var(--bib);
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .bib::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.35;
  }

  .bib-size-bib {
    height: var(--bib-h);
    font-size: calc(var(--bib-h) * 0.62);
  }

  .bib-size-chip {
    height: 1.25rem;
    min-width: 1.25rem;
    justify-content: center;
    font-size: 0.7rem;
  }

  .bib-number,
  .bib-name {
    position: relative;
  }

  .bib-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bib-shape-circle {
    border-radius: 999px;
  }

  .bib-shape-square {
    border-radius: 2px;
  }

  .bib-shape-diamond {
    border-radius: 2px;
    clip-path: polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%);
  }

  .bib-shape-shield {
    border-radius: 2px 2px 40% 40%;
  }

  .bib-shape-hexagon {
    clip-path: polygon(12% 0, 88% 0, 100% 50%, 88% 100%, 12% 100%, 0 50%);
  }

  .bib-pattern-stripes::before {
    background: repeating-linear-gradient(90deg, var(--bib-ink) 0 2px, transparent 2px 6px);
  }

  .bib-pattern-dots::before {
    background: radial-gradient(var(--bib-ink) 1px, transparent 1.5px) 0 0 / 5px 5px;
  }

  .bib-pattern-chevrons::before {
    background: repeating-linear-gradient(135deg, var(--bib-ink) 0 2px, transparent 2px 7px);
  }

  .bib-pattern-checks::before {
    background: repeating-conic-gradient(var(--bib-ink) 0 25%, transparent 0 50%) 0 0 / 6px 6px;
  }

  .bib-pattern-zigzag::before {
    background: repeating-linear-gradient(60deg, var(--bib-ink) 0 1px, transparent 1px 5px);
  }

  .bib-pattern-stars::before {
    background: radial-gradient(circle, var(--bib-ink) 1.5px, transparent 2px) 0 0 / 7px 7px;
  }

  .bib-pattern-hoops::before {
    background: repeating-linear-gradient(0deg, var(--bib-ink) 0 2px, transparent 2px 6px);
  }

  .bib-pattern-diagonal::before {
    background: repeating-linear-gradient(45deg, var(--bib-ink) 0 2px, transparent 2px 8px);
  }

  .bib-pattern-crosses::before {
    background:
      repeating-linear-gradient(45deg, var(--bib-ink) 0 1px, transparent 1px 6px),
      repeating-linear-gradient(-45deg, var(--bib-ink) 0 1px, transparent 1px 6px);
  }

  .decor {
    position: absolute;
    pointer-events: none;
  }

  .decor svg {
    width: 100%;
    height: 100%;
  }

  .decor-hearts {
    left: 10%;
    bottom: 80%;
    width: 80%;
    height: 80%;
  }

  .heart {
    position: absolute;
    bottom: 0;
    width: 40%;
    height: 40%;
    font-size: calc(var(--sprite) * 0.3);
  }

  .heart-1 {
    left: 0;
  }

  .heart-2 {
    left: 30%;
  }

  .heart-3 {
    left: 60%;
  }

  .decor-kiss {
    right: -10%;
    top: 30%;
    width: 40%;
    height: 40%;
    font-size: calc(var(--sprite) * 0.3);
  }

  .decor-slap {
    left: -25%;
    top: 20%;
    width: 50%;
    height: 50%;
    font-size: calc(var(--sprite) * 0.35);
  }

  .decor-smoke {
    left: 20%;
    bottom: 50%;
    width: 70%;
    height: 70%;
    font-size: calc(var(--sprite) * 0.4);
  }

  .decor-stars {
    left: 5%;
    top: -35%;
    width: 90%;
    height: 50%;
    font-size: calc(var(--sprite) * 0.25);
    animation: stage-spin 900ms linear infinite;
  }

  .decor-zap {
    inset: -15%;
  }

  .zap {
    position: absolute;
    width: 30%;
    height: 40%;
    font-size: calc(var(--sprite) * 0.25);
    animation: stage-flicker 160ms steps(2, end) infinite;
  }

  .zap-1 {
    left: 0;
    top: 0;
  }

  .zap-2 {
    right: 0;
    top: 10%;
  }

  .decor-eagle {
    left: -20%;
    bottom: 55%;
    width: 140%;
    height: 90%;
    font-size: calc(var(--sprite) * 0.7);
  }

  .eagle-art,
  .eagle-puzzled {
    position: absolute;
    inset: 0;
  }

  .eagle-cat {
    position: absolute;
    left: 32%;
    top: 62%;
    width: 40%;
    height: 50%;
    font-size: calc(var(--sprite) * 0.35);
  }

  .eagle-puzzled::after {
    content: '?';
    position: absolute;
    right: 0;
    top: -25%;
    color: var(--ss-hud-ink);
    font-size: calc(var(--sprite) * 0.45);
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 1px 2px var(--ss-hud-shadow);
  }

  /* A thrown cat lands on the squirrel's back; the stylesheet's frame is where it lands. */
  .decor-cat {
    left: -30%;
    top: 10%;
    width: 70%;
    height: 70%;
    font-size: calc(var(--sprite) * 0.45);
  }

  .decor-cat-cling {
    left: -25%;
    top: 20%;
    width: 65%;
    height: 65%;
    font-size: calc(var(--sprite) * 0.4);
  }

  .decor-cheeks {
    inset: 0;
  }

  /* Named decor-cheek: the kit's squirrel has its own inner "cheek" group. */
  .decor-cheek {
    position: absolute;
    top: 28%;
    width: 22%;
    height: 22%;
    font-size: calc(var(--sprite) * 0.18);
  }

  .decor-cheek-left {
    left: 48%;
  }

  .decor-cheek-right {
    left: 72%;
  }

  .decor-acorn {
    left: 15%;
    top: -45%;
    width: 70%;
    height: 70%;
    font-size: calc(var(--sprite) * 0.45);
  }

  /* The nut that's too big, balanced on the squirrel's head. */
  .decor-big-nut {
    left: 15%;
    top: -60%;
    width: 80%;
    height: 80%;
    font-size: calc(var(--sprite) * 0.6);
  }

  .trunk-labels {
    display: grid;
    grid-template-columns: repeat(var(--lanes), minmax(0, 1fr));
    height: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .trunk-label {
    position: relative;
    min-width: 0;
  }

  .trunk-tag {
    position: absolute;
    top: 4px;
    left: 50%;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: calc(100% - 4px);
    padding: 1px 4px 1px 1px;
    border-radius: 999px;
    color: var(--ss-label-ink);
    background-color: var(--ss-label-paper);
    font-size: var(--label-font);
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    transform: translateX(-50%);
  }

  .trunk-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trunk-labels.is-rotated .trunk-tag {
    max-width: none;
    transform: rotate(45deg);
    transform-origin: 0 50%;
  }

  @keyframes stage-wobble {
    from {
      transform: rotate(-4deg) translateY(0);
    }
    to {
      transform: rotate(4deg) translateY(-3%);
    }
  }

  @keyframes stage-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-8%);
    }
    75% {
      transform: translateX(8%);
    }
  }

  @keyframes stage-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes stage-tumble {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(540deg);
    }
  }

  @keyframes stage-tree-sway {
    from {
      transform: rotate(-3deg);
    }
    to {
      transform: rotate(3deg);
    }
  }

  @keyframes stage-tree-bend {
    from {
      transform: skewX(-6deg);
    }
    to {
      transform: skewX(8deg);
    }
  }

  @keyframes stage-nut-bounce {
    0%,
    100% {
      transform: translateX(-50%) translateY(0);
    }
    40% {
      transform: translateX(-50%) translateY(-45%);
    }
  }

  @keyframes stage-flicker {
    to {
      opacity: 0.2;
    }
  }

  @keyframes stage-heavy-wobble {
    from {
      transform: rotate(-6deg) translateY(0);
    }
    to {
      transform: rotate(6deg) translateY(4%);
    }
  }

  @keyframes stage-flutter {
    from {
      transform: skewY(-6deg) translateX(-4%);
    }
    to {
      transform: skewY(6deg) translateX(4%);
    }
  }

  @keyframes stage-bounce {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-14%);
    }
  }

  @keyframes stage-vibrate {
    0%,
    100% {
      transform: translate(0, 0);
    }
    25% {
      transform: translate(-6%, 2%);
    }
    50% {
      transform: translate(5%, -2%);
    }
    75% {
      transform: translate(-3%, -3%);
    }
  }

  @keyframes stage-beamed {
    from {
      transform: rotate(-12deg) scale(0.95);
    }
    to {
      transform: rotate(12deg) scale(1.05);
    }
  }

  @keyframes stage-tree-wobble {
    from {
      transform: translateX(-2px) rotate(-1deg);
    }
    to {
      transform: translateX(2px) rotate(1deg);
    }
  }
`;
