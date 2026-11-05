/**
 * "Meet the athletes" for the setup view (SPEC.md § 8, § 9): every squirrel in its outfit with
 * its name on a bib. Selecting a squirrel re-rolls its outfit, the padlock keeps an outfit, and
 * "Shuffle outfits" re-rolls the rest. A squirrel wearing anything legendary sparkles.
 *
 * Presentational only: the setup view owns the outfits and the padlocks. This component emits
 * ss-lineup:reroll {key, name}, ss-lineup:toggle-lock {key, name} and ss-lineup:shuffle.
 *
 * Each card carries data-outfit, the exact JSON sent to POST /draw for that squirrel, so a test
 * can prove the outfit on screen is the outfit in the request. Names render as text only.
 */
import {html, css, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {repeat} from 'lit/directives/repeat.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {icon} from '@servicenow/aiux/aiux-directive-icon';
import {truncateLabel} from '../lib/names.js';
import {outfitForDrawing, toPayload} from '../lib/outfits.js';
import {themeConfig} from '../lib/theme-config.js';
import {buildLabels, outfitItemLabel} from './labels.js';
import {squirrelSprite} from './sprites/squirrel.js';

/**
 * The line-up. Properties: entrants ({key, name, outfit, locked, legendary} in names-box order)
 * and disabled (a draw is in flight).
 */
@customElement('ss-setup-lineup')
export class SetupLineup extends AIUXElement {
  static properties = {
    entrants: {type: Array},
    disabled: {type: Boolean}
  };

  static styles = css`
    :host {
      display: block;
    }

    .athletes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .athletes.is-compact {
      grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    }

    .athlete {
      position: relative;
      display: flex;
      min-width: 0;
      flex-direction: column;
      align-items: center;
      gap: 0.375rem;
      padding: 0.75rem 0.5rem;
      border: 1px solid var(--color-base-300);
      border-radius: var(--radius-box, 1rem);
      background-color: var(--color-base-100);
      text-align: center;
    }

    .athlete.is-locked {
      border-style: dashed;
      border-color: var(--color-primary);
    }

    .athlete.is-legendary {
      border-color: var(--color-warning);
      animation: legendary-glow 2.4s ease-in-out infinite;
    }

    @keyframes legendary-glow {
      0%,
      100% {
        box-shadow: 0 0 0 0 transparent;
      }

      50% {
        box-shadow: 0 0 0.75rem 0.125rem
          color-mix(in srgb, var(--color-warning) 55%, transparent);
      }
    }

    .sprite-button {
      width: 5rem;
      height: 5rem;
      padding: 0;
      border: 0;
      border-radius: var(--radius-field, 0.5rem);
      background: transparent;
      cursor: pointer;
    }

    .is-compact .sprite-button {
      width: 3.5rem;
      height: 3.5rem;
    }

    .sprite-button:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .sprite-button[aria-disabled='true'] {
      cursor: not-allowed;
    }

    .sprite-button svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .bib {
      display: inline-block;
      max-width: 100%;
      padding: 0.125rem 0.5rem;
      overflow: hidden;
      border: 2px solid currentColor;
      border-radius: 0.375rem;
      background-color: var(--color-base-100);
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .outfit-text {
      font-size: 0.75rem;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .lock-button {
      position: absolute;
      top: 0.25rem;
      inset-inline-end: 0.25rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .athlete.is-legendary {
        animation: none;
        box-shadow: 0 0 0 2px var(--color-warning);
      }
    }

    @media (forced-colors: active) {
      .athlete.is-legendary,
      .athlete.is-locked {
        border-color: Highlight;
      }
    }
  `;

  /**
   * @description Sets the starting state.
   * @since 1.0.0
   */
  constructor() {
    super();
    this.entrants = [];
    this.disabled = false;
  }

  /**
   * @description Finds an entrant by its key.
   * @param {string} key - The entrant key (the lower-case name).
   * @returns {Object|undefined} The entrant.
   * @since 1.0.0
   */
  _entrantFor(key) {
    return (this.entrants || []).find((entrant) => entrant.key === key);
  }

  /**
   * @description Emits one line-up event for the entrant behind the clicked button.
   * @param {string} eventName - The event to emit.
   * @param {HTMLElement} button - The clicked button, carrying data-key.
   * @returns {void}
   * @since 1.0.0
   */
  _emitFor(eventName, button) {
    const entrant = this._entrantFor(button.dataset.key);
    if (!entrant || this.disabled) {
      return;
    }
    this.dispatchEvent(new CustomEvent(eventName, {
      detail: {key: entrant.key, name: entrant.name},
      bubbles: true,
      composed: true
    }));
  }

  /**
   * @description Asks for a new outfit for the clicked squirrel (one handler for every card).
   * @param {MouseEvent} event - The click event.
   * @returns {void}
   * @since 1.0.0
   */
  _onRerollClick = (event) => {
    this._emitFor('ss-lineup:reroll', event.currentTarget);
  };

  /**
   * @description Toggles the clicked squirrel's padlock (one handler for every card).
   * @param {MouseEvent} event - The click event.
   * @returns {void}
   * @since 1.0.0
   */
  _onLockClick = (event) => {
    this._emitFor('ss-lineup:toggle-lock', event.currentTarget);
  };

  /**
   * @description Asks for every unlocked outfit to be re-rolled.
   * @returns {void}
   * @since 1.0.0
   */
  _onShuffle = () => {
    if (this.disabled) {
      return;
    }
    this.dispatchEvent(new CustomEvent('ss-lineup:shuffle', {bubbles: true, composed: true}));
  };

  /**
   * @description One squirrel's card.
   * @param {{key: string, name: string, outfit: Object, locked: boolean, legendary: boolean}}
   *   entrant - The entrant.
   * @param {Object} labels - The label catalogue.
   * @returns {import('lit').TemplateResult} The card.
   * @since 1.0.0
   */
  _renderAthlete(entrant, labels) {
    const outfit = outfitForDrawing(entrant.outfit);
    const outfitWords = themeConfig.outfits.slotOrder
      .map((slot) => outfitItemLabel(labels, slot, outfit[slot]))
      .join(', ');
    const rerollLabel = entrant.locked
      ? i18n.getMessage('{name}’s outfit is locked', {name: entrant.name})
      : i18n.getMessage('Give {name} a new outfit', {name: entrant.name});
    return html`
      <li
        class=${classMap({
          athlete: true,
          'is-legendary': entrant.legendary,
          'is-locked': entrant.locked
        })}
        data-testid="athlete"
        data-name=${entrant.name}
        data-outfit=${JSON.stringify(toPayload(entrant.outfit))}
      >
        <button
          type="button"
          class="sprite-button"
          data-key=${entrant.key}
          aria-label=${rerollLabel}
          aria-disabled=${entrant.locked || this.disabled ? 'true' : 'false'}
          @click=${this._onRerollClick}
        >
          ${squirrelSprite({
            fur: outfit.fur,
            hat: outfit.hat,
            cape: outfit.cape,
            accessory: outfit.accessory,
            pose: 'idle',
            effects: {sparkle: entrant.legendary}
          })}
        </button>
        <span class="bib text-text-primary" title=${entrant.name}>
          ${truncateLabel(entrant.name)}
        </span>
        <span class="outfit-text text-text-secondary">${outfitWords}</span>
        ${entrant.legendary
          ? html`<span class="aiux-badge aiux-badge-warning aiux-badge-sm">
              ${i18n.getMessage('Legendary')}
            </span>`
          : nothing}
        <button
          type="button"
          class="lock-button aiux-btn aiux-btn-ghost aiux-btn-xs aiux-btn-square"
          data-key=${entrant.key}
          aria-pressed=${entrant.locked ? 'true' : 'false'}
          aria-label=${i18n.getMessage('Keep {name}’s outfit', {name: entrant.name})}
          ?disabled=${this.disabled}
          data-testid="athlete-lock"
          @click=${this._onLockClick}
        >
          ${icon({name: entrant.locked ? 'lock' : 'unlock', size: 'sm'})}
        </button>
      </li>
    `;
  }

  /**
   * @description Renders the heading, the shuffle button and the cards. Pure and server-safe.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  render() {
    const entrants = Array.isArray(this.entrants) ? this.entrants : [];
    const labels = buildLabels(i18n);
    const canShuffle = entrants.some((entrant) => !entrant.locked);
    const compact = entrants.length > themeConfig.race.scale.flatLabelsUpTo;
    return html`
      <section class="flex flex-col gap-3" aria-labelledby="lineup-heading">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 id="lineup-heading" class="text-lg font-semibold text-text-primary">
            ${i18n.getMessage('Meet the athletes')}
          </h2>
          <button
            type="button"
            class="aiux-btn aiux-btn-secondary aiux-btn-sm"
            ?disabled=${this.disabled || !canShuffle}
            data-testid="shuffle-outfits"
            @click=${this._onShuffle}
          >${i18n.getMessage('Shuffle outfits')}</button>
        </div>
        <p class="text-xs text-text-secondary">
          ${i18n.getMessage('Select a squirrel for a new outfit. Padlocked outfits stay put when you shuffle.')}
        </p>
        ${entrants.length === 0
          ? html`<p class="text-sm text-text-secondary">
              ${i18n.getMessage('Add some names to meet the athletes.')}
            </p>`
          : html`
            <ul class=${classMap({athletes: true, 'is-compact': compact})}>
              ${repeat(entrants, (entrant) => entrant.key,
                (entrant) => this._renderAthlete(entrant, labels))}
            </ul>
          `}
      </section>
    `;
  }
}
