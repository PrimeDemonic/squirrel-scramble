/**
 * The translated commentary catalogue (SPEC.md § 8 race view, § 12): one entry per phrase key in
 * lib/theme-config.js (themeConfig.phrases), each a literal i18n.getMessage() call.
 *
 * Why a catalogue: the i18n lint rule (getmessage-no-variable-arg) and the build's string
 * extractor only accept a literal first argument, so the phrase bank's data-driven texts cannot
 * be passed to getMessage() directly. Each literal here is the theme text, word for word, with
 * its {name} and {other} placeholders; getMessage() fills them from a named-values object.
 * tests/phrases.test.js checks that the catalogue covers every theme key, nothing else, and that
 * each literal still matches its theme text.
 *
 * Entrant names only ever arrive as placeholder values and leave as plain strings; the race stage
 * renders the result through a Lit text binding, so a name is never parsed as HTML.
 *
 * The race log (Chaos v2 contract § 11) has its own catalogue, RACE_LOG_CATALOGUE: one entry per
 * key in themeConfig.raceLog (its lines, its short titles and its list words), checked the same
 * way by tests/race-log.test.js. logLineParts() splits a translated log line around its name
 * placeholders, so the stage can show each named squirrel as its bib chip and name.
 *
 * The module has no imports on purpose: the i18n service is passed in, so the Node tests can run
 * it with a stub and the build still sees literal i18n.getMessage() calls.
 */

// Matches a {placeholder} token, the same shape the AIUX i18n service fills.
const PLACEHOLDER = /\{([^{}]*)\}/g;

// The race log's name slots, and each slot's own token: a log line is translated with every
// slot filled by its own token, so the slots survive translation and can be split out.
const LOG_SLOT = /\{(names|name|other)\}/g;
const LOG_SLOT_TOKENS = Object.freeze({names: '{names}', name: '{name}', other: '{other}'});

// Between names in a list of three or more ("Alex, Sam and Jo").
const LOG_LIST_SEPARATOR = ', ';

// The list words when the catalogue cannot be read.
const LOG_LIST_FALLBACK = Object.freeze({separator: LOG_LIST_SEPARATOR, conjunction: ' and '});

/**
 * Every commentary phrase, keyed by its theme key. Each entry takes the i18n service and the
 * named placeholder values, and returns the translated line.
 * @type {Readonly<Object<string, function({getMessage: Function}, Object): string>>}
 */
