import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {
  ANIMATION_CLASSES,
  SPRITE_CATALOGUE,
  TORNADO_DEBRIS,
  beaverSprite,
  chestnut,
  confettiPiece,
  crowdAnimal,
  eagleSprite,
  heartSprite,
  hunterSprite,
  kissMark,
  lightningBolt,
  positionBadge,
  skyBackdrop,
  slapHand,
  smokePuff,
  sootCloud,
  spriteStyles,
  squirrelSprite,
  stars,
  suitorSprite,
  tornadoSprite,
  treeSprite
} from '../../../components/sprites/index.js';
import {setDocumentTitle} from '../../../utils/document-title.js';
import {repairStaleShell} from '../../../utils/shell.js';

const {global, roles} = decorators;

/** Fully dressed squirrels, to check that hats, capes, accessories and furs layer cleanly. */
const LINE_UP = [
  {
    fur: 'golden',
    hat: 'crown',
    cape: 'royal',
    accessory: 'gold_chain',
    effects: {sparkle: true}
  },
  {
    fur: 'rainbow',
    hat: 'halo',
    cape: 'superhero',
    accessory: 'sunglasses',
    effects: {sparkle: true}
  },
  {fur: 'grey', hat: 'viking', cape: 'tartan', accessory: 'moustache'},
  {fur: 'black', hat: 'pirate', cape: 'red', accessory: 'eyepatch'},
  {fur: 'albino', hat: 'wizard', cape: 'purple', accessory: 'monocle'},
  {fur: 'cinnamon', hat: 'propeller', cape: 'blue', accessory: 'headphones'},
  {fur: 'red', hat: 'party', cape: 'green', accessory: 'bow_tie'},
  {fur: 'grey', hat: 'chef', cape: 'none', accessory: 'scarf'},
  {fur: 'red', hat: 'cowboy', cape: 'none', accessory: 'flower'},
  {fur: 'cinnamon', hat: 'traffic_cone', cape: 'red', accessory: 'none'},
  {fur: 'black', hat: 'beanie', cape: 'none', accessory: 'headphones'},
  {fur: 'golden', hat: 'top_hat', cape: 'royal', accessory: 'monocle'}
];

/** A hat that picks each victory dance (crown, viking and party), and one that jigs. */
const DANCES = [
  {dance: 'jig', hat: 'top_hat'},
  {dance: 'royal-wave', hat: 'crown'},
  {dance: 'war-dance', hat: 'viking'},
  {dance: 'conga', hat: 'party'}
];

/** Confetti indexes 0 to 7 show all eight colours and all three shapes. */
const CONFETTI_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7];

/** Podium places, a later place and a two-digit place. */
const BADGE_POSITIONS = [1, 2, 3, 4, 12];

/**
 * The Wardrobe page of Squirrel Scramble, at routeFor('wardrobe') in utils/routes.js: the visual
 * QA sheet for the sprite kit (components/sprites). Every fur, hat, cape, accessory, pose and
 * effect on the squirrel, the whole Chaos cast in every pose, the props, the scenery and the
 * event animations, each in a tile labelled with the id the race uses and tagged
 * data-testid="sprite-<group>-<id>".
 * One-shot animations loop here (--ss-oneshot-count: infinite), and a CSS-only switch pauses
 * everything. It loads no data; render() is pure and server-safe, and only firstUpdated()
 * (browser only) touches the document, to repair a stale shell and set the tab title.
 */
// Scoped to this app's experience; @roles writes sys_aix_page.roles (SPEC.md § 6, § 8).
@global(false)
@roles(['x_crli_squirrel.marshal'])
@customElement('x-crli-squirrel-wardrobe-v7-page')
export default class WardrobePage extends AIUXElement {
  static styles = [
    spriteStyles,
    css`
      :host {
        display: block;
      }

      /* One-shot animations loop here, and travelling ones stay inside their tiles. */
      .wardrobe-sheet {
        --ss-oneshot-count: infinite;
        --ss-tree-wobble-count: infinite;
        --ss-tornado-start: -28px;
        --ss-tornado-end: 28px;
        --ss-confetti-start: -24px;
        --ss-confetti-fall: 96px;
        --ss-confetti-drift: 16px;
        --ss-debris-rx: 26px;
        --ss-debris-ry: 8px;
        --ss-heart-rise: -36px;
        /* Looping flashes stay well under three a second. */
        --ss-photo-flash-duration: 2000ms;
        --ss-lightning-flash-duration: 2400ms;
      }

      /* The pause switch is CSS only, so render() stays pure. */
      .wardrobe-sheet:has(.motion-toggle:checked) * {
        animation-play-state: paused !important;
      }
    `
  ];

