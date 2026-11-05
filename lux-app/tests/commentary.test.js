/**
 * Unit tests for lib/commentary.js (SPEC.md § 8 race view, § 11.11, § 12).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRng} from '../lib/rng.js';
import {themeConfig} from '../lib/theme-config.js';
import {buildRacePlan} from '../lib/choreography.js';
import {buildCommentaryCues} from '../lib/commentary.js';
import {CHAOS_LENGTHS_MS, CLASSIC_LENGTHS_MS, randomRaceInput} from './support.js';

const GAP_MS = themeConfig.timings.commentaryGapMs;

/**
 * @description Phrase keys in one bank.
 * @param {string} bank - 'classic' or 'chaos'.
 * @returns {Set<string>} The keys.
 */
function keysIn(bank) {
  return new Set(Object.values(themeConfig.phrases[bank]).flat().map((phrase) => phrase.key));
}

const CLASSIC_KEYS = keysIn('classic');
const CHAOS_KEYS = keysIn('chaos');

/**
 * @description Checks the rules every cue list must keep.
 * @param {Object} plan - The plan.
 * @param {Array<Object>} cues - Its cues.
 * @returns {void}
 */
function checkCues(plan, cues) {
  cues.forEach((cue, order) => {
    if (order > 0) {
      assert.ok(cue.atMs - cues[order - 1].atMs >= GAP_MS, `cues too close at ${cue.atMs} ms`);
    }
    const known = CLASSIC_KEYS.has(cue.templateKey) || CHAOS_KEYS.has(cue.templateKey);
    assert.ok(known, cue.templateKey);
    if (plan.mode === 'classic') {
      assert.ok(CLASSIC_KEYS.has(cue.templateKey), `Chaos line in Classic: ${cue.templateKey}`);
    }
    if (cue.template.includes('{name}')) {
      assert.equal(typeof cue.params.name, 'string');
      assert.ok(plan.entrants[cue.entrantIndex]);
    }
    if (cue.template.includes('{other}')) {
      assert.equal(typeof cue.params.other, 'string');
      assert.notEqual(cue.otherIndex, cue.entrantIndex);
    }
  });
  const triggers = cues.map((cue) => cue.trigger);
  assert.ok(triggers.includes('finalStretch'));
  assert.ok(triggers.includes('winner') || triggers.includes('photoFinish'));
  const openings = plan.entrants.length === 1 ? ['solo'] : ['opening', 'openingCarnage'];
  assert.ok(triggers.some((trigger) => openings.includes(trigger)));
}

test('cues are 1.5 s apart, use known phrases and always cover the big moments', () => {
  const rng = createRng(1515);
  const seenTriggers = new Set();
  ['classic', 'chaos'].forEach((mode) => {
    const lengths = mode === 'classic' ? CLASSIC_LENGTHS_MS : CHAOS_LENGTHS_MS;
    for (let race = 0; race < 300; race += 1) {
      const shape = {minEntrants: 1, maxEntrants: 12, lengths, mode};
      const plan = buildRacePlan(randomRaceInput(rng, shape));
      const cues = buildCommentaryCues(plan, themeConfig.phrases, createRng(plan.seed + 1));
      checkCues(plan, cues);
      cues.forEach((cue) => seenTriggers.add(cue.trigger));
    }
  });
  ['newLeader', 'nutStop', 'tornado', 'photoFinish', 'solo'].forEach((trigger) => {
    assert.ok(seenTriggers.has(trigger), `no ${trigger} line in 600 races`);
  });
});

test('cues are deterministic for a plan and a seed', () => {
  const rng = createRng(77);
  const shape = {minEntrants: 6, maxEntrants: 10, lengths: CHAOS_LENGTHS_MS, mode: 'chaos'};
  const plan = buildRacePlan(randomRaceInput(rng, shape));
  const first = buildCommentaryCues(plan, themeConfig.phrases, createRng(plan.seed + 1));
  const second = buildCommentaryCues(plan, themeConfig.phrases, createRng(plan.seed + 1));
  assert.deepStrictEqual(first, second);
});

