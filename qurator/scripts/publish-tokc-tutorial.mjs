import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = 'https://xkatttkfpcgpmmpitnvr.supabase.co';
const ADMIN_ID = '5810aba3-0ccf-4da6-bbcb-fe2659f55986';
const CATEGORY_ID = 'd95dda7b-a88c-4a9c-b0b6-92f174d92ed1';
const BGG_IMAGE_URL = 'https://cf.geekdo-images.com/q3Qp4L-rU3VOW6fMAFUJnQ__original/img/zICTkM9KNDlQ6wZgIMQ2HavR4PE=/0x0/filters:format(jpeg)/pic8937255.jpg';

const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const serviceKey = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from qurator/.env.local');

async function api(path, method, body, prefer = 'return=representation') {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const shape = (id, shapeName, x, y, width, height, fill, label, zIndex = 2) => ({
  id, type: 'shape', shape: shapeName, x, y, width, height, fill,
  stroke: 'rgba(255,255,255,0.38)', strokeWidth: 1, rotation: 0,
  opacity: 1, zIndex, label,
});
const text = (id, x, y, width, value, fontSize = 11, zIndex = 6) => ({
  id, type: 'text', x, y, width, height: 20, text: value, fontSize,
  fontWeight: 600, textColor: 'rgba(255,255,255,0.92)', textAlign: 'center',
  rotation: 0, opacity: 1, zIndex,
});

function kingdomBoard() {
  const e = [
    shape('board', 'rectangle', 20, 20, 960, 620, 'rgba(35,50,62,0.72)', 'The Kingdom Board', 1),
    text('title', 300, 30, 400, 'THE KINGDOM BOARD', 18),
    text('council-title', 70, 72, 210, 'Councils Tile', 12),
    text('road-title', 560, 72, 290, 'Great Road', 12),
    text('map-title', 345, 250, 290, 'Map: three Regions, six Locations', 13),
  ];
  ['Relics', 'Secrets', 'Oaths'].forEach((name, i) => {
    e.push(shape(`council-${i}`, 'rectangle', 70 + i * 135, 98, 120, 48, 'rgba(107,78,143,0.48)', `Council of ${name}`));
    e.push(text(`council-label-${i}`, 70 + i * 135, 111, 120, name));
  });
  e.push(shape('road-deck-back', 'card', 560, 100, 50, 72, 'rgba(26,111,142,0.7)', 'Kingdom deck'));
  e.push(text('road-deck-label', 555, 176, 60, 'Deck', 9));
  ['1', '2', '3', '4'].forEach((name, i) => {
    e.push(shape(`road-${name}`, 'card', 625 + i * 66, 100, 50, 72, 'rgba(204,160,69,0.54)', `Face-up Kingdom Card ${name}`));
    e.push(text(`road-label-${name}`, 625 + i * 66, 176, 50, `Card ${name}`, 9));
  });
  [
    ['Highlands', 'Castle', 'Wilderness', 'rgba(105,148,191,0.45)'],
    ['Plateau', 'Harvest Field', 'Battlefield', 'rgba(164,126,68,0.48)'],
    ['Lowlands', 'Shrine', 'Necropolis', 'rgba(72,121,104,0.48)'],
  ].forEach(([region, left, right, fill], row) => {
    const y = 285 + row * 92;
    e.push(text(`region-${row}`, 58, y + 26, 130, region, 12));
    e.push(shape(`location-${row}-left`, 'rectangle', 210, y, 285, 76, fill, `${left} location`));
    e.push(shape(`location-${row}-right`, 'rectangle', 505, y, 285, 76, fill, `${right} location`));
    e.push(text(`location-${row}-left-label`, 210, y + 27, 285, left, 12));
    e.push(text(`location-${row}-right-label`, 505, y + 27, 285, right, 12));
    e.push(shape(`clash-${row}`, 'token', 800, y + 22, 30, 30, 'rgba(255,214,10,0.8)', `${region} Clash marker`));
  });
  e.push(text('order-title', 55, 205, 140, 'Order Track', 11));
  ['1', '2', '3', '4'].forEach((slot, i) => {
    e.push(shape(`order-${slot}`, 'circle', 65 + i * 37, 228, 27, 27, 'rgba(255,255,255,0.15)', `Order Track position ${slot}`));
    e.push(text(`order-label-${slot}`, 66 + i * 37, 232, 26, slot, 10));
  });
  e.push(text('round-title', 820, 525, 120, 'Round Track', 11));
  ['1', '2', '3', '4', '5', '6'].forEach((slot, i) => {
    e.push(shape(`round-${slot}`, 'circle', 810 + i * 27, 550, 20, 20, 'rgba(255,173,51,0.35)', `Round ${slot}`));
    e.push(text(`round-label-${slot}`, 809 + i * 27, 551, 21, slot, 9));
  });
  [
    ['Spring', 'rgba(85,165,98,0.55)'], ['Summer', 'rgba(234,169,52,0.55)'],
    ['Autumn', 'rgba(194,98,51,0.55)'], ['Winter', 'rgba(89,148,194,0.55)'],
  ].forEach(([season, fill], i) => {
    e.push(shape(`season-${i}`, 'rectangle', 185 + i * 155, 590, 145, 28, fill, `${season} phase`));
    e.push(text(`season-label-${i}`, 185 + i * 155, 594, 145, season, 10));
  });
  e.push(text('legend', 620, 625, 320, 'Blue = Highlands, ochre = Plateau, green = Lowlands, gold = cards/markers', 9));
  return { type: 'custom', cols: 0, rows: 0, cells: [], pieces: [], title: 'Kingdom Board Setup', canvas_width: 1000, canvas_height: 660, canvas_elements: e };
}

function playerBoard() {
  const e = [
    shape('mat', 'rectangle', 50, 50, 700, 420, 'rgba(31,78,100,0.68)', 'Faction Player Board', 1),
    text('mat-title', 240, 64, 320, 'YOUR FACTION PLAYER BOARD', 17),
    shape('deck', 'card', 86, 135, 65, 95, 'rgba(28,76,143,0.7)', 'Faction Deck'),
    shape('discard', 'card', 644, 135, 65, 95, 'rgba(110,69,130,0.7)', 'Discard Pile'),
    text('deck-label', 80, 236, 78, 'Deck', 10), text('discard-label', 635, 236, 84, 'Discard', 10),
    shape('herald', 'pawn', 202, 142, 42, 56, 'rgba(241,196,15,0.75)', 'Herald slot'),
    text('herald-label', 185, 204, 76, 'Herald', 10),
    text('support-title', 295, 123, 180, 'Five Supporter slots', 11),
    text('tactics-title', 265, 285, 270, 'Four Tactic Tiles', 11),
    text('site-title', 100, 360, 205, 'Site of Power: five cards', 11),
    text('kingdom-title', 460, 360, 205, 'Two Kingdom Card spaces', 11),
  ];
  for (let i = 0; i < 5; i++) e.push(shape(`supporter-${i}`, 'meeple', 300 + i * 42, 150, 30, 42, 'rgba(46,204,113,0.65)', `Supporter ${i + 1}`));
  for (let i = 0; i < 4; i++) e.push(shape(`tactic-${i}`, 'card', 285 + i * 62, 315, 50, 72, 'rgba(206,105,65,0.56)', `Tactic Tile ${i + 1}`));
  for (let i = 0; i < 5; i++) e.push(shape(`site-${i}`, 'card', 100 + i * 34, 390, 28, 45, 'rgba(159,93,194,0.6)', `Site of Power card ${i + 1}`));
  for (let i = 0; i < 2; i++) e.push(shape(`kingdom-${i}`, 'card', 490 + i * 82, 390, 65, 45, 'rgba(211,173,74,0.6)', `Kingdom Card space ${i + 1}`));
  e.push(shape('hand-marker', 'token', 600, 80, 28, 28, 'rgba(255,255,255,0.55)', 'Hand Size Marker'));
  e.push(text('hand-label', 620, 84, 90, 'Hand Size', 10));
  e.push(text('legend', 270, 452, 280, 'Gold = Herald, green = Supporter, orange = Tactic, purple = Site of Power', 9));
  return { type: 'custom', cols: 0, rows: 0, cells: [], pieces: [], title: 'Player Board Setup', canvas_width: 800, canvas_height: 500, canvas_elements: e };
}

const tutorialId = randomUUID();
const ids = Object.fromEntries([
  'welcome', 'setup', 'faction-select', 'faction-logic', 'nobility', 'clans', 'uprising', 'gathering',
  'year', 'spring', 'summer', 'tie-logic', 'tie', 'autumn', 'focus', 'focus-logic', 'pressure', 'develop',
  'winter', 'win', 'remember',
].map((name) => [name, randomUUID()]));

const content = (name, sort, heading, body, options = {}) => ({
  id: ids[name], tutorial_id: tutorialId, step_type: 'content', sort_order: sort,
  content_json: { heading, body, ...options }, logic_json: null,
  position_x: options.position_x ?? 0, position_y: options.position_y ?? sort * 170,
});
const logic = (name, sort, prompt, conditions, defaultTarget = '', defaultLabel = '', position_x = 0, position_y = sort * 170) => ({
  id: ids[name], tutorial_id: tutorialId, step_type: 'logic', sort_order: sort,
  content_json: null,
  logic_json: { prompt, conditions: conditions.map(([label, target]) => ({ label, condition: { variable: '', operator: 'eq', value: '' }, target_step_id: ids[target] })), default_target_step_id: defaultTarget ? ids[defaultTarget] : '', default_label: defaultLabel },
  position_x, position_y,
});

const steps = [
  content('welcome', 0, 'Welcome to The Old King\'s Crown',
    'The old king is gone and four factions are fighting for the throne. In this card-driven contest, you bluff, bid, clash across the map and build a position that can outlast everyone else.\n\nYour goal is simple: finish the final Round with the most **Influence** in your Supply. The road there is deliciously devious :)',
    { tip: 'Your hand is your whole economy. A strong card can be a bid, a clash commitment, a Council vote or a journey into Lore. Spend it with a purpose.' }),
  content('setup', 1, 'Set up the Kingdom',
    '{c:#FFDC00}**Central area:**{/c}\n- Put the **Kingdom Board** within reach and the three-part **Councils Tile** directly above it.\n- Make the **Reserve** with all Influence and Lore tokens.\n- Put the **Kingdom\'s Favour** on Harvest Field, the Season marker on Spring and the Round marker on 1.\n- Make the Great Road: one face-down Kingdom deck plus **four face-up Kingdom Cards**.\n\nThe board has three Regions. Each Region has two Locations, but you clash for the whole Region and only then choose a Location reward.',
    { is_setup_step: true, board_view: kingdomBoard(), tip: 'Keep the six named Locations visible. The Region decides where cards clash, while your chosen Location decides your reward.' }),
  content('faction-select', 2, 'Choose a faction and prepare your board',
    'Choose or randomly assign one of the four factions. Take its Player Board, **one Herald**, **five Supporters**, four Tactics and its Site of Power.\n\nFind that faction\'s five advanced/HQ cards and put them face-up at its Site of Power. Set aside the **Heir**, shuffle the remaining cards into your Deck, then take the Heir and draw until you have **six cards**.\n\nEvery faction begins with the same basic card roles. Their advanced cards, HQ cards, Tactics and Kingdom\'s Favour Action are what make them sing.',
    { is_setup_step: true, board_view: playerBoard(), tip: 'For a first game, pick the faction whose learning style fits you. You do not need to understand every advanced card before the first Round.' }),
  logic('faction-logic', 3, 'Who are you leading?', [
    ['**The Nobility** - defence and control', 'nobility'],
    ['**The Clans** - mobility and force', 'clans'],
    ['**The Uprising** - feints and elimination', 'uprising'],
    ['**The Gathering** - manipulation and slow power', 'gathering'],
  ], '', '', 0, 510),
  content('nobility', 4, 'The Nobility',
    '**Style:** potent defence, sustaining your position and exerting control.\n\nThe old order has woken. The Nobility rewards a patient player who wants to make an important place hard to take and turn durable control into a crown.',
    { tip: 'From experience, play your first Nobility game with a clear plan for which Region you want to protect. Let the other fights be expensive for rivals.' }),
  content('clans', 5, 'The Clans',
    '**Style:** mobility, momentum and overwhelming force.\n\nThe Clans arrive with movement and pressure. They are a great fit if you enjoy changing the shape of a conflict after opponents think they know where it will be decided.',
    { tip: 'Do not show every intention in Spring. Mobility is strongest when an opponent has already committed somewhere else.' }),
  content('uprising', 6, 'The Uprising',
    '**Style:** schemes, careful feints and eliminating rival cards.\n\nThe Uprising thrives on making the obvious fight uncomfortable. Use hidden commitments to force hard choices, then make the timing matter.',
    { tip: 'A bluff only needs to make someone spend a better card than they wanted to. You do not have to win every Region to win the game.' }),
  content('gathering', 7, 'The Gathering',
    '**Style:** card manipulation, subversion and the creeping accrual of power.\n\nThe Gathering favours a patient engine that becomes more threatening each Round. Small advantages can become a very awkward problem for everyone else.',
    { tip: 'Watch the paths to Lore. Your Site of Power gives long-term options, so a quiet Journey can be more valuable than one more close fight.' }),
  content('year', 8, 'A year has four seasons',
    '{c:#FFDC00}**Spring:**{/c} bid for Kingdom Cards, place Heralds and secretly commit cards.\n{c:#FFDC00}**Summer:**{/c} resolve the three regional Clashes.\n{c:#FFDC00}**Autumn:**{/c} Govern, Journey and develop your engine.\n{c:#FFDC00}**Winter:**{/c} resolve mandatory effects, clean up and advance the Round.\n\nSkip Start of the Year in Round 1. Later, everyone draws up to Hand Size and then turn order is adjusted by Influence.',
    { board_view: kingdomBoard(), tip: 'The player last on the Order Track chooses Summer\'s clash order. That makes being last a tactical tool, not merely bad news.' }),
  content('spring', 9, 'Spring: bid, declare, deceive',
    '{c:#FFDC00}**1. Bid:**{/c} each player secretly chooses one card, then reveals together. Highest total **Strength** resolves first. On your bid, either take and Occupy a Great Road Kingdom Card, steal an eligible occupied card, or return the bid to your Hand.\n\n{c:#FFDC00}**2. Heralds and cards:**{/c} in turn order, each player places a Herald on any Location. Then every player secretly places **one Faction Card next to each Region**.\n\n{c:#FFDC00}**3. Actions:**{/c} take Spring Actions in turn order. Supporters are placed on a whole Region, not a specific Location.',
    { tip: 'A high bid is not automatically good. If you Occupy a Kingdom Card with it, that faction card will not be one of your three hidden commitments this Round.' }),
  content('summer', 10, 'Summer: resolve the Clashes',
    'The player last on the Order Track places I, II and III Clash markers, deciding the Region order. For each Region: \n\n{c:#FFDC00}**A. Reveal**{/c} all committed cards. They are now **Active**.\n{c:#FFDC00}**B. Day Action Step**{/c} players act in turn order.\n{c:#FFDC00}**C. Night Effects Step**{/c} mandatory Effects trigger simultaneously.\n{c:#FFDC00}**D. Tally Strength**{/c} and determine the winner.\n{c:#FFDC00}**E. Claim Rewards**{/c} from one Location in that Region.\n\nSupporters give +1 Strength each the first time they take part in a Clash there.',
    { board_view: kingdomBoard(), tip: 'A Region is not the same thing as a Location. Win the Region first, then choose one of its two Location rewards.' }),
  logic('tie-logic', 11, 'Did the Clash end tied for the highest Strength?', [['Yes, start a new tied Clash', 'tie']], 'autumn', 'No, continue to Autumn', 0, 1870),
  content('tie', 12, 'Tied Clashes create another showdown',
    'Each tied player, in turn order, either places another Faction Card face-down in that Region or passes. If anyone adds a card, reveal and resolve a **new Clash** between the tied players.\n\nIf every tied player passes, the Region is resolved as a tie. Nobody claims rewards there this Round :|\n\nCards and Supporters that took part in a previous Clash in that Region do not contribute to the new tied Clash unless a rule says otherwise.',
    { tip: 'Passing is a real choice. Ask whether another card can actually change the Region, or whether saving it for Autumn is stronger.' }),
  content('autumn', 13, 'Autumn: turn cards into a future',
    'In your Autumn Action Step, in any sequence, you may:\n\n- **Govern once** with one card from Hand that has one or more Votes, moving it into a Council.\n- **Journey once** with one card from Hand that has one or more Lore icons, moving it to the Lost Pile and gaining that Lore.\n- Activate any available Actions and Commands.\n\nWhenever you gain Lore, you may immediately spend any amount from your Supply to acquire advanced Faction or HQ cards from your Site of Power.',
    { tip: 'I recommend learning one Council at a time. A small, focused plan is much easier to execute than scattering your Votes across all three.' }),
  content('focus', 14, 'Choose your next priority',
    'You have seen the core loop. Now choose the lesson that best matches your first-game instinct. Both paths return to Winter, where the board resets for the next Year.',
    { tip: 'There is no universally correct focus. Your Hand, the Great Road and where the Heralds land should shape this choice.' }),
  logic('focus-logic', 15, 'What do you want to practise first?', [
    ['**Pressure a Region** - use the map and hidden cards', 'pressure'],
    ['**Develop your engine** - use Lore and Councils', 'develop'],
  ], '', '', 0, 2550),
  content('pressure', 16, 'Pressure a Region',
    'Commit one hidden card to every Region, then decide where your Herald and Supporters make the reward worth chasing. In Summer, use the Day Action Step to respond to the reveal.\n\n{c:#2ECC40}**Remember:**{/c} your Herald only pays off if you choose the Location it occupies after winning that Region. If rivals share that Location, your Herald reward can also steal Influence from each of them.',
    { tip: 'A Herald can be a threat as well as a promise. Placing it openly does not force you to make that Region your main fight.' }),
  content('develop', 17, 'Develop your engine',
    'Use **Journey** to turn a Lore-icon card into Lore, then decide whether to buy from your Site of Power now or save for later. Use **Govern** to add Votes to a Council and unlock its benefit.\n\n{c:#0074D9}**Important:**{/c} your hand can never exceed its current Hand Size unless a rule says otherwise. When you gain cards or recover cards, keep that limit in view.',
    { tip: 'Development that does not help your next Round can still be right. The best purchase is often one that gives you more options, not merely more raw Strength.' }),
  content('winter', 18, 'Winter: reset without losing the story',
    '{c:#FFDC00}**1. Effects:**{/c} resolve all Winter Effects simultaneously.\n{c:#FFDC00}**2. Cleanup:**{/c} return Heralds to Player Boards, move all Supporters on the Map to the Lost Pile, remove Clash markers, then handle Active cards. Active cards with no Influence go to their owners\' discard piles. An Active card with Influence instead loses one Influence.\n{c:#FFDC00}**3. Advance:**{/c} move the Round marker forward. If it has reached the final chosen Round, score the game.\n\nFrom Round 2 onward, Start of the Year makes everyone draw to Hand Size and updates turn order by Influence.',
    { tip: 'Attrition only happens when you must draw from an empty Deck. Then shuffle your Discard Pile into a new Deck, reduce Hand Size by one, and draw to the new size. Hand Size never falls below three.' }),
  content('win', 19, 'Claim the crown',
    'At the end of the final Round, total the **Influence** in your Supply. The player with the most wins.\n\nIf players tie, the tied player controlling the **Kingdom\'s Favour** wins. If none of the tied players controls it, the tied player highest on the **Order Track** wins.\n\n{c:#2ECC40}**You did it.**{/c} You now have the entire seasonal rhythm in your hands :)',
    { tip: 'Keep the Kingdom\'s Favour tiebreaker visible during the final Round. A Location reward that looks small can become decisive.' }),
  content('remember', 20, 'First-game reminders',
    '{c:#FF5733}**Do not forget:**{/c}\n- Cards fight for **Regions**, not individual Locations.\n- A winning player chooses one Location in that Region for rewards.\n- Face-down commitments are private. You may discuss them, but do not physically reveal them.\n- Text on a card or component takes precedence over the rulebook.\n\n*Note:* For a learning game, talk through unexpected timing windows. I would not undo hidden-card choices, but pausing to identify the correct Step makes the next Round far smoother.',
    { interactive: { type: 'multiple_choice', question: 'After winning a Summer Clash, what do you choose?', options: [
      { label: 'One Location in the Region you won', correct: true },
      { label: 'Every Location in the Region', correct: false },
      { label: 'Any Location anywhere on the map', correct: false },
    ], explanation: 'Clashes are resolved by Region. The winner then chooses one of that Region\'s two Locations and claims its rewards.' }, tip: 'Use this tutorial as a table-side refresher during the first game. The season sequence and the six map Locations are the two things worth keeping in view.' }),
];

const edges = [
  ['welcome', 'setup'], ['setup', 'faction-select'], ['faction-select', 'faction-logic'],
  ['faction-logic', 'nobility'], ['faction-logic', 'clans'], ['faction-logic', 'uprising'], ['faction-logic', 'gathering'],
  ['nobility', 'year'], ['clans', 'year'], ['uprising', 'year'], ['gathering', 'year'],
  ['year', 'spring'], ['spring', 'summer'], ['summer', 'tie-logic'], ['tie-logic', 'tie'], ['tie-logic', 'autumn'], ['tie', 'autumn'],
  ['autumn', 'focus'], ['focus', 'focus-logic'], ['focus-logic', 'pressure'], ['focus-logic', 'develop'],
  ['pressure', 'winter'], ['develop', 'winter'], ['winter', 'win'], ['win', 'remember'],
];
const connections = edges.map(([from, to]) => ({ id: randomUUID(), from_step_id: ids[from], to_step_id: ids[to], condition_json: null }));

function validate() {
  if (new Set(steps.map((step) => step.id)).size !== steps.length) throw new Error('Duplicate step UUID');
  if (new Set(connections.map((connection) => connection.id)).size !== connections.length) throw new Error('Duplicate connection UUID');
  if (steps.some((step) => step.step_type === 'content' && !step.content_json?.heading)) throw new Error('Content step missing heading');
  if (steps.some((step) => /—/.test(JSON.stringify(step)))) throw new Error('Tutorial contains an em dash');
  if (!steps.some((step) => step.content_json?.interactive?.type === 'multiple_choice')) throw new Error('Missing quiz');
  if (!steps.some((step) => step.content_json?.board_view?.canvas_elements?.length)) throw new Error('Missing custom board view');
  const actual = new Set(connections.map((connection) => `${connection.from_step_id}:${connection.to_step_id}`));
  for (const step of steps.filter((step) => step.step_type === 'logic')) {
    for (const condition of step.logic_json.conditions) {
      if (!actual.has(`${step.id}:${condition.target_step_id}`)) throw new Error(`Missing connection for ${step.id}`);
    }
    if (step.logic_json.default_target_step_id && !actual.has(`${step.id}:${step.logic_json.default_target_step_id}`)) throw new Error(`Missing default connection for ${step.id}`);
  }
}

validate();

if (process.argv.includes('--validate')) {
  console.log(JSON.stringify({ tutorialId, steps: steps.length, connections: connections.length, validation: 'passed' }));
  process.exit(0);
}

const [game] = await api('games', 'POST', {
  title: "The Old King's Crown", bgg_id: 357873, bgg_image_url: BGG_IMAGE_URL,
  bgg_rating: 8, description: 'A card-driven conquest game of bidding, bluffing, hand management and area control as rival factions vie for a vacant throne.',
  complexity: 4, min_players: 1, max_players: 4, play_time_minutes: 120, year_published: 2025,
}, 'resolution=merge-duplicates,return=representation');

await api('tutorials', 'POST', {
  id: tutorialId, game_id: game.id, category_id: CATEGORY_ID, creator_id: ADMIN_ID,
  title: "The Old King's Crown Quickstart + Recommendations",
  description: 'Learn the standard five-round multiplayer game: setup, factions, seasonal flow, clashes, development and scoring.',
  cover_image_url: BGG_IMAGE_URL, estimated_minutes: 10, status: 'published', version: 1,
});
await api('tutorial_steps', 'POST', steps, 'return=minimal');
for (const connection of connections) await api('tutorial_connections', 'POST', connection, 'return=minimal');

console.log(JSON.stringify({ tutorialId, gameId: game.id, steps: steps.length, connections: connections.length }));