  /**
   * @description Repairs a stale cached shell (utils/shell.js) and sets the browser tab title
   *   (WCAG 2.2 SC 2.4.2). Client only.
   * @returns {void}
   * @throws {never} Never throws.
   * @example
   *   // Lit calls it once, after the first render in the browser.
   * @since 1.0.0
   */
  firstUpdated() {
    repairStaleShell(this);
    setDocumentTitle(i18n.getMessage('Wardrobe'));
  }

  /**
   * @description Renders one labelled tile: the art in a framed box and its id as the caption.
   * @param {string} group - The tile group for the test id, e.g. 'hat'.
   * @param {string} id - The id shown and used in the test id, e.g. 'top_hat'.
   * @param {*} art - The sprite, or a sprite with an overlay.
   * @param {Object} [layout] - Layout options.
   * @param {string} [layout.boxClass] - Height classes for the art box; 'h-28' by default.
   * @param {string} [layout.wrapClass] - Classes for the wrapper round the art, such as an
   *   animation class; it fills the box by default.
   * @returns {import('lit').TemplateResult} The list item.
   * @throws {never} Never throws.
   * @example
   *   this._tile('hat', 'crown', squirrelSprite({hat: 'crown'}));
   * @since 1.0.0
   */
  _tile(group, id, art, {boxClass = 'h-28', wrapClass = 'h-full w-full'} = {}) {
    return html`
      <li class="min-w-0">
        <figure
          class="aiux-card m-0 h-full bg-base-100 shadow-sm"
          data-testid=${`sprite-${group}-${id}`}
        >
          <div class="relative overflow-hidden p-2 ${boxClass}">
            <div class=${wrapClass}>${art}</div>
          </div>
          <figcaption class="px-2 pb-2 text-center text-xs text-text-secondary">
            <code class="break-words">${id}</code>
          </figcaption>
        </figure>
      </li>
    `;
  }

  /**
   * @description Renders a titled section holding a responsive grid of tiles.
   * @param {string} sectionId - A short id for the heading, e.g. 'hats'.
   * @param {string} heading - The translated heading text.
   * @param {Array<import('lit').TemplateResult>} tiles - The tiles.
   * @returns {import('lit').TemplateResult} The section.
   * @throws {never} Never throws.
   * @example
   *   this._section('hats', i18n.getMessage('Hats'), hatTiles);
   * @since 1.0.0
   */
  _section(sectionId, heading, tiles) {
    const headingId = `wardrobe-${sectionId}`;
    return html`
      <section class="flex flex-col gap-3" aria-labelledby=${headingId}>
        <h2 id=${headingId} class="text-xl font-semibold text-text-primary">${heading}</h2>
        <ul
          class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4
            lg:grid-cols-6 xl:grid-cols-8"
        >
          ${tiles}
        </ul>
      </section>
    `;
  }

  /**
   * @description Renders the squirrel sections: furs, hats, capes, accessories, poses with
   *   the victory dances, effects and a line-up of full outfits.
   * @returns {import('lit').TemplateResult} The sections.
   * @throws {never} Never throws.
   * @example
   *   this._squirrelSections();
   * @since 1.0.0
   */
  _squirrelSections() {
    const furTiles = SPRITE_CATALOGUE.furs.map(furId =>
      this._tile('fur', furId, squirrelSprite({fur: furId, pose: 'idle'}))
    );
    const hatTiles = SPRITE_CATALOGUE.hats.map(hatId =>
      this._tile('hat', hatId, squirrelSprite({hat: hatId, pose: 'idle'}))
    );
    const capeTiles = SPRITE_CATALOGUE.capes.map(capeId =>
      this._tile('cape', capeId, squirrelSprite({cape: capeId, pose: 'idle'}))
    );
    const accessoryTiles = SPRITE_CATALOGUE.accessories.map(accessoryId =>
      this._tile('accessory', accessoryId, squirrelSprite({accessory: accessoryId, pose: 'idle'}))
    );
    const poseTiles = SPRITE_CATALOGUE.poses.map(poseId =>
      this._tile('pose', poseId, squirrelSprite({pose: poseId}))
    );
    const danceTiles = DANCES.map(({dance, hat}) =>
      this._tile('dance', dance, squirrelSprite({pose: 'victory', hat}))
    );
    const effectTiles = SPRITE_CATALOGUE.effects.map(effectId =>
      this._tile('effect', effectId, squirrelSprite({pose: 'idle', effects: {[effectId]: true}}))
    );
    const lineUpTiles = LINE_UP.map(outfit =>
      this._tile(
        'lineup',
        `${outfit.hat}-${outfit.cape}-${outfit.accessory}-${outfit.fur}`,
        squirrelSprite({...outfit, pose: 'climb'})
      )
    );
    return html`
      ${this._section('furs', i18n.getMessage('Furs'), furTiles)}
      ${this._section('hats', i18n.getMessage('Hats'), hatTiles)}
      ${this._section('capes', i18n.getMessage('Capes'), capeTiles)}
      ${this._section('accessories', i18n.getMessage('Accessories'), accessoryTiles)}
      ${this._section('poses', i18n.getMessage('Poses and victory dances'), [
        ...poseTiles,
        ...danceTiles
      ])}
      ${this._section('effects', i18n.getMessage('Effects'), effectTiles)}
      ${this._section('lineup', i18n.getMessage('Line-up'), lineUpTiles)}
    `;
  }

