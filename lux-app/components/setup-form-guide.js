/**
 * The form guide for the setup view (SPEC.md § 15, a "should"): for each squirrel, a racing
 * nickname ("Alex ‘The Nutcracker’") and two silly statistics (nuts buried this season,
 * favourite tree), with "Every squirrel has equal odds" underneath.
 *
 * Everything is seeded from the name itself (an FNV-1a hash into the app's mulberry32 generator),
 * so the same name always gets the same nickname and nothing here uses unseeded randomness. It is
 * pure decoration: the server draws the result, and the form guide never influences it.
 *
 * The nickname and tree texts live in lib/theme-config.js; the i18n lint rule needs literal
 * getMessage() calls, so the catalogue below repeats them, keyed by the theme's English text.
 */
import {html, css, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {createRng} from '../lib/rng.js';
import {themeConfig} from '../lib/theme-config.js';

// The 32-bit FNV-1a offset basis and prime.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * @description The translated nicknames and favourite trees, keyed by the theme's English text.
 * @returns {{nicknames: Object<string, string>, trees: Object<string, string>}} The catalogue.
 * @since 1.0.0
 */
function formGuideLabels() {
  return {
    nicknames: {
      'The Nutcracker': i18n.getMessage('The Nutcracker'),
      'Bushy Tail': i18n.getMessage('Bushy Tail'),
      'The Acorn Assassin': i18n.getMessage('The Acorn Assassin'),
      Twiggy: i18n.getMessage('Twiggy'),
      'The Bark Shark': i18n.getMessage('The Bark Shark'),
      'Sir Scampers': i18n.getMessage('Sir Scampers'),
      'The Conker King': i18n.getMessage('The Conker King'),
      'Hazel Lightning': i18n.getMessage('Hazel Lightning'),
      'The Branch Manager': i18n.getMessage('The Branch Manager'),
      'Captain Cobnut': i18n.getMessage('Captain Cobnut'),
      'The Leaf Blower': i18n.getMessage('The Leaf Blower'),
      'Pinecone Pete': i18n.getMessage('Pinecone Pete')
    },
    trees: {
      Oak: i18n.getMessage('Oak'),
      Beech: i18n.getMessage('Beech'),
      Sycamore: i18n.getMessage('Sycamore'),
      'Horse chestnut': i18n.getMessage('Horse chestnut'),
      'Scots pine': i18n.getMessage('Scots pine'),
      'Silver birch': i18n.getMessage('Silver birch')
    }
  };
}

/**
 * @description A stable 32-bit seed from a name (FNV-1a over its lower-case UTF-16 units), so the
 *   same squirrel always gets the same form.
 * @param {string} name - The squirrel's name.
 * @returns {number} An unsigned 32-bit integer.
 * @example
 *   nameSeed('Alex') === nameSeed('alex');
 *   // true
 * @since 1.0.0
 */
export function nameSeed(name) {
  const text = String(name).toLowerCase();
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    // Bitwise on purpose: FNV-1a is defined in 32-bit integer arithmetic.
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * @description Rolls one squirrel's form from its name: a nickname, nuts buried and a tree.
 * @param {string} name - The squirrel's name.
 * @returns {{nickname: string, nutsBuried: number, tree: string}} The form, in the theme's English.
 * @example
 *   formFor('Alex').nickname;
 * @since 1.0.0
 */
export function formFor(name) {
  const guide = themeConfig.formGuide;
  const rng = createRng(nameSeed(name));
  return {
    nickname: rng.pick(guide.nicknames),
    nutsBuried: rng.intBetween(guide.nutsBuried.min, guide.nutsBuried.max),
    tree: rng.pick(guide.favouriteTrees)
  };
}

/**
 * The form guide table. Properties: names (cleaned names, in the names box order) and locale.
 */
@customElement('ss-setup-form-guide')
export class SetupFormGuide extends AIUXElement {
  static properties = {
    names: {type: Array},
    locale: {type: String},
    _open: {state: true}
  };

  static styles = css`
    :host {
      display: block;
    }

    summary {
      cursor: pointer;
    }

    .squirrel {
      overflow-wrap: anywhere;
    }
  `;

  /**
   * @description Sets the starting state.
   * @since 1.0.0
   */
  constructor() {
    super();
    this.names = [];
    this.locale = undefined;
    this._open = true;
  }

  /**
   * @description Remembers whether the marshal opened or closed the guide.
   * @param {Event} event - The details toggle event.
   * @returns {void}
   * @since 1.0.0
   */
  _onToggle = (event) => {
    this._open = event.currentTarget.open;
  };

  /**
   * @description Formats a whole number in the marshal's locale.
   * @param {number} value - The number.
   * @returns {string} The formatted number.
   * @since 1.0.0
   */
  _formatNumber(value) {
    try {
      return new Intl.NumberFormat(this.locale).format(value);
    } catch {
      return String(value);
    }
  }

  /**
   * @description Renders the guide, or nothing when there are no names yet. Pure and
   *   server-safe: every value comes from the names.
   * @returns {import('lit').TemplateResult|typeof nothing} The template.
   * @since 1.0.0
   */
  render() {
    const names = Array.isArray(this.names) ? this.names : [];
    if (names.length === 0) {
      return nothing;
    }
    const labels = formGuideLabels();
    return html`
      <details
        class="rounded-xl border border-base-300 bg-base-100 p-4"
        ?open=${this._open}
        @toggle=${this._onToggle}
      >
        <summary class="text-lg font-semibold text-text-primary">
          ${i18n.getMessage('Form guide')}
        </summary>
        <div class="mt-3 overflow-x-auto">
          <table class="aiux-table aiux-table-sm">
            <caption class="sr-only">
              ${i18n.getMessage('Each squirrel’s racing nickname and season statistics')}
            </caption>
            <thead>
              <tr>
                <th scope="col">${i18n.getMessage('Squirrel')}</th>
                <th scope="col">${i18n.getMessage('Nuts buried this season')}</th>
                <th scope="col">${i18n.getMessage('Favourite tree')}</th>
              </tr>
            </thead>
            <tbody>
              ${repeat(names, (name, index) => `${index}:${name}`, (name) => {
                const form = formFor(name);
                const nickname = labels.nicknames[form.nickname] || form.nickname;
                return html`
                  <tr>
                    <th scope="row" class="squirrel font-medium">
                      ${i18n.getMessage('{name} ‘{nickname}’', {name, nickname})}
                    </th>
                    <td>${this._formatNumber(form.nutsBuried)}</td>
                    <td>${labels.trees[form.tree] || form.tree}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-sm font-semibold text-text-primary">
          ${i18n.getMessage('Every squirrel has equal odds.')}
        </p>
      </details>
    `;
  }
}
