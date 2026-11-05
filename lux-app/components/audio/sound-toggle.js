/**
 * <ss-sound-toggle>: the sound on/off button (Chaos v2 contract § 9 "Control"), for the setup
 * screen and the race HUD. A speaker icon (a struck-through speaker when off) and the label
 * "Sound"; aria-pressed says whether the sound is on, so the label stays the same and a screen
 * reader announces the state. The title tooltip reads "Sound is on" or "Sound is off".
 *
 * Every toggle on the page stays in step through getRaceAudio().onChange(). Turning the sound on
 * also calls unlock(), since the click is a user gesture the browser accepts for audio.
 *
 * Attributes: compact (icon only; the label stays for screen readers). Emits ss-sound:change
 * with {muted} after a click, for a page that wants to announce it.
 */
import {html, css, isServer} from 'lit';
import {customElement} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {icon} from '@servicenow/aiux/aiux-directive-icon';
import {getRaceAudio} from './race-audio.js';
import {buildSoundLabels} from './sound-labels.js';

/**
 * The sound toggle. Properties: compact (icon only).
 */
@customElement('ss-sound-toggle')
export class SoundToggle extends AIUXElement {
  static properties = {
    compact: {type: Boolean, reflect: true},
    _muted: {state: true}
  };

  static styles = css`
    :host {
      display: inline-flex;
    }

    :host([hidden]) {
      display: none;
    }

    .sound-toggle-button {
      gap: 0.375rem;
    }

    .sound-toggle-button[aria-pressed='false'] {
      opacity: 0.8;
    }

    .sound-toggle-button:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  `;

  /**
   * @description Sets the starting state: sound on until the browser says otherwise (read after
   *   the first render, so server and client render the same markup).
   * @since 1.0.0
   */
  constructor() {
    super();
    this.compact = false;
    this._muted = false;
    this._unsubscribe = null;
  }

  /**
   * @description Follows the shared engine's mute state. Browser only.
   * @returns {void}
   * @since 1.0.0
   */
  connectedCallback() {
    super.connectedCallback();
    if (!isServer) {
      const audio = getRaceAudio();
      if (!this._unsubscribe) {
        this._unsubscribe = audio.onChange((muted) => {
          this._muted = Boolean(muted);
        });
      }
      if (this.hasUpdated) {
        this._muted = audio.isMuted();
      }
    }
  }

  /**
   * @description Stops following the engine.
   * @returns {void}
   * @since 1.0.0
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  /**
   * @description After the first (hydrating) render: shows the remembered preference.
   * @returns {void}
   * @since 1.0.0
   */
  firstUpdated() {
    this._muted = getRaceAudio().isMuted();
  }

  /**
   * @description Turns the sound off or on. Turning it on unlocks the audio (this click is the
   *   user gesture the browser needs).
   * @returns {void}
   * @since 1.0.0
   */
  _onClick = () => {
    const audio = getRaceAudio();
    const muted = !audio.isMuted();
    audio.setMuted(muted);
    if (!muted) {
      audio.unlock();
    }
    this._muted = audio.isMuted();
    this.dispatchEvent(new CustomEvent('ss-sound:change', {
      detail: {muted: this._muted},
      bubbles: true,
      composed: true
    }));
  };

  /**
   * @description Renders the button. Pure and server-safe.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  render() {
    const labels = buildSoundLabels(i18n);
    const soundOn = !this._muted;
    return html`
      <button
        type="button"
        class=${classMap({
          'sound-toggle-button': true,
          'aiux-btn': true,
          'aiux-btn-ghost': true,
          'aiux-btn-sm': true,
          'aiux-btn-square': this.compact
        })}
        aria-pressed=${soundOn ? 'true' : 'false'}
        aria-keyshortcuts="M"
        title=${soundOn ? labels.soundOn : labels.soundOff}
        data-testid="sound-toggle"
        @click=${this._onClick}
      >
        ${icon({name: soundOn ? 'speaker' : 'speaker-slash', size: 'sm'})}
        <span class=${this.compact ? 'sr-only' : 'sound-toggle-text'}>${labels.sound}</span>
      </button>
    `;
  }
}
