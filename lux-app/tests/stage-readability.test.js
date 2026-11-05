/**
 * Race-stage readability (Chaos v2 contract § 8) and sound marks (§ 9), checked on the stage's
 * pure modules: every walker crosses at no more than 18% of the field's width per second, every
 * walker and trunk visitor is on screen at least 2.5 s, the overlays use the same windows, two
 * walkers never share a row while both are on stage, field-wide events have a lead-in and a
 * tail, the disco's ball and lights are up before the dancing starts, the stage never changes
 * the plan, and the sound marks are in order. The brief's own race (seed 424242, 8 entrants,
 * 60 s, Absolute Carnage) prints its visitor table as diagnostics.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRng} from '../lib/rng.js';
import {fakeResult} from '../lib/simulate.js';
import {buildRacePlan, laneAt} from '../lib/choreography.js';
import {rollOutfit} from '../lib/outfits.js';
import {makeNames, randomRaceInput} from './support.js';
import {prepareTimeline, walkerWindow} from '../components/stage-timeline.js';
import {overlaysAt} from '../components/stage-overlays.js';
import {audioMarks} from '../components/stage-audio.js';
import {
  READABILITY,
  STAGE_TIMINGS,
  WALK,
  walkSpan,
  walkDirection,
  walkerOffStageMs,
  hunterPath,
  trunkVisit,
  fieldWindow
} from '../components/stage-shared.js';

const FIELD_PX = 1000;
const MAX_WALK_SHARE_PER_SECOND = 0.18;
const MIN_ON_SCREEN_MS = 2500;
const SAME_ROW_GAP_MS = 1200;
const FIELD_TYPES = ['disco', 'earthquake', 'flood', 'var', 'acornHail', 'leafBlower'];

/**
 * @description The brief's race: seed 424242, 8 entrants, 60 s, Absolute Carnage.
 * @returns {{input: Object, plan: Object}} The plan input and the plan.
 */
function briefRace() {
  const rng = createRng(424242);
  const result = fakeResult(rng, makeNames(8), 60000);
  const entrants = result.entrants.map((entrant) => ({...entrant, outfit: rollOutfit(rng)}));
  const input = {entrants, seed: 424242, durationMs: 60000, mode: 'chaos', chaosLevel: 'carnage'};
  return {input, plan: buildRacePlan(input)};
}

/**
 * @description One row of the visitor table for each walker and trunk visitor: its window, its
 *   time on screen (a walker's centre over the field; a fading visitor at least half visible)
 *   and its walking speed.
 * @param {Object} plan - The plan.
 * @param {Object} timeline - From prepareTimeline.
 * @returns {Array<{id: string, type: string, windowMs: number, onScreenMs: number,
 *   sharePerSecond: number}>} The rows.
 */
function visitorTable(plan, timeline) {
  const rows = [];
  timeline.events.forEach((event) => {
    if (event.type === 'catLady' || event.type === 'leafBlower') {
      const span = walkSpan(event);
      const windowMs = span.endMs - span.startMs;
      rows.push({
        id: event.id,
        type: event.type,
        windowMs,
        onScreenMs: windowMs - 2 * walkerOffStageMs(),
        sharePerSecond: (WALK.toFraction - WALK.fromFraction) / (windowMs / 1000)
      });
    }
    if (event.type === 'hunter') {
      const combo = timeline.combos[event.id];
      const vsTornado = Boolean(combo && combo.kind === 'hunterVsTornado');
      const target = event.entrants[0];
      if (!vsTornado && !Number.isInteger(target)) {
        return;
      }
      const count = plan.entrants.length;
      const path = hunterPath({
        count,
        lane: vsTornado ? count : laneAt(plan, target, event.startMs).lane,
        vsTornado,
        outcome: event.outcome,
        startMs: event.startMs,
        endMs: event.endMs
      });
      const leaveOff = path.side === 'vs' ? STAGE_TIMINGS.hunter.leaveMs / 2 : walkerOffStageMs();
      rows.push({
        id: event.id,
        type: 'hunter',
        windowMs: path.leaveEnd - path.enterAt,
        onScreenMs: path.leaveEnd - path.enterAt - walkerOffStageMs() - leaveOff,
        sharePerSecond: Math.abs(path.stand - path.from) / (path.walkMs / 1000)
      });
    }
    if (event.type === 'beaver' || event.type === 'woodpecker') {
      const visit = trunkVisit(event);
      const windowMs = visit.endMs - visit.startMs;
      rows.push({
        id: event.id,
        type: event.type,
        windowMs,
        onScreenMs: windowMs - READABILITY.trunkFadeMs,
        sharePerSecond: 0
      });
    }
  });
  return rows;
}