  /**
   * @description Renders the Chaos cast in every pose, then the props, confetti and badges.
   * @param {string} burstLabel - The translated "BLAM!" for the hunter's fire pose.
   * @returns {import('lit').TemplateResult} The sections.
   * @throws {never} Never throws.
   * @example
   *   this._castSections(i18n.getMessage('BLAM!'));
   * @since 1.0.0
   */
  _castSections(burstLabel) {
    const suitorTiles = SPRITE_CATALOGUE.suitorPoses.map(poseId =>
      this._tile('suitor', poseId, suitorSprite({pose: poseId}))
    );
    const hunterTiles = SPRITE_CATALOGUE.hunterPoses.map(poseId =>
      this._tile('hunter', poseId, hunterSprite({pose: poseId, burstLabel}))
    );
    const tornadoTiles = [
      this._tile('tornado', 'funnel', tornadoSprite()),
      ...SPRITE_CATALOGUE.tornadoDebris.map(debrisId =>
        this._tile('debris', debrisId, TORNADO_DEBRIS[debrisId]())
      )
    ];
    const wildlifeTiles = [
      ...SPRITE_CATALOGUE.eaglePoses.map(poseId =>
        this._tile('eagle', poseId, eagleSprite({pose: poseId}))
      ),
      ...SPRITE_CATALOGUE.beaverPoses.map(poseId =>
        this._tile('beaver', poseId, beaverSprite({pose: poseId}))
      ),
      this._tile('lightning', 'bolt', lightningBolt())
    ];
    const propTiles = [
      this._tile('prop', 'heart', heartSprite()),
      this._tile('prop', 'kiss-mark', kissMark()),
      this._tile('prop', 'slap-hand', slapHand()),
      this._tile('prop', 'stars', stars()),
      this._tile('prop', 'smoke-puff', smokePuff()),
      this._tile('prop', 'soot-cloud', sootCloud()),
      ...CONFETTI_INDEXES.map(index =>
        this._tile('confetti', String(index), confettiPiece(index), {
          wrapClass: 'mx-auto h-12 w-12'
        })
      ),
      ...BADGE_POSITIONS.map(position =>
        this._tile('badge', String(position), positionBadge(position))
      )
    ];
    return html`
      ${this._section('suitor', i18n.getMessage('The suitor'), suitorTiles)}
      ${this._section('hunter', i18n.getMessage('The hunter'), hunterTiles)}
      ${this._section('tornado', i18n.getMessage('The tornado and its passengers'), tornadoTiles)}
      ${this._section('wildlife', i18n.getMessage('Eagle, beaver and lightning'), wildlifeTiles)}
      ${this._section('props', i18n.getMessage('Props, confetti and badges'), propTiles)}
    `;
  }

  /**
   * @description Renders the scenery: trees and the chestnut, the crowd in every pose, skies.
   * @returns {import('lit').TemplateResult} The sections.
   * @throws {never} Never throws.
   * @example
   *   this._scenerySections();
   * @since 1.0.0
   */
  _scenerySections() {
    const tall = {boxClass: 'h-56'};
    const treeTiles = [
      this._tile('tree', 'still', treeSprite({height: 220}), tall),
      this._tile('tree', 'swaying', treeSprite({height: 220, swaying: true}), tall),
      this._tile('chestnut', 'chestnut', chestnut())
    ];
    const crowdTiles = SPRITE_CATALOGUE.crowdKinds.flatMap(kindId =>
      SPRITE_CATALOGUE.crowdPoses.map(poseId =>
        this._tile('crowd', `${kindId}-${poseId}`, crowdAnimal(kindId, poseId))
      )
    );
    const skyTiles = SPRITE_CATALOGUE.skies.map(presetId =>
      this._tile('sky', presetId, skyBackdrop(presetId))
    );
    return html`
      ${this._section('trees', i18n.getMessage('Trees and the chestnut'), treeTiles)}
      ${this._section('crowd', i18n.getMessage('The woodland crowd'), crowdTiles)}
      ${this._section('skies', i18n.getMessage('Skies'), skyTiles)}
    `;
  }

