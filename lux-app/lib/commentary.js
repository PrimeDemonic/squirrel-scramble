/**
 * Race commentary cues (SPEC.md § 8 race view, § 11.11, § 12, Chaos v2 contract § 4 and § 6).
 * Turns a race plan into a list of timed lines: which phrase, when, and who it is about. The
 * component layer translates each phrase and fills its {name} and {other} placeholders; nothing
 * here touches the DOM.
 *
 * Triggers: the opening (or a solo race acknowledging itself; Absolute Carnage has its own
 * opening), a legendary outfit, a new leader held for 0.5 s, an event starting (a combo, a
 * sharknado and a VAR verdict have their own lines), the finale burst, 75% of the race ("Final
 * stretch!"), the winner finishing, and a photo finish (which replaces the winner's line).
 *
 * Scheduling: the must-say lines (opening or solo, final stretch, winner or photo finish) go in
 * first, moved later if they must be. Then the optional lines fill the gaps, best first (the
 * finale, Chaos events and verdicts, the legendary line, leader changes, Classic events). Every
 * line is at least the commentary gap (1.5 s) from its neighbours; an optional line that would
 * run too late, or after the winner finishes, is dropped. A line is only offered when every
 * placeholder in it can be filled, so a field-wide event that singles nobody out uses a line
 * that names nobody. Chaos phrases appear only in Chaos races.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {themeConfig} from './theme-config.js';
import {heightAt, leaderChanges} from './choreography.js';

const PLACEHOLDER = /\{([a-z]+)\}/g;

/**
 * @description Reads the commentary settings from a theme.
 * @param {Object} theme - A theme config.
 * @returns {Object} The settings.
 * @since 1.0.0
 */
function commentarySettings(theme) {
  return {
    ...theme.commentary,
    gapMs: theme.timings.commentaryGapMs,
    holdMs: theme.timings.leaderHoldMs,
    finalStretchFraction: theme.timings.finalStretchFraction
  };
}

/**
 * @description Which phrase group an event uses: its combo, the sharknado, a hunter's hit or
 *   miss, a suitor's kiss or slap, or simply its type.
 * @param {{type: string, category: string, outcome: (string|null), data?: Object}} event - A plan
 *   event.
 * @returns {{bank: string, group: string}} The phrase bank and group.
 * @since 1.0.0
 */
function eventPhraseGroup(event) {
  const data = event.data || {};
  if (data.combo) {
    return {bank: 'chaos', group: data.combo.kind};
  }
  if (event.type === 'tornado' && data.sharks) {
    return {bank: 'chaos', group: 'sharknado'};
  }
  if (event.type === 'hunter') {
    return {bank: 'chaos', group: event.outcome === 'hit' ? 'hunterHit' : 'hunterMiss'};
  }
  if (event.type === 'suitor') {
    return {bank: 'chaos', group: event.outcome === 'slap' ? 'suitorSlap' : 'suitorKiss'};
  }
  return {bank: event.category === 'chaos' ? 'chaos' : 'classic', group: event.type};
}

/**
 * @description The first or second entry of a list, or null.
 * @param {*} list - A list (or anything).
 * @param {number} position - 0 or 1.
 * @returns {number|null} The entry.
 * @since 2.0.0
 */
function entryAt(list, position) {
  return Array.isArray(list) && Number.isInteger(list[position]) ? list[position] : null;
}

/**
 * @description Who a line about an event names: the squirrel it singles out (the sharknado's hat
 *   victim, the first cat to land, the trench coat's host, a field event's first slip, burst,
 *   chubby cheek or lost hat), otherwise its first two entrants. A field event that singles
 *   nobody out names nobody.
 * @param {Object} event - A plan event.
 * @returns {{entrantIndex: (number|null), otherIndex: (number|null)}} The subjects.
 * @since 2.0.0
 */
