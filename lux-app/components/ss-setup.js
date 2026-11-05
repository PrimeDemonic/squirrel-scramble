/**
 * The setup view of the /play page (SPEC.md § 8 "Setup view", M5): the race title, the names box
 * with its live count and inline problems, group and previous line-up loading, the Classic or
 * Chaos toggle, the Chaos level (Chaos only, Chaos v2 contract § 1), places to award, race
 * length, "Meet the athletes" and the form guide.
 *
 * It never draws a race. Start (or Instant result) emits ss-setup:start with the request for
 * POST /draw; the page calls the API, and the server decides the result.
 *
 * Outfits are rolled here, in the browser, from a generator seeded once by randomSeed() (the
 * app's only entropy source, SPEC.md § 9). They are kept per name (case-insensitive), so editing
 * the names box never reshuffles the squirrels already shown, and the request carries exactly
 * the outfits on screen, passed through toPayload().
 *
 * Names reach the page through Lit text bindings only (SPEC.md § 13).
 *
 * The sound toggle sits beside the heading, and M turns the sound on or off while the setup view
 * is showing (Chaos v2 contract § 9 "Control"); the race HUD has its own.
 */
import {html, css, nothing, isServer} from 'lit';
import {customElement} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {live} from 'lit/directives/live.js';
import {styleMap} from 'lit/directives/style-map.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {toBcp47} from '@servicenow/aiux/aiux-locales/locale-mapping';
import {cleanName, parseNames, truncateLabel} from '../lib/names.js';
import {
  isLegendary,
  outfitForDrawing,
  rerollOutfits,
  rollOutfits,
  toPayload
} from '../lib/outfits.js';
import {createRng, randomSeed} from '../lib/rng.js';
import {themeConfig} from '../lib/theme-config.js';
import {
  CHAOS_LEVEL_IDS,
  DEFAULT_CHAOS_LEVEL,
  buildLabels,
  labelFor,
  lengthLabel,
  normaliseChaosLevel,
  outfitItemLabel
} from './labels.js';
import {getRaceAudio} from './audio/race-audio.js';
import {buildSoundLabels} from './audio/sound-labels.js';
import {isSoundShortcut} from './audio/sound-shortcut.js';
import './setup-group-picker.js';
import './setup-previous-lineup.js';
import './setup-lineup.js';
import './setup-form-guide.js';
import './audio/sound-toggle.js';

const MODES = ['classic', 'chaos'];
// The server's title column holds 80 characters (SPEC.md § 5).
const TITLE_MAX_LENGTH = 80;
// Problem lists show names shortened to this length, so one huge name cannot flood the page.
const PROBLEM_NAME_CHARS = 24;
// A re-roll tries this many times to land on a different outfit.
const REROLL_ATTEMPTS = 5;
const SYS_ID_PATTERN = /^[0-9a-f]{32}$/;
// Commas and semicolons split the names box, so a loaded name keeps them as spaces.
const NAME_SEPARATORS = /[,;]+/g;

/**
 * @description The key an outfit or a padlock is stored under: the cleaned name in lower case,
 *   matching how the server judges duplicates.
 * @param {string} name - A cleaned name.
 * @returns {string} The key.
 * @since 1.0.0
 */
function nameKey(name) {
  return name.toLowerCase();
}

/**
 * @description Says whether two outfits dress a squirrel the same way.
 * @param {Object} first - An outfit.
 * @param {Object} second - Another outfit.
 * @returns {boolean} True when every slot matches.
 * @since 1.0.0
 */
function sameOutfit(first, second) {
  const left = outfitForDrawing(first);
  const right = outfitForDrawing(second);
  return themeConfig.outfits.slotOrder.every((slot) => left[slot] === right[slot]);
}

/**
 * @description The marshal's display locale: the browser's own variant of the instance language
 *   when they agree (so 'en' on a UK machine becomes 'en-GB'), otherwise the instance language
 *   mapped to BCP 47 (ServiceNow's 'pb' becomes 'pt-BR'). Browser only.
 * @returns {string|undefined} A BCP 47 tag, or undefined for the runtime default.
 * @since 1.0.0
 */
