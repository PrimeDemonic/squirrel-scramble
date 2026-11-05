/**
 * The race stage's one door to the sprite kit in components/sprites/ (SPEC.md § 12). Every sprite
 * the stage draws goes through a function here, so the stage depends on the kit's names and
 * argument shapes in this file only.
 *
 * Written against the agreed exports of components/sprites/index.js (squirrelSprite, suitorSprite,
 * hunterSprite, tornadoSprite, eagleSprite, beaverSprite, lightningBolt, heartSprite, kissMark,
 * slapHand, stars, smokePuff, sootCloud, confettiPiece, positionBadge, treeSprite, chestnut,
 * crowdAnimal, skyBackdrop, SPRITE_CATALOGUE), the Chaos v2 sprites (Chaos v2 contract § 5:
 * catLadySprite, flyingCatSprite, goldenAcornSprite, sharkSprite, gardenerSprite, leafGustSprite,
 * ufoSprite, woodpeckerSprite from cast2.js; crackSprite, molePopSprite, floodWaterSprite,
 * rubberRingSprite, rubberDuckSprite, mirrorBallSprite, discoLightsSprite, hailNutSprite,
 * owlRefereeSprite, varLinesSprite, trenchCoatSprite from field.js; the squirrel's dance and flag
 * poses and chubby, catClinging and vibrate effects), the weather art (Chaos v2 contract § 14:
 * rainSheetSprite, splashRippleSprite, thundercloudSprite from scenery.js) and the Lit css
 * exports of the kit. The kit
 * is read through namespace imports, so a sprite that is missing or renamed draws a small emoji
 * or nothing instead of breaking the build, and a missing squirrel pose draws its nearest
 * stand-in.
 *
 * A sprite may come back as an svg`` fragment (drawn inside an <svg> here, with the viewBox from
 * SPRITE_CATALOGUE when it gives one) or as an html`` template that carries its own <svg>; both
 * render. Every sprite is decorative and hidden from assistive technology: the stage says in text
 * what the pictures show.
 */
import {html, nothing, CSSResult} from 'lit';
import * as spriteKit from './sprites/index.js';
import * as spriteMotion from './sprites/animations.js';

// Lit marks svg`` template results with this _$litType$ value (html`` results carry 1).
const SVG_RESULT = 2;
const DEFAULT_VIEW_BOX = '0 0 100 100';
// The sky fills the stage, cropping rather than letterboxing.
const SKY_VIEW_BOX = '0 0 1600 900';
// How a fragment fits its box: the sky crops, trees and bolts stretch to their tall, narrow
// lanes, everything else keeps its shape and stands on the bottom edge.
const FITS = {skyBackdrop: 'xMidYMid slice', treeSprite: 'none', lightningBolt: 'none'};

// Squirrel poses the stage asks for that an older kit may not draw yet, and the pose that stands
// in for each: dancing at the disco looks like the victory dance, clinging sideways in the leaf
// gust like flying.
const POSE_STAND_INS = Object.freeze({dance: 'victory', flag: 'fly'});

/**
 * @description Collects the Lit stylesheets in a module namespace: every CSSResult export, and
 *   the CSSResults inside any exported array of them (the kit's spriteStyles list).
 * @param {Object} namespace - The module namespace.
 * @returns {CSSResult[]} The stylesheets.
 * @since 1.0.0
 */
function stylesheetsIn(namespace) {
  return Object.values(namespace).flatMap((value) => {
    if (value instanceof CSSResult) {
      return [value];
    }
    return Array.isArray(value) ? value.filter((item) => item instanceof CSSResult) : [];
  });
}

/**
 * Every Lit stylesheet the sprite kit exports (its animations module, and anything index.js
 * re-exports, such as cast2Animations and fieldAnimations), each once, so the stage adopts the
 * kit's keyframes and classes alongside its own.
 * @type {CSSResult[]}
 */
export const spriteStyles = Array.from(new Set([
  ...stylesheetsIn(spriteMotion),
  ...stylesheetsIn(spriteKit)
]));

/**
 * @description Says whether the kit offers a sprite function by this name.
 * @param {string} name - The export name, for example 'treeSprite'.
 * @returns {boolean} True when it is a function.
 * @example
 *   hasSprite('treeSprite');
 * @since 1.0.0
 */
export function hasSprite(name) {
  return typeof spriteKit[name] === 'function';
}

/**
 * @description Reads one id list from the kit's SPRITE_CATALOGUE.
 * @param {string} listName - The catalogue key, for example 'poses'.
 * @returns {string[]} The ids (empty when the catalogue lacks the list).
 * @since 1.0.0
 */
function catalogueList(listName) {
  const catalogue = spriteKit.SPRITE_CATALOGUE;
  const list = catalogue && typeof catalogue === 'object' ? catalogue[listName] : null;
  return Array.isArray(list) ? list : [];
}