function eventSubjects(event) {
  const data = event.data || {};
  if (event.type === 'tornado' && data.sharks) {
    return {entrantIndex: Number.isInteger(data.hatChomp) ? data.hatChomp : null, otherIndex: null};
  }
  if (event.type === 'catLady') {
    const landed = (data.throws || [])
      .filter((item) => !item.intercepted)
      .map((item) => item.entrant);
    return {entrantIndex: entryAt(landed, 0), otherIndex: null};
  }
  if (event.type === 'trenchCoat') {
    return {entrantIndex: Number.isInteger(data.host) ? data.host : null, otherIndex: null};
  }
  if (event.scope === 'field') {
    const singled = {
      leafBlower: data.hatLoss,
      earthquake: data.slips,
      flood: data.bursters,
      acornHail: data.chubby
    }[event.type];
    return {entrantIndex: entryAt(singled, 0), otherIndex: entryAt(singled, 1)};
  }
  return {entrantIndex: entryAt(event.entrants, 0), otherIndex: entryAt(event.entrants, 1)};
}

/**
 * @description The lines that are always said: the opening (or the solo line), the final
 *   stretch, and the winner (or the photo finish).
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - Commentary settings.
 * @returns {Array<Object>} Candidates in time order.
 * @since 1.0.0
 */
function mustCandidates(plan, settings) {
  const solo = plan.entrants.length === 1;
  const winner = plan.winnerIndex;
  let opening = {bank: 'classic', group: 'opening'};
  if (solo) {
    opening = {bank: 'classic', group: 'solo', entrantIndex: winner};
  } else if (plan.mode === 'chaos') {
    opening = {bank: 'chaos', group: plan.chaosLevel === 'carnage' ? 'openingCarnage' : 'opening'};
  }
  const finale = plan.photoFinish && !solo
    ? {
      bank: 'classic',
      group: 'photoFinish',
      atMs: plan.entrants[plan.finishOrder[1]].finishMs,
      entrantIndex: winner,
      otherIndex: plan.finishOrder[1]
    }
    : {bank: 'classic', group: 'winner', atMs: plan.durationMs, entrantIndex: winner};
  return [
    {...opening, atMs: 0},
    {
      bank: 'classic',
      group: 'finalStretch',
      atMs: Math.round(plan.durationMs * settings.finalStretchFraction)
    },
    finale
  ];
}

/**
 * @description Leader-change candidates: the first leader and every change held for the hold
 *   time before the winner finishes. A change between two squirrels within a few height units
 *   is "neck and neck" and names both.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - Commentary settings.
 * @returns {Array<Object>} Candidates.
 * @since 1.0.0
 */
function leaderCandidates(plan, settings) {
  if (plan.entrants.length < 2) {
    return [];
  }
  const changes = leaderChanges(plan, {holdMs: settings.holdMs, untilMs: plan.durationMs - 1});
  return changes.map((change) => {
    const previous = change.previousIndex;
    const gap = previous === null
      ? Infinity
      : Math.abs(heightAt(plan, change.entrantIndex, change.atMs)
        - heightAt(plan, previous, change.atMs));
    const close = gap < settings.neckAndNeckUnits;
    return {
      bank: 'classic',
      group: close ? 'neckAndNeck' : 'newLeader',
      atMs: change.atMs,
      entrantIndex: change.entrantIndex,
      otherIndex: close ? previous : null,
      priority: settings.priority.leader,
      maxDelayMs: settings.maxDelayMs.leader
    };
  });
}

/**
 * @description Event candidates: one per event start, plus a VAR event's verdict at its end.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - Commentary settings.
 * @returns {Array<Object>} Candidates.
 * @since 1.0.0
 */
function eventCandidates(plan, settings) {
  const candidates = [];
  plan.events.forEach((event) => {
    const {bank, group} = eventPhraseGroup(event);
    const tier = event.category === 'chaos' ? 'chaos' : 'classic';
    candidates.push({
      bank,
      group,
      atMs: event.startMs,
      ...eventSubjects(event),
      priority: settings.priority[tier],
      maxDelayMs: settings.maxDelayMs[tier]
    });
    const verdict = event.type === 'var' && event.data ? event.data.verdict : null;
    if (typeof verdict === 'string') {
      candidates.push({
        bank: 'chaos',
        group: 'varVerdict',
        fixedKey: verdict,
        atMs: event.endMs,
        priority: settings.priority.verdict,
        maxDelayMs: settings.maxDelayMs.verdict
      });
    }
  });
  return candidates;
}

