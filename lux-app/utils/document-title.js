/**
 * Browser tab titles for Squirrel Scramble pages (WCAG 2.2 SC 2.4.2, Page Titled).
 *
 * Client only: pages call it from firstUpdated() or an event handler, never from render(). On the
 * server it does nothing, so a stray call during server rendering is harmless.
 */
import {isServer} from 'lit';
import {i18n} from '@servicenow/aiux/aiux-services';

/**
 * @description Sets the browser tab title to "<page> | Squirrel Scramble", or to the app name
 *   alone when no page title is given.
 * @param {string} pageTitle - The page's own title, already translated.
 * @returns {void}
 * @example
 *   setDocumentTitle(i18n.getMessage('Hall of Fame'));
 *   // document.title === 'Hall of Fame | Squirrel Scramble'
 * @since 1.0.0
 */
export function setDocumentTitle(pageTitle) {
  if (isServer || typeof document === 'undefined') {
    return;
  }
  const cleaned = typeof pageTitle === 'string' ? pageTitle.trim() : '';
  document.title = cleaned
    ? i18n.getMessage('{page} | Squirrel Scramble', {page: cleaned})
    : i18n.getMessage('Squirrel Scramble');
}
