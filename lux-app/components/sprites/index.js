import {
  ACCESSORY_IDS,
  CAPE_IDS,
  FUR_IDS,
  HAT_IDS,
  SQUIRREL_EFFECT_IDS,
  SQUIRREL_POSE_IDS
} from './squirrel.js';
import {
  BEAVER_POSE_IDS,
  EAGLE_POSE_IDS,
  HUNTER_POSE_IDS,
  SUITOR_POSE_IDS,
  TORNADO_DEBRIS_IDS
} from './cast.js';
import {CROWD_KIND_IDS, CROWD_POSE_IDS, SKY_PRESET_IDS} from './scenery.js';
import {FIELD_SPRITE_NAMES, OWL_REFEREE_POSE_IDS} from './field.js';
import {BOOTH_SPRITE_NAMES, OWL_COMMENTATOR_POSE_IDS} from './booth.js';
import {ANIMATION_CLASSES} from './animations.js';

/**
 * Squirrel Scramble sprite kit: one import for every sprite, helper, id list and style,
 * including the Chaos v2 sprites in cast2.js (sprite lane A) and field.js (sprite lane B), and
 * the owl commentator's booth in booth.js (contract § 12, since 2.2.0).
 *
 *   import {squirrelSprite, spriteStyles} from '../../components/sprites/index.js';
 *
 * Put `spriteStyles` in the static styles of any component that renders sprites. The art
 * catalogue below lists the ids each sprite can draw, so a page can iterate them; the outfit
 * ids match the theme config's catalogue (lib/theme-config.js), which owns labels and rarity.
 */

export * from './squirrel.js';
export * from './cast.js';
export * from './scenery.js';
export * from './cast2.js';
export * from './field.js';
export * from './booth.js';
export * from './animations.js';

/**
 * Every id with art, per slot and per sprite, in catalogue order. The cast2 sprite names and
 * pose lists follow the Chaos v2 contract (docs/specs/squirrel-scramble-chaos-v2.md § 5).
 */
export const SPRITE_CATALOGUE = Object.freeze({
  furs: FUR_IDS,
  hats: HAT_IDS,
  capes: CAPE_IDS,
  accessories: ACCESSORY_IDS,
  poses: SQUIRREL_POSE_IDS,
  effects: SQUIRREL_EFFECT_IDS,
  suitorPoses: SUITOR_POSE_IDS,
  hunterPoses: HUNTER_POSE_IDS,
  eaglePoses: EAGLE_POSE_IDS,
  beaverPoses: BEAVER_POSE_IDS,
  tornadoDebris: TORNADO_DEBRIS_IDS,
  crowdKinds: CROWD_KIND_IDS,
  crowdPoses: CROWD_POSE_IDS,
  skies: SKY_PRESET_IDS,
  animations: Object.freeze(Object.keys(ANIMATION_CLASSES)),
  cast2Sprites: Object.freeze([
    'catLadySprite',
    'flyingCatSprite',
    'goldenAcornSprite',
    'sharkSprite',
    'gardenerSprite',
    'leafGustSprite',
    'ufoSprite',
    'woodpeckerSprite'
  ]),
  catLadyPoses: Object.freeze(['walk', 'throw', 'cackle']),
  flyingCatPoses: Object.freeze(['fly', 'cling', 'drop']),
  goldenAcornPoses: Object.freeze(['fly', 'loop', 'impact']),
  sharkPoses: Object.freeze(['circle', 'chomp']),
  gardenerPoses: Object.freeze(['walk', 'blow', 'toupee-off']),
  woodpeckerPoses: Object.freeze(['peck', 'idle']),
  fieldSprites: FIELD_SPRITE_NAMES,
  owlRefereePoses: OWL_REFEREE_POSE_IDS,
  boothSprites: BOOTH_SPRITE_NAMES,
  owlCommentatorPoses: OWL_COMMENTATOR_POSE_IDS
});