/**
 * @description The finale-burst candidate (Absolute Carnage), as the first burst event starts.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - Commentary settings.
 * @returns {Array<Object>} Zero or one candidate.
 * @since 2.0.0
 */
function finaleCandidates(plan, settings) {
  const burst = plan.finaleBurst;
  if (!burst || burst.count === 0) {
    return [];
  }
  const starts = plan.events
    .filter((event) => burst.eventIds.includes(event.id))
    .map((event) => event.startMs);
  return [{
    bank: 'chaos',
    group: 'finale',
    atMs: Math.min(...starts),
    priority: settings.priority.finale,
    maxDelayMs: settings.maxDelayMs.finale
  }];
}

/**
 * @description The legendary-outfit candidate, about the first legendary squirrel listed.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - Commentary settings.
 * @param {number[]} legendaryIndexes - Entrant indexes wearing a legendary item.
 * @returns {Array<Object>} Zero or one candidate.
 * @since 1.0.0
 */
function legendaryCandidates(plan, settings, legendaryIndexes) {
  const valid = (legendaryIndexes || []).filter((index) => (
    Number.isInteger(index) && index >= 0 && index < plan.entrants.length
  ));
  if (valid.length === 0) {
    return [];
  }
  return [{
    bank: 'classic',
    group: 'legendary',
    atMs: settings.legendaryCueMs,
    entrantIndex: valid[0],
    otherIndex: null,
    priority: settings.priority.legendary,
    maxDelayMs: settings.maxDelayMs.legendary
  }];
}

/**
 * @description The earliest time at or after atMs that keeps the gap from every scheduled line.
 * @param {number[]} scheduledTimes - Times already taken, ascending.
 * @param {number} atMs - The wanted time.
 * @param {number} gapMs - The minimum gap.
 * @returns {number} The slot.
 * @since 1.0.0
 */
function findSlot(scheduledTimes, atMs, gapMs) {
  let slot = atMs;
  for (const time of scheduledTimes) {
    if (time >= slot + gapMs) {
      break;
    }
    if (time > slot - gapMs) {
      slot = time + gapMs;
    }
  }
  return slot;
}

/**
 * @description Schedules the candidates: must-say lines first, then optional ones best first.
 * @param {Array<Object>} must - Must-say candidates.
 * @param {Array<Object>} optional - Optional candidates.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - Commentary settings.
 * @returns {Array<Object>} Scheduled candidates in time order.
 * @since 1.0.0
 */
function schedule(must, optional, plan, settings) {
  const scheduled = [];
  const insert = (candidate, atMs) => {
    scheduled.push({...candidate, atMs});
    scheduled.sort((left, right) => left.atMs - right.atMs);
  };
  must.forEach((candidate) => {
    insert(candidate, findSlot(scheduled.map((item) => item.atMs), candidate.atMs, settings.gapMs));
  });
  const ranked = optional
    .map((candidate, order) => ({...candidate, order}))
    .sort((left, right) => (
      right.priority - left.priority || left.atMs - right.atMs || left.order - right.order
    ));
  ranked.forEach((candidate) => {
    const slot = findSlot(scheduled.map((item) => item.atMs), candidate.atMs, settings.gapMs);
    if (slot - candidate.atMs <= candidate.maxDelayMs && slot <= plan.durationMs) {
      insert(candidate, slot);
    }
  });
  return scheduled;
}

/**
 * @description The placeholder values for a line, from the plan's entrant names.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} candidate - The scheduled candidate.
 * @returns {{name?: string, other?: string}} The parameters.
 * @since 1.0.0
 */
