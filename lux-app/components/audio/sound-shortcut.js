/**
 * The sound shortcut, M (Chaos v2 contract § 9 "Control"), shared by the setup screen and the race
 * HUD so both read the key the same way: M or Shift+M, no Ctrl, Alt or Meta, not a key held down,
 * not already handled, and not while the marshal is typing in a text field.
 *
 * Pure ES module: it only reads the event it is given.
 */

/** Input types that take typing; M in these is a letter, not the shortcut. */
const TEXT_INPUT_TYPES = Object.freeze([
  'text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'datetime-local',
  'month', 'time', 'week'
]);

/**
 * @description Says whether an element on the event path takes typing.
 * @param {*} node - An event-path entry.
 * @returns {boolean} True for text inputs, text areas, selects and editable content.
 * @since 1.0.0
 */
function takesTyping(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  const tag = typeof node.tagName === 'string' ? node.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  if (tag === 'INPUT') {
    const type = typeof node.type === 'string' ? node.type.toLowerCase() : 'text';
    return TEXT_INPUT_TYPES.includes(type);
  }
  return node.isContentEditable === true;
}

/**
 * @description Says whether a keydown is the sound shortcut. On a non-Latin layout (the M key
 *   types a letter of another script) the physical M key (code KeyM) counts; punctuation never
 *   does.
 * @param {KeyboardEvent} keyEvent - The keydown.
 * @returns {boolean} True when it should toggle the sound.
 * @example
 *   window.addEventListener('keydown', (keyEvent) => {
 *     if (isSoundShortcut(keyEvent)) {
 *       keyEvent.preventDefault();
 *       audio.setMuted(!audio.isMuted());
 *     }
 *   });
 * @since 1.0.0
 */
export function isSoundShortcut(keyEvent) {
  if (!keyEvent || keyEvent.defaultPrevented || keyEvent.repeat
    || keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) {
    return false;
  }
  const key = typeof keyEvent.key === 'string' ? keyEvent.key : '';
  const latinM = key === 'm' || key === 'M';
  const otherScriptLetter = /^\p{L}$/u.test(key) && !/^[a-z]$/i.test(key);
  const physicalM = otherScriptLetter && keyEvent.code === 'KeyM';
  if (!latinM && !physicalM) {
    return false;
  }
  const path = typeof keyEvent.composedPath === 'function'
    ? keyEvent.composedPath()
    : [keyEvent.target];
  return !path.some(takesTyping);
}