/**
 * @description Checks every readability rule on one plan, and returns its visitor table.
 * @param {Object} plan - The plan.
 * @returns {Array<Object>} The visitor table.
 */
function checkReadability(plan) {
  const timeline = prepareTimeline(plan, 3);
  const table = visitorTable(plan, timeline);
  table.forEach((row) => {
    if (row.onScreenMs < MIN_ON_SCREEN_MS) {
      assert.fail(`${row.type} ${row.id} is on screen ${row.onScreenMs} ms, seed ${plan.seed}`);
    }
    if (row.sharePerSecond > MAX_WALK_SHARE_PER_SECOND) {
      assert.fail(`${row.type} ${row.id} walks at ${row.sharePerSecond} of the field per second`);
    }
  });
  checkOverlayWindows(plan, timeline);
  checkWalkerRows(plan, timeline);
  checkFieldWindows(plan, timeline);
  return table;
}

/**
 * @description The overlays use the same windows as the helpers: each walker and trunk visitor is
 *   drawn just inside its window and gone just after it.
 * @param {Object} plan - The plan.
 * @param {Object} timeline - From prepareTimeline.
 * @returns {void}
 */
function checkOverlayWindows(plan, timeline) {
  const typeOf = {hunter: 'hunter', catLady: 'catLady', leafBlower: 'gardener'};
  timeline.events.forEach((event) => {
    let window = walkerWindow(plan, event, timeline.combos);
    let type = typeOf[event.type];
    if (event.type === 'beaver' || event.type === 'woodpecker') {
      window = trunkVisit(event);
      type = event.type;
    }
    if (!window || !type) {
      return;
    }
    const drawnAt = (raceMs) => overlaysAt(plan, timeline, raceMs, false)
      .some((overlay) => overlay.key === event.id && overlay.type === type);
    if (!drawnAt(window.startMs + 1) || !drawnAt(window.endMs - 1) || drawnAt(window.endMs + 1)) {
      assert.fail(`${event.type} ${event.id} is not drawn over exactly its window`);
    }
  });
}

/**
 * @description Two walkers on one row are never on stage together, unless both are steady
 *   crossings the same way at the same speed, at least SAME_ROW_GAP_MS apart.
 * @param {Object} plan - The plan.
 * @param {Object} timeline - From prepareTimeline.
 * @returns {void}
 */
function checkWalkerRows(plan, timeline) {
  const walkers = timeline.events
    .map((event) => ({event, window: walkerWindow(plan, event, timeline.combos)}))
    .filter((item) => item.window);
  walkers.forEach((first, index) => {
    walkers.slice(index + 1).forEach((second) => {
      const row = timeline.walkerRows[first.event.id];
      if (row !== timeline.walkerRows[second.event.id]) {
        return;
      }
      const overlap = first.window.startMs < second.window.endMs
        && second.window.startMs < first.window.endMs;
      const follows = first.window.crossing && second.window.crossing
        && walkDirection(first.event, row) === walkDirection(second.event, row)
        && first.window.endMs - first.window.startMs === second.window.endMs - second.window.startMs
        && Math.abs(first.window.startMs - second.window.startMs) >= SAME_ROW_GAP_MS;
      if (overlap && !follows) {
        const pair = `${first.event.id} and ${second.event.id}`;
        assert.fail(`${pair} share row ${row} on stage, seed ${plan.seed}`);
      }
    });
  });
}

/**
 * @description Says whether an overlay belongs to an event: its key is the event id, or the id
 *   and a suffix ('evt-3-wash'), never another event whose id merely starts the same ('evt-31').
 * @param {{key: string}} overlay - An overlay descriptor.
 * @param {string} eventId - The event id.
 * @returns {boolean} True when it belongs.
 */
function belongsTo(overlay, eventId) {
  return overlay.key === eventId || overlay.key.startsWith(`${eventId}-`);
}

/**
 * @description Field-wide events are drawn over a lead-in and a tail; the disco's ball has
 *   dropped and its lights are up before the dancing starts, its wash is on the wash layer
 *   (behind the squirrels) and only its accents are in front.
 * @param {Object} plan - The plan.
 * @param {Object} timeline - From prepareTimeline.
 * @returns {void}
 */