function paramsFor(plan, candidate) {
  const params = {};
  if (Number.isInteger(candidate.entrantIndex) && plan.entrants[candidate.entrantIndex]) {
    params.name = plan.entrants[candidate.entrantIndex].name;
  }
  if (Number.isInteger(candidate.otherIndex) && plan.entrants[candidate.otherIndex]) {
    params.other = plan.entrants[candidate.otherIndex].name;
  }
  return params;
}

/**
 * @description Says whether every placeholder in a phrase has a value.
 * @param {string} text - The phrase text.
 * @param {Object} params - The values.
 * @returns {boolean} True when the phrase can be filled.
 * @since 2.0.0
 */
function canFill(text, params) {
  return [...text.matchAll(PLACEHOLDER)].every((match) => typeof params[match[1]] === 'string');
}

/**
 * @description Picks a phrase for each scheduled line, in time order: only phrases whose
 *   placeholders can be filled, avoiding the same line twice in a row within a group. A moment
 *   with no usable phrase stays quiet.
 * @param {Array<Object>} scheduled - Scheduled candidates in time order.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} phraseBank - The theme's phrases section.
 * @param {Object} rng - A seeded generator.
 * @returns {Array<Object>} The cues.
 * @since 1.0.0
 */
function choosePhrases(scheduled, plan, phraseBank, rng) {
  const lastKeyByGroup = new Map();
  const cues = [];
  scheduled.forEach((candidate) => {
    const group = ((phraseBank || {})[candidate.bank] || {})[candidate.group] || [];
    const params = paramsFor(plan, candidate);
    const usable = group.filter((phrase) => (
      (!candidate.fixedKey || phrase.key === candidate.fixedKey) && canFill(phrase.text, params)
    ));
    if (usable.length === 0) {
      return;
    }
    const groupId = `${candidate.bank}.${candidate.group}`;
    const fresh = usable.length > 1
      ? usable.filter((phrase) => phrase.key !== lastKeyByGroup.get(groupId))
      : usable;
    const phrase = rng.pick(fresh);
    lastKeyByGroup.set(groupId, phrase.key);
    cues.push({
      atMs: candidate.atMs,
      templateKey: phrase.key,
      template: phrase.text,
      params,
      trigger: candidate.group,
      bank: candidate.bank,
      entrantIndex: Number.isInteger(candidate.entrantIndex) ? candidate.entrantIndex : null,
      otherIndex: Number.isInteger(candidate.otherIndex) ? candidate.otherIndex : null
    });
  });
  return cues;
}

/**
 * @description Builds the commentary for a race: timed cues at least the commentary gap apart.
 *   Deterministic for a given plan and generator seed; seed the generator from the race (for
 *   example createRng(plan.seed + 1)) so a replay says the same lines.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} phraseBank - The theme's phrases section ({classic: {...}, chaos: {...}}).
 * @param {Object} rng - A seeded generator from createRng(), used only to pick phrases.
 * @param {{legendaryIndexes?: number[], theme?: Object}} [extras] - Entrants wearing a legendary
 *   item (see isLegendary in outfits.js), and a theme for the timings.
 * @returns {Array<{atMs: number, templateKey: string, template: string,
 *   params: {name?: string, other?: string}, trigger: string, bank: string,
 *   entrantIndex: (number|null), otherIndex: (number|null)}>} Cues in time order.
 * @example
 *   const cues = buildCommentaryCues(plan, themeConfig.phrases, createRng(plan.seed + 1));
 * @since 1.0.0
 */
export function buildCommentaryCues(plan, phraseBank, rng, extras = {}) {
  const settings = commentarySettings(extras.theme || themeConfig);
  const optional = [
    ...finaleCandidates(plan, settings),
    ...legendaryCandidates(plan, settings, extras.legendaryIndexes),
    ...eventCandidates(plan, settings),
    ...leaderCandidates(plan, settings)
  ];
  const scheduled = schedule(mustCandidates(plan, settings), optional, plan, settings);
  return choosePhrases(scheduled, plan, phraseBank, rng);
}
