/**
 * The one theme object for Squirrel Scramble (SPEC.md § 12). Data only: no functions, no DOM.
 *
 * Everything that makes the race a squirrel race lives here: timings, race lengths, the
 * choreography and Chaos constants, the outfit catalogue and rarities, the lane palette, the
 * crowd, the skies and the commentary phrase bank. A duck theme is a copy of this file with the
 * nouns, outfits, phrases and colours changed; the logic modules read whatever object they are
 * given and default to this one.
 *
 * Treat it as read-only at run time: a replay is only identical if the constants are.
 * Phrase texts are plain strings with {name} and {other} placeholders. The component layer
 * translates them; the i18n lint rule only extracts literal getMessage() arguments, so it needs
 * a literal catalogue keyed by the phrase keys below.
 */
export const themeConfig = {
  id: 'squirrel',
  name: 'Squirrel Scramble',
  racerNoun: {singular: 'squirrel', plural: 'squirrels'},

  timings: {
    // One choreography step (SPEC.md § 11.2). Every entrant's ticks sit on this grid.
    tickMs: 250,
    // "3-2-1, go": three steps of one second each before the clock starts.
    countdownFrom: 3,
    countdownStepMs: 1000,
    // Switch to the result view this long after the last awarded place finishes (§ 11.12).
    handOffMs: 1500,
    // At most one new commentary line this often (§ 8 race view).
    commentaryGapMs: 1500,
    // A new leader must stay in front this long before it counts (§ 11.11).
    leaderHoldMs: 500,
    // CSS-only confetti: this many pieces, removed after this long (§ 8 result view).
    confettiMs: 4000,
    confettiPieces: 60,
    // The first two finishers within this gap make a photo finish (§ 5, Race.photo_finish).
    photoFinishThresholdMs: 150,
    // "Final stretch!" at this share of the race (§ 11.11).
    finalStretchFraction: 0.75
  },

  race: {
    // Client-side default only; the server's x_crli_squirrel.max_entrants property wins.
    maxEntrants: 50,
    maxNameLength: 40,
    // Bib labels truncate to this many characters, ellipsis included (§ 8 race view).
    labelMaxChars: 14,
    // Labels rotate 45 degrees when a lane is narrower than this (§ 8 race view).
    rotateLabelsBelowPx: 90,
    defaultPlaces: 2,
    maxPlaces: 3,
    // Client default; the server's x_crli_squirrel.photo_finish_chance property wins.
    photoFinishChance: 0.25,
    lengths: {
      classic: [
        {seconds: 10, label: 'Quick'},
        {seconds: 20, label: 'Standard'},
        {seconds: 40, label: 'Epic'}
      ],
      // Renamed in Chaos v2 (contract § 1) so no length shares a name with a level.
      chaos: [
        {seconds: 45, label: 'Short'},
        {seconds: 60, label: 'Proper'},
        {seconds: 90, label: 'Marathon'}
      ]
    },
    defaultSeconds: {classic: 20, chaos: 60},
    // Scale bands (§ 8 scale): flat labels and full outfits up to 12 entrants, rotated labels
    // and hat-and-fur outfits from 13, compact 30 px lanes from 31.
    scale: {flatLabelsUpTo: 12, simplifiedOutfitsFrom: 13, compactLanesFrom: 31}
  },

  // The server's finish-time rules (SPEC.md § 7, draw step 7), mirrored for simulate().
  serverTiming: {
    photoGapMs: {min: 40, max: 140},
    runnerUpGapMs: {min: 200, max: 900},
    laterGapMs: {min: 150, max: 700},
    // If the total spread exceeds this share of the race, every gap is scaled down.
    maxSpreadFraction: 0.5
  },

  choreography: {
    // Base climb per tick, in climb units, drawn uniformly (§ 11.3).
    paceMin: 0.5,
    paceMax: 1.5,
    // The average base climb. Chaos drops and lifts are sized against an entrant's expected
    // total climb, tickCount x paceMean, so "5 height units" means about 5% of the tree.
    paceMean: 1,
    // Form curve: 1 + formAmplitude x sin(2 pi x frequency x tick / tickCount + phase).
    // SPEC.md § 11.3 suggests 0.35. Tuned to 0.6: at 0.35 a variance estimate put the eventual
    // winner in front at the 25% mark in about 22% of 8-entrant Classic races (10 s races are
    // the worst, because the finishing spread is a larger share of a short race), too close to
    // the M8 limit of 25%. At 0.6 the estimate is about 17%. The lowest multiplier is 0.4, so a
    // fading squirrel still climbs.
    formAmplitude: 0.6,
    formFrequencyMin: 0.5,
    formFrequencyMax: 1.5,
    // Height ceiling before an entrant's final tick (§ 11.8): nobody touches the chestnut early.
    preFinishCeiling: 98,
    // No event in the last 10% of an entrant's ticks (§ 10, § 11.4). Whole percent, so the tick
    // limit is exact integer arithmetic.
    eventFreeTailPercent: 10,
    // No event before this tick, so "Go!" is clean.
    earliestEventTick: 2,
    // An entrant stalls for at most 40% of its ticks (§ 10). Whole percent, as above.
    maxStallPercent: 40,
    // Random start ticks an event tries before it is dropped (spans may not overlap).
    placementAttempts: 6,
    // Keyframe heights are rounded to this many decimals, which keeps plans compact.
    heightDecimals: 4
  },

  // Classic events (§ 11.4). Each entrant rolls each event once, in this order.
  classicEvents: {
    nutStop: {chance: 0.35, minTicks: 2, maxTicks: 4},
    // One tick of minus 2 to 4 times the mean climb, then a tick to recover (no effect).
    slip: {chance: 0.25, minMeanClimbs: 2, maxMeanClimbs: 4, recoveryTicks: 1},
    burst: {chance: 0.3, ticks: 3, paceMultiplier: 2.2}
  },

  // The Chaos deck (SPEC.md § 10, Chaos v2 contract § 4): the shape of each event. How often each
  // one happens is the level's business (chaosLevels below).
  chaosDeck: {
    // Per-squirrel chances (the suitor) halve above 30 entrants.
    crowdedFieldAbove: 30,
    crowdedChanceFactor: 0.5,
    // Random start ticks (and targets) an ordinary event tries before it is dropped.
    placementAttempts: 8,
    // Attempts for the guaranteed moments: the "every squirrel" pass, and each finale slot.
    coverageAttempts: 12,
    finaleSlotAttempts: 4,
    // Event starts follow this curve (contract § 1): [share of the race, relative weight],
    // linear in between. Calm for the first 15%, building, a plateau from 55% to 75%, then
    // fading into the quiet zone (the last 10% of each squirrel's ticks never moves).
    intensity: {
      points: [[0, 0.03], [0.15, 0.08], [0.55, 1], [0.75, 1], [0.9, 0.15], [1, 0]]
    },
    tornado: {
      minEntrants: 3,
      // Starts between 25% and 70% of the race (whole percent, exact integer arithmetic).
      earliestPercent: 25,
      latestPercent: 70,
      minLifted: 2,
      maxLifted: 4,
      // The funnel crosses the stage in this long; flight ticks count as stalled.
      flightMs: 2500,
      minDropUnits: 5,
      maxDropUnits: 15,
      dizzyTicks: 2,
      // A second tornado starts at least this long after the first has landed.
      spacingMs: 1000
    },
    hunter: {
      hitChance: 0.7,
      // A hit knocks off 20% to 40% of the squirrel's running climb total.
      minFallFraction: 0.2,
      maxFallFraction: 0.4,
      minStunTicks: 2,
      maxStunTicks: 3,
      // A miss has no effect on the climb; this many ticks are kept clear for the animation.
      missTicks: 4
    },
    suitor: {
      // At most a third of the field (integer division by fieldDivisor).
      fieldDivisor: 3,
      slapChance: 0.25,
      minKissTicks: 3,
      maxKissTicks: 6,
      slapTicks: 2
    },
    eagle: {minLiftUnits: 10, maxLiftUnits: 20, carryTicks: 3},
    beaver: {stallTicks: 2},
    // A 90 s race rolls for a second strike.
    lightning: {stallTicks: 2, secondStrikeFromMs: 90000},
    // Each cat clings for 2 to 4 ticks and slows its squirrel to 40% pace.
    catLady: {
      minThrows: 2,
      maxThrows: 4,
      throwGapTicks: 2,
      minClingTicks: 2,
      maxClingTicks: 4,
      clingPace: 0.4
    },
    // Checked every 2.5 s from 20% to 88% of the race; at most one every 10 s. The lead
    // threshold is the level's.
    goldenAcorn: {
      checkpointMs: 2500,
      fromPercent: 20,
      toPercent: 88,
      minFallFraction: 0.2,
      maxFallFraction: 0.3,
      dizzyTicks: 2,
      minGapMs: 10000
    },
    // A field event that stalls everyone needs at least half the field free to join in.
    leafBlower: {
      minClingTicks: 2,
      maxClingTicks: 3,
      minHatLoss: 1,
      maxHatLoss: 2,
      minFieldPercent: 50
    },
    ufo: {beamTicks: 6, dazedTicks: 2},
    earthquake: {shakeTicks: 6, minSlips: 2, maxSlips: 4, minSlipUnits: 5, maxSlipUnits: 15},
    // The water rises over 2 ticks; squirrels still below it then get a 3-tick burst.
    flood: {
      durationTicks: 8,
      burstDelayTicks: 2,
      burstTicks: 3,
      burstMultiplier: 2.2,
      minWaterUnits: 15,
      maxWaterUnits: 25
    },
    // "Every squirrel stalls 2 s to dance" (contract § 4).
    disco: {durationTicks: 8, minFieldPercent: 50},
    acornHail: {
      hailTicks: 6,
      minChubby: 2,
      maxChubby: 4,
      minSlowTicks: 3,
      maxSlowTicks: 5,
      slowPace: 0.6
    },
    // "A 1.5 s stall for all" (contract § 4).
    var: {stallTicks: 6, minFieldPercent: 50},
    trenchCoat: {maxHeightGapUnits: 15, minDisguiseTicks: 3, maxDisguiseTicks: 5, dazedTicks: 1},
    woodpecker: {stallTicks: 3},
    // Late events (the Golden Acorn, the trench coat, flood bursts) leave every height before
    // them unchanged; this compensation reshapes the squirrel's later free ticks, within these
    // bounds, so it still reaches the top exactly on time. An event that needs more is dropped.
    compensation: {minBoost: 0.4, maxBoost: 2.5, minFreeTicks: 4},
    // The events a peak cluster or a finale burst draws from, by weight.
    clusterWeights: {
      woodpecker: 3,
      hunter: 3,
      suitor: 2,
      eagle: 2,
      catLady: 2,
      ufo: 2,
      lightning: 1,
      beaver: 1,
      earthquake: 1,
      acornHail: 1
    }
  },

  // Chaos levels (contract § 1), stored on the race so a replay is identical. Labels and blurbs
  // match the setup lane's literal catalogue in components/labels.js.
  chaosLevels: {
    order: ['mild', 'silly', 'carnage'],
    defaultLevel: 'silly',
    levels: {
      mild: {
        label: 'Mild',
        blurb: 'A few surprises',
        // At most this many Chaos events on screen at once, and the stall cap per squirrel.
        maxOverlap: 2,
        maxStallPercent: 40,
        // The Golden Acorn smacks a leader this many height units clear of second place.
        goldenAcornLeadUnits: 15,
        everySquirrel: false,
        peakCluster: null,
        finale: null,
        // Today's deck (SPEC.md § 10): the six original events, plus a rare shark.
        deck: {
          tornadoSecondChance: 0.35,
          sharkChance: 0.1,
          hunterCountWeights: [15, 55, 30],
          suitorChance: 0.2,
          chances: {
            eagle: 0.25,
            beaver: 0.25,
            lightning: 0.2,
            woodpecker: 0,
            catLady: 0,
            ufo: 0,
            leafBlower: 0,
            earthquake: 0,
            flood: 0,
            disco: 0,
            acornHail: 0,
            var: 0
          },
          trenchCoatMax: 0,
          trenchCoatChance: 0,
          goldenAcorn: true,
          combos: {hunterVsTornado: 0.1, eagleIntoFunnel: 0.1, suitorSwept: 0.1, catVsEagle: 0}
        }
      },
      silly: {
        label: 'Silly',
        blurb: 'Things get out of hand',
        maxOverlap: 3,
        maxStallPercent: 45,
        goldenAcornLeadUnits: 15,
        // Every squirrel gets at least one Chaos moment of its own.
        everySquirrel: true,
        // A pile-up of events sharing one moment on the intensity plateau.
        peakCluster: {size: 3, anchorFromPercent: 55, anchorToPercent: 75},
        finale: null,
        // About twice the Mild deck.
        deck: {
          tornadoSecondChance: 0.5,
          sharkChance: 0.3,
          hunterCountWeights: [5, 45, 50],
          suitorChance: 0.25,
          chances: {
            eagle: 0.5,
            beaver: 0.4,
            lightning: 0.4,
            woodpecker: 0.5,
            catLady: 0.5,
            ufo: 0.4,
            leafBlower: 0.35,
            earthquake: 0.3,
            flood: 0.3,
            disco: 0.3,
            acornHail: 0.35,
            var: 0.3
          },
          trenchCoatMax: 1,
          trenchCoatChance: 0.5,
          goldenAcorn: true,
          combos: {hunterVsTornado: 0.3, eagleIntoFunnel: 0.3, suitorSwept: 0.3, catVsEagle: 0.3}
        }
      },
      carnage: {
        label: 'Absolute Carnage',
        blurb: 'Everything, all at once',
        maxOverlap: 5,
        maxStallPercent: 50,
        goldenAcornLeadUnits: 10,
        everySquirrel: true,
        peakCluster: {size: 4, anchorFromPercent: 55, anchorToPercent: 70},
        // Several events sharing one moment between 78% and 84%, all starting within 75% to 88%.
        finale: {
          size: 5,
          minEvents: 4,
          fromPercent: 75,
          toPercent: 88,
          anchorFromPercent: 78,
          anchorToPercent: 84
        },
        // About four times the Mild deck (the overlap cap trims the excess).
        deck: {
          tornadoSecondChance: 0.9,
          sharkChance: 0.6,
          hunterCountWeights: [0, 20, 50, 30],
          suitorChance: 0.35,
          chances: {
            eagle: 0.9,
            beaver: 0.7,
            lightning: 0.7,
            woodpecker: 0.9,
            catLady: 0.9,
            ufo: 0.8,
            leafBlower: 0.6,
            earthquake: 0.6,
            flood: 0.5,
            disco: 0.5,
            acornHail: 0.6,
            var: 0.5
          },
          trenchCoatMax: 2,
          trenchCoatChance: 0.7,
          goldenAcorn: true,
          combos: {hunterVsTornado: 0.6, eagleIntoFunnel: 0.6, suitorSwept: 0.6, catVsEagle: 0.6}
        }
      }
    }
  },

  commentary: {
    // A new leader within this many height units of the old one is "neck and neck".
    neckAndNeckUnits: 3,
    // When the legendary-outfit line is offered, after the opening line.
    legendaryCueMs: 1500,
    // How late a line may run before it is dropped as stale.
    maxDelayMs: {
      legendary: 3000,
      finale: 1000,
      verdict: 1500,
      chaos: 600,
      leader: 750,
      classic: 600
    },
    // Who wins a crowded moment: higher first.
    priority: {finale: 5, chaos: 4, verdict: 4, legendary: 3, leader: 2, classic: 1}
  },

  // The race log and the owl commentator (Chaos v2 contract § 11 and § 12, since 2.2.0), read by
  // lib/race-log.js. Every line names squirrels only through its placeholders and never with a
  // pronoun: the names belong to real people. Placeholders: {names} is every squirrel the line is
  // about, joined with the list words below; {name} is one squirrel singled out (the shark's hat,
  // the trench coat's top); {other} is a second squirrel (the winner, in a photo finish). Each
  // kind lists variants: 'some' when it names squirrels, 'none' when it singles nobody out, and a
  // few special ones. A line is only used when every placeholder in it can be filled. Keys are
  // stable: components/phrases.js holds the literal translation catalogue keyed by them.
  raceLog: {
    // The newest entry stays highlighted this long (§ 11 display).
    highlightMs: 1500,
    // The owl commentator (§ 12): it talks for talkMs after each new commentary cue, gasps for
    // gaspMs at a big moment (a cue trigger or a log kind in gaspTriggers) and cheers for cheerMs
    // at the winner's line. In a photo finish the winner's line is the photo-finish cue, so the
    // owl gasps first, then cheers.
    owl: {
      talkMs: 1200,
      gaspMs: 1500,
      cheerMs: 3000,
      gaspTriggers: [
        'tornado',
        'sharknado',
        'goldenAcorn',
        'earthquake',
        'ufo',
        'finale',
        'varVerdict',
        'photoFinish'
      ],
      cheerTriggers: ['winner', 'photoFinish']
    },
    // How a list of names reads: "Alex, Sam and Jo".
    list: {key: 'log_list_and', text: '{first} and {last}', separator: ', '},
    // The short bold title in front of each line, by log kind.
    titles: {
      opening: {key: 'log_title_opening', text: 'Go!'},
      nutStop: {key: 'log_title_nut_stop', text: 'Nut stop'},
      slip: {key: 'log_title_slip', text: 'Slip'},
      burst: {key: 'log_title_burst', text: 'Burst'},
      tornado: {key: 'log_title_tornado', text: 'Tornado'},
      sharknado: {key: 'log_title_sharknado', text: 'Sharknado'},
      hunterHit: {key: 'log_title_hunter_hit', text: 'Hunter hit'},
      hunterMiss: {key: 'log_title_hunter_miss', text: 'Hunter miss'},
      suitorKiss: {key: 'log_title_suitor_kiss', text: 'Smooch'},
      suitorSlap: {key: 'log_title_suitor_slap', text: 'Slap'},
      eagle: {key: 'log_title_eagle', text: 'Eagle'},
      beaver: {key: 'log_title_beaver', text: 'Beaver'},
      lightning: {key: 'log_title_lightning', text: 'Lightning'},
      woodpecker: {key: 'log_title_woodpecker', text: 'Woodpecker'},
      catLady: {key: 'log_title_cat_lady', text: 'Cat lady'},
      goldenAcorn: {key: 'log_title_golden_acorn', text: 'Golden Acorn'},
      leafBlower: {key: 'log_title_leaf_blower', text: 'Leaf blower'},
      ufo: {key: 'log_title_ufo', text: 'UFO'},
      earthquake: {key: 'log_title_earthquake', text: 'Earthquake'},
      flood: {key: 'log_title_flood', text: 'Flood'},
      disco: {key: 'log_title_disco', text: 'Disco'},
      acornHail: {key: 'log_title_acorn_hail', text: 'Acorn hail'},
      var: {key: 'log_title_var', text: 'VAR'},
      varVerdict: {key: 'log_title_var_verdict', text: 'VAR verdict'},
      trenchCoat: {key: 'log_title_trench_coat', text: 'Trench coat'},
      hunterVsTornado: {key: 'log_title_hunter_tornado', text: 'Hunter v tornado'},
      eagleIntoFunnel: {key: 'log_title_eagle_funnel', text: 'Eagle drop'},
      suitorSwept: {key: 'log_title_suitor_swept', text: 'Swept away'},
      catVsEagle: {key: 'log_title_cat_eagle', text: 'Cat v eagle'},
      winner: {key: 'log_title_winner', text: 'Winner'},
      place: {key: 'log_title_place', text: 'Finish'},
      photoFinish: {key: 'log_title_photo_finish', text: 'Photo finish'},
      other: {key: 'log_title_other', text: 'Chaos'}
    },
    // The lines, by log kind.
    templates: {
      opening: [
        {key: 'log_opening', variant: 'none', text: 'And they’re off!'},
        {key: 'log_opening_solo', variant: 'some', text: '{names} is off on a solo run!'}
      ],
      nutStop: [
        {key: 'log_nut_stop', variant: 'some', text: '{names} stopped to bury a nut.'}
      ],
      slip: [
        {key: 'log_slip', variant: 'some', text: '{names} slipped down the trunk.'}
      ],
      burst: [
        {key: 'log_burst', variant: 'some', text: '{names} found a burst of speed.'}
      ],
      tornado: [
        {key: 'log_tornado', variant: 'some', text: 'A tornado whisked {names} onto new trees.'},
        {key: 'log_tornado_none', variant: 'none', text: 'A tornado tore through the wood.'}
      ],
      sharknado: [
        {
          key: 'log_sharknado_chomp',
          variant: 'chomp',
          text: 'A sharknado whisked {names} onto new trees, and a shark stole {name}’s hat.'
        },
        {
          key: 'log_sharknado',
          variant: 'some',
          text: 'A sharknado whisked {names} onto new trees.'
        },
        {
          key: 'log_sharknado_none',
          variant: 'none',
          text: 'A sharknado tore through the wood. Sharks and all.'
        }
      ],
      hunterHit: [
        {key: 'log_hunter_hit', variant: 'some', text: 'A hunter blasted {names} off the branch.'},
        {key: 'log_hunter_hit_none', variant: 'none', text: 'A hunter fired into the trees.'}
      ],
      hunterMiss: [
        {key: 'log_hunter_miss', variant: 'some', text: 'A hunter took aim at {names} and missed.'},
        {key: 'log_hunter_miss_none', variant: 'none', text: 'A hunter fired and hit nothing.'}
      ],
      suitorKiss: [
        {
          key: 'log_suitor_kiss',
          variant: 'some',
          text: '{names} stopped for a smooch with a mysterious stranger.'
        }
      ],
      suitorSlap: [
        {key: 'log_suitor_slap', variant: 'some', text: 'A mysterious stranger slapped {names}.'}
      ],
      eagle: [
        {key: 'log_eagle', variant: 'some', text: 'An eagle gave {names} a lift up the trunk.'}
      ],
      beaver: [
        {key: 'log_beaver', variant: 'some', text: 'A beaver gnawed at the tree under {names}.'}
      ],
      lightning: [
        {key: 'log_lightning', variant: 'some', text: 'Lightning struck {names}.'}
      ],
      woodpecker: [
        {
          key: 'log_woodpecker',
          variant: 'some',
          text: 'A woodpecker drilled the tree under {names}.'
        }
      ],
      catLady: [
        {key: 'log_cat_lady', variant: 'some', text: 'The cat lady landed cats on {names}.'},
        {
          key: 'log_cat_lady_none',
          variant: 'none',
          text: 'The cat lady hurled cats and hit nobody.'
        }
      ],
      goldenAcorn: [
        {
          key: 'log_golden_acorn',
          variant: 'some',
          text: 'The Golden Acorn of Doom smacked runaway leader {names}.'
        },
        {
          key: 'log_golden_acorn_none',
          variant: 'none',
          text: 'The Golden Acorn of Doom went looking for a runaway leader.'
        }
      ],
      leafBlower: [
        {key: 'log_leaf_blower', variant: 'some', text: 'A leaf blower left {names} bare-headed.'},
        {
          key: 'log_leaf_blower_none',
          variant: 'none',
          text: 'A leaf blower left everyone hanging on like washing.'
        }
      ],
      ufo: [
        {
          key: 'log_ufo',
          variant: 'some',
          text: 'A UFO swapped {names}, trees and outfits included.'
        },
        {key: 'log_ufo_none', variant: 'none', text: 'A UFO hovered, then thought better of it.'}
      ],
      earthquake: [
        {
          key: 'log_earthquake',
          variant: 'some',
          text: 'An earthquake shook {names} down the trunk.'
        },
        {key: 'log_earthquake_none', variant: 'none', text: 'An earthquake shook the whole wood.'}
      ],
      flood: [
        {key: 'log_flood', variant: 'some', text: 'A flood lifted {names} up the trunk.'},
        {
          key: 'log_flood_none',
          variant: 'none',
          text: 'A flood rose, but nobody was low enough to float.'
        }
      ],
      disco: [
        {key: 'log_disco', variant: 'none', text: 'Disco! Everyone stopped to dance.'}
      ],
      acornHail: [
        {
          key: 'log_acorn_hail',
          variant: 'some',
          text: 'Acorn hail! {names} stuffed far too many nuts in.'
        },
        {key: 'log_acorn_hail_none', variant: 'none', text: 'Acorn hail pelted the whole wood.'}
      ],
      var: [
        {key: 'log_var', variant: 'none', text: 'Everyone froze for VAR.'}
      ],
      // One verdict per commentary verdict key (data.verdict), plus a plain one.
      varVerdict: [
        {
          key: 'log_var_verdict_1',
          variant: 'chaos_var_verdict_1',
          text: 'No infringement. Play on!'
        },
        {
          key: 'log_var_verdict_2',
          variant: 'chaos_var_verdict_2',
          text: 'The acorn was over the line. Play on anyway.'
        },
        {
          key: 'log_var_verdict_3',
          variant: 'chaos_var_verdict_3',
          text: 'Inconclusive. The owl has gone for a cuppa.'
        },
        {key: 'log_var_verdict_none', variant: 'none', text: 'The check is over. Play on!'}
      ],
      trenchCoat: [
        {
          key: 'log_trench_coat_host',
          variant: 'host',
          text: '{names} squeezed into one trench coat, with {name} on top.'
        },
        {key: 'log_trench_coat', variant: 'some', text: '{names} squeezed into one trench coat.'},
        {
          key: 'log_trench_coat_none',
          variant: 'none',
          text: 'Three squirrels in a trench coat? Surely not.'
        }
      ],
      hunterVsTornado: [
        {
          key: 'log_hunter_tornado',
          variant: 'none',
          text: 'A hunter shot at the tornado and got the cow back.'
        }
      ],
      eagleIntoFunnel: [
        {
          key: 'log_eagle_funnel',
          variant: 'some',
          text: 'An eagle dropped {names} straight into the tornado.'
        }
      ],
      suitorSwept: [
        {
          key: 'log_suitor_swept',
          variant: 'some',
          text: '{names} and a mysterious stranger were swept up mid-smooch.'
        }
      ],
      catVsEagle: [
        {
          key: 'log_cat_eagle',
          variant: 'some',
          text: 'An eagle caught the cat meant for {names} and flew off confused.'
        },
        {
          key: 'log_cat_eagle_none',
          variant: 'none',
          text: 'An eagle caught a flying cat. Neither looks happy.'
        }
      ],
      winner: [
        {
          key: 'log_winner_photo',
          variant: 'photo',
          text: 'Photo finish! {names} wins by a whisker from {other}.'
        },
        {key: 'log_winner', variant: 'some', text: '{names} grabs the chestnut and wins!'}
      ],
      place: [
        {key: 'log_place_second', variant: 'second', text: '{names} finishes second.'},
        {key: 'log_place_third', variant: 'third', text: '{names} finishes third.'},
        {key: 'log_place', variant: 'some', text: '{names} reaches the chestnut.'}
      ],
      photoFinish: [
        {
          key: 'log_photo_finish',
          variant: 'some',
          text: 'Photo finish! {names} is second, a whisker behind {other}.'
        },
        {key: 'log_photo_finish_plain', variant: 'plain', text: 'Photo finish! {names} is second.'}
      ],
      // Anything the log has no kind for (a newer event type, say).
      other: [
        {key: 'log_other', variant: 'some', text: 'Something odd happened to {names}.'},
        {key: 'log_other_none', variant: 'none', text: 'Something odd happened in the wood.'}
      ]
    }
  },

  outfits: {
    // The server contract (SPEC.md § 7) allows exactly these four slots.
    slotOrder: ['hat', 'cape', 'accessory', 'fur'],
    rarityOrder: ['common', 'rare', 'legendary'],
    // Per slot (§ 9).
    rarityWeights: {common: 80, rare: 17, legendary: 3},
    // A slot missing from a stored outfit draws as this.
    defaults: {hat: 'none', cape: 'none', accessory: 'none', fur: 'red'},
    slots: {
      hat: [
        {id: 'none', label: 'No hat', rarity: 'common'},
        {id: 'top_hat', label: 'Top hat', rarity: 'common'},
        {id: 'propeller', label: 'Propeller cap', rarity: 'common'},
        {id: 'viking', label: 'Viking helmet', rarity: 'common'},
        {id: 'cowboy', label: 'Cowboy hat', rarity: 'common'},
        {id: 'party', label: 'Party hat', rarity: 'common'},
        {id: 'chef', label: 'Chef’s hat', rarity: 'common'},
        {id: 'beanie', label: 'Beanie', rarity: 'common'},
        {id: 'pirate', label: 'Pirate hat', rarity: 'common'},
        {id: 'wizard', label: 'Wizard hat', rarity: 'rare'},
        {id: 'traffic_cone', label: 'Traffic cone', rarity: 'rare'},
        {id: 'halo', label: 'Halo', rarity: 'rare'},
        {id: 'crown', label: 'Crown', rarity: 'legendary'}
      ],
      cape: [
        {id: 'none', label: 'No cape', rarity: 'common'},
        {id: 'red', label: 'Red cape', rarity: 'common'},
        {id: 'blue', label: 'Blue cape', rarity: 'common'},
        {id: 'green', label: 'Green cape', rarity: 'common'},
        {id: 'purple', label: 'Purple cape', rarity: 'common'},
        {id: 'tartan', label: 'Tartan cape', rarity: 'rare'},
        {id: 'superhero', label: 'Superhero cape', rarity: 'rare'},
        {id: 'royal', label: 'Royal ermine cape', rarity: 'legendary'}
      ],
      accessory: [
        {id: 'none', label: 'No accessory', rarity: 'common'},
        {id: 'sunglasses', label: 'Sunglasses', rarity: 'common'},
        {id: 'bow_tie', label: 'Bow tie', rarity: 'common'},
        {id: 'scarf', label: 'Scarf', rarity: 'common'},
        {id: 'moustache', label: 'Moustache', rarity: 'common'},
        {id: 'headphones', label: 'Headphones', rarity: 'common'},
        {id: 'flower', label: 'Flower', rarity: 'common'},
        {id: 'monocle', label: 'Monocle', rarity: 'rare'},
        {id: 'eyepatch', label: 'Eyepatch', rarity: 'rare'},
        {id: 'gold_chain', label: 'Gold chain', rarity: 'legendary'}
      ],
      fur: [
        {id: 'red', label: 'Red fur', rarity: 'common'},
        {id: 'grey', label: 'Grey fur', rarity: 'common'},
        {id: 'black', label: 'Black fur', rarity: 'common'},
        {id: 'cinnamon', label: 'Cinnamon fur', rarity: 'common'},
        {id: 'albino', label: 'Albino fur', rarity: 'common'},
        {id: 'golden', label: 'Golden fur', rarity: 'rare'},
        {id: 'rainbow', label: 'Rainbow fur', rarity: 'legendary'}
      ]
    }
  },

  // Ten lane colours, repeating. Each bib also carries the lane number and its own pattern and
  // shape, so colour is never the only identifier (§ 13). ink is the bib text colour.
  lanePalette: [
    {id: 'pillar_box', colour: '#C8102E', ink: '#FFFFFF', bibPattern: 'solid', bibShape: 'circle'},
    {id: 'royal', colour: '#1F4E9E', ink: '#FFFFFF', bibPattern: 'stripes', bibShape: 'square'},
    {id: 'mustard', colour: '#E3A812', ink: '#1A1A1A', bibPattern: 'dots', bibShape: 'diamond'},
    {id: 'forest', colour: '#237A3B', ink: '#FFFFFF', bibPattern: 'chevrons', bibShape: 'shield'},
    {id: 'tangerine', colour: '#F26B1D', ink: '#1A1A1A', bibPattern: 'checks', bibShape: 'hexagon'},
    {id: 'plum', colour: '#6E2C8C', ink: '#FFFFFF', bibPattern: 'zigzag', bibShape: 'circle'},
    {id: 'teal', colour: '#138A8A', ink: '#FFFFFF', bibPattern: 'stars', bibShape: 'square'},
    {id: 'bubblegum', colour: '#E85A9A', ink: '#1A1A1A', bibPattern: 'hoops', bibShape: 'diamond'},
    {id: 'slate', colour: '#4A5560', ink: '#FFFFFF', bibPattern: 'diagonal', bibShape: 'shield'},
    {id: 'lime', colour: '#8BC34A', ink: '#1A1A1A', bibPattern: 'crosses', bibShape: 'hexagon'}
  ],

  crowd: {
    animals: [
      {id: 'hedgehog', label: 'Hedgehog'},
      {id: 'rabbit', label: 'Rabbit'},
      {id: 'owl', label: 'Owl'},
      {id: 'badger', label: 'Badger'},
      {id: 'fox', label: 'Fox'}
    ],
    // What the crowd does, and for how long, on each kind of moment (§ 8 race view).
    reactions: {leadChange: 'wave', chaosEvent: 'gasp', finish: 'cheer'},
    reactionMs: {wave: 1200, gasp: 900, cheer: 2000}
  },

  skies: {
    // One pool for Classic and Chaos alike (Chaos v2 contract § 14): every race takes one of
    // these from its seed (seed modulo length), without touching the race's generator. Day
    // appears twice so it is the most common, and rain (drizzle or storm) comes one race in
    // three.
    seededChoices: ['day', 'day', 'golden_hour', 'night', 'drizzle', 'storm'],
    // A preset with rain says how much, relative to the storm: density (share of the storm's
    // streaks), speed (share of its fall speed), opacity (share of its opacity), and the
    // streaks' colour (components/stage-weather.js draws it).
    presets: {
      day: {label: 'Day', top: '#7EC8F2', bottom: '#DFF3FF', celestial: 'sun', extras: ['clouds']},
      golden_hour: {
        label: 'Golden hour',
        top: '#F6A04D',
        bottom: '#FDE3A7',
        celestial: 'low_sun',
        extras: ['long_shadows']
      },
      night: {
        label: 'Night',
        top: '#0B1D3A',
        bottom: '#2A3F6B',
        celestial: 'moon',
        extras: ['stars', 'fireflies']
      },
      // An overcast grey-blue day with soft pale clouds and light rain: no lightning flashes.
      drizzle: {
        label: 'Drizzle',
        top: '#8FA3B8',
        bottom: '#D5DEE7',
        celestial: null,
        extras: ['pale_clouds', 'rain'],
        rain: {density: 0.4, speed: 0.6, opacity: 0.7, colour: '#5E7489'}
      },
      storm: {
        label: 'Storm',
        top: '#3A3F47',
        bottom: '#7A828C',
        celestial: null,
        extras: ['storm_clouds', 'rain', 'lightning_flashes'],
        rain: {density: 1, speed: 1, opacity: 1, colour: '#CFE3F2'}
      }
    }
  },

  // Small effects only (§ 12): sprites are inline SVG, never emoji.
  emoji: {
    chestnut: '🌰',
    medals: ['🥇', '🥈', '🥉'],
    heart: '❤️',
    kiss: '💋',
    slap: '👋',
    tornado: '🌪️',
    star: '⭐'
  },

  // Form guide cards (§ 15, should): a seeded nickname and a favourite tree per squirrel.
  formGuide: {
    nicknames: [
      'The Nutcracker',
      'Bushy Tail',
      'The Acorn Assassin',
      'Twiggy',
      'The Bark Shark',
      'Sir Scampers',
      'The Conker King',
      'Hazel Lightning',
      'The Branch Manager',
      'Captain Cobnut',
      'The Leaf Blower',
      'Pinecone Pete'
    ],
    favouriteTrees: ['Oak', 'Beech', 'Sycamore', 'Horse chestnut', 'Scots pine', 'Silver birch'],
    nutsBuried: {min: 12, max: 480}
  },

  // Commentary (§ 12): about the squirrel's antics, never the person. Slapstick, PG, UK English.
  // Keys are stable: the component layer's translation catalogue is keyed by them.
  phrases: {
    classic: {
      opening: [
        {key: 'classic_opening_1', text: 'And they’re off!'},
        {key: 'classic_opening_2', text: 'Paws on the bark… and away they go!'}
      ],
      solo: [
        {key: 'classic_solo_1', text: 'A solo run for {name}. The crowd goes mild.'},
        {
          key: 'classic_solo_2',
          text: '{name} races alone. Victory is certain; dignity is optional.'
        }
      ],
      legendary: [
        {key: 'classic_legendary_1', text: 'Legendary drip on {name}!'},
        {key: 'classic_legendary_2', text: 'Is that a legendary outfit on {name}? Very stylish.'}
      ],
      newLeader: [
        {key: 'classic_lead_1', text: '{name} takes the lead!'},
        {key: 'classic_lead_2', text: '{name} hits the front!'},
        {key: 'classic_lead_3', text: '{name} scampers into the lead!'},
        {key: 'classic_lead_4', text: '{name} is top squirrel now!'},
        {key: 'classic_lead_5', text: '{name} surges ahead, tail held high!'}
      ],
      neckAndNeck: [
        {key: 'classic_neck_1', text: '{name} and {other} are neck and neck.'},
        {key: 'classic_neck_2', text: 'Nothing between {name} and {other}!'},
        {key: 'classic_neck_3', text: '{name} edges past {other} by a whisker.'}
      ],
      nutStop: [
        {key: 'classic_nut_1', text: '{name} has stopped to bury a nut.'},
        {key: 'classic_nut_2', text: '{name} is having words with a pigeon.'},
        {key: 'classic_nut_3', text: '{name} has found a snack and forgotten the race.'}
      ],
      slip: [
        {key: 'classic_slip_1', text: '{name} slipped on wet bark!'},
        {key: 'classic_slip_2', text: 'Whoops! {name} loses grip and slides down a bit.'},
        {key: 'classic_slip_3', text: '{name} skids down a branch. Undignified.'}
      ],
      burst: [
        {key: 'classic_burst_1', text: '{name} has found another gear!'},
        {key: 'classic_burst_2', text: 'Zoom! {name} is flying up that trunk!'},
        {key: 'classic_burst_3', text: '{name} has clearly had an espresso.'}
      ],
      finalStretch: [
        {key: 'classic_final_1', text: 'Final stretch!'},
        {key: 'classic_final_2', text: 'Into the final stretch. Hold on to your acorns!'}
      ],
      winner: [
        {key: 'classic_winner_1', text: '{name} wins it!'},
        {key: 'classic_winner_2', text: '{name} grabs the chestnut! Victory!'},
        {key: 'classic_winner_3', text: 'It’s {name}! What a climb!'}
      ],
      photoFinish: [
        {key: 'classic_photo_1', text: 'Photo finish! {name} pips {other}!'},
        {key: 'classic_photo_2', text: 'Too close to call… {name} by a whisker over {other}!'}
      ]
    },
    chaos: {
      opening: [
        {key: 'chaos_opening_1', text: 'Storm clouds are gathering. This could get silly.'}
      ],
      tornado: [
        {key: 'chaos_tornado_1', text: 'TORNADO! {name} and {other} have swapped trees!'},
        {key: 'chaos_tornado_2', text: 'Is that a cow?'},
        {key: 'chaos_tornado_3', text: 'A twister! {name} is going for a spin!'},
        {
          key: 'chaos_tornado_4',
          text: 'The wind has rearranged the field. {name} lands on a new tree!'
        }
      ],
      hunterHit: [
        {key: 'chaos_hunter_hit_1', text: '{name} has been blasted off the branch!'},
        {key: 'chaos_hunter_hit_2', text: 'BLAM! {name} is seeing stars.'},
        {key: 'chaos_hunter_hit_3', text: '{name} now has a smoking tail and a new hairdo.'}
      ],
      hunterMiss: [
        {key: 'chaos_hunter_miss_1', text: 'He missed! His eyebrows didn’t make it.'},
        {
          key: 'chaos_hunter_miss_2',
          text: 'The blunderbuss backfires! {name} climbs on, smirking.'
        },
        {key: 'chaos_hunter_miss_3', text: 'Missed! The hunter has shot his own hat off.'}
      ],
      suitorKiss: [
        {key: 'chaos_suitor_kiss_1', text: '{name} has been distracted by a mysterious stranger.'},
        {key: 'chaos_suitor_kiss_2', text: 'Hearts everywhere! {name} is smitten.'},
        {key: 'chaos_suitor_kiss_3', text: '{name} has stopped for a smooch. Priorities.'}
      ],
      suitorSlap: [
        {key: 'chaos_suitor_slap_1', text: '{name} got slapped. Fair.'},
        {key: 'chaos_suitor_slap_2', text: 'A slap! {name} will be sulking for a bit.'}
      ],
      eagle: [
        {key: 'chaos_eagle_1', text: '{name} has hitched a lift!'},
        {key: 'chaos_eagle_2', text: 'An eagle gives {name} a free ride up the trunk!'}
      ],
      beaver: [
        {key: 'chaos_beaver_1', text: 'A beaver is having a go at {name}’s tree!'},
        {key: 'chaos_beaver_2', text: '{name} clings on while a beaver chews the trunk.'}
      ],
      lightning: [
        {key: 'chaos_lightning_1', text: '{name} has been struck by lightning. Again.'},
        {key: 'chaos_lightning_2', text: 'ZAP! {name}’s fur is standing on end.'}
      ],
      // Chaos v2 (contract § 4). A line naming nobody is used when an event singles nobody
      // out; commentary.js only offers a line whose placeholders it can fill.
      openingCarnage: [
        {
          key: 'chaos_opening_carnage_1',
          text: 'Absolute Carnage selected. The woodland insurers have left the building.'
        },
        {key: 'chaos_opening_carnage_2', text: 'Batten down the hatches. Here comes everything.'}
      ],
      sharknado: [
        {key: 'chaos_sharknado_1', text: 'SHARKNADO! Yes, there are sharks in that tornado.'},
        {key: 'chaos_sharknado_2', text: 'A shark has nicked {name}’s hat. It suits the shark.'},
        {key: 'chaos_sharknado_3', text: 'Nobody ordered the sharks. The sharks came anyway.'}
      ],
      catLady: [
        {key: 'chaos_cat_lady_1', text: 'Incoming cat! {name} has a passenger.'},
        {key: 'chaos_cat_lady_2', text: '{name} is now wearing a very cross moggy.'},
        {key: 'chaos_cat_lady_3', text: 'Where is she keeping all those cats?'}
      ],
      goldenAcorn: [
        {
          key: 'chaos_golden_acorn_1',
          text: 'The Golden Acorn of Doom has spotted {name} showing off!'
        },
        {key: 'chaos_golden_acorn_2', text: 'BONK! The Golden Acorn takes {name} down a peg.'},
        {key: 'chaos_golden_acorn_3', text: 'Nobody likes a runaway leader, {name}.'}
      ],
      leafBlower: [
        {key: 'chaos_leaf_blower_1', text: 'Leaf blower! Everyone is hanging on like washing.'},
        {key: 'chaos_leaf_blower_2', text: 'The gardener has blown {name}’s hat clean off!'},
        {key: 'chaos_leaf_blower_3', text: 'Was that the gardener’s toupee?'}
      ],
      ufo: [
        {key: 'chaos_ufo_1', text: 'A UFO has beamed up {name} and {other}!'},
        {key: 'chaos_ufo_2', text: 'Aliens have swapped {name} and {other}. Outfits included.'},
        {key: 'chaos_ufo_3', text: 'The aliens have rearranged the wardrobe department.'}
      ],
      earthquake: [
        {key: 'chaos_earthquake_1', text: 'EARTHQUAKE! The whole wood is wobbling!'},
        {key: 'chaos_earthquake_2', text: '{name} has been shaken off the bark!'},
        {key: 'chaos_earthquake_3', text: 'A mole has popped up to complain about the noise.'}
      ],
      flood: [
        {key: 'chaos_flood_1', text: 'Flood! The water is rising!'},
        {key: 'chaos_flood_2', text: '{name} is getting a lift from the floodwater!'},
        {key: 'chaos_flood_3', text: 'Is that a rubber duck? Wrong race, mate.'}
      ],
      disco: [
        {key: 'chaos_disco_1', text: 'Disco time! Nobody can resist the mirror ball.'},
        {key: 'chaos_disco_2', text: 'The whole field has stopped to dance.'},
        {key: 'chaos_disco_3', text: 'Is the beaver doing the robot?'}
      ],
      acornHail: [
        {key: 'chaos_acorn_hail_1', text: 'Acorn hail! Cheeks are filling up fast.'},
        {key: 'chaos_acorn_hail_2', text: '{name} has stuffed far too many nuts in.'},
        {key: 'chaos_acorn_hail_3', text: 'Chubby cheeks all round!'}
      ],
      var: [
        {key: 'chaos_var_1', text: 'Hold everything. VAR is checking a possible nut infringement.'},
        {key: 'chaos_var_2', text: 'The owl referee is going to the monitor.'}
      ],
      // The VAR verdict line is chosen while the race is built and stored as data.verdict.
      varVerdict: [
        {key: 'chaos_var_verdict_1', text: 'VAR verdict: no infringement. Play on!'},
        {
          key: 'chaos_var_verdict_2',
          text: 'VAR verdict: the acorn was over the line. Play on anyway.'
        },
        {
          key: 'chaos_var_verdict_3',
          text: 'VAR verdict: inconclusive. The owl has gone for a cuppa.'
        }
      ],
      trenchCoat: [
        {key: 'chaos_trench_coat_1', text: 'Is that one very tall squirrel in a trench coat?'},
        {key: 'chaos_trench_coat_2', text: '{name} is definitely not three squirrels in a coat.'},
        {key: 'chaos_trench_coat_3', text: 'Nice moustache, {name}. Very convincing.'}
      ],
      woodpecker: [
        {key: 'chaos_woodpecker_1', text: 'A woodpecker is drilling {name}’s tree!'},
        {key: 'chaos_woodpecker_2', text: '{name} is vibrating. Blame the woodpecker.'}
      ],
      hunterVsTornado: [
        {
          key: 'chaos_hunter_tornado_1',
          text: 'The hunter shot at the tornado. It threw the cow back.'
        },
        {key: 'chaos_hunter_tornado_2', text: 'Never pick a fight with a tornado. Lesson learned.'}
      ],
      eagleIntoFunnel: [
        {
          key: 'chaos_eagle_funnel_1',
          text: 'The eagle has dropped {name} straight into the tornado!'
        },
        {key: 'chaos_eagle_funnel_2', text: '{name} has gone from eagle taxi to tornado express.'}
      ],
      suitorSwept: [
        {
          key: 'chaos_suitor_swept_1',
          text: '{name} and the mystery stranger have been swept away!'
        },
        {key: 'chaos_suitor_swept_2', text: 'A whirlwind romance for {name}. Literally.'}
      ],
      catVsEagle: [
        {key: 'chaos_cat_eagle_1', text: 'The eagle has caught a cat instead of {name}. Awkward.'},
        {key: 'chaos_cat_eagle_2', text: 'An eagle holding a cat. Neither of them looks happy.'}
      ],
      finale: [
        {key: 'chaos_finale_1', text: 'Here comes the grand finale. Hold on to your tails!'},
        {key: 'chaos_finale_2', text: 'Everything is happening at once!'}
      ]
    }
  }
};