function checkFieldWindows(plan, timeline) {
  timeline.events
    .filter((event) => FIELD_TYPES.includes(event.type))
    .forEach((event) => {
      const keys = (raceMs) => overlaysAt(plan, timeline, raceMs, false)
        .filter((overlay) => belongsTo(overlay, event.id))
        .map((overlay) => overlay.layer);
      const lead = READABILITY.fieldLeadMs - 100;
      const tail = READABILITY.fieldTailMs - 100;
      if (keys(event.startMs - lead).length === 0 || keys(event.endMs + tail).length === 0) {
        assert.fail(`${event.type} ${event.id} has no lead-in or tail`);
      }
      if (event.type !== 'disco') {
        return;
      }
      const during = overlaysAt(plan, timeline, event.startMs, false)
        .filter((overlay) => belongsTo(overlay, event.id));
      const wash = during.find((overlay) => overlay.type === 'discoWash');
      const accents = during.find((overlay) => overlay.type === 'disco');
      const lights = fieldWindow(event, STAGE_TIMINGS.disco.leadMs, STAGE_TIMINGS.disco.tailMs);
      const lightsUpAt = lights.startMs + STAGE_TIMINGS.disco.lightsUpMs;
      if (!wash || wash.layer !== 'wash' || !accents || accents.layer !== 'fx'
        || accents.ball.startMs + accents.ball.durationMs > event.startMs
        || lightsUpAt > event.startMs) {
        assert.fail(`disco ${event.id} is not up before the dancing, or its wash is in front`);
      }
    });
}

test('the brief race (seed 424242, 8, 60 s, Carnage): readable visitors', (t) => {
  const {plan} = briefRace();
  const table = checkReadability(plan);
  t.diagnostic('visitor | window ms | on screen ms | share/s | px/s at 1000 px');
  table.forEach((row) => {
    const pxPerSecond = Math.round(row.sharePerSecond * FIELD_PX);
    const share = Math.round(row.sharePerSecond * 1000) / 1000;
    t.diagnostic(`${row.type} ${row.id} | ${row.windowMs} | ${row.onScreenMs} | ${share} | `
      + `${pxPerSecond}`);
  });
  assert.ok(table.length > 0, 'the brief race has walkers or trunk visitors');
});

test('200 Carnage races of 8 at 60 s: every visitor readable, walkers never share a row', () => {
  const rng = createRng(91001);
  const shape = {
    minEntrants: 8,
    maxEntrants: 8,
    lengths: [60000],
    mode: 'chaos',
    chaosLevel: 'carnage'
  };
  for (let race = 0; race < 200; race += 1) {
    checkReadability(buildRacePlan(randomRaceInput(rng, shape)));
  }
});

test('the stage never changes the plan: stored order and finish times stay put', () => {
  const {input, plan} = briefRace();
  const before = JSON.stringify(plan);
  const timeline = prepareTimeline(plan, 3);
  for (let raceMs = -3000; raceMs < plan.durationMs + 5000; raceMs += 250) {
    overlaysAt(plan, timeline, raceMs, false);
  }
  audioMarks(plan, timeline);
  assert.equal(JSON.stringify(plan), before);
  input.entrants.forEach((entrant, index) => {
    assert.equal(plan.entrants[index].finishMs, entrant.finishMs);
    assert.equal(plan.entrants[index].position, entrant.position);
  });
});

test('sound marks: in order, one go and one finish, every event starts and ends', () => {
  const {plan} = briefRace();
  const timeline = prepareTimeline(plan, 3);
  const marks = audioMarks(plan, timeline);
  marks.forEach((mark, index) => {
    if (index > 0 && mark.atMs < marks[index - 1].atMs) {
      assert.fail('sound marks are out of order');
    }
  });
  const cues = marks.filter((mark) => mark.kind === 'cue').map((mark) => mark.name);
  assert.equal(cues.filter((name) => name === 'go').length, 1);
  assert.equal(cues.filter((name) => name === 'finish').length, 1);
  assert.ok(cues.includes('finaleBurst'), 'an Absolute Carnage race has a finale burst cue');
  timeline.events.forEach((event) => {
    const phases = marks
      .filter((mark) => mark.kind === 'event' && mark.event.id === event.id)
      .map((mark) => mark.phase);
    assert.ok(phases.includes('start') && phases.includes('end'), `${event.id} start and end`);
  });
});