export const PHRASE_CATALOGUE = Object.freeze({
  // Classic: the opening line.
  classic_opening_1: (i18n, params) => i18n.getMessage('And they’re off!', params),
  classic_opening_2: (i18n, params) => i18n.getMessage(
    'Paws on the bark… and away they go!',
    params
  ),
  // Classic: a race with one squirrel.
  classic_solo_1: (i18n, params) => i18n.getMessage(
    'A solo run for {name}. The crowd goes mild.',
    params
  ),
  classic_solo_2: (i18n, params) => i18n.getMessage(
    '{name} races alone. Victory is certain; dignity is optional.',
    params
  ),
  // Classic: a legendary outfit.
  classic_legendary_1: (i18n, params) => i18n.getMessage('Legendary drip on {name}!', params),
  classic_legendary_2: (i18n, params) => i18n.getMessage(
    'Is that a legendary outfit on {name}? Very stylish.',
    params
  ),
  // Classic: a new leader.
  classic_lead_1: (i18n, params) => i18n.getMessage('{name} takes the lead!', params),
  classic_lead_2: (i18n, params) => i18n.getMessage('{name} hits the front!', params),
  classic_lead_3: (i18n, params) => i18n.getMessage('{name} scampers into the lead!', params),
  classic_lead_4: (i18n, params) => i18n.getMessage('{name} is top squirrel now!', params),
  classic_lead_5: (i18n, params) => i18n.getMessage(
    '{name} surges ahead, tail held high!',
    params
  ),
  // Classic: a change of leader by a whisker.
  classic_neck_1: (i18n, params) => i18n.getMessage(
    '{name} and {other} are neck and neck.',
    params
  ),
  classic_neck_2: (i18n, params) => i18n.getMessage('Nothing between {name} and {other}!', params),
  classic_neck_3: (i18n, params) => i18n.getMessage(
    '{name} edges past {other} by a whisker.',
    params
  ),
  // Classic: a nut stop.
  classic_nut_1: (i18n, params) => i18n.getMessage('{name} has stopped to bury a nut.', params),
  classic_nut_2: (i18n, params) => i18n.getMessage(
    '{name} is having words with a pigeon.',
    params
  ),
  classic_nut_3: (i18n, params) => i18n.getMessage(
    '{name} has found a snack and forgotten the race.',
    params
  ),
  // Classic: a slip.
  classic_slip_1: (i18n, params) => i18n.getMessage('{name} slipped on wet bark!', params),
  classic_slip_2: (i18n, params) => i18n.getMessage(
    'Whoops! {name} loses grip and slides down a bit.',
    params
  ),
  classic_slip_3: (i18n, params) => i18n.getMessage(
    '{name} skids down a branch. Undignified.',
    params
  ),
  // Classic: a burst of speed.
  classic_burst_1: (i18n, params) => i18n.getMessage('{name} has found another gear!', params),
  classic_burst_2: (i18n, params) => i18n.getMessage(
    'Zoom! {name} is flying up that trunk!',
    params
  ),
  classic_burst_3: (i18n, params) => i18n.getMessage(
    '{name} has clearly had an espresso.',
    params
  ),
  // Classic: the final stretch.
  classic_final_1: (i18n, params) => i18n.getMessage('Final stretch!', params),
  classic_final_2: (i18n, params) => i18n.getMessage(
    'Into the final stretch. Hold on to your acorns!',
    params
  ),
  // Classic: the winner.
  classic_winner_1: (i18n, params) => i18n.getMessage('{name} wins it!', params),
  classic_winner_2: (i18n, params) => i18n.getMessage(
    '{name} grabs the chestnut! Victory!',
    params
  ),
  classic_winner_3: (i18n, params) => i18n.getMessage('It’s {name}! What a climb!', params),
  // Classic: a photo finish.
  classic_photo_1: (i18n, params) => i18n.getMessage('Photo finish! {name} pips {other}!', params),
  classic_photo_2: (i18n, params) => i18n.getMessage(
    'Too close to call… {name} by a whisker over {other}!',
    params
  ),
  // Chaos: the opening line.
  chaos_opening_1: (i18n, params) => i18n.getMessage(
    'Storm clouds are gathering. This could get silly.',
    params
  ),
  // Chaos: a tornado.
  chaos_tornado_1: (i18n, params) => i18n.getMessage(
    'TORNADO! {name} and {other} have swapped trees!',
    params
  ),
  chaos_tornado_2: (i18n, params) => i18n.getMessage('Is that a cow?', params),
  chaos_tornado_3: (i18n, params) => i18n.getMessage(
    'A twister! {name} is going for a spin!',
    params
  ),
  chaos_tornado_4: (i18n, params) => i18n.getMessage(
    'The wind has rearranged the field. {name} lands on a new tree!',
    params
  ),
  // Chaos: a hunter's hit.
  chaos_hunter_hit_1: (i18n, params) => i18n.getMessage(
    '{name} has been blasted off the branch!',
    params
  ),
  chaos_hunter_hit_2: (i18n, params) => i18n.getMessage('BLAM! {name} is seeing stars.', params),
  chaos_hunter_hit_3: (i18n, params) => i18n.getMessage(
    '{name} now has a smoking tail and a new hairdo.',
    params
  ),
  // Chaos: a hunter's miss.
  chaos_hunter_miss_1: (i18n, params) => i18n.getMessage(
    'He missed! His eyebrows didn’t make it.',
    params
  ),
  chaos_hunter_miss_2: (i18n, params) => i18n.getMessage(
    'The blunderbuss backfires! {name} climbs on, smirking.',
    params
  ),
  chaos_hunter_miss_3: (i18n, params) => i18n.getMessage(
    'Missed! The hunter has shot his own hat off.',
    params
  ),
  // Chaos: a suitor's kiss.
  chaos_suitor_kiss_1: (i18n, params) => i18n.getMessage(
    '{name} has been distracted by a mysterious stranger.',
    params
  ),
  chaos_suitor_kiss_2: (i18n, params) => i18n.getMessage(
    'Hearts everywhere! {name} is smitten.',
    params
  ),
  chaos_suitor_kiss_3: (i18n, params) => i18n.getMessage(
    '{name} has stopped for a smooch. Priorities.',
    params
  ),
  // Chaos: a suitor's slap.
  chaos_suitor_slap_1: (i18n, params) => i18n.getMessage('{name} got slapped. Fair.', params),
  chaos_suitor_slap_2: (i18n, params) => i18n.getMessage(
    'A slap! {name} will be sulking for a bit.',
    params
  ),
  // Chaos: the eagle.
  chaos_eagle_1: (i18n, params) => i18n.getMessage('{name} has hitched a lift!', params),
  chaos_eagle_2: (i18n, params) => i18n.getMessage(
    'An eagle gives {name} a free ride up the trunk!',
    params
  ),
  // Chaos: the beaver.
  chaos_beaver_1: (i18n, params) => i18n.getMessage(
    'A beaver is having a go at {name}’s tree!',
    params
  ),
  chaos_beaver_2: (i18n, params) => i18n.getMessage(
    '{name} clings on while a beaver chews the trunk.',
    params
  ),
  // Chaos: lightning.
  chaos_lightning_1: (i18n, params) => i18n.getMessage(
    '{name} has been struck by lightning. Again.',
    params
  ),
  chaos_lightning_2: (i18n, params) => i18n.getMessage(
    'ZAP! {name}’s fur is standing on end.',
    params
  ),
  // Chaos v2: the Absolute Carnage opening line.
  chaos_opening_carnage_1: (i18n, params) => i18n.getMessage(
    'Absolute Carnage selected. The woodland insurers have left the building.',
    params
  ),
  chaos_opening_carnage_2: (i18n, params) => i18n.getMessage(
    'Batten down the hatches. Here comes everything.',
    params
  ),
  // Chaos v2: a sharknado.
  chaos_sharknado_1: (i18n, params) => i18n.getMessage(
    'SHARKNADO! Yes, there are sharks in that tornado.',
    params
  ),
  chaos_sharknado_2: (i18n, params) => i18n.getMessage(
    'A shark has nicked {name}’s hat. It suits the shark.',
    params
  ),
  chaos_sharknado_3: (i18n, params) => i18n.getMessage(
    'Nobody ordered the sharks. The sharks came anyway.',
    params
  ),
  // Chaos v2: the cat lady.
  chaos_cat_lady_1: (i18n, params) => i18n.getMessage(
    'Incoming cat! {name} has a passenger.',
    params
  ),
  chaos_cat_lady_2: (i18n, params) => i18n.getMessage(
    '{name} is now wearing a very cross moggy.',
    params
  ),
  chaos_cat_lady_3: (i18n, params) => i18n.getMessage(
    'Where is she keeping all those cats?',
    params
  ),
  // Chaos v2: the Golden Acorn of Doom.
  chaos_golden_acorn_1: (i18n, params) => i18n.getMessage(
    'The Golden Acorn of Doom has spotted {name} showing off!',
    params
  ),
  chaos_golden_acorn_2: (i18n, params) => i18n.getMessage(
    'BONK! The Golden Acorn takes {name} down a peg.',
    params
  ),
  chaos_golden_acorn_3: (i18n, params) => i18n.getMessage(
    'Nobody likes a runaway leader, {name}.',
    params
  ),
  // Chaos v2: the leaf blower.
  chaos_leaf_blower_1: (i18n, params) => i18n.getMessage(
    'Leaf blower! Everyone is hanging on like washing.',
    params
  ),
  chaos_leaf_blower_2: (i18n, params) => i18n.getMessage(
    'The gardener has blown {name}’s hat clean off!',
    params
  ),
  chaos_leaf_blower_3: (i18n, params) => i18n.getMessage(
    'Was that the gardener’s toupee?',
    params
  ),
  // Chaos v2: the UFO.
  chaos_ufo_1: (i18n, params) => i18n.getMessage(
    'A UFO has beamed up {name} and {other}!',
    params
  ),
  chaos_ufo_2: (i18n, params) => i18n.getMessage(
    'Aliens have swapped {name} and {other}. Outfits included.',
    params
  ),
  chaos_ufo_3: (i18n, params) => i18n.getMessage(
    'The aliens have rearranged the wardrobe department.',
    params
  ),
  // Chaos v2: the earthquake.
  chaos_earthquake_1: (i18n, params) => i18n.getMessage(
    'EARTHQUAKE! The whole wood is wobbling!',
    params
  ),
  chaos_earthquake_2: (i18n, params) => i18n.getMessage(
    '{name} has been shaken off the bark!',
    params
  ),
  chaos_earthquake_3: (i18n, params) => i18n.getMessage(
    'A mole has popped up to complain about the noise.',
    params
  ),
  // Chaos v2: the flood.
  chaos_flood_1: (i18n, params) => i18n.getMessage('Flood! The water is rising!', params),
  chaos_flood_2: (i18n, params) => i18n.getMessage(
    '{name} is getting a lift from the floodwater!',
    params
  ),
  chaos_flood_3: (i18n, params) => i18n.getMessage(
    'Is that a rubber duck? Wrong race, mate.',
    params
  ),
  // Chaos v2: the disco.
  chaos_disco_1: (i18n, params) => i18n.getMessage(
    'Disco time! Nobody can resist the mirror ball.',
    params
  ),
  chaos_disco_2: (i18n, params) => i18n.getMessage(
    'The whole field has stopped to dance.',
    params
  ),
  chaos_disco_3: (i18n, params) => i18n.getMessage(
    'Is the beaver doing the robot?',
    params
  ),
  // Chaos v2: the acorn hail.
  chaos_acorn_hail_1: (i18n, params) => i18n.getMessage(
    'Acorn hail! Cheeks are filling up fast.',
    params
  ),
  chaos_acorn_hail_2: (i18n, params) => i18n.getMessage(
    '{name} has stuffed far too many nuts in.',
    params
  ),
  chaos_acorn_hail_3: (i18n, params) => i18n.getMessage('Chubby cheeks all round!', params),
  // Chaos v2: VAR.
  chaos_var_1: (i18n, params) => i18n.getMessage(
    'Hold everything. VAR is checking a possible nut infringement.',
    params
  ),
  chaos_var_2: (i18n, params) => i18n.getMessage(
    'The owl referee is going to the monitor.',
    params
  ),
  // Chaos v2: the VAR verdict (chosen when the race is built, stored as data.verdict).
  chaos_var_verdict_1: (i18n, params) => i18n.getMessage(
    'VAR verdict: no infringement. Play on!',
    params
  ),
  chaos_var_verdict_2: (i18n, params) => i18n.getMessage(
    'VAR verdict: the acorn was over the line. Play on anyway.',
    params
  ),
  chaos_var_verdict_3: (i18n, params) => i18n.getMessage(
    'VAR verdict: inconclusive. The owl has gone for a cuppa.',
    params
  ),
  // Chaos v2: the trench coat.
  chaos_trench_coat_1: (i18n, params) => i18n.getMessage(
    'Is that one very tall squirrel in a trench coat?',
    params
  ),
  chaos_trench_coat_2: (i18n, params) => i18n.getMessage(
    '{name} is definitely not three squirrels in a coat.',
    params
  ),
  chaos_trench_coat_3: (i18n, params) => i18n.getMessage(
    'Nice moustache, {name}. Very convincing.',
    params
  ),
  // Chaos v2: the woodpecker.
  chaos_woodpecker_1: (i18n, params) => i18n.getMessage(
    'A woodpecker is drilling {name}’s tree!',
    params
  ),
  chaos_woodpecker_2: (i18n, params) => i18n.getMessage(
    '{name} is vibrating. Blame the woodpecker.',
    params
  ),
  // Chaos v2 combo: the hunter against a tornado.
  chaos_hunter_tornado_1: (i18n, params) => i18n.getMessage(
    'The hunter shot at the tornado. It threw the cow back.',
    params
  ),
  chaos_hunter_tornado_2: (i18n, params) => i18n.getMessage(
    'Never pick a fight with a tornado. Lesson learned.',
    params
  ),
  // Chaos v2 combo: an eagle drops its squirrel into the funnel.
  chaos_eagle_funnel_1: (i18n, params) => i18n.getMessage(
    'The eagle has dropped {name} straight into the tornado!',
    params
  ),
  chaos_eagle_funnel_2: (i18n, params) => i18n.getMessage(
    '{name} has gone from eagle taxi to tornado express.',
    params
  ),
  // Chaos v2 combo: a suitor and her date swept up together.
  chaos_suitor_swept_1: (i18n, params) => i18n.getMessage(
    '{name} and the mystery stranger have been swept away!',
    params
  ),
  chaos_suitor_swept_2: (i18n, params) => i18n.getMessage(
    'A whirlwind romance for {name}. Literally.',
    params
  ),
  // Chaos v2 combo: the eagle catches a cat instead.
  chaos_cat_eagle_1: (i18n, params) => i18n.getMessage(
    'The eagle has caught a cat instead of {name}. Awkward.',
    params
  ),
  chaos_cat_eagle_2: (i18n, params) => i18n.getMessage(
    'An eagle holding a cat. Neither of them looks happy.',
    params
  ),
  // Chaos v2: the Absolute Carnage finale burst.
  chaos_finale_1: (i18n, params) => i18n.getMessage(
    'Here comes the grand finale. Hold on to your tails!',
    params
  ),
  chaos_finale_2: (i18n, params) => i18n.getMessage('Everything is happening at once!', params)
});