/**
 * @description Says whether the kit's squirrel draws an effect (catalogue effects list).
 * @param {string} name - The effect, for example 'catClinging'.
 * @returns {boolean} True when it does.
 * @example
 *   hasEffect('chubby');
 * @since 1.0.0
 */
export function hasEffect(name) {
  return catalogueList('effects').includes(name);
}

/**
 * @description The squirrel pose to ask the kit for: the pose itself when the kit draws it, else
 *   its stand-in (dance as victory, flag as fly).
 * @param {string} pose - The pose the stage wants.
 * @returns {string} The pose to draw.
 * @since 1.0.0
 */
function drawablePose(pose) {
  const poses = catalogueList('poses');
  if (poses.length === 0 || poses.includes(pose)) {
    return pose;
  }
  return POSE_STAND_INS[pose] || pose;
}

/**
 * @description The viewBox for an svg fragment: the catalogue's, when it lists the sprite.
 * @param {string} name - The export name.
 * @returns {string} The viewBox.
 * @since 1.0.0
 */
function viewBoxFor(name) {
  const catalogue = spriteKit.SPRITE_CATALOGUE;
  const entry = catalogue && typeof catalogue === 'object' ? catalogue[name] : null;
  if (entry && typeof entry.viewBox === 'string') {
    return entry.viewBox;
  }
  return name === 'skyBackdrop' ? SKY_VIEW_BOX : DEFAULT_VIEW_BOX;
}

/**
 * @description Wraps what a sprite function returned so it renders in an html template: an svg
 *   fragment goes inside a hidden <svg>; anything else renders as it is.
 * @param {string} name - The export name.
 * @param {*} drawn - The sprite function's result.
 * @param {*} fallback - What to render when there is nothing.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
function present(name, drawn, fallback) {
  if (drawn === undefined || drawn === null || drawn === nothing) {
    return fallback;
  }
  if (drawn && drawn._$litType$ === SVG_RESULT) {
    const fit = FITS[name] || 'xMidYMax meet';
    return html`<svg
      class="sprite-svg"
      viewBox=${viewBoxFor(name)}
      preserveAspectRatio=${fit}
      aria-hidden="true"
      focusable="false"
    >${drawn}</svg>`;
  }
  return drawn;
}

/**
 * @description Calls one sprite function, falling back when the kit lacks it or it throws.
 * @param {string} name - The export name.
 * @param {Array} args - The arguments.
 * @param {*} [fallback] - What to render instead.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
function draw(name, args, fallback = nothing) {
  if (!hasSprite(name)) {
    return fallback;
  }
  try {
    return present(name, spriteKit[name](...args), fallback);
  } catch {
    // A broken sprite must not stop the race; the emoji stands in.
    return fallback;
  }
}

/**
 * @description A small emoji stand-in, hidden from assistive technology.
 * @param {string} character - The emoji.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function glyph(character) {
  return html`<span class="sprite-glyph" aria-hidden="true">${character}</span>`;
}

/**
 * @description The squirrel in its outfit, pose and effects. The stage keeps effects as a list of
 *   names; the kit takes them as flags ({singed: true, ...}), so the list is turned into flags.
 * @param {{fur: string, hat: string, cape: string, accessory: string, pose: string,
 *   effects: string[]}} look - What to draw.
 * @returns {*} A Lit-renderable value.
 * @example
 *   drawSquirrel({fur: 'red', hat: 'crown', cape: 'none', accessory: 'none', pose: 'climb',
 *     effects: ['lipstick']});
 * @since 1.0.0
 */
export function drawSquirrel(look) {
  const names = Array.isArray(look.effects) ? look.effects : [];
  const flags = Object.fromEntries(names.map((name) => [name, true]));
  const pose = drawablePose(look.pose);
  return draw('squirrelSprite', [{...look, pose, effects: flags}], glyph('🐿️'));
}