function resolveLocale() {
  try {
    const documentLanguage = document.documentElement.lang || '';
    const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
    const primary = documentLanguage.split('-')[0].toLowerCase();
    const sameLanguage = browserLanguages.find((tag) => (
      typeof tag === 'string' && tag.split('-')[0].toLowerCase() === primary
    ));
    const candidate = sameLanguage || (documentLanguage ? toBcp47(documentLanguage) : '')
      || browserLanguages[0];
    return Intl.DateTimeFormat.supportedLocalesOf([candidate]).length > 0 ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The setup view. Properties: busy (a draw is in flight), reducedMotion (the page detected
 * prefers-reduced-motion) and maxEntrants. Emits ss-setup:start with {request, instant}.
 */
@customElement('ss-setup')
export class SquirrelSetup extends AIUXElement {
  static properties = {
    busy: {type: Boolean},
    reducedMotion: {type: Boolean, attribute: 'reduced-motion'},
    maxEntrants: {type: Number, attribute: 'max-entrants'},
    _title: {state: true},
    _defaultTitle: {state: true},
    _namesText: {state: true},
    _mode: {state: true},
    _seconds: {state: true},
    _chaosLevel: {state: true},
    _places: {state: true},
    _outfits: {state: true},
    _locked: {state: true},
    _rematch: {state: true},
    _pending: {state: true},
    _notice: {state: true},
    _locale: {state: true}
  };

  static styles = css`
    :host {
      display: block;
    }

    :host([hidden]) {
      display: none;
    }

    .panel {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--color-base-300);
      border-radius: var(--radius-box, 1rem);
      background-color: var(--color-base-100);
      transition: border-color var(--duration-sm, 200ms) linear;
    }

    .panel.is-chaos {
      border-color: color-mix(in srgb, var(--ss-sky-top) 55%, var(--color-base-300));
      background-image: linear-gradient(
        180deg,
        color-mix(in srgb, var(--ss-sky-top) 22%, var(--color-base-100)) 0,
        var(--color-base-100) 24rem
      );
    }

    .sky {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 4.5rem;
      padding: 0.75rem 1.5rem;
      background-image: linear-gradient(180deg, var(--ss-sky-top), var(--ss-sky-bottom));
    }

    .sky-emoji {
      position: relative;
      z-index: 1;
      font-size: 2rem;
      line-height: 1;
    }

    .sky-chip {
      position: relative;
      z-index: 1;
    }

    .choice {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 2px solid var(--color-base-300);
      border-radius: var(--radius-field, 0.5rem);
      background-color: var(--color-base-100);
      cursor: pointer;
    }

    .choice.is-selected {
      border-color: var(--color-primary);
      background-color: var(--color-base-200);
    }

    .choice:has(input:focus-visible) {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .choice.is-disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .mode-choice {
      padding: 1rem;
      border-radius: var(--radius-box, 1rem);
    }

    .mode-name {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .break-anywhere {
      overflow-wrap: anywhere;
    }

    @media (forced-colors: active) {
      .choice.is-selected {
        border-color: Highlight;
      }
    }
  `;

  /**
   * @description Sets the starting state. No browser API and no randomness here: the default
   *   title and the first outfits are made on the client.
   * @since 1.0.0
   */
  constructor() {
    super();
    this.busy = false;
    this.reducedMotion = false;
    this.maxEntrants = themeConfig.race.maxEntrants;
    this._title = '';
    this._defaultTitle = '';
    this._namesText = '';
    this._mode = 'classic';
    this._seconds = {...themeConfig.race.defaultSeconds};
    this._chaosLevel = DEFAULT_CHAOS_LEVEL;
    this._places = themeConfig.race.defaultPlaces;
    this._outfits = new Map();
    this._locked = new Set();
    this._rematch = null;
    this._pending = null;
    this._notice = '';
    this._locale = undefined;
    this._titleEdited = false;
    this._outfitRng = null;
  }

  /**
   * @description Listens for the sound shortcut (M). Browser only.
   * @returns {void}
   * @since 1.0.0
   */
  connectedCallback() {
    super.connectedCallback();
    if (!isServer) {
      window.addEventListener('keydown', this._onSoundKey);
    }
  }

  /**
   * @description Removes the sound shortcut listener.
   * @returns {void}
   * @since 1.0.0
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    if (!isServer) {
      window.removeEventListener('keydown', this._onSoundKey);
    }
  }

  /**
   * @description After the first (hydrating) render: works out the locale and the default title,
   *   "Squirrel race" plus today's date in the marshal's format.
   * @returns {void}
   * @since 1.0.0
   */
  firstUpdated() {
    this._locale = resolveLocale();
    let today = '';
    try {
      today = new Intl.DateTimeFormat(this._locale, {dateStyle: 'long'}).format(new Date());
    } catch {
      today = '';
    }
    this._defaultTitle = today
      ? i18n.getMessage('Squirrel race {date}', {date: today})
      : i18n.getMessage('Squirrel race');
    if (!this._titleEdited && !this._title) {
      this._title = this._defaultTitle;
    }
  }

  /**
   * @description Moves focus to the confirmation when one appears.
   * @param {Map<string, *>} changed - The properties that changed.
   * @returns {void}
   * @since 1.0.0
   */
  updated(changed) {
    if (changed.has('_pending') && this._pending) {
      const replaceButton = this.renderRoot.querySelector('#confirm-replace');
      if (replaceButton) {
        replaceButton.focus();
      }
    }
  }

  /**
   * @description Emits ss-setup:start when the line-up is valid and no draw is in flight. The page
   *   calls it for the Space shortcut, and the Start and Instant result buttons call it too. It
   *   unlocks the race audio first, while still inside that click or key press (the browser's
   *   autoplay rule, Chaos v2 contract § 9); the stage starts the music after the draw.
   * @param {boolean} [instant] - True to go straight to the podium.
   * @returns {boolean} Whether a start was requested.
   * @example
   *   setupElement.requestStart(false);
   * @since 1.0.0
   */
  requestStart(instant = false) {
    getRaceAudio().unlock();
    const parsed = parseNames(this._namesText, this.maxEntrants);
    if (!parsed.valid || this.busy || this._pending) {
      return false;
    }
    const request = this._buildRequest(parsed.names);
    this.dispatchEvent(new CustomEvent('ss-setup:start', {
      detail: {request, instant: Boolean(instant)},
      bubbles: true,
      composed: true
    }));
    return true;
  }

  /**
   * @description Offers a line-up from outside the setup view (the page's ?rematch= link). Asks
   *   before overwriting names already in the box, as the group and line-up loaders do.
   * @param {{names: string[], outfits?: Array<Object>, rematch?: {sysId: string, number: string},
   *   sourceLabel?: string, settings?: {mode?: string, places?: number, raceSeconds?: number,
   *   chaosLevel?: (string|null)}}}
   *   lineup - The line-up.
   * @returns {void}
   * @example
   *   setupElement.loadLineup({names, outfits, rematch: {sysId, number}, sourceLabel: number});
   * @since 1.0.0
   */
  loadLineup(lineup) {
    if (lineup && Array.isArray(lineup.names)) {
      this._offerLineup(lineup);
    }
  }

  /**
   * @description Drops the rematch link, for example after the server said the original race no
   *   longer exists.
   * @returns {void}
   * @since 1.0.0
   */
  clearRematch() {
    this._rematch = null;
  }

  /**
   * @description Puts keyboard focus in the names box (after "New race", for example).
   * @returns {void}
   * @since 1.0.0
   */
  focusNames() {
    const namesBox = this.renderRoot.querySelector('#names');
    if (namesBox) {
      namesBox.focus();
    }
  }

  /**
   * @description The outfit generator, seeded once from the platform's cryptographic source.
   *   Called from event handlers only, never during rendering.
   * @returns {Object} A generator from createRng().
   * @since 1.0.0
   */
  _rng() {
    if (!this._outfitRng) {
      this._outfitRng = createRng(randomSeed());
    }
    return this._outfitRng;
  }

  /**
   * @description The outfit shown for a name, and therefore the one sent to the server. A name
   *   with no rolled outfit yet draws as a plain squirrel.
   * @param {string} name - A cleaned name.
   * @returns {{hat: string, cape: string, accessory: string, fur: string}} The outfit.
   * @since 1.0.0
   */
  _outfitFor(name) {
    return this._outfits.get(nameKey(name)) || outfitForDrawing({});
  }

  /**
   * @description Rolls an outfit for every name that has none yet; stored outfits (from a
   *   previous line-up) win over existing ones.
   * @param {Array<{name: string, outfit: (Object|null)}>} entries - Cleaned names with an
   *   optional stored outfit each.
   * @returns {void}
   * @since 1.0.0
   */
  _ensureOutfits(entries) {
    const next = new Map(this._outfits);
    let changed = false;
    entries.forEach(({name, outfit}) => {
      const key = nameKey(name);
      if (outfit) {
        next.set(key, outfitForDrawing(outfit));
        changed = true;
      } else if (!next.has(key)) {
        next.set(key, rollOutfits(this._rng(), 1)[0]);
        changed = true;
      }
    });
    if (changed) {
      this._outfits = next;
    }
  }

  /**
   * @description Builds the POST /draw request from what is on screen. A Chaos race carries its
   *   chaosLevel; a Classic race leaves it out (the server ignores it there anyway).
   * @param {string[]} names - The cleaned, valid names.
   * @returns {{title: string, mode: string, names: string[], outfits: Array<Object>,
   *   places: number, raceSeconds: number, rematchOf: (string|null), chaosLevel?: string}} The
   *   request.
   * @since 1.0.0
   */
  _buildRequest(names) {
    const title = this._title.trim().slice(0, TITLE_MAX_LENGTH)
      || this._defaultTitle
      || i18n.getMessage('Squirrel race');
    const request = {
      title,
      mode: this._mode,
      names: names.slice(),
      outfits: names.map((name) => toPayload(this._outfitFor(name))),
      places: this._effectivePlaces(names.length),
      raceSeconds: this._seconds[this._mode],
      rematchOf: this._rematch && SYS_ID_PATTERN.test(this._rematch.sysId)
        ? this._rematch.sysId
        : null
    };
    if (this._mode === 'chaos') {
      request.chaosLevel = normaliseChaosLevel(this._chaosLevel);
    }
    return request;
  }

  /**
   * @description The places actually awarded: the marshal's choice, clamped to the entrants.
   * @param {number} count - How many squirrels race.
   * @returns {number} 1 to 3.
   * @since 1.0.0
   */
  _effectivePlaces(count) {
    return Math.max(1, Math.min(this._places, count));
  }

  /**
   * @description Shows a line-up straight away when the names box is empty, otherwise asks first.
   * @param {Object} lineup - See loadLineup().
   * @returns {void}
   * @since 1.0.0
   */
  _offerLineup(lineup) {
    const current = parseNames(this._namesText, this.maxEntrants).names;
    if (current.length === 0) {
      this._applyLineup(lineup);
    } else {
      this._pending = lineup;
    }
  }

  /**
   * @description Fills the names box from a line-up, keeps any stored outfits, sets or clears
   *   the rematch link and applies optional race settings.
   * @param {Object} lineup - See loadLineup().
   * @returns {void}
   * @since 1.0.0
   */
  _applyLineup(lineup) {
    const outfits = Array.isArray(lineup.outfits) ? lineup.outfits : [];
    const entries = lineup.names
      .map((name, index) => ({
        name: cleanName(String(name).replace(NAME_SEPARATORS, ' ')),
        outfit: outfits[index] && typeof outfits[index] === 'object' ? outfits[index] : null
      }))
      .filter((entry) => entry.name.length > 0);
    this._pending = null;
    this._namesText = entries.map((entry) => entry.name).join('\n');
    this._ensureOutfits(entries);
    const rematch = lineup.rematch;
    this._rematch = rematch && SYS_ID_PATTERN.test(rematch.sysId)
      ? {sysId: rematch.sysId, number: rematch.number || ''}
      : null;
    this._applySettings(lineup.settings);
    const incoming = entries.length === 1
      ? i18n.getMessage('1 name')
      : i18n.getMessage('{count} names', {count: entries.length});
    this._notice = lineup.sourceLabel
      ? i18n.getMessage('Loaded {incoming} from {source}.', {
        incoming,
        source: lineup.sourceLabel
      })
      : i18n.getMessage('Loaded {incoming}.', {incoming});
  }

  /**
   * @description Applies a stored race's mode, places, length and Chaos level when they are
   *   valid. A missing or unknown value leaves the current choice alone.
   * @param {{mode?: string, places?: number, raceSeconds?: number,
   *   chaosLevel?: (string|null)}|undefined} settings - The settings.
   * @returns {void}
   * @since 1.0.0
   */
  _applySettings(settings) {
    if (!settings) {
      return;
    }
    const mode = MODES.includes(settings.mode) ? settings.mode : this._mode;
    this._mode = mode;
    if (CHAOS_LEVEL_IDS.includes(settings.chaosLevel)) {
      this._chaosLevel = settings.chaosLevel;
    }
    const places = parseInt(settings.places, 10);
    if (places >= 1 && places <= themeConfig.race.maxPlaces) {
      this._places = places;
    }
    const seconds = parseInt(settings.raceSeconds, 10);
    if (themeConfig.race.lengths[mode].some((option) => option.seconds === seconds)) {
      this._seconds = {...this._seconds, [mode]: seconds};
    }
  }

  /**
   * @description Keeps the title as the marshal types it.
   * @param {InputEvent} event - The input event.
   * @returns {void}
   * @since 1.0.0
   */
  _onTitleInput = (event) => {
    this._titleEdited = true;
    this._title = event.target.value;
  };

  /**
   * @description Re-reads the names box and rolls outfits for any new squirrel.
   * @param {InputEvent} event - The input event.
   * @returns {void}
   * @since 1.0.0
   */
  _onNamesInput = (event) => {
    this._namesText = event.target.value;
    const names = parseNames(this._namesText, this.maxEntrants).names;
    this._ensureOutfits(names.map((name) => ({name, outfit: null})));
  };

  /**
   * @description Switches between Classic and Chaos.
   * @param {Event} event - The radio change event.
   * @returns {void}
   * @since 1.0.0
   */
  _onModeChange = (event) => {
    if (MODES.includes(event.target.value)) {
      this._mode = event.target.value;
    }
  };

  /**
   * @description Sets the race length for the current mode.
   * @param {Event} event - The radio change event.
   * @returns {void}
   * @since 1.0.0
   */
  _onLengthChange = (event) => {
    const seconds = parseInt(event.target.value, 10);
    if (themeConfig.race.lengths[this._mode].some((option) => option.seconds === seconds)) {
      this._seconds = {...this._seconds, [this._mode]: seconds};
    }
  };

  /**
   * @description Sets the Chaos level (Mild, Silly or Absolute Carnage).
   * @param {Event} event - The radio change event.
   * @returns {void}
   * @since 1.0.0
   */
  _onChaosLevelChange = (event) => {
    if (CHAOS_LEVEL_IDS.includes(event.target.value)) {
      this._chaosLevel = event.target.value;
    }
  };

  /**
   * @description Sets the places to award.
   * @param {Event} event - The radio change event.
   * @returns {void}
   * @since 1.0.0
   */
  _onPlacesChange = (event) => {
    const places = parseInt(event.target.value, 10);
    if (places >= 1 && places <= themeConfig.race.maxPlaces) {
      this._places = places;
    }
  };

  /**
   * @description A group's members arrived from the group picker.
   * @param {CustomEvent} event - ss-group:members with {groupName, names}.
   * @returns {void}
   * @since 1.0.0
   */
  _onGroupMembers = (event) => {
    const {groupName, names} = event.detail || {};
    if (Array.isArray(names)) {
      this._offerLineup({names, outfits: null, rematch: null, sourceLabel: groupName || ''});
    }
  };

  /**
   * @description A previous race's line-up arrived: names, outfits, the rematch link and, for a
   *   Chaos race, its stored Chaos level (the mode and the other settings stay as they are).
   * @param {CustomEvent} event - ss-previous:lineup with {names, outfits, sysId, number, title,
   *   chaosLevel}.
   * @returns {void}
   * @since 1.0.0
   */
  _onPreviousLineup = (event) => {
    const detail = event.detail || {};
    if (!Array.isArray(detail.names)) {
      return;
    }
    this._offerLineup({
      names: detail.names,
      outfits: detail.outfits,
      rematch: {sysId: detail.sysId, number: detail.number},
      sourceLabel: detail.number || detail.title || '',
      settings: {chaosLevel: detail.chaosLevel}
    });
  };

  /**
   * @description Confirms replacing the names box with the offered line-up.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  _onConfirmReplace = async () => {
    if (this._pending) {
      this._applyLineup(this._pending);
      await this.updateComplete;
      this.focusNames();
    }
  };

  /**
   * @description Keeps the names already typed and drops the offered line-up.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  _onConfirmKeep = async () => {
    this._pending = null;
    this._notice = i18n.getMessage('Kept the names you typed.');
    await this.updateComplete;
    this.focusNames();
  };

  /**
   * @description Removes the rematch link.
   * @returns {void}
   * @since 1.0.0
   */
  _onClearRematch = () => {
    this._rematch = null;
    this._notice = i18n.getMessage('This race is no longer linked as a rematch.');
  };

  /**
   * @description Re-rolls one squirrel's outfit, trying for a different one. A padlocked
   *   squirrel keeps its outfit.
   * @param {CustomEvent} event - ss-lineup:reroll with {key, name}.
   * @returns {void}
   * @since 1.0.0
   */
  _onReroll = (event) => {
    const {key, name} = event.detail || {};
    if (!key || !this._outfits.has(key)) {
      return;
    }
    if (this._locked.has(key)) {
      this._notice = i18n.getMessage('{name}’s outfit is locked. Unlock it to re-roll.', {name});
      return;
    }
    const current = this._outfits.get(key);
    let candidate = current;
    let attempts = 0;
    while (attempts < REROLL_ATTEMPTS && sameOutfit(candidate, current)) {
      candidate = rollOutfits(this._rng(), 1)[0];
      attempts += 1;
    }
    const next = new Map(this._outfits);
    next.set(key, candidate);
    this._outfits = next;
    this._notice = i18n.getMessage('{name} now wears: {outfit}.', {
      name,
      outfit: this._describeOutfit(candidate)
    });
  };

  /**
   * @description Padlocks or unlocks one squirrel's outfit.
   * @param {CustomEvent} event - ss-lineup:toggle-lock with {key, name}.
   * @returns {void}
   * @since 1.0.0
   */
  _onToggleLock = (event) => {
    const {key, name} = event.detail || {};
    if (!key) {
      return;
    }
    const next = new Set(this._locked);
    if (next.has(key)) {
      next.delete(key);
      this._notice = i18n.getMessage('{name}’s outfit is unlocked.', {name});
    } else {
      next.add(key);
      this._notice = i18n.getMessage('{name}’s outfit is locked.', {name});
    }
    this._locked = next;
  };

  /**
   * @description "Shuffle outfits": re-rolls every squirrel that is not padlocked.
   * @returns {void}
   * @since 1.0.0
   */
  _onShuffle = () => {
    const keys = this._uniqueEntrants().map((entrant) => entrant.key);
    if (keys.length === 0) {
      return;
    }
    const current = keys.map((key) => this._outfits.get(key) || outfitForDrawing({}));
    const lockedIndexes = keys
      .map((key, index) => (this._locked.has(key) ? index : -1))
      .filter((index) => index >= 0);
    const shuffled = rerollOutfits(this._rng(), current, lockedIndexes);
    const next = new Map(this._outfits);
    keys.forEach((key, index) => next.set(key, shuffled[index]));
    this._outfits = next;
    const reRolled = keys.length - lockedIndexes.length;
    this._notice = reRolled === 1
      ? i18n.getMessage('Shuffled 1 outfit.')
      : i18n.getMessage('Shuffled {count} outfits.', {count: reRolled});
  };

  /**
   * @description The M shortcut: turns the sound off or on while this view is showing (the page
   *   keeps it in the DOM, hidden, during a race, when the race HUD's shortcut applies instead).
   *   Turning it on unlocks the audio, since a key press is a user gesture.
   * @param {KeyboardEvent} event - The keydown.
   * @returns {void}
   * @since 1.0.0
   */
  _onSoundKey = (event) => {
    if (!isSoundShortcut(event) || !this.isConnected || this.getClientRects().length === 0) {
      return;
    }
    event.preventDefault();
    const audio = getRaceAudio();
    const muted = !audio.isMuted();
    audio.setMuted(muted);
    if (!muted) {
      audio.unlock();
    }
    const soundLabels = buildSoundLabels(i18n);
    this._notice = audio.isMuted() ? soundLabels.soundOff : soundLabels.soundOn;
  };

  /**
   * @description The Start button.
   * @returns {void}
   * @since 1.0.0
   */
  _onStartClick = () => {
    this.requestStart(false);
  };

  /**
   * @description The Instant result link.
   * @returns {void}
   * @since 1.0.0
   */
  _onInstantClick = () => {
    this.requestStart(true);
  };

  /**
   * @description Each distinct squirrel in names-box order, with its outfit and padlock.
   * @returns {Array<{key: string, name: string, outfit: Object, locked: boolean,
   *   legendary: boolean}>} The entrants.
   * @since 1.0.0
   */
  _uniqueEntrants() {
    const seen = new Set();
    const entrants = [];
    parseNames(this._namesText, this.maxEntrants).names.forEach((name) => {
      const key = nameKey(name);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const outfit = this._outfitFor(name);
      entrants.push({
        key,
        name,
        outfit,
        locked: this._locked.has(key),
        legendary: isLegendary(outfit)
      });
    });
    return entrants;
  }

  /**
   * @description An outfit as words, for announcements.
   * @param {Object} outfit - The outfit.
   * @returns {string} For example "Viking helmet, Red cape, Monocle, Grey fur".
   * @since 1.0.0
   */
  _describeOutfit(outfit) {
    const labels = buildLabels(i18n);
    const drawable = outfitForDrawing(outfit);
    return themeConfig.outfits.slotOrder
      .map((slot) => outfitItemLabel(labels, slot, drawable[slot]))
      .join(', ');
  }

  /**
   * @description Joins names into a readable list in the marshal's language.
   * @param {string[]} names - The names.
   * @returns {string} For example "Sam, Jo and Priya".
   * @since 1.0.0
   */
  _listOf(names) {
    try {
      return new Intl.ListFormat(this._locale, {type: 'conjunction'}).format(names);
    } catch {
      return names.join(', ');
    }
  }

  /**
   * @description The live count under the names box.
   * @param {number} count - How many squirrels.
   * @returns {string} The count text.
   * @since 1.0.0
   */
  _countText(count) {
    if (count === 0) {
      return i18n.getMessage('No squirrels yet');
    }
    return count === 1
      ? i18n.getMessage('1 squirrel')
      : i18n.getMessage('{count} squirrels', {count});
  }

  /**
   * @description The problems that keep Start disabled, as sentences.
   * @param {{names: string[], problems: Object}} parsed - The parsed names box.
   * @returns {string[]} One sentence per problem.
   * @since 1.0.0
   */
  _problemTexts(parsed) {
    const {duplicates, tooLong, overCap} = parsed.problems;
    const texts = [];
    if (duplicates.length > 0) {
      texts.push(i18n.getMessage('These names appear more than once: {names}.', {
        names: this._listOf(duplicates.map((name) => truncateLabel(name, PROBLEM_NAME_CHARS)))
      }));
    }
    if (tooLong.length > 0) {
      texts.push(i18n.getMessage('Names can be at most {max} characters: {names}.', {
        max: themeConfig.race.maxNameLength,
        names: this._listOf(tooLong.map((name) => truncateLabel(name, PROBLEM_NAME_CHARS)))
      }));
    }
    if (overCap) {
      texts.push(i18n.getMessage('That is {count} squirrels; one race takes at most {max}.', {
        count: parsed.names.length,
        max: this.maxEntrants
      }));
    }
    return texts;
  }

  /**
   * @description The confirmation shown before a loaded line-up replaces typed names.
   * @returns {import('lit').TemplateResult|typeof nothing} The template.
   * @since 1.0.0
   */
  _renderConfirm() {
    if (!this._pending) {
      return nothing;
    }
    const count = this._pending.names.length;
    const incoming = count === 1
      ? i18n.getMessage('1 name')
      : i18n.getMessage('{count} names', {count});
    const question = this._pending.sourceLabel
      ? i18n.getMessage('Replace the names in the box with {incoming} from {source}?', {
        incoming,
        source: this._pending.sourceLabel
      })
      : i18n.getMessage('Replace the names in the box with {incoming}?', {incoming});
    return html`
      <div
        class="aiux-alert aiux-alert-warning aiux-alert-soft flex flex-wrap items-center gap-3"
        role="group"
        aria-labelledby="confirm-question"
      >
        <p id="confirm-question" class="break-anywhere">${question}</p>
        <div class="flex flex-wrap gap-2">
          <button
            id="confirm-replace"
            type="button"
            class="aiux-btn aiux-btn-primary aiux-btn-sm"
            @click=${this._onConfirmReplace}
          >${i18n.getMessage('Replace names')}</button>
          <button
            type="button"
            class="aiux-btn aiux-btn-ghost aiux-btn-sm"
            @click=${this._onConfirmKeep}
          >${i18n.getMessage('Keep my names')}</button>
        </div>
      </div>
    `;
  }

  /**
   * @description The sky banner (Chaos v2 contract § 14): in both modes the race's seed picks the
   *   sky from one pool, so the banner names every sky it can be.
   * @param {Object} labels - The label catalogue.
   * @returns {import('lit').TemplateResult} The banner.
   * @since 1.0.0
   */
  _renderSky(labels) {
    const text = i18n.getMessage(
      'Sky: chosen by the race: {day}, {golden}, {night}, {drizzle} or {storm}',
      {
        day: labelFor(labels.skies, 'day', 'day'),
        golden: labelFor(labels.skies, 'golden_hour', 'golden_hour'),
        night: labelFor(labels.skies, 'night', 'night'),
        drizzle: labelFor(labels.skies, 'drizzle', 'drizzle'),
        storm: labelFor(labels.skies, 'storm', 'storm')
      }
    );
    return html`
      <div class="sky" data-testid="setup-sky">
        <span class="sky-emoji" aria-hidden="true">🌦️</span>
        <span class="sky-chip rounded-full bg-base-100 px-3 py-1 text-sm font-semibold
          text-text-primary">${text}</span>
      </div>
    `;
  }

  /**
   * @description The Classic or Chaos toggle.
   * @param {Object} labels - The label catalogue.
   * @returns {import('lit').TemplateResult} The fieldset.
   * @since 1.0.0
   */
  _renderMode(labels) {
    const blurbs = {
      classic: i18n.getMessage('A straight scramble up the trees.'),
      chaos: i18n.getMessage('Tornadoes, hunters and suitors. The result is still drawn first.')
    };
    return html`
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 text-sm font-semibold text-text-primary">
          ${i18n.getMessage('Mode')}
        </legend>
        <div class="grid gap-3 sm:grid-cols-2">
          ${MODES.map((mode) => html`
            <label class=${classMap({
              choice: true,
              'mode-choice': true,
              'is-selected': this._mode === mode
            })}>
              <input
                class="aiux-radio aiux-radio-sm mt-1"
                type="radio"
                name="mode"
                value=${mode}
                .checked=${live(this._mode === mode)}
                data-testid="mode-${mode}"
                @change=${this._onModeChange}
              />
              <span class="flex flex-col gap-1">
                <span class="mode-name text-text-primary">
                  ${labelFor(labels.modes, mode, mode)}
                  ${mode === 'chaos'
                    ? html`<span aria-hidden="true">${themeConfig.emoji.tornado}</span>`
                    : nothing}
                </span>
                <span class="text-sm text-text-secondary">${blurbs[mode]}</span>
              </span>
            </label>
          `)}
        </div>
      </fieldset>
    `;
  }

  /**
   * @description The Chaos level picker (Mild, Silly or Absolute Carnage), shown in Chaos mode
   *   only. Styled like the length choices, with a short description under each level.
   * @param {Object} labels - The label catalogue.
   * @returns {import('lit').TemplateResult} The fieldset.
   * @since 1.0.0
   */
  _renderChaosLevel(labels) {
    const selected = normaliseChaosLevel(this._chaosLevel);
    return html`
      <fieldset class="flex flex-col gap-2" data-testid="chaos-level">
        <legend class="mb-2 text-sm font-semibold text-text-primary">
          ${i18n.getMessage('Chaos level')}
        </legend>
        <div class="grid gap-2 sm:grid-cols-3">
          ${CHAOS_LEVEL_IDS.map((level) => html`
            <label class=${classMap({choice: true, 'is-selected': level === selected})}>
              <input
                class="aiux-radio aiux-radio-sm mt-1"
                type="radio"
                name="chaos-level"
                value=${level}
                .checked=${live(level === selected)}
                data-testid="chaos-level-${level}"
                @change=${this._onChaosLevelChange}
              />
              <span class="flex flex-col">
                <span class="font-bold text-text-primary">
                  ${labelFor(labels.chaosLevels, level, level)}
                </span>
                <span class="text-xs text-text-secondary">
                  ${labelFor(labels.chaosLevelBlurbs, level, '')}
                </span>
              </span>
            </label>
          `)}
        </div>
      </fieldset>
    `;
  }

  /**
   * @description Places to award: 1, 2 or 3, with options above the entrant count disabled.
   * @param {number} count - How many squirrels.
   * @returns {import('lit').TemplateResult} The fieldset.
   * @since 1.0.0
   */
  _renderPlaces(count) {
    const effective = this._effectivePlaces(count);
    const allowed = Math.max(1, count);
    const hints = {
      1: i18n.getMessage('Winner only'),
      2: i18n.getMessage('Winner and runner-up'),
      3: i18n.getMessage('Top three')
    };
    const options = [];
    for (let places = 1; places <= themeConfig.race.maxPlaces; places += 1) {
      options.push(places);
    }
    return html`
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 text-sm font-semibold text-text-primary">
          ${i18n.getMessage('Places to award')}
        </legend>
        <div class="grid grid-cols-3 gap-2">
          ${options.map((places) => {
            const disabled = places > allowed;
            return html`
              <label class=${classMap({
                choice: true,
                'is-selected': places === effective,
                'is-disabled': disabled
              })}>
                <input
                  class="aiux-radio aiux-radio-sm mt-1"
                  type="radio"
                  name="places"
                  value=${places}
                  .checked=${live(places === effective)}
                  ?disabled=${disabled}
                  data-testid="places-${places}"
                  @change=${this._onPlacesChange}
                />
                <span class="flex flex-col">
                  <span class="text-lg font-bold text-text-primary">${places}</span>
                  <span class="text-xs text-text-secondary">${hints[places] || ''}</span>
                </span>
              </label>
            `;
          })}
        </div>
        ${count === 1
          ? html`<p class="text-xs text-text-secondary">
              ${i18n.getMessage('A solo squirrel races for first place only.')}
            </p>`
          : nothing}
      </fieldset>
    `;
  }

  /**
   * @description The race lengths for the current mode.
   * @param {Object} labels - The label catalogue.
   * @returns {import('lit').TemplateResult} The fieldset.
   * @since 1.0.0
   */
  _renderLengths(labels) {
    const selected = this._seconds[this._mode];
    return html`
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 text-sm font-semibold text-text-primary">
          ${i18n.getMessage('Race length')}
        </legend>
        <div class="grid grid-cols-3 gap-2">
          ${themeConfig.race.lengths[this._mode].map((option) => html`
            <label class=${classMap({choice: true, 'is-selected': option.seconds === selected})}>
              <input
                class="aiux-radio aiux-radio-sm mt-1"
                type="radio"
                name="length-${this._mode}"
                value=${option.seconds}
                .checked=${live(option.seconds === selected)}
                data-testid="length-${option.seconds}"
                @change=${this._onLengthChange}
              />
              <span class="flex flex-col">
                <span class="font-bold text-text-primary">
                  ${lengthLabel(labels, this._mode, option.seconds)}
                </span>
                <span class="text-xs text-text-secondary">
                  ${i18n.getMessage('{seconds} s', {seconds: option.seconds})}
                </span>
              </span>
            </label>
          `)}
        </div>
      </fieldset>
    `;
  }

  /**
   * @description Start, Instant result and the line explaining why Start is unavailable.
   * @param {{valid: boolean, problems: Object}} parsed - The parsed names box.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  _renderStart(parsed) {
    const canStart = parsed.valid && !this.busy && !this._pending;
    let help;
    if (this.busy) {
      help = i18n.getMessage('Drawing the race on the server…');
    } else if (parsed.problems.noNames) {
      help = i18n.getMessage('Add at least one name to start.');
    } else if (!parsed.valid) {
      help = i18n.getMessage('Fix the names above to start.');
    } else if (this._pending) {
      help = i18n.getMessage('Answer the question about the names first.');
    } else {
      help = '';
    }
    return html`
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="aiux-btn aiux-btn-primary aiux-btn-lg"
          ?disabled=${!canStart}
          aria-describedby="start-help"
          data-testid="start-race"
          @click=${this._onStartClick}
        >
          ${this.busy
            ? html`<span class="aiux-loading aiux-loading-spinner aiux-loading-sm"
              aria-hidden="true"></span>`
            : nothing}
          ${i18n.getMessage('Start the race')}
        </button>
        <button
          type="button"
          class="aiux-btn aiux-btn-link aiux-btn-sm self-start"
          ?disabled=${!canStart}
          data-testid="instant-result"
          @click=${this._onInstantClick}
        >${i18n.getMessage('Instant result')}</button>
        <p id="start-help" class="text-xs text-text-secondary">
          ${help}
          ${help ? nothing : html`
            ${i18n.getMessage('Shortcut:')}
            <kbd class="aiux-kbd aiux-kbd-sm">${i18n.getMessage('Space')}</kbd>
            ${i18n.getMessage('starts the race when you are not typing.')}
          `}
        </p>
        ${this.reducedMotion
          ? html`<p class="text-xs text-text-secondary" data-testid="reduced-motion-note">
              ${i18n.getMessage('Your device asks for reduced motion, so Start goes straight to the result. You can still run the race from there.')}
            </p>`
          : nothing}
      </div>
    `;
  }

  /**
   * @description Renders the whole setup view. Pure and server-safe: no browser API, no
   *   randomness and no clock.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  render() {
    const labels = buildLabels(i18n);
    const soundLabels = buildSoundLabels(i18n);
    const parsed = parseNames(this._namesText, this.maxEntrants);
    const count = parsed.names.length;
    const problems = this._problemTexts(parsed);
    const isChaos = this._mode === 'chaos';
    // The race picks its own sky (Chaos v2 contract § 14), so the panel shows a day sky in both
    // modes.
    const sky = themeConfig.skies.presets.day;
    const entrants = this._uniqueEntrants();
    return html`
      <section
        class=${classMap({panel: true, 'is-chaos': isChaos})}
        style=${styleMap({'--ss-sky-top': sky.top, '--ss-sky-bottom': sky.bottom})}
        aria-labelledby="setup-heading"
        data-testid="setup-panel"
        data-mode=${this._mode}
      >
        ${this._renderSky(labels)}
        <div class="flex flex-col gap-6 p-4 lg:p-6">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h1 id="setup-heading" class="text-2xl font-bold text-text-primary">
              ${i18n.getMessage('Set up a race')}
            </h1>
            <div class="flex flex-wrap items-center gap-2" data-testid="setup-sound">
              <ss-sound-toggle></ss-sound-toggle>
              <span class="text-xs text-text-secondary">${soundLabels.shortcut}</span>
            </div>
          </div>
          ${this._renderConfirm()}
          <div class="grid gap-6 lg:grid-cols-2">
            <div class="flex min-w-0 flex-col gap-4">
              <div class="flex flex-col gap-1">
                <label for="race-title" class="text-sm font-semibold text-text-primary">
                  ${i18n.getMessage('Race title')}
                </label>
                <input
                  id="race-title"
                  class="aiux-input w-full"
                  type="text"
                  maxlength=${TITLE_MAX_LENGTH}
                  autocomplete="off"
                  .value=${live(this._title)}
                  ?disabled=${this.busy}
                  @input=${this._onTitleInput}
                />
              </div>
              <div class="flex flex-col gap-1">
                <label for="names" class="text-sm font-semibold text-text-primary">
                  ${i18n.getMessage('Names')}
                </label>
                <p id="names-hint" class="text-xs text-text-secondary">
                  ${i18n.getMessage('One per line. Commas and semicolons also split names.')}
                </p>
                <textarea
                  id="names"
                  class="aiux-textarea w-full"
                  rows="8"
                  spellcheck="false"
                  autocomplete="off"
                  aria-describedby="names-hint names-count names-problems"
                  aria-invalid=${problems.length > 0 ? 'true' : 'false'}
                  .value=${live(this._namesText)}
                  ?disabled=${this.busy}
                  data-testid="names-box"
                  @input=${this._onNamesInput}
                ></textarea>
                <p
                  id="names-count"
                  class="text-sm font-semibold text-text-primary"
                  role="status"
                  aria-live="polite"
                  data-testid="names-count"
                >${this._countText(count)}</p>
                <ul
                  id="names-problems"
                  class="flex flex-col gap-1 text-sm text-error"
                  data-testid="names-problems"
                >
                  ${problems.map((text) => html`<li class="break-anywhere">${text}</li>`)}
                </ul>
                ${this._rematch ? html`
                  <div class="flex flex-wrap items-center gap-2" data-testid="rematch-chip">
                    <span class="aiux-badge aiux-badge-info aiux-badge-soft">
                      ${i18n.getMessage('Rematch of {number}', {
                        number: this._rematch.number || this._rematch.sysId
                      })}
                    </span>
                    <button
                      type="button"
                      class="aiux-btn aiux-btn-ghost aiux-btn-xs"
                      @click=${this._onClearRematch}
                    >${i18n.getMessage('Remove the rematch link')}</button>
                  </div>
                ` : nothing}
              </div>
              <ss-setup-group-picker
                ?disabled=${this.busy}
                @ss-group:members=${this._onGroupMembers}
              ></ss-setup-group-picker>
              <ss-setup-previous-lineup
                ?disabled=${this.busy}
                .locale=${this._locale}
                @ss-previous:lineup=${this._onPreviousLineup}
              ></ss-setup-previous-lineup>
            </div>
            <div class="flex min-w-0 flex-col gap-5">
              ${this._renderMode(labels)}
              ${isChaos ? this._renderChaosLevel(labels) : nothing}
              ${this._renderPlaces(count)}
              ${this._renderLengths(labels)}
              ${this._renderStart(parsed)}
            </div>
          </div>
          <p class="sr-only" role="status" aria-live="polite">${this._notice}</p>
          <ss-setup-lineup
            .entrants=${entrants}
            ?disabled=${this.busy}
            @ss-lineup:reroll=${this._onReroll}
            @ss-lineup:toggle-lock=${this._onToggleLock}
            @ss-lineup:shuffle=${this._onShuffle}
          ></ss-setup-lineup>
          <ss-setup-form-guide
            .names=${entrants.map((entrant) => entrant.name)}
            .locale=${this._locale}
          ></ss-setup-form-guide>
        </div>
      </section>
    `;
  }
}