test('a solo race acknowledges itself and has no leader lines', () => {
  const rng = createRng(1);
  const plan = buildRacePlan(randomRaceInput(rng, {
    minEntrants: 1, maxEntrants: 1, lengths: CLASSIC_LENGTHS_MS, mode: 'classic'
  }));
  const cues = buildCommentaryCues(plan, themeConfig.phrases, createRng(2));
  assert.equal(cues[0].trigger, 'solo');
  assert.equal(cues[0].atMs, 0);
  assert.equal(cues[0].params.name, plan.entrants[0].name);
  assert.ok(!cues.some((cue) => cue.trigger === 'newLeader' || cue.trigger === 'neckAndNeck'));
});

test('a legendary outfit gets a line early on', () => {
  const rng = createRng(3);
  const plan = buildRacePlan(randomRaceInput(rng, {
    minEntrants: 4, maxEntrants: 4, lengths: [20000], mode: 'classic'
  }));
  const extras = {legendaryIndexes: [2]};
  const cues = buildCommentaryCues(plan, themeConfig.phrases, createRng(4), extras);
  const legendary = cues.find((cue) => cue.trigger === 'legendary');
  assert.ok(legendary);
  assert.ok(legendary.atMs <= themeConfig.commentary.legendaryCueMs + 3000);
  assert.equal(legendary.params.name, plan.entrants[2].name);
});

test('Chaos v2: Carnage opens its own way, and finale, verdict and combo lines are used', () => {
  const rng = createRng(2121);
  const triggers = new Set();
  const shape = {minEntrants: 6, maxEntrants: 12, lengths: CHAOS_LENGTHS_MS, mode: 'chaos'};
  for (let race = 0; race < 200; race += 1) {
    const plan = buildRacePlan(randomRaceInput(rng, {...shape, chaosLevel: 'carnage'}));
    const cues = buildCommentaryCues(plan, themeConfig.phrases, createRng(plan.seed + 1));
    checkCues(plan, cues);
    assert.equal(cues[0].trigger, 'openingCarnage');
    const verdicts = plan.events
      .filter((event) => event.type === 'var')
      .map((event) => event.data.verdict);
    cues.forEach((cue) => {
      triggers.add(cue.trigger);
      if (cue.trigger === 'varVerdict') {
        assert.ok(verdicts.includes(cue.templateKey), `${cue.templateKey} is not a stored verdict`);
      }
    });
  }
  ['finale', 'varVerdict', 'sharknado', 'goldenAcorn', 'catLady'].forEach((trigger) => {
    assert.ok(triggers.has(trigger), `no ${trigger} line in 200 Carnage races`);
  });
  assert.ok(['hunterVsTornado', 'eagleIntoFunnel', 'suitorSwept', 'catVsEagle']
    .some((trigger) => triggers.has(trigger)), 'no combo line in 200 Carnage races');
});

test('a field event that singles nobody out never leaves a placeholder unfilled', () => {
  const rng = createRng(2122);
  const shape = {minEntrants: 1, maxEntrants: 12, lengths: CHAOS_LENGTHS_MS, mode: 'chaos'};
  for (let race = 0; race < 200; race += 1) {
    const plan = buildRacePlan(randomRaceInput(rng, {...shape, chaosLevel: 'silly'}));
    buildCommentaryCues(plan, themeConfig.phrases, createRng(3)).forEach((cue) => {
      const needed = [...cue.template.matchAll(/\{([a-z]+)\}/g)].map((match) => match[1]);
      needed.forEach((name) => assert.equal(typeof cue.params[name], 'string', cue.templateKey));
    });
  }
});

test('a missing phrase group leaves that moment quiet instead of failing', () => {
  const rng = createRng(5);
  const plan = buildRacePlan(randomRaceInput(rng, {
    minEntrants: 3, maxEntrants: 3, lengths: [20000], mode: 'classic'
  }));
  const cues = buildCommentaryCues(plan, {classic: {}}, createRng(6));
  assert.deepEqual(cues, []);
});