/**
 * @description The suitor on her branch.
 * @param {string} pose - 'beckon', 'kiss', 'slap' or 'wave-off'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawSuitor(pose) {
  return draw('suitorSprite', [{pose}], glyph('🐿️'));
}

/**
 * @description The hunter. His fire pose draws its own comic burst, and his backfire its own
 *   smoke.
 * @param {string} pose - 'walk', 'aim', 'fire', 'backfire' or 'grumble'.
 * @param {string} burstLabel - The translated word in the fire pose's burst ("BLAM!").
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawHunter(pose, burstLabel) {
  return draw('hunterSprite', [{pose, burstLabel}], glyph('🎯'));
}

/**
 * @description The tornado funnel.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawTornado() {
  return draw('tornadoSprite', [], glyph('🌪️'));
}

/**
 * @description One piece of tornado debris. Tries a debrisSprite(kind) export, then
 *   <kind>Sprite(), then <kind>().
 * @param {string} kind - 'leaf', 'gnome' or 'cow'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawDebris(kind) {
  const stand = {leaf: '🍂', gnome: '🧙', cow: '🐄'}[kind] || '🍂';
  if (hasSprite('debrisSprite')) {
    return draw('debrisSprite', [kind], glyph(stand));
  }
  if (hasSprite(`${kind}Sprite`)) {
    return draw(`${kind}Sprite`, [], glyph(stand));
  }
  return draw(kind, [], glyph(stand));
}

/**
 * @description The eagle.
 * @param {string} pose - 'dive', 'carry' or 'fly'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawEagle(pose) {
  return draw('eagleSprite', [{pose}], glyph('🦅'));
}

/**
 * @description The beaver.
 * @param {string} pose - 'gnaw'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawBeaver(pose) {
  return draw('beaverSprite', [{pose}], glyph('🦫'));
}

/**
 * @description A lightning bolt.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawBolt() {
  return draw('lightningBolt', [], glyph('⚡'));
}

/**
 * @description A heart.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawHeart() {
  return draw('heartSprite', [], glyph('❤️'));
}

/**
 * @description A kiss mark.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawKissMark() {
  return draw('kissMark', [], glyph('💋'));
}

/**
 * @description A slapping hand.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawSlapHand() {
  return draw('slapHand', [], glyph('👋'));
}

/**
 * @description Circling stars, for a dizzy squirrel.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawStars() {
  return draw('stars', [], glyph('⭐'));
}

/**
 * @description A puff of smoke.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawSmoke() {
  return draw('smokePuff', [], glyph('💨'));
}

/**
 * @description A soot cloud, for the hunter's backfire.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawSoot() {
  return draw('sootCloud', [], glyph('💨'));
}

/**
 * @description One confetti piece.
 * @param {number} colourIndex - Which confetti colour.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawConfetti(colourIndex) {
  return draw('confettiPiece', [colourIndex], nothing);
}

/**
 * @description A finishing-position badge.
 * @param {number} position - 1, 2, 3 and so on.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawPositionBadge(position) {
  return draw('positionBadge', [position], html`<span class="sprite-number">${position}</span>`);
}

/**
 * @description One tree, with its own chestnut on top. The stage draws a plain trunk and a
 *   separate chestnut when the kit has no tree.
 * @param {{height: number, swaying: boolean, className: string}} options - The viewBox height
 *   (the kit's tree is 60 units wide, anchored at the bottom), whether it sways, and extra root
 *   classes ('ss-anim-chestnut-bounce' for the winner, 'ss-anim-tree-bend' in a tornado).
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawTree(options) {
  return draw('treeSprite', [options], nothing);
}

/**
 * @description The chestnut at the top of a tree.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawChestnut() {
  return draw('chestnut', [], glyph('🌰'));
}

/**
 * @description One woodland spectator. The kit has no cheer pose, so a cheer waves (the stage
 *   adds the hopping).
 * @param {string} kind - 'hedgehog', 'rabbit', 'owl', 'badger' or 'fox'.
 * @param {string} pose - 'idle', 'wave', 'gasp' or 'cheer'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawCrowdAnimal(kind, pose) {
  const stand = {hedgehog: '🦔', rabbit: '🐇', owl: '🦉', badger: '🦡', fox: '🦊'}[kind] || '🦔';
  const spritePose = pose === 'cheer' ? 'wave' : pose;
  return draw('crowdAnimal', [kind, spritePose], glyph(stand));
}

/**
 * @description The sky behind the stage. The stage paints the preset's gradient underneath, so a
 *   missing backdrop still leaves a sky. Rain is not part of it (drawRainSheet).
 * @param {string} preset - 'day', 'golden_hour', 'night', 'drizzle' or 'storm'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawSky(preset) {
  return draw('skyBackdrop', [preset], nothing);
}

/**
 * @description One static rain sheet for an HTML rain layer (Chaos v2 contract § 14). Without
 *   the kit's sheet there is no rain: the sky still reads as wet from its colours.
 * @param {Array<{d: string, width: number, opacity: number}>} groups - From streakGroups.
 * @param {string} colour - The streaks' colour, a literal #RRGGBB.
 * @returns {*} A Lit-renderable value.
 * @example
 *   drawRainSheet(streakGroups(layer.streaks), '#CFE3F2');
 * @since 2.2.0
 */
export function drawRainSheet(groups, colour) {
  return draw('rainSheetSprite', [{groups, colour}], nothing);
}

/**
 * @description One splash ripple for the grass strip (Chaos v2 contract § 14).
 * @returns {*} A Lit-renderable value.
 * @since 2.2.0
 */
export function drawSplash() {
  return draw('splashRippleSprite', [], nothing);
}