/**
 * Every race log key in themeConfig.raceLog (Chaos v2 contract § 11): the list words, each short
 * title and each line. Each entry takes the i18n service and the named placeholder values, and
 * returns the translated text. No line uses a pronoun about a squirrel.
 * @type {Readonly<Object<string, function({getMessage: Function}, Object): string>>}
 * @since 2.2.0
 */
export const RACE_LOG_CATALOGUE = Object.freeze({
  // The list words: "Alex, Sam and Jo".
  log_list_and: (i18n, params) => i18n.getMessage('{first} and {last}', params),
  // The short titles.
  log_title_opening: (i18n, params) => i18n.getMessage('Go!', params),
  log_title_nut_stop: (i18n, params) => i18n.getMessage('Nut stop', params),
  log_title_slip: (i18n, params) => i18n.getMessage('Slip', params),
  log_title_burst: (i18n, params) => i18n.getMessage('Burst', params),
  log_title_tornado: (i18n, params) => i18n.getMessage('Tornado', params),
  log_title_sharknado: (i18n, params) => i18n.getMessage('Sharknado', params),
  log_title_hunter_hit: (i18n, params) => i18n.getMessage('Hunter hit', params),
  log_title_hunter_miss: (i18n, params) => i18n.getMessage('Hunter miss', params),
  log_title_suitor_kiss: (i18n, params) => i18n.getMessage('Smooch', params),
  log_title_suitor_slap: (i18n, params) => i18n.getMessage('Slap', params),
  log_title_eagle: (i18n, params) => i18n.getMessage('Eagle', params),
  log_title_beaver: (i18n, params) => i18n.getMessage('Beaver', params),
  log_title_lightning: (i18n, params) => i18n.getMessage('Lightning', params),
  log_title_woodpecker: (i18n, params) => i18n.getMessage('Woodpecker', params),
  log_title_cat_lady: (i18n, params) => i18n.getMessage('Cat lady', params),
  log_title_golden_acorn: (i18n, params) => i18n.getMessage('Golden Acorn', params),
  log_title_leaf_blower: (i18n, params) => i18n.getMessage('Leaf blower', params),
  log_title_ufo: (i18n, params) => i18n.getMessage('UFO', params),
  log_title_earthquake: (i18n, params) => i18n.getMessage('Earthquake', params),
  log_title_flood: (i18n, params) => i18n.getMessage('Flood', params),
  log_title_disco: (i18n, params) => i18n.getMessage('Disco', params),
  log_title_acorn_hail: (i18n, params) => i18n.getMessage('Acorn hail', params),
  log_title_var: (i18n, params) => i18n.getMessage('VAR', params),
  log_title_var_verdict: (i18n, params) => i18n.getMessage('VAR verdict', params),
  log_title_trench_coat: (i18n, params) => i18n.getMessage('Trench coat', params),
  log_title_hunter_tornado: (i18n, params) => i18n.getMessage('Hunter v tornado', params),
  log_title_eagle_funnel: (i18n, params) => i18n.getMessage('Eagle drop', params),
  log_title_suitor_swept: (i18n, params) => i18n.getMessage('Swept away', params),
  log_title_cat_eagle: (i18n, params) => i18n.getMessage('Cat v eagle', params),
  log_title_winner: (i18n, params) => i18n.getMessage('Winner', params),
  log_title_place: (i18n, params) => i18n.getMessage('Finish', params),
  log_title_photo_finish: (i18n, params) => i18n.getMessage('Photo finish', params),
  log_title_other: (i18n, params) => i18n.getMessage('Chaos', params),
  // The opening.
  log_opening: (i18n, params) => i18n.getMessage('And they’re off!', params),
  log_opening_solo: (i18n, params) => i18n.getMessage('{names} is off on a solo run!', params),
  // Classic events.
  log_nut_stop: (i18n, params) => i18n.getMessage('{names} stopped to bury a nut.', params),
  log_slip: (i18n, params) => i18n.getMessage('{names} slipped down the trunk.', params),
  log_burst: (i18n, params) => i18n.getMessage('{names} found a burst of speed.', params),
  // The tornado and the sharknado.
  log_tornado: (i18n, params) => i18n.getMessage(
    'A tornado whisked {names} onto new trees.',
    params
  ),
  log_tornado_none: (i18n, params) => i18n.getMessage('A tornado tore through the wood.', params),
  log_sharknado_chomp: (i18n, params) => i18n.getMessage(
    'A sharknado whisked {names} onto new trees, and a shark stole {name}’s hat.',
    params
  ),
  log_sharknado: (i18n, params) => i18n.getMessage(
    'A sharknado whisked {names} onto new trees.',
    params
  ),
  log_sharknado_none: (i18n, params) => i18n.getMessage(
    'A sharknado tore through the wood. Sharks and all.',
    params
  ),
  // The hunter.
  log_hunter_hit: (i18n, params) => i18n.getMessage(
    'A hunter blasted {names} off the branch.',
    params
  ),
  log_hunter_hit_none: (i18n, params) => i18n.getMessage('A hunter fired into the trees.', params),
  log_hunter_miss: (i18n, params) => i18n.getMessage(
    'A hunter took aim at {names} and missed.',
    params
  ),
  log_hunter_miss_none: (i18n, params) => i18n.getMessage(
    'A hunter fired and hit nothing.',
    params
  ),
  // The suitor.
  log_suitor_kiss: (i18n, params) => i18n.getMessage(
    '{names} stopped for a smooch with a mysterious stranger.',
    params
  ),
  log_suitor_slap: (i18n, params) => i18n.getMessage(
    'A mysterious stranger slapped {names}.',
    params
  ),
  // Single-squirrel visitors.
  log_eagle: (i18n, params) => i18n.getMessage(
    'An eagle gave {names} a lift up the trunk.',
    params
  ),
  log_beaver: (i18n, params) => i18n.getMessage(
    'A beaver gnawed at the tree under {names}.',
    params
  ),
  log_lightning: (i18n, params) => i18n.getMessage('Lightning struck {names}.', params),
  log_woodpecker: (i18n, params) => i18n.getMessage(
    'A woodpecker drilled the tree under {names}.',
    params
  ),
  // The cat lady.
  log_cat_lady: (i18n, params) => i18n.getMessage('The cat lady landed cats on {names}.', params),
  log_cat_lady_none: (i18n, params) => i18n.getMessage(
    'The cat lady hurled cats and hit nobody.',
    params
  ),
  // The Golden Acorn of Doom.
  log_golden_acorn: (i18n, params) => i18n.getMessage(
    'The Golden Acorn of Doom smacked runaway leader {names}.',
    params
  ),
  log_golden_acorn_none: (i18n, params) => i18n.getMessage(
    'The Golden Acorn of Doom went looking for a runaway leader.',
    params
  ),
  // The leaf blower.
  log_leaf_blower: (i18n, params) => i18n.getMessage(
    'A leaf blower left {names} bare-headed.',
    params
  ),
  log_leaf_blower_none: (i18n, params) => i18n.getMessage(
    'A leaf blower left everyone hanging on like washing.',
    params
  ),
  // The UFO.
  log_ufo: (i18n, params) => i18n.getMessage(
    'A UFO swapped {names}, trees and outfits included.',
    params
  ),
  log_ufo_none: (i18n, params) => i18n.getMessage(
    'A UFO hovered, then thought better of it.',
    params
  ),
  // The earthquake.
  log_earthquake: (i18n, params) => i18n.getMessage(
    'An earthquake shook {names} down the trunk.',
    params
  ),
  log_earthquake_none: (i18n, params) => i18n.getMessage(
    'An earthquake shook the whole wood.',
    params
  ),
  // The flood.
  log_flood: (i18n, params) => i18n.getMessage('A flood lifted {names} up the trunk.', params),
  log_flood_none: (i18n, params) => i18n.getMessage(
    'A flood rose, but nobody was low enough to float.',
    params
  ),
  // The disco.
  log_disco: (i18n, params) => i18n.getMessage('Disco! Everyone stopped to dance.', params),
  // The acorn hail.
  log_acorn_hail: (i18n, params) => i18n.getMessage(
    'Acorn hail! {names} stuffed far too many nuts in.',
    params
  ),
  log_acorn_hail_none: (i18n, params) => i18n.getMessage(
    'Acorn hail pelted the whole wood.',
    params
  ),
  // VAR, and its verdicts.
  log_var: (i18n, params) => i18n.getMessage('Everyone froze for VAR.', params),
  log_var_verdict_1: (i18n, params) => i18n.getMessage('No infringement. Play on!', params),
  log_var_verdict_2: (i18n, params) => i18n.getMessage(
    'The acorn was over the line. Play on anyway.',
    params
  ),
  log_var_verdict_3: (i18n, params) => i18n.getMessage(
    'Inconclusive. The owl has gone for a cuppa.',
    params
  ),
  log_var_verdict_none: (i18n, params) => i18n.getMessage('The check is over. Play on!', params),
  // The trench coat.
  log_trench_coat_host: (i18n, params) => i18n.getMessage(
    '{names} squeezed into one trench coat, with {name} on top.',
    params
  ),
  log_trench_coat: (i18n, params) => i18n.getMessage(
    '{names} squeezed into one trench coat.',
    params
  ),
  log_trench_coat_none: (i18n, params) => i18n.getMessage(
    'Three squirrels in a trench coat? Surely not.',
    params
  ),
  // The combos.
  log_hunter_tornado: (i18n, params) => i18n.getMessage(
    'A hunter shot at the tornado and got the cow back.',
    params
  ),
  log_eagle_funnel: (i18n, params) => i18n.getMessage(
    'An eagle dropped {names} straight into the tornado.',
    params
  ),
  log_suitor_swept: (i18n, params) => i18n.getMessage(
    '{names} and a mysterious stranger were swept up mid-smooch.',
    params
  ),
  log_cat_eagle: (i18n, params) => i18n.getMessage(
    'An eagle caught the cat meant for {names} and flew off confused.',
    params
  ),
  log_cat_eagle_none: (i18n, params) => i18n.getMessage(
    'An eagle caught a flying cat. Neither looks happy.',
    params
  ),
  // The finishers.
  log_winner_photo: (i18n, params) => i18n.getMessage(
    'Photo finish! {names} wins by a whisker from {other}.',
    params
  ),
  log_winner: (i18n, params) => i18n.getMessage('{names} grabs the chestnut and wins!', params),
  log_place_second: (i18n, params) => i18n.getMessage('{names} finishes second.', params),
  log_place_third: (i18n, params) => i18n.getMessage('{names} finishes third.', params),
  log_place: (i18n, params) => i18n.getMessage('{names} reaches the chestnut.', params),
  log_photo_finish: (i18n, params) => i18n.getMessage(
    'Photo finish! {names} is second, a whisker behind {other}.',
    params
  ),
  log_photo_finish_plain: (i18n, params) => i18n.getMessage(
    'Photo finish! {names} is second.',
    params
  ),
  // Anything else.
  log_other: (i18n, params) => i18n.getMessage('Something odd happened to {names}.', params),
  log_other_none: (i18n, params) => i18n.getMessage(
    'Something odd happened in the wood.',
    params
  )
});