  /**
   * @description Renders one tile per event animation class, each looping on a suitable
   *   sprite. Overlay classes (photo flash, stamp, lightning flash) sit over a sprite.
   * @returns {import('lit').TemplateResult} The section.
   * @throws {never} Never throws.
   * @example
   *   this._animationSection();
   * @since 1.0.0
   */
  _animationSection() {
    const fill = 'h-full w-full';
    const demos = [
      {key: 'tumble', art: squirrelSprite({pose: 'stunned', effects: {singed: true}})},
      {key: 'slip', art: squirrelSprite({pose: 'climb'})},
      {key: 'kissLean', art: squirrelSprite({pose: 'kiss', effects: {lipstick: true}})},
      {key: 'slapShake', art: squirrelSprite({pose: 'sulk', effects: {redCheek: true}})},
      {key: 'heartFloat', art: heartSprite(), size: 'mx-auto mt-12 h-10 w-10'},
      {key: 'pop', art: kissMark()},
      {key: 'debrisOrbit', art: TORNADO_DEBRIS.cow(), size: 'mx-auto mt-8 h-10 w-10'},
      {key: 'eagleDive', art: eagleSprite({pose: 'dive'})},
      {key: 'tornadoCross', art: tornadoSprite(), size: 'mx-auto h-full w-14'},
      {key: 'treeBend', art: treeSprite({height: 220}), boxClass: 'h-56'},
      {key: 'treeWobble', art: treeSprite({height: 220}), boxClass: 'h-56'},
      {key: 'chestnutBounce', art: chestnut()},
      {key: 'confettiFall', art: confettiPiece(3), size: 'mx-auto h-6 w-6'},
      {
        key: 'photoFlash',
        overlay: true,
        art: html`${squirrelSprite({pose: 'victory', hat: 'crown'})}
          <div class="${ANIMATION_CLASSES.photoFlash} absolute inset-0"></div>`
      },
      {
        key: 'photoStamp',
        overlay: true,
        art: html`${squirrelSprite({pose: 'cheer'})}
          <div
            class="${ANIMATION_CLASSES.photoStamp} absolute inset-x-2 top-8 rounded border-2
              border-error bg-base-100 px-1 text-center text-xs font-bold uppercase text-error"
          >
            ${i18n.getMessage('PHOTO FINISH')}
          </div>`
      },
      {
        key: 'lightningFlash',
        overlay: true,
        art: html`${lightningBolt()}
          <div class="${ANIMATION_CLASSES.lightningFlash} absolute inset-0"></div>`
      },
      {key: 'flip', art: suitorSprite({pose: 'beckon'})}
    ];
    const tiles = demos.map(demo =>
      this._tile('anim', demo.key, demo.art, {
        boxClass: demo.boxClass ?? 'h-28',
        wrapClass: demo.overlay
          ? fill
          : `${ANIMATION_CLASSES[demo.key]} ${demo.size ?? fill}`
      })
    );
    return this._section('animations', i18n.getMessage('Event animations'), tiles);
  }

  /**
   * @description Renders the Wardrobe: a header with the pause switch, then every section.
   *   Pure and server-safe: it runs during server rendering and again in the browser.
   * @returns {import('lit').TemplateResult} The page template.
   * @throws {never} Never throws.
   * @example
   *   html`<x-crli-squirrel-wardrobe-v7-page></x-crli-squirrel-wardrobe-v7-page>`;
   * @since 1.0.0
   */
  render() {
    return html`
      <div class="wardrobe-sheet mx-auto flex max-w-7xl flex-col gap-8 p-4 lg:p-8">
        <header class="flex flex-col gap-2">
          <h1 class="text-3xl font-bold text-text-primary">${i18n.getMessage('Wardrobe')}</h1>
          <p class="max-w-3xl text-base leading-relaxed text-text-secondary">
            ${i18n.getMessage(
              'Every hat, cape, accessory, fur, pose and Chaos character in one place, each labelled with the id the race uses.'
            )}
          </p>
          <label class="flex w-fit cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" class="aiux-toggle aiux-toggle-sm motion-toggle" />
            ${i18n.getMessage('Pause animations')}
          </label>
        </header>
        ${this._squirrelSections()} ${this._castSections(i18n.getMessage('BLAM!'))}
        ${this._scenerySections()} ${this._animationSection()}
      </div>
    `;
  }
}