/**
 * @description The cartoon thundercloud a lightning strike comes out of in a sky with no storm
 *   clouds (Chaos v2 contract § 14).
 * @returns {*} A Lit-renderable value.
 * @since 2.2.0
 */
export function drawThundercloud() {
  return draw('thundercloudSprite', [], glyph('🌩️'));
}

/**
 * @description The crazy cat lady with her bottomless handbag.
 * @param {string} pose - 'walk', 'throw' or 'cackle'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawCatLady(pose) {
  return draw('catLadySprite', [{pose}], glyph('👵'));
}

/**
 * @description A thrown cat.
 * @param {string} pose - 'fly', 'cling' or 'drop'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawFlyingCat(pose) {
  return draw('flyingCatSprite', [{pose}], glyph('🐈'));
}

/**
 * @description The winged, angry Golden Acorn of Doom.
 * @param {string} pose - 'fly', 'loop' or 'impact'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawGoldenAcorn(pose) {
  return draw('goldenAcornSprite', [{pose}], glyph('🌰'));
}

/**
 * @description A sharknado shark, wearing the hat it stole once it has one.
 * @param {string} pose - 'circle' or 'chomp'.
 * @param {string} hat - A hat id, or 'none'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawShark(pose, hat) {
  return draw('sharkSprite', [{pose, hat}], glyph('🦈'));
}

/**
 * @description The gardener with his leaf blower (and his toupee, for now).
 * @param {string} pose - 'walk', 'blow' or 'toupee-off'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawGardener(pose) {
  return draw('gardenerSprite', [{pose}], glyph('👨‍🌾'));
}

/**
 * @description The leaf gust's swirl of leaves.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawLeafGust() {
  return draw('leafGustSprite', [], glyph('🍃'));
}

/**
 * @description The pigeon blown along in the leaf gust (no kit sprite: an emoji).
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
export function drawPigeon() {
  return glyph('🕊️');
}

/**
 * @description The flying saucer, with the tiny alien waving from its window.
 * @param {boolean} beam - Its tractor beam is on.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawUfo(beam) {
  return draw('ufoSprite', [{beam}], glyph('🛸'));
}

/**
 * @description The woodpecker in its tiny hard hat.
 * @param {string} pose - 'peck' or 'idle'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawWoodpecker(pose) {
  return draw('woodpeckerSprite', [{pose}], glyph('🐦'));
}

/**
 * @description The crack across the ground strip. The stage draws a plain crack underneath, so a
 *   missing sprite still leaves one.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawCrack() {
  return draw('crackSprite', [], nothing);
}

/**
 * @description The mole popping out of the crack.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawMole() {
  return draw('molePopSprite', [], glyph('🐹'));
}

/**
 * @description The flood water, rising from the bottom of a box that spans the climb, so the
 *   plan's waterHeightUnits is the level. The stage paints plain water when the kit has none.
 * @param {number} level - The waterline, in height units (0 to 100).
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawFloodWater(level) {
  return draw('floodWaterSprite', [{level}], nothing);
}

/**
 * @description A crowd animal bobbing in a rubber ring.
 * @param {string} kind - The crowd animal.
 * @param {string} pose - Its pose ('idle', 'wave' or 'gasp').
 * @param {*} fallback - What to draw without the kit's ring (the animal and a plain ring).
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawRubberRing(kind, pose, fallback) {
  const spritePose = pose === 'cheer' ? 'wave' : pose;
  return draw('rubberRingSprite', [kind, spritePose], fallback);
}

/**
 * @description The lone rubber duck.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawRubberDuck() {
  return draw('rubberDuckSprite', [], glyph('🦆'));
}

/**
 * @description The disco's mirror ball.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawMirrorBall() {
  return draw('mirrorBallSprite', [], glyph('🪩'));
}

/**
 * @description The disco's coloured lights. The stage paints a purple wash underneath.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawDiscoLights() {
  return draw('discoLightsSprite', [], nothing);
}

/**
 * @description One hailstone nut.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawHailNut() {
  return draw('hailNutSprite', [], glyph('🌰'));
}

/**
 * @description The owl referee with its whistle, tiny monitor and card.
 * @param {string} pose - 'whistle', 'monitor' or 'card'.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawOwlReferee(pose) {
  return draw('owlRefereeSprite', [{pose}], glyph('🦉'));
}

/**
 * @description The VAR lines across the field. The stage draws plain lines underneath.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawVarLines() {
  return draw('varLinesSprite', [], nothing);
}

/**
 * @description One very tall squirrel in a trench coat, hat and fake moustache.
 * @param {number|string[]} heads - How many squirrels are in the coat, or their fur ids, top
 *   first.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
export function drawTrenchCoat(heads) {
  return draw('trenchCoatSprite', [{heads}], glyph('🕵️'));
}