/**
 * @description Fills {name} and {other} style placeholders in a template from a named-values
 *   object, in one pass, so a value that itself contains a placeholder is never expanded again.
 *   Unknown placeholders are left as they are. Used only as the fallback for a phrase key the
 *   catalogue does not know (for example a theme edited without updating this file).
 * @param {string} template - The text with placeholders.
 * @param {Object<string, string>} [params] - The named values.
 * @returns {string} The filled text.
 * @example
 *   fillPlaceholders('{name} wins it!', {name: 'Alex'});
 *   // 'Alex wins it!'
 * @since 1.0.0
 */
export function fillPlaceholders(template, params = {}) {
  const text = typeof template === 'string' ? template : '';
  const values = params && typeof params === 'object' ? params : {};
  return text.replace(PLACEHOLDER, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}

/**
 * @description Translates one commentary cue from lib/commentary.js: looks its templateKey up in
 *   the catalogue and fills the entrant names in as plain text. A key the catalogue does not know
 *   falls back to the cue's untranslated theme text, so the commentator never goes silent.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service, or a stub
 *   with the same getMessage signature.
 * @param {{templateKey: string, template?: string, params?: Object<string, string>}} cue - A cue
 *   from buildCommentaryCues().
 * @returns {string} The line to show.
 * @example
 *   translateCue(i18n, {templateKey: 'classic_lead_1', params: {name: 'Alex'}});
 *   // 'Alex takes the lead!'
 * @since 1.0.0
 */
export function translateCue(i18n, cue) {
  if (!cue || typeof cue !== 'object') {
    return '';
  }
  const params = cue.params && typeof cue.params === 'object' ? {...cue.params} : {};
  const known = Object.prototype.hasOwnProperty.call(PHRASE_CATALOGUE, cue.templateKey);
  if (known && i18n && typeof i18n.getMessage === 'function') {
    return PHRASE_CATALOGUE[cue.templateKey](i18n, params);
  }
  return fillPlaceholders(cue.template, params);
}

/**
 * @description Finds one phrase's theme text in a phrase bank shaped like themeConfig.phrases
 *   (sections of groups of {key, text}).
 * @param {Object} bank - The phrase bank.
 * @param {string} key - The phrase key.
 * @returns {string} The text, or '' when the bank has no such key.
 * @example
 *   phraseText(themeConfig.phrases, 'classic_lead_1');
 *   // '{name} takes the lead!'
 * @since 1.0.0
 */
export function phraseText(bank, key) {
  if (!bank || typeof bank !== 'object') {
    return '';
  }
  for (const section of Object.values(bank)) {
    const groups = section && typeof section === 'object' ? Object.values(section) : [];
    for (const group of groups) {
      const found = Array.isArray(group)
        ? group.find((phrase) => phrase && phrase.key === key)
        : null;
      if (found) {
        return String(found.text);
      }
    }
  }
  return '';
}

/**
 * @description Translates one phrase by its key (a VAR verdict, for example), the same way as a
 *   commentary cue: the catalogue's literal when it has the key, else the bank's text.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service.
 * @param {Object} bank - The phrase bank (themeConfig.phrases).
 * @param {string} key - The phrase key.
 * @param {Object<string, string>} [params] - Named placeholder values.
 * @returns {string} The line, or '' when neither the catalogue nor the bank knows the key.
 * @example
 *   translatePhrase(i18n, themeConfig.phrases, verdictKey);
 * @since 1.0.0
 */
export function translatePhrase(i18n, bank, key, params = {}) {
  const template = phraseText(bank, key);
  const known = Object.prototype.hasOwnProperty.call(PHRASE_CATALOGUE, key);
  if (!template && !known) {
    return '';
  }
  return translateCue(i18n, {templateKey: key, template, params});
}

/**
 * @description Says whether an i18n service can translate a race log key.
 * @param {*} i18n - The AIUX i18n service, or anything.
 * @param {*} key - A race log key.
 * @returns {boolean} True when the catalogue has the key and the service has getMessage.
 * @since 2.2.0
 */
function canTranslateLog(i18n, key) {
  return typeof key === 'string'
    && Object.prototype.hasOwnProperty.call(RACE_LOG_CATALOGUE, key)
    && Boolean(i18n)
    && typeof i18n.getMessage === 'function';
}

/**
 * @description Translates a race log entry's short title ("Tornado", "Winner"). A key the
 *   catalogue does not know falls back to the entry's theme title.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service.
 * @param {{titleKey?: string, title?: string}} entry - An entry from buildRaceLog().
 * @returns {string} The title.
 * @example
 *   translateLogTitle(i18n, {titleKey: 'log_title_ufo', title: 'UFO'});
 *   // 'UFO'
 * @since 2.2.0
 */
export function translateLogTitle(i18n, entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  if (canTranslateLog(i18n, entry.titleKey)) {
    return String(RACE_LOG_CATALOGUE[entry.titleKey](i18n, {}));
  }
  return typeof entry.title === 'string' ? entry.title : '';
}

/**
 * @description Translates a race log entry's line as plain text, with the names already joined
 *   (for a screen reader summary or a copy of the log). A key the catalogue does not know falls
 *   back to the entry's theme text.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service.
 * @param {{templateKey?: string, template?: string, params?: Object<string, string>}} entry - An
 *   entry from buildRaceLog().
 * @returns {string} The line.
 * @example
 *   translateLogEntry(i18n, {templateKey: 'log_slip', params: {names: 'Alex'}});
 *   // 'Alex slipped down the trunk.'
 * @since 2.2.0
 */
export function translateLogEntry(i18n, entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const params = entry.params && typeof entry.params === 'object' ? {...entry.params} : {};
  if (canTranslateLog(i18n, entry.templateKey)) {
    return String(RACE_LOG_CATALOGUE[entry.templateKey](i18n, params));
  }
  return fillPlaceholders(entry.template, params);
}

/**
 * @description The words that join a list of names in the reader's language: the separator
 *   between earlier names and the words before the last one ("Alex, Sam and Jo"). Read from the
 *   translated log_list_and line; a translation that moves {last} before {first} falls back to
 *   the English words.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service.
 * @returns {{separator: string, conjunction: string}} The list words.
 * @example
 *   logListWords(i18n);
 *   // {separator: ', ', conjunction: ' and '}
 * @since 2.2.0
 */
export function logListWords(i18n) {
  if (!canTranslateLog(i18n, 'log_list_and')) {
    return {...LOG_LIST_FALLBACK};
  }
  const text = String(RACE_LOG_CATALOGUE.log_list_and(i18n, {first: '{first}', last: '{last}'}));
  const firstAt = text.indexOf('{first}');
  const lastAt = text.indexOf('{last}');
  const tidy = firstAt === 0 && lastAt > firstAt && text.endsWith('{last}');
  if (!tidy) {
    return {...LOG_LIST_FALLBACK};
  }
  return {separator: LOG_LIST_SEPARATOR, conjunction: text.slice('{first}'.length, lastAt)};
}

/**
 * @description Splits a race log entry's translated line around its name slots, so the stage can
 *   show each named squirrel as its bib chip followed by its name. The line is translated with
 *   each slot filled by its own token, then cut at the tokens. A text part holds plain words; a
 *   names part holds the entrant indexes for that slot, in order ({names} may be several, {name}
 *   and {other} are one each). A slot with no squirrel behind it keeps its filled-in text.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service.
 * @param {{templateKey?: string, template?: string, params?: Object<string, string>,
 *   subjects?: {names?: number[], name?: (number|null), other?: (number|null)}}} entry - An
 *   entry from buildRaceLog().
 * @returns {Array<{kind: string, text?: string, slot?: string, indexes?: number[]}>} The parts in
 *   reading order: {kind: 'text', text} or {kind: 'names', slot, indexes}.
 * @example
 *   logLineParts(i18n, {templateKey: 'log_slip', subjects: {names: [2]}});
 *   // [{kind: 'names', slot: 'names', indexes: [2]},
 *   //  {kind: 'text', text: ' slipped down the trunk.'}]
 * @since 2.2.0
 */
export function logLineParts(i18n, entry) {
  if (!entry || typeof entry !== 'object') {
    return [];
  }
  const subjects = entry.subjects && typeof entry.subjects === 'object' ? entry.subjects : {};
  const params = entry.params && typeof entry.params === 'object' ? entry.params : {};
  const line = canTranslateLog(i18n, entry.templateKey)
    ? String(RACE_LOG_CATALOGUE[entry.templateKey](i18n, {...LOG_SLOT_TOKENS}))
    : String(typeof entry.template === 'string' ? entry.template : '');
  const slotIndexes = {
    names: Array.isArray(subjects.names) ? subjects.names.filter(Number.isInteger) : [],
    name: Number.isInteger(subjects.name) ? [subjects.name] : [],
    other: Number.isInteger(subjects.other) ? [subjects.other] : []
  };
  const parts = [];
  const addText = (text) => {
    if (text) {
      parts.push({kind: 'text', text});
    }
  };
  let cursor = 0;
  for (const match of line.matchAll(LOG_SLOT)) {
    addText(line.slice(cursor, match.index));
    const slot = match[1];
    if (slotIndexes[slot].length > 0) {
      parts.push({kind: 'names', slot, indexes: slotIndexes[slot].slice()});
    } else {
      addText(typeof params[slot] === 'string' ? params[slot] : '');
    }
    cursor = match.index + match[0].length;
  }
  addText(line.slice(cursor));
  return parts;
}
