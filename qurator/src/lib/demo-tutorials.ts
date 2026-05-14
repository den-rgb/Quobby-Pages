import type { BoardViewConfig, ContentStepPayload, Game, Tutorial } from './types';

// Well-known category slugs → placeholder IDs for demo tutorials.
// On fresh installs these match seed data. On existing installs the
// browse page resolves demos by slug via the DEMO_CATEGORY_SLUGS map.
export const DEMO_CATEGORY_IDS = {
  'board-games': '00000000-0000-4000-c000-000000000001',
  'cooking': '00000000-0000-4000-c000-000000000002',
  'diy-crafts': '00000000-0000-4000-c000-000000000003',
  'software': '00000000-0000-4000-c000-000000000004',
  'music': '00000000-0000-4000-c000-000000000005',
  'sports': '00000000-0000-4000-c000-000000000006',
  'science': '00000000-0000-4000-c000-000000000007',
} as const;

export const DEMO_CREATOR_ID = '5810aba3-0ccf-4da6-bbcb-fe2659f55986';

// Reverse map: demo category_id → slug (used for filtering by slug)
export const DEMO_CATEGORY_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(DEMO_CATEGORY_IDS).map(([slug, id]) => [id, slug])
);

// Theme-aligned muted resource colors
const C = {
  grain: 'rgba(180,160,60,0.22)',
  wool: 'rgba(140,180,120,0.18)',
  lumber: 'rgba(70,120,70,0.25)',
  brick: 'rgba(160,90,50,0.22)',
  ore: 'rgba(120,120,140,0.22)',
  desert: 'rgba(160,140,80,0.15)',
  blue: 'rgba(60,120,200,0.18)',
  red: 'rgba(180,60,60,0.18)',
  neutral: 'rgba(255,255,255,0.04)',
  black: 'rgba(255,255,255,0.02)',
  forest: 'rgba(50,130,70,0.16)',
  grass: 'rgba(150,150,50,0.14)',
  wetland: 'rgba(50,100,160,0.16)',
};

// ─── Catan Board ────────────────────────────────────────────────────────────
const CATAN_BOARD: BoardViewConfig = {
  type: 'hex_grid',
  cols: 5,
  rows: 5,
  title: 'Catan Island',
  cells: [
    // Row 0 (3 hexes)
    { id: 'h1', label: '10', color: C.grain, icon: 'GRN', tooltip: 'Grain — roll 10' },
    { id: 'h2', label: '2', color: C.wool, icon: 'WOL', tooltip: 'Wool — roll 2' },
    { id: 'h3', label: '9', color: C.lumber, icon: 'LBR', tooltip: 'Lumber — roll 9' },
    // Row 1 (4 hexes)
    { id: 'h4', label: '12', color: C.brick, icon: 'BRK', tooltip: 'Brick — roll 12' },
    { id: 'h5', label: '6', color: C.ore, icon: 'ORE', tooltip: 'Ore — roll 6' },
    { id: 'h6', label: '4', color: C.grain, icon: 'GRN', tooltip: 'Grain — roll 4' },
    { id: 'h7', label: '10', color: C.brick, icon: 'BRK', tooltip: 'Brick — roll 10' },
    // Row 2 (5 hexes)
    { id: 'h8', label: '9', color: C.wool, icon: 'WOL', tooltip: 'Wool — roll 9' },
    { id: 'h9', label: '11', color: C.lumber, icon: 'LBR', tooltip: 'Lumber — roll 11' },
    { id: 'h10', label: '', color: C.desert, icon: '—', tooltip: 'Desert — no production' },
    { id: 'h11', label: '3', color: C.ore, icon: 'ORE', tooltip: 'Ore — roll 3' },
    { id: 'h12', label: '8', color: C.lumber, icon: 'LBR', tooltip: 'Lumber — roll 8' },
    // Row 3 (4 hexes)
    { id: 'h13', label: '8', color: C.ore, icon: 'ORE', tooltip: 'Ore — roll 8' },
    { id: 'h14', label: '3', color: C.grain, icon: 'GRN', tooltip: 'Grain — roll 3' },
    { id: 'h15', label: '4', color: C.wool, icon: 'WOL', tooltip: 'Wool — roll 4' },
    { id: 'h16', label: '5', color: C.brick, icon: 'BRK', tooltip: 'Brick — roll 5' },
    // Row 4 (3 hexes)
    { id: 'h17', label: '5', color: C.wool, icon: 'WOL', tooltip: 'Wool — roll 5' },
    { id: 'h18', label: '6', color: C.grain, icon: 'GRN', tooltip: 'Grain — roll 6' },
    { id: 'h19', label: '11', color: C.lumber, icon: 'LBR', tooltip: 'Lumber — roll 11' },
  ],
  pieces: [
    { id: 'p1', cell_id: 'h1', label: '', color: 'rgba(220,60,60,0.8)', shape: 'triangle', tooltip: 'Red Settlement' },
    { id: 'p2', cell_id: 'h6', label: '', color: 'rgba(60,140,220,0.8)', shape: 'triangle', tooltip: 'Blue Settlement' },
    { id: 'p3', cell_id: 'h10', label: '', color: 'rgba(255,255,255,0.2)', shape: 'circle', tooltip: 'Robber' },
  ],
};

const CATAN_SETUP_BOARD: BoardViewConfig = {
  ...CATAN_BOARD,
  title: 'Board Setup',
  highlight_cells: ['h1', 'h5', 'h9', 'h12', 'h18'],
  pieces: [],
};

// ─── Wingspan Board ─────────────────────────────────────────────────────────
const WINGSPAN_BOARD: BoardViewConfig = {
  type: 'row_layout',
  cols: 5,
  rows: 3,
  title: 'Player Mat',
  cells: [
    { id: 'f1', label: 'Gain Food', color: C.forest, icon: 'F', tooltip: 'Forest Habitat' },
    { id: 'f2', label: 'Slot 2', color: C.forest, icon: '·', tooltip: 'Bird slot' },
    { id: 'f3', label: 'Slot 3', color: C.forest, icon: '·', tooltip: 'Bird slot' },
    { id: 'f4', label: 'Slot 4', color: C.forest, icon: '·', tooltip: 'Bird slot' },
    { id: 'f5', label: 'Slot 5', color: C.forest, icon: '·', tooltip: 'Bird slot' },
    { id: 'g1', label: 'Lay Eggs', color: C.grass, icon: 'E', tooltip: 'Grassland Habitat' },
    { id: 'g2', label: 'Slot 2', color: C.grass, icon: '·', tooltip: 'Bird slot' },
    { id: 'g3', label: 'Slot 3', color: C.grass, icon: '·', tooltip: 'Bird slot' },
    { id: 'g4', label: 'Slot 4', color: C.grass, icon: '·', tooltip: 'Bird slot' },
    { id: 'g5', label: 'Slot 5', color: C.grass, icon: '·', tooltip: 'Bird slot' },
    { id: 'w1', label: 'Draw Cards', color: C.wetland, icon: 'C', tooltip: 'Wetland Habitat' },
    { id: 'w2', label: 'Slot 2', color: C.wetland, icon: '·', tooltip: 'Bird slot' },
    { id: 'w3', label: 'Slot 3', color: C.wetland, icon: '·', tooltip: 'Bird slot' },
    { id: 'w4', label: 'Slot 4', color: C.wetland, icon: '·', tooltip: 'Bird slot' },
    { id: 'w5', label: 'Slot 5', color: C.wetland, icon: '·', tooltip: 'Bird slot' },
  ],
  pieces: [
    { id: 'wp1', cell_id: 'f2', label: '', color: 'rgba(200,160,60,0.7)', shape: 'diamond', tooltip: 'Eastern Bluebird (2pts)' },
  ],
};

// ─── Codenames Board ────────────────────────────────────────────────────────
const CODENAMES_BOARD: BoardViewConfig = {
  type: 'rect_grid',
  cols: 5,
  rows: 5,
  title: 'Word Grid',
  cells: [
    { id: 'c1', label: 'APPLE', color: C.blue, tooltip: 'Blue team' },
    { id: 'c2', label: 'BANK', color: C.red, tooltip: 'Red team' },
    { id: 'c3', label: 'CAST', color: C.neutral, tooltip: 'Neutral' },
    { id: 'c4', label: 'DICE', color: C.blue, tooltip: 'Blue team' },
    { id: 'c5', label: 'ENGINE', color: C.neutral, tooltip: 'Neutral' },
    { id: 'c6', label: 'FIRE', color: C.red, tooltip: 'Red team' },
    { id: 'c7', label: 'GLASS', color: C.blue, tooltip: 'Blue team' },
    { id: 'c8', label: 'HAWK', color: C.neutral, tooltip: 'Neutral' },
    { id: 'c9', label: 'ICE', color: C.red, tooltip: 'Red team' },
    { id: 'c10', label: 'JUPITER', color: C.blue, tooltip: 'Blue team' },
    { id: 'c11', label: 'KNIGHT', color: C.neutral, tooltip: 'Neutral' },
    { id: 'c12', label: 'LEMON', color: C.red, tooltip: 'Red team' },
    { id: 'c13', label: 'MOON', color: C.black, tooltip: 'Assassin!' },
    { id: 'c14', label: 'NOVEL', color: C.blue, tooltip: 'Blue team' },
    { id: 'c15', label: 'OCTOPUS', color: C.neutral, tooltip: 'Neutral' },
    { id: 'c16', label: 'PIANO', color: C.blue, tooltip: 'Blue team' },
    { id: 'c17', label: 'QUEEN', color: C.red, tooltip: 'Red team' },
    { id: 'c18', label: 'RIVER', color: C.blue, tooltip: 'Blue team' },
    { id: 'c19', label: 'SPRING', color: C.neutral, tooltip: 'Neutral' },
    { id: 'c20', label: 'TOWER', color: C.red, tooltip: 'Red team' },
    { id: 'c21', label: 'UNICORN', color: C.neutral, tooltip: 'Neutral' },
    { id: 'c22', label: 'VIOLET', color: C.blue, tooltip: 'Blue team' },
    { id: 'c23', label: 'WHALE', color: C.red, tooltip: 'Red team' },
    { id: 'c24', label: 'XYLOPH.', color: C.neutral, tooltip: 'Neutral' },
    { id: 'c25', label: 'ZERO', color: C.blue, tooltip: 'Blue team' },
  ],
  pieces: [],
};

// ─── Demo Steps ─────────────────────────────────────────────────────────────

export const CATAN_STEPS: ContentStepPayload[] = [
  {
    heading: 'Welcome to Catan!',
    body: "Catan is a game about settling an island. You'll collect resources, build roads and settlements, and race to **10 victory points**. Let's learn how to play!",
    tip: "Don't worry about memorizing everything — this tutorial will guide you step by step.",
  },
  {
    heading: 'Board Setup',
    body: "The board is made of **19 hexagonal terrain tiles**. These tiles are **shuffled and placed randomly** each game, so every board is different.\n\nArrange the tiles in a diamond shape (3-4-5-4-3). Then place **number tokens** (2-12) on each tile except the desert. Finally, place the **Robber** pawn on the desert tile.\n\nTap the tiles below to see what each one produces.",
    is_setup_step: true,
    board_view: CATAN_SETUP_BOARD,
    tip: 'This is one possible arrangement. The rulebook includes a beginner layout, but experienced players randomize everything.',
  },
  {
    heading: 'Resources & Intersections',
    body: "There are five resources:\n\n- **GRN** — Grain (yellow fields)\n- **WOL** — Wool (green pastures)\n- **LBR** — Lumber (dark forests)\n- **BRK** — Brick (red hills)\n- **ORE** — Ore (grey mountains)\n\nWhen a number is rolled, every hex with that number produces resources. But resources go to players who have a **settlement or city on an intersection** — the corners where 2-3 hex edges meet.\n\nA **settlement** collects **1 resource** from each adjacent hex. A **city** collects **2 resources** per adjacent hex.",
    board_view: CATAN_BOARD,
    tip: 'Settlements and cities sit on intersections (corners), not on the hex tiles themselves. A good intersection touches 2-3 different resource types.',
  },
  {
    heading: 'Initial Placement',
    body: "Before the game begins, each player places pieces in turn order:\n\n**Round 1:** Each player places **1 settlement + 1 road** (in clockwise order).\n**Round 2:** Each player places **1 more settlement + 1 road** (in reverse order — last player goes first).\n\nYour second settlement's adjacent hexes give you your **starting resources** — collect 1 of each resource type touching that settlement.\n\nPlacement rules:\n- Settlements go on **intersections** (hex corners)\n- Roads go on **edges** (hex borders) and must connect to your settlement\n- The **Distance Rule**: no two settlements can be on adjacent intersections — there must be at least 2 edges between any two settlements",
    tip: 'Place your first settlement where you can access diverse resources. Brick + Lumber are critical early for roads and settlements.',
  },
  {
    heading: 'Roads & Building',
    body: "**Roads** are placed along the **edges** between hexes, connecting your settlements. You can only build new settlements along your road network.\n\nBuilding costs:\n- **Road**: 1 Brick + 1 Lumber — placed on a hex edge, must connect to your existing roads/settlements\n- **Settlement**: 1 Brick + 1 Lumber + 1 Wool + 1 Grain — placed on an intersection along your road, respecting the Distance Rule\n- **City**: 2 Grain + 3 Ore — replaces an existing settlement, doubling its resource output\n- **Development Card**: 1 Wool + 1 Grain + 1 Ore — drawn from the deck, kept secret",
    tip: 'Cities are powerful: a city on a hex that rolls frequently gives you 2 resources every time. Prioritize upgrading settlements on high-probability numbers (6 and 8).',
  },
  {
    heading: 'Your Turn',
    body: "On your turn, you do three things in order:\n\n1. **Roll the dice** — every player with a settlement or city adjacent to a matching hex collects resources (1 per settlement, 2 per city)\n2. **Trade** — swap resources with other players (any ratio you agree on) or with the bank at **4:1**. If you have a settlement on a **harbor**, you get better rates: **3:1** (any resource) or **2:1** (specific resource)\n3. **Build** — spend resources to build roads, settlements, cities, or buy development cards",
    tip: 'You can trade and build in any order, as many times as you want. Harbors on the coast give you huge trading advantages.',
  },
  {
    heading: 'Development Cards',
    body: "Development cards cost **1 Wool + 1 Grain + 1 Ore** and are drawn face-down. You can play **1 dev card per turn** (before or after rolling). Types:\n\n- **Knight** (14 cards) — move the Robber and steal a card. 3+ knights = **Largest Army** (2 VP)\n- **Road Building** (2) — place 2 free roads instantly\n- **Year of Plenty** (2) — take any 2 resources from the bank\n- **Monopoly** (2) — name a resource; every player gives you all of theirs\n- **Victory Point** (5) — worth 1 VP each, kept secret until you win",
    tip: 'Knights are the most common dev card and can swing the game via Largest Army. VP cards are revealed only when claiming victory.',
  },
  {
    heading: 'The Robber',
    body: "When a **7** is rolled, two things happen:\n\n1. Any player with **more than 7 resource cards** must discard half (rounded down)\n2. The player who rolled **moves the Robber** to any hex, **blocking it** from producing. They also steal 1 random resource card from a player with a settlement or city on that hex.\n\nYou can also move the Robber by playing a **Knight** development card.",
    board_view: {
      ...CATAN_BOARD,
      title: 'The Robber',
      highlight_cells: ['h10'],
    },
    tip: "Keep your hand at 7 or fewer cards. Hoarding resources makes you a target when 7 is rolled!",
  },
  {
    heading: 'Victory Points & Winning',
    body: "The first player to reach **10 victory points** on their turn wins!\n\n- **Settlement** = 1 VP\n- **City** = 2 VP\n- **Longest Road** (5+ continuous roads) = 2 VP\n- **Largest Army** (3+ knights played) = 2 VP\n- **VP development cards** = 1 VP each\n\nLongest Road and Largest Army can be **stolen** if another player surpasses your count.",
  },
  {
    heading: 'Board Legend',
    body: "Here's a quick reference for the shapes and symbols used on the board:\n\n**Hex tiles** — terrain tiles that produce resources when their number is rolled\n**Number tokens** — shown as circles with numbers inside each hex; the number that must be rolled for that hex to produce\n**△ Triangle** — settlement (1 VP, collects 1 resource per adjacent hex)\n**○ Circle** — the Robber pawn (blocks a hex from producing)\n**Roads** — placed on hex edges, connecting your settlements\n\n**Resource abbreviations:**\n- GRN = Grain (fields) — used for settlements, cities, dev cards\n- WOL = Wool (pastures) — used for settlements, dev cards\n- LBR = Lumber (forests) — used for roads, settlements\n- BRK = Brick (hills) — used for roads, settlements\n- ORE = Ore (mountains) — used for cities, dev cards",
    board_view: CATAN_BOARD,
  },
  {
    heading: "You're Ready to Play!",
    body: "That covers everything you need for your first game of Catan. Remember:\n\n- Tiles are placed **randomly** each game\n- Settlements go on **intersections**, roads on **edges**\n- Cities give **double resources**\n- Trade smart, build strategically, and watch out for the Robber!\n\nGood luck, settler!",
    tip: 'Your first game is about learning, not winning. Pay attention to which numbers roll most often — 6 and 8 are statistically the best.',
  },
];

export const WINGSPAN_STEPS: ContentStepPayload[] = [
  {
    heading: 'Welcome to Wingspan!',
    body: "Wingspan is a competitive bird-collection engine-building game for 1-5 players. You are bird enthusiasts seeking to attract the best birds to your wildlife preserves. Each bird you play extends a chain of powerful actions in one of your three habitats.",
    tip: 'Wingspan is a relaxing strategy game — there is no direct conflict between players.',
  },
  {
    heading: 'Setting Up',
    body: "**Shared supply:**\n- Shuffle the **bird deck** and place the **bird tray** (3 face-up birds)\n- Fill the **bird feeder** (dice tower) with 5 food dice\n- Set out the **egg supply** and place the **goal board** with 4 random end-of-round goal tiles\n\n**Per player:**\n- Take a **player mat**, **8 action cubes**, and **2 random bonus cards** (keep 1, discard 1)\n- Deal **5 bird cards** and **5 food tokens** (1 of each type)\n- You must discard down to a combined total of 5 — for each bird you keep, return 1 food token\n\nTap the habitats below to see what each row does.",
    is_setup_step: true,
    board_view: {
      ...WINGSPAN_BOARD,
      highlight_cells: ['f1', 'g1', 'w1'],
    },
    tip: 'The first column of each habitat shows the base action. Birds fill slots left to right, making each action stronger.',
  },
  {
    heading: 'Your Player Mat',
    body: "Your mat has **3 habitat rows**, each tied to a core action:\n\n- **Forest** (top row) — **Gain Food** from the bird feeder. Food is used to play birds.\n- **Grassland** (middle row) — **Lay Eggs** on your birds. Eggs are used to play birds into later slots and score 1 VP each at game end.\n- **Wetland** (bottom row) — **Draw Bird Cards** from the deck or the face-up tray.\n\nAs you place more birds in a row, that row's action becomes **more powerful** — you gain more food, eggs, or cards each time you use it.",
    board_view: WINGSPAN_BOARD,
  },
  {
    heading: 'The Bird Feeder',
    body: "The bird feeder is a dice tower with **5 custom food dice**. Each die face shows a food type: seeds, berries, fish, rodents, or invertebrates (one face is wild, giving you a choice of any food).\n\nWhen you take the **Gain Food** action, you pick dice from the feeder matching the food you need. The dice stay out until the feeder is empty or contains only one food type — then **reroll all dice** back into the feeder.\n\nBird cards list which food types they require. Some birds accept **wild** food (any type).",
    tip: 'Watch which food is available in the feeder before choosing your action. If only one type remains, a reroll is triggered.',
  },
  {
    heading: 'Playing a Bird',
    body: "To play a bird card from your hand:\n\n1. Choose the bird and check its **habitat icons** (which row it can go in)\n2. Pay the **food cost** shown on the card using tokens from your supply\n3. Pay **eggs** if the column requires them (columns 2-5 cost increasing eggs)\n4. Place the bird in the **leftmost open slot** of that habitat\n\nBirds have one of three power types:\n- **When Played** — activates once, immediately\n- **When Activated** — triggers each time you use that row's action (right-to-left)\n- **Once Between Turns** — activates on other players' turns when conditions are met",
    tip: 'Early game: play cheap birds that give good engine returns. A 0-cost bird in the Forest can start producing extra food immediately.',
  },
  {
    heading: 'Taking Actions',
    body: "On your turn, you perform **one action** by placing an action cube:\n\n- **Play a Bird** — pay food (and eggs if needed) to add a bird to a habitat\n- **Gain Food** — place cube in the Forest row, then activate all bird powers in that row from right-to-left\n- **Lay Eggs** — place cube in the Grassland row, then activate bird powers right-to-left\n- **Draw Cards** — place cube in the Wetland row, then activate bird powers right-to-left\n\nYou start with **8 action cubes** in round 1. At the end of each round, you lose 1 cube to the goal board, so you have 7, 6, and 5 cubes in rounds 2-4.",
  },
  {
    heading: 'Rounds & End-of-Round Goals',
    body: "The game lasts **4 rounds**. At the end of each round:\n\n1. All players remove their action cubes from the mat\n2. Score the **end-of-round goal** for that round (e.g., \"most eggs in the Grassland\" or \"most birds with a bowl nest\")\n3. Place 1 action cube on the goal board (scoring side up or not), reducing your cubes for the next round\n\nThere are 4 public goals — one scored per round. In competitive mode, only the player with the most scores the full points. In the gentler \"green\" side, everyone scores based on their count.",
    tip: 'Keep an eye on the end-of-round goals. Timing when you pursue them (vs. building your engine) is key to winning.',
  },
  {
    heading: 'Scoring',
    body: "At the end of round 4, add up:\n\n- **Bird VP** — points printed on each bird card you played\n- **Bonus Card** — your secret goal (e.g., \"birds that eat fish\")\n- **End-of-Round Goals** — points from the 4 public objectives\n- **Eggs** — 1 VP per egg on your birds\n- **Cached Food** — 1 VP per food token stored on birds (from certain bird powers)\n- **Tucked Cards** — 1 VP per card tucked under birds (from certain bird powers)\n\nHighest total wins. Tie-breaker: most unused food tokens.",
    tip: 'Most points come from birds themselves and bonus cards. Eggs and tucked cards are steady supplementary income.',
  },
  {
    heading: "You're Ready to Fly!",
    body: "You know enough to play your first game of Wingspan. A few final tips:\n\n- Read bird card powers carefully — some are incredibly strong combinations\n- The face-up bird tray refreshes when cards are taken; check it before drawing blind\n- Don't neglect eggs — you need them for later bird slots and they're worth VP\n\nGood luck, bird watcher!",
    tip: 'Focus on building one habitat in your first game to see how the engine grows.',
  },
];

export const CODENAMES_STEPS: ContentStepPayload[] = [
  {
    heading: 'Welcome to Codenames!',
    body: "Codenames is a party word game for **4+ players** (best with 6-8). Two teams compete to find their secret agents hidden behind code words on a 5×5 grid. One player on each team is the **Spymaster** who gives one-word clues to guide their team.",
    tip: 'Works with 4 players (2v2) but shines with larger groups. There are also 2-3 player cooperative variants.',
  },
  {
    heading: 'Setting Up',
    body: "1. Shuffle the **word cards** and lay out **25** in a 5×5 grid — these are visible to everyone\n2. Split into two teams — **Red** and **Blue**\n3. Each team selects a **Spymaster** who sits on one side; the rest are **field operatives** on the other side\n4. Draw a random **key card** and place it in the stand between Spymasters — only they can see it\n\nThe key card shows which words belong to which team, which are neutral, and which is the assassin.\n\nThe team indicated by the **border color of the key card** goes first and has **9 agents** to find. The other team has **8**.",
    is_setup_step: true,
    board_view: CODENAMES_BOARD,
    tip: 'Tap the words to see which team they belong to. In a real game, only Spymasters can see this.',
  },
  {
    heading: 'The Word Grid',
    body: "The 25 words hide:\n\n- **9 agents** for the starting team (the team that goes first)\n- **8 agents** for the other team\n- **7 innocent bystanders** (neutral)\n- **1 Assassin** (instant loss if guessed!)\n\nOnly the Spymasters know which words are which. Field operatives see only the words — no colors. The Spymasters' job is to lead their team to the right words without accidentally revealing opponents or the Assassin.",
    board_view: {
      ...CODENAMES_BOARD,
      title: 'Key Card View (Spymaster)',
      highlight_cells: ['c13'],
    },
    tip: 'The starting team has more agents (9 vs 8) to compensate for going first. The Assassin (dark) is the most dangerous card.',
  },
  {
    heading: 'Giving Clues',
    body: "On your turn, the **Spymaster** says exactly two things:\n\n- **One word** (the clue)\n- **One number** (how many grid words relate to it)\n\nExample: \"**Fruit, 2**\" might connect APPLE and LEMON.\n\n**Clue rules:**\n- Must be a single English word (no phrases, no hyphens unless it's a common compound)\n- Cannot be any word currently visible on the grid\n- Cannot be a different form of a grid word (e.g., can't say \"FIRED\" if FIRE is on the grid)\n- The Spymaster must keep a **straight face** — no gestures, tone hints, or reactions\n\n**Special numbers:**\n- **0** — means \"none of our words relate to this clue\" (lets your team guess freely from past clues)\n- **Unlimited** — at least 1 word relates, but your team can keep guessing as long as they want",
  },
  {
    heading: 'Guessing',
    body: "After the Spymaster gives a clue, their team discusses openly and **touches one word card** at a time to guess. The Spymaster covers it with the matching color card:\n\n- **Your team's agent** — correct! You may keep guessing (up to the number + 1)\n- **Innocent bystander** (neutral) — your turn ends immediately\n- **Opponent's agent** — your turn ends AND you helped the other team by revealing one of their agents\n- **Assassin** — your team **loses the game immediately**\n\nYou **must make at least 1 guess** per turn, but you can **stop guessing voluntarily** at any time after that. Stopping is often smart when you're unsure.",
    tip: "If you're not confident about a guess, stop. Hitting the Assassin loses the entire game. Hitting an opponent's word is almost as bad.",
  },
  {
    heading: 'Winning',
    body: "The game ends when:\n\n- A team **finds all their agents** — that team wins!\n- A team **guesses the Assassin** — that team loses immediately\n\nThere is no set number of rounds. Teams alternate turns until one of the above happens.\n\n**Strategy tips for Spymasters:**\n- Start with clues that connect 2-3 words safely\n- Avoid clues that could point to the Assassin\n- Consider what the opposing Spymaster might be thinking\n\n**Strategy tips for operatives:**\n- Think about why the Spymaster chose *that specific* word\n- Discuss openly — your Spymaster can hear you, which helps them plan future clues\n- When in doubt, stop guessing and let the Spymaster give a better clue next turn",
    tip: 'The starting team (9 agents) has a slight disadvantage despite going first, because they have more words to find. Bold 3-word clues can turn the game.',
  },
  {
    heading: "You're Ready to Play!",
    body: "That's everything for Codenames. A few final notes:\n\n- **Timer** (optional): some groups use a sand timer to prevent overthinking. Not required but keeps the pace up.\n- **Spymaster patience**: the hardest part is watching your team debate and staying poker-faced!\n- **Rematches**: swap Spymasters between games so everyone gets a turn giving clues.\n\nFind your teams, pick your Spymasters, and start guessing!",
    tip: 'First game? Keep clues simple — connecting just 2 words is perfectly fine. You\'ll naturally get bolder as you play more.',
  },
];

// ─── Cooking Demo ────────────────────────────────────────────────────────────

export const COOKING_STEPS: ContentStepPayload[] = [
  {
    heading: 'Classic Pasta Aglio e Olio',
    body: "This Roman classic uses just **6 ingredients** and takes 20 minutes. It's proof that simplicity is the ultimate sophistication in cooking.\n\nYou'll learn knife technique, timing pasta, and building flavour from garlic and olive oil alone.",
    tip: 'Use the best olive oil you can afford — it\'s the star of this dish.',
  },
  {
    heading: 'Ingredients & Prep',
    body: "**Ingredients (serves 2):**\n\n- 200g spaghetti\n- 4 cloves garlic, thinly sliced\n- 60ml extra-virgin olive oil\n- 1/2 tsp red chilli flakes\n- Small bunch flat-leaf parsley, chopped\n- Salt (for pasta water)\n\n**Prep:**\n1. Bring a large pot of water to a rolling boil and salt generously (it should taste like the sea)\n2. Thinly slice garlic — aim for even, paper-thin slices so they cook uniformly\n3. Chop parsley (stems are fine — they have great flavour)",
    is_setup_step: true,
    tip: 'Slice garlic with a sharp knife, not a press. Pressed garlic burns too quickly.',
  },
  {
    heading: 'Cook the Pasta',
    body: "Drop spaghetti into boiling salted water. Cook for **1 minute less** than the packet says (al dente).\n\n**Critical:** Before draining, save a mug (about 250ml) of the starchy pasta water. This is your secret sauce-builder — the starch helps emulsify the oil into a silky coating.\n\nDrain the pasta but do NOT rinse it.",
    tip: 'Starchy pasta water is liquid gold. It binds oil and water into a creamy emulsion without any cream.',
  },
  {
    heading: 'Build the Sauce',
    body: "While pasta cooks:\n\n1. Heat olive oil in a large pan over **medium-low** heat\n2. Add sliced garlic and cook gently for **2-3 minutes**, stirring often\n3. The garlic should turn **pale gold** — never brown or it turns bitter\n4. Add chilli flakes, stir for 30 seconds\n5. Remove from heat immediately\n\nThe residual heat will finish cooking the garlic without burning it.",
    tip: 'Low and slow is the rule. If garlic starts browning, immediately add a splash of pasta water to stop the cooking.',
  },
  {
    heading: 'Bring It Together',
    body: "1. Return the pan to **medium heat**\n2. Add drained pasta directly to the garlic oil\n3. Add **3-4 tablespoons** of reserved pasta water\n4. Toss vigorously for 60 seconds — the water and oil should combine into a glossy, creamy coating\n5. Add parsley and toss again\n6. Taste and adjust salt\n\nServe immediately on warm plates.",
    interactive: {
      type: 'multiple_choice',
      question: 'Why do we save pasta water?',
      options: [
        { label: 'To dilute the sauce if too thick', correct: false },
        { label: 'The starch emulsifies oil into a silky coating', correct: true },
        { label: 'To keep the pasta from sticking', correct: false },
      ],
      explanation: 'Pasta water contains starch that acts as an emulsifier, binding oil and water into a creamy sauce without adding cream or butter.',
    },
  },
  {
    heading: 'You\'re a Chef!',
    body: "That's aglio e olio — one of the simplest and most satisfying pasta dishes in existence.\n\n**Keys to remember:**\n- Salt your water generously\n- Slice garlic thin and cook low & slow\n- Save that pasta water\n- Toss vigorously to emulsify\n\nPair with a simple green salad and crusty bread. Buon appetito!",
  },
];

// ─── Software Demo ───────────────────────────────────────────────────────────

export const SOFTWARE_STEPS: ContentStepPayload[] = [
  {
    heading: 'Build a REST API with Express',
    body: "In this tutorial you'll build a complete REST API from scratch using **Node.js** and **Express**. By the end, you'll have a working CRUD API for a todo list.\n\nPrerequisites: Node.js installed, basic JavaScript knowledge.",
    tip: 'Make sure you have Node.js 18+ installed. Run `node --version` to check.',
  },
  {
    heading: 'Project Setup',
    body: "Create a new directory and initialise your project:",
    code_block: {
      language: 'bash',
      filename: 'terminal',
      code: 'mkdir todo-api && cd todo-api\nnpm init -y\nnpm install express',
    },
    tip: 'The -y flag accepts all defaults for package.json. You can edit it later.',
  },
  {
    heading: 'Create the Server',
    body: "Create an `index.js` file with the basic Express server:",
    code_block: {
      language: 'javascript',
      filename: 'index.js',
      code: "const express = require('express');\nconst app = express();\nconst PORT = 3000;\n\napp.use(express.json());\n\nlet todos = [];\nlet nextId = 1;\n\napp.listen(PORT, () => {\n  console.log(`Server running on http://localhost:${PORT}`);\n});",
    },
  },
  {
    heading: 'Add CRUD Routes',
    body: "Now add the four essential operations — **C**reate, **R**ead, **U**pdate, **D**elete:",
    code_block: {
      language: 'javascript',
      filename: 'index.js',
      code: "// GET all todos\napp.get('/todos', (req, res) => {\n  res.json(todos);\n});\n\n// POST a new todo\napp.post('/todos', (req, res) => {\n  const { title } = req.body;\n  if (!title) return res.status(400).json({ error: 'Title required' });\n  const todo = { id: nextId++, title, done: false };\n  todos.push(todo);\n  res.status(201).json(todo);\n});\n\n// PATCH toggle done\napp.patch('/todos/:id', (req, res) => {\n  const todo = todos.find(t => t.id === Number(req.params.id));\n  if (!todo) return res.status(404).json({ error: 'Not found' });\n  todo.done = !todo.done;\n  res.json(todo);\n});\n\n// DELETE a todo\napp.delete('/todos/:id', (req, res) => {\n  todos = todos.filter(t => t.id !== Number(req.params.id));\n  res.status(204).end();\n});",
    },
  },
  {
    heading: 'Test Your API',
    body: "Start the server and test with curl:",
    code_block: {
      language: 'bash',
      filename: 'terminal',
      code: "# Start the server\nnode index.js\n\n# Create a todo\ncurl -X POST http://localhost:3000/todos \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"title\": \"Learn Express\"}'\n\n# List all todos\ncurl http://localhost:3000/todos\n\n# Toggle done\ncurl -X PATCH http://localhost:3000/todos/1\n\n# Delete\ncurl -X DELETE http://localhost:3000/todos/1",
    },
    interactive: {
      type: 'multiple_choice',
      question: 'What HTTP status code should a successful DELETE return?',
      options: [
        { label: '200 OK', correct: false },
        { label: '204 No Content', correct: true },
        { label: '202 Accepted', correct: false },
        { label: '301 Moved Permanently', correct: false },
      ],
      explanation: '204 No Content is the standard response for a successful DELETE — the resource is gone and there\'s nothing to return in the body.',
    },
  },
  {
    heading: 'You Built an API!',
    body: "Congratulations! You now have a working REST API. Here's what you learned:\n\n- **Express setup** with `express.json()` middleware\n- **Route handlers** for GET, POST, PATCH, DELETE\n- **Status codes** for different response types\n- **Request parsing** from body and URL params\n\n**Next steps:**\n- Add a database (SQLite or PostgreSQL)\n- Add input validation (try `zod`)\n- Add error handling middleware\n- Deploy to Railway or Fly.io",
  },
];

// ─── DIY Demo ────────────────────────────────────────────────────────────────

export const DIY_STEPS: ContentStepPayload[] = [
  {
    heading: 'Build a Floating Shelf',
    body: "A floating shelf gives any room a clean, modern look. This beginner-friendly project takes **1-2 hours** and requires only basic tools.\n\nThe secret to a truly \"floating\" look is a hidden French cleat — no visible brackets.",
    tip: 'This project works best on drywall with studs, or solid masonry. Avoid plasterboard-only mounting for heavy items.',
  },
  {
    heading: 'Materials & Tools',
    body: "**Materials:**\n- 1× hardwood board (900mm × 200mm × 25mm)\n- 1× French cleat strip (or make one from a 45° ripped board)\n- 4× wall screws (75mm) + wall plugs if needed\n- Wood glue, sandpaper (120 & 220 grit)\n- Wood finish (oil, wax, or polyurethane)\n\n**Tools:**\n- Drill/driver + drill bits\n- Level (spirit or laser)\n- Stud finder\n- Saw (mitre saw or hand saw)\n- Measuring tape & pencil\n- Clamps (optional but helpful)",
    is_setup_step: true,
  },
  {
    heading: 'Prepare the Shelf',
    body: "1. **Sand** the board — start with 120 grit to remove roughness, then 220 grit for a smooth finish\n2. **Round the edges** slightly with sandpaper for a polished look\n3. **Apply finish** — 2 coats of oil or poly with light sanding between coats\n4. Let dry fully (follow the finish manufacturer's time)\n\nWhile drying, move on to mounting the cleat.",
    tip: 'Always sand WITH the grain, never against it. Cross-grain sanding leaves visible scratches under finish.',
  },
  {
    heading: 'Mount the Cleat',
    body: "1. Use a **stud finder** to locate wall studs and mark them with pencil\n2. Hold the cleat strip against the wall at your desired shelf height\n3. Use a **level** to ensure it's perfectly horizontal — mark screw holes\n4. Drill pilot holes into studs (or use wall plugs for masonry)\n5. Screw the cleat securely — it must hold the shelf weight plus whatever you place on it\n\n**Test:** hang your full body weight on it briefly. If it holds you, it'll hold books.",
    interactive: {
      type: 'multiple_choice',
      question: 'Why is finding wall studs important?',
      options: [
        { label: 'Studs are where electrical wires run', correct: false },
        { label: 'Screws into studs hold much more weight than drywall alone', correct: true },
        { label: 'It looks better if screws are evenly spaced', correct: false },
      ],
      explanation: 'Drywall alone can only hold a few kilograms. Screwing into wooden studs provides 10-50× more holding strength.',
    },
  },
  {
    heading: 'Hang the Shelf',
    body: "1. Slot the shelf onto the wall cleat — the matching 45° angles should lock together\n2. Check level one more time\n3. If there's any wobble, add a small wedge or adhesive pad\n4. Step back and admire your work!\n\n**Loading guidelines:**\n- 25mm hardwood on 2 studs: safely holds ~20kg\n- Don't concentrate all weight at one end\n- For heavy books, keep items toward the wall side",
  },
  {
    heading: 'Your Shelf is Complete!',
    body: "You've built a professional-looking floating shelf with no visible hardware.\n\n**Key takeaways:**\n- French cleats provide strong, hidden mounting\n- Always locate studs for heavy loads\n- Proper sanding + finishing makes cheap wood look expensive\n- A level is your best friend for any wall-mounting project\n\nTry building a set of 3 at different heights for a staggered display wall!",
  },
];

// ─── Music Demo ──────────────────────────────────────────────────────────────

export const MUSIC_STEPS: ContentStepPayload[] = [
  {
    heading: 'Learn Your First 4 Chords',
    body: "With just **4 chords** you can play hundreds of popular songs on guitar or piano. This tutorial covers the **I-V-vi-IV progression** in the key of G.\n\nThe chords: **G — D — Em — C**",
    tip: 'These same 4 chords (in different keys) are behind songs from The Beatles to Ed Sheeran to Taylor Swift.',
  },
  {
    heading: 'G Major',
    body: "**Guitar:**\n- 1st finger: 2nd fret, A string\n- 2nd finger: 3rd fret, low E string\n- 3rd finger: 3rd fret, high E string\n- Strum all 6 strings\n\n**Piano:**\n- Play G, B, D together (right hand)\n- G in the bass (left hand)\n\nPractice strumming/playing this chord cleanly 8 times before moving on.",
  },
  {
    heading: 'D Major',
    body: "**Guitar:**\n- 1st finger: 2nd fret, G string\n- 2nd finger: 2nd fret, high E string\n- 3rd finger: 3rd fret, B string\n- Strum strings 4-1 only (skip low E and A)\n\n**Piano:**\n- Play D, F#, A together\n- D in the bass\n\nSwitch between G and D until the transition is smooth.",
  },
  {
    heading: 'E Minor',
    body: "**Guitar (the easiest chord!):**\n- 1st finger: 2nd fret, A string\n- 2nd finger: 2nd fret, D string\n- Strum all 6 strings\n\n**Piano:**\n- Play E, G, B together\n- E in the bass\n\nNotice how this chord sounds sadder/darker than G and D. That contrast creates emotion in music.",
    interactive: {
      type: 'multiple_choice',
      question: 'What makes a minor chord sound "sad"?',
      options: [
        { label: 'It uses fewer notes', correct: false },
        { label: 'The middle note (3rd) is lowered by a half step', correct: true },
        { label: 'It\'s played more quietly', correct: false },
      ],
      explanation: 'A minor chord has a flattened 3rd — E minor uses G (natural) instead of G# that E major would use. This half-step creates the melancholic sound.',
    },
  },
  {
    heading: 'C Major',
    body: "**Guitar:**\n- 1st finger: 1st fret, B string\n- 2nd finger: 2nd fret, D string\n- 3rd finger: 3rd fret, A string\n- Strum strings 5-1 (skip low E)\n\n**Piano:**\n- Play C, E, G together\n- C in the bass\n\nC is the trickiest guitar shape here — practice the stretch!",
  },
  {
    heading: 'Put It Together!',
    body: "Now play the full progression:\n\n**G → D → Em → C** (repeat)\n\nTiming: 4 beats (strums) per chord, steady tempo.\n\n**Songs you can now play:**\n- \"Let It Be\" — The Beatles\n- \"No Woman No Cry\" — Bob Marley\n- \"Someone Like You\" — Adele (capo 2)\n- \"With or Without You\" — U2\n- \"Riptide\" — Vance Joy\n\nStart slow (60 BPM), focus on clean chord changes, then gradually speed up.",
    tip: 'Use a metronome app! Speed means nothing without good timing. Clean and slow beats fast and sloppy every time.',
  },
];

// ─── Sports Demo ─────────────────────────────────────────────────────────────

export const SPORTS_STEPS: ContentStepPayload[] = [
  {
    heading: 'Offside Rule Explained',
    body: "The offside rule is football's most misunderstood law. This tutorial will make it click in **5 minutes**.\n\nBy the end, you'll be able to spot offside calls (and bad ones) while watching matches.",
  },
  {
    heading: 'The Basic Rule',
    body: "A player is in an **offside position** when:\n\n1. They are in the **opponent's half** of the pitch\n2. They are **closer to the opponent's goal line** than both the ball AND the **second-to-last defender**\n\nBeing in an offside position is NOT an offence by itself. It only becomes an offence when you're **involved in active play** from that position.",
    tip: 'The goalkeeper usually counts as one of the two defenders. So "second-to-last defender" typically means the last outfield player.',
  },
  {
    heading: 'When Is It Judged?',
    body: "Offside position is judged at the **exact moment the ball is played** by a teammate — not when you receive it.\n\nThis means:\n- You CAN run from onside to offside after the ball is kicked (not offside)\n- You CANNOT stand offside and wait for the ball, even if you move onside before receiving it\n\nThe key frame is: **where were you when your teammate's foot touched the ball?**",
    interactive: {
      type: 'multiple_choice',
      question: 'A striker is behind the last defender when the pass is made, but runs back onside before receiving the ball. Is this offside?',
      options: [
        { label: 'Yes — position at the moment of the pass is what counts', correct: true },
        { label: 'No — they were onside when they received it', correct: false },
        { label: 'Only if the referee sees it', correct: false },
      ],
      explanation: 'Offside is always judged at the moment the ball is played by the teammate, regardless of where the receiver is when they actually get the ball.',
    },
  },
  {
    heading: 'Exceptions',
    body: "You **cannot** be offside from:\n\n- A **goal kick**\n- A **throw-in**\n- A **corner kick**\n\nYou also cannot be offside if:\n- You are in **your own half** when the ball is played\n- You receive the ball **directly** from an opponent (deflection, deliberate play)\n- You are **level** with the second-to-last defender (level = onside)",
  },
  {
    heading: 'Active Involvement',
    body: "Being offside only matters if you're **actively involved** in play by:\n\n- **Interfering with play:** touching or playing the ball\n- **Interfering with an opponent:** blocking their line of sight or movement\n- **Gaining an advantage:** receiving the ball from a rebound off the post, crossbar, or defender when you were in an offside position\n\nIf you stand offside but don't affect the play at all, no offence is called.",
  },
  {
    heading: 'You Get It Now!',
    body: "**Quick summary:**\n\n1. Offside = in opponent's half + ahead of second-last defender + at the moment ball is played by teammate\n2. Must be actively involved to be penalised\n3. Not offside from goal kicks, throw-ins, or corners\n4. Level with defender = onside\n\nNext time you watch a match, watch the defensive line at the moment of each pass. You'll start spotting offside before the flag goes up!",
  },
];

// ─── Science Demo ────────────────────────────────────────────────────────────

export const SCIENCE_STEPS: ContentStepPayload[] = [
  {
    heading: 'How Batteries Work',
    body: "Every phone, laptop, and electric car runs on batteries — but how do they actually produce electricity? This tutorial explains the chemistry and physics behind batteries in plain language.\n\nBy the end, you'll understand why batteries die, why some are rechargeable, and why lithium is so popular.",
    tip: 'A battery is just a controlled chemical reaction that pushes electrons through a wire.',
  },
  {
    heading: 'The Three Parts',
    body: "Every battery has exactly **3 components**:\n\n- **Anode** (negative terminal) — the electrode that gives up electrons\n- **Cathode** (positive terminal) — the electrode that accepts electrons\n- **Electrolyte** — a substance (liquid or solid) that allows ions to move between the electrodes, but NOT electrons\n\nThe key insight: electrons can't travel through the electrolyte, so they're forced to take the long way around — through your device's circuit. That flow of electrons IS the electrical current.",
    interactive: {
      type: 'multiple_choice',
      question: 'Why can\'t electrons travel through the electrolyte?',
      options: [
        { label: 'The electrolyte is too hot', correct: false },
        { label: 'The electrolyte only conducts ions, not electrons', correct: true },
        { label: 'The electrons are too heavy', correct: false },
      ],
      explanation: 'The electrolyte is designed to conduct ions (charged atoms) but block electron flow. This forces electrons through the external circuit — your device — creating useful current.',
    },
  },
  {
    heading: 'The Chemical Reaction',
    body: "Here's what happens inside an alkaline AA battery:\n\n1. At the **anode** (zinc), a chemical reaction releases electrons: Zn → Zn²⁺ + 2e⁻\n2. These electrons flow through the wire (powering your device)\n3. At the **cathode** (manganese dioxide), electrons are absorbed: 2MnO₂ + H₂O + 2e⁻ → Mn₂O₃ + 2OH⁻\n4. Ions move through the electrolyte to balance the charge\n\n**Why batteries die:** The anode material gets consumed. Once the zinc is fully oxidised, no more electrons can be released. The reaction stops.",
    tip: 'Think of the anode as a fuel tank. When the fuel (zinc) runs out, the battery is dead.',
  },
  {
    heading: 'Rechargeable vs Disposable',
    body: "**Disposable (primary) batteries:**\n- Chemical reaction is one-way\n- Once reactants are consumed, it's over\n- Examples: alkaline (AA, AAA), zinc-carbon\n\n**Rechargeable (secondary) batteries:**\n- Chemical reaction is **reversible**\n- Applying external voltage pushes electrons back, restoring the anode\n- Examples: lithium-ion, NiMH, lead-acid\n\n**Why lithium?** Lithium is the lightest metal and has the highest electrochemical potential — meaning more energy per gram than any other element. That's why your phone battery is so light yet lasts all day.",
  },
  {
    heading: 'Battery Degradation',
    body: "Rechargeable batteries don't last forever. Each charge cycle causes:\n\n- **SEI growth** — a thin film builds on the anode, consuming lithium ions\n- **Dendrite formation** — spiky lithium crystals grow and can short-circuit the cell\n- **Cathode cracking** — repeated expansion/contraction fractures the electrode\n\nThis is why your phone holds less charge after 2-3 years. Typical lithium-ion batteries retain ~80% capacity after **500 full cycles**.\n\n**Tips to extend battery life:**\n- Keep charge between 20-80% when possible\n- Avoid extreme heat (degrades electrolyte)\n- Slow charging is gentler than fast charging",
  },
  {
    heading: 'Now You Know!',
    body: "**Summary:**\n\n- Batteries convert chemical energy to electrical energy\n- Anode releases electrons, cathode absorbs them\n- The electrolyte forces electrons through your circuit\n- Rechargeable batteries reverse the reaction with external power\n- Lithium dominates because it's light and energy-dense\n- All batteries degrade over time due to physical/chemical wear\n\nNext time your phone dies, you'll know exactly what happened at the atomic level!",
  },
];

// ─── Ticket to Ride Demo ────────────────────────────────────────────────────

export const TTR_STEPS: ContentStepPayload[] = [
  {
    heading: 'Welcome to Ticket to Ride!',
    body: "Ticket to Ride is one of the most popular board games in the world — a gateway classic for 2-5 players. You'll claim railway routes across the map by collecting and playing matching train cards, racing to complete secret destination tickets before anyone else.\n\nThis tutorial covers the **USA map** (the original). Once you know this, every version plays similarly.",
    tip: "Games take about 45-60 minutes. The rules are simple enough for age 8+, but the strategy has real depth.",
  },
  {
    heading: 'Setting Up',
    body: "**Board:** Lay out the map in the centre of the table. It shows cities connected by coloured routes (1-6 train cars long).\n\n**Per player:**\n- Take **45 plastic train cars** and a matching **scoring marker** (place on 0)\n- Draw **4 train cards** from the deck\n- Draw **3 Destination Ticket cards** — keep at least 2, return unwanted ones to the bottom of the deck\n\n**Shared supply:**\n- Shuffle the **train card deck** and deal **5 face-up** next to it\n- Shuffle the **Destination Ticket deck** and place it nearby",
    is_setup_step: true,
    tip: "When choosing your starting tickets, look for destinations that overlap — two tickets that share a common middle city let you score both efficiently.",
  },
  {
    heading: 'Train Cards',
    body: "The deck contains **110 train cards** in 8 colours plus **14 Locomotives** (wild/rainbow cards).\n\nEach colour matches a route colour on the board. **Grey routes** can be claimed with any single colour.\n\nTo claim a route, you play cards matching the route's colour equal to its length:\n- A **3-long blue route** needs 3 blue cards\n- A **5-long grey route** needs 5 cards of any ONE colour\n- **Locomotives are wild** — they substitute for any colour\n\nThe 5 face-up cards are always visible, so you can plan ahead based on what's available.",
    interactive: {
      type: 'multiple_choice',
      question: 'To claim a 4-long red route, which combination works?',
      options: [
        { label: '2 red + 2 blue cards', correct: false },
        { label: '3 red + 1 locomotive', correct: true },
        { label: '4 cards of any mixed colours', correct: false },
        { label: '2 red + 2 locomotives + 1 extra', correct: false },
      ],
      explanation: 'All non-locomotive cards must be the SAME colour matching the route. Locomotives are wild and substitute for any colour, so 3 red + 1 locomotive = 4 red-equivalent cards.',
    },
  },
  {
    heading: 'Your Turn — 3 Options',
    body: "On your turn, do **exactly one** of these three actions:\n\n**1. Draw Train Cards** — take 2 cards:\n- Draw from the **5 face-up cards** or the **top of the deck** (blind draw)\n- If you take a face-up **Locomotive**, that's your entire turn (only 1 card)\n- Blind-drawn locomotives are free — you still get your second draw\n- Replace face-up cards immediately after each pick\n\n**2. Claim a Route** — play matching cards to claim a route:\n- Discard the required cards face-up\n- Place your trains on every space of that route\n- Score points immediately (see scoring chart)\n- Each route can only be claimed **once** (in 2-3 player games, double routes are treated as single)\n\n**3. Draw Destination Tickets** — draw 3, keep at least 1:\n- These are secret objectives worth bonus points if completed\n- Uncompleted tickets **subtract** their value at game end!",
    tip: "Drawing destination tickets mid-game is risky but can be hugely rewarding. Only do it when you've nearly finished your current tickets and have trains to spare.",
  },
  {
    heading: 'Route Scoring',
    body: "Longer routes score exponentially more points:\n\n- **1 car** = 1 point\n- **2 cars** = 2 points\n- **3 cars** = 4 points\n- **4 cars** = 7 points\n- **5 cars** = 10 points\n- **6 cars** = 15 points\n\nThis means a single 6-car route is worth more than six 1-car routes (15 vs 6). **Claiming long routes is critical for scoring well.**",
    tip: "The 6-long routes (like LA to El Paso, or Duluth to Helena) are hugely valuable at 15 points each. Prioritise them when they fit your tickets.",
  },
  {
    heading: 'Destination Tickets',
    body: "Each Destination Ticket shows **two cities** and a **point value** (e.g., \"Los Angeles to New York — 21 points\").\n\n- If you connect those two cities with a **continuous chain of your routes** by game end, you score the ticket's points\n- If you **fail** to connect them, you **lose** that many points\n- You must keep tickets secret until end-game scoring\n- Longer-distance tickets are worth more but harder to complete\n\n**Key insight:** Your routes don't have to be a direct path — any connected chain of your claimed routes counts.",
    interactive: {
      type: 'multiple_choice',
      question: 'You drew a ticket for "Seattle to Denver" but it looks hard to complete. What happens if you keep it and fail?',
      options: [
        { label: 'Nothing — uncompleted tickets are ignored', correct: false },
        { label: 'You lose the ticket\'s point value from your score', correct: true },
        { label: 'You lose half the ticket\'s value', correct: false },
      ],
      explanation: 'Uncompleted Destination Tickets are subtracted from your final score. This is why you should only keep tickets you\'re confident you can finish — especially mid-game draws.',
    },
  },
  {
    heading: 'Game End & Final Scoring',
    body: "The end is triggered when any player reaches **2 or fewer trains remaining**. Every player (including the trigger player) gets **one final turn**.\n\nFinal scoring:\n1. **Route points** — already scored during the game\n2. **Completed Destination Tickets** — add their value\n3. **Failed Destination Tickets** — subtract their value\n4. **Longest Continuous Path** — the player with the longest single unbroken chain of routes scores a **10-point bonus**\n\nHighest total wins. Tiebreaker: most completed Destination Tickets.",
    tip: "Keep an eye on opponents' train supplies. When someone is running low, the end is near — make sure your tickets are connected!",
  },
  {
    heading: 'Strategy — Route Selection',
    body: "Good route strategy separates beginners from winners:\n\n**Prioritise long routes early.** 5 and 6-car routes give disproportionate points and are contested. Claim them before opponents block you.\n\n**Build from the centre outward.** Routes through Denver, Chicago, and Nashville are high-traffic. Securing central routes early gives you flexibility to extend in any direction.\n\n**Watch for bottlenecks.** Some city pairs have only one route between them. If your ticket depends on a single-route bottleneck, claim it before someone else does.\n\n**Grey routes are flexible.** Save your colour-specific cards for coloured routes; use grey routes when you have surplus of any colour.",
  },
  {
    heading: 'Strategy — Card Management',
    body: "How you draw cards matters as much as which routes you claim:\n\n**Locomotives are powerful but expensive.** Taking a face-up locomotive costs your whole turn (1 card instead of 2). Only do it when you genuinely need it for a specific route.\n\n**Hoard one colour.** Accumulating 5-6 of one colour lets you claim a long route in one turn, giving opponents no time to block.\n\n**Watch opponent draws.** If someone keeps taking green cards, they're probably eyeing a green route. Consider claiming it first or preparing a backup plan.\n\n**Know when to stop drawing.** If you have enough cards to claim your target route, do it. Waiting risks someone else taking it.",
    tip: "The face-up display is public information. Count what opponents take — it tells you their plans.",
  },
  {
    heading: 'Strategy — Ticket Management',
    body: "Tickets are where games are won or lost:\n\n**Overlap is king.** Two tickets like \"Seattle to Denver\" and \"Portland to Salt Lake City\" share most of their path. Completing both costs only slightly more than one.\n\n**Short tickets late game.** Drawing new tickets when you have 5+ trains left can be safe if you pick short-distance tickets you can complete with existing routes.\n\n**Never keep a ticket you can't finish.** A -21 penalty for failing \"LA to New York\" wipes out multiple claimed routes. Be honest about what's achievable with your remaining trains.\n\n**Bluff your destinations.** Claim a few routes in directions you don't need. This prevents opponents from deducing your tickets and blocking you.",
  },
  {
    heading: 'Common Mistakes to Avoid',
    body: "**1. Ignoring the train count.** You only have 45 trains. Every 1-car route costs the same precious train as part of a 6-car route. Don't waste trains on low-value short routes unless they connect your tickets.\n\n**2. Drawing too many tickets.** Two well-chosen starting tickets are often enough. Each additional ticket is a commitment of 5-15 trains.\n\n**3. Tunnel vision on one route.** If your planned route gets blocked, have a backup. Being flexible with alternative paths is more important than a perfect plan.\n\n**4. Forgetting the Longest Path bonus.** 10 points is significant. Try to build your routes in a continuous chain rather than scattered segments.\n\n**5. Revealing your plans.** Building an obvious straight line from coast to coast tells everyone your destination. Mix in some misdirection.",
    tip: "The winner usually completes 2-3 tickets, claims 2-3 long routes, and connects them into the Longest Path. That's the recipe.",
  },
  {
    heading: "You're Ready to Ride!",
    body: "That's everything you need for Ticket to Ride. Quick summary:\n\n- **Draw cards** or **claim routes** or **draw tickets** each turn\n- **Longer routes** score exponentially more\n- **Complete tickets** for huge bonuses, but failed ones hurt\n- **Longest Path** bonus (10 points) rewards connected play\n- **Watch your train supply** — the game ends fast when someone runs low\n\nRemember: the best strategy is flexible routes that serve multiple tickets at once. Happy travels!",
    tip: "Your first game will feel rushed — that's normal. You'll learn how quickly 45 trains disappear and plan better next time.",
  },
];

// ─── Pandemic Demo ──────────────────────────────────────────────────────────

export const PANDEMIC_STEPS: ContentStepPayload[] = [
  {
    heading: 'Welcome to Pandemic!',
    body: "Pandemic is the most famous **cooperative** board game ever made. You and 1-3 teammates are elite disease specialists fighting to cure **4 deadly diseases** spreading across the globe.\n\nYou either **all win together** or **all lose together**. This isn't a competition — it's teamwork under pressure.",
    tip: "Pandemic is intense. Expect to lose your first few games — that's normal and part of the learning curve.",
  },
  {
    heading: 'Setting Up',
    body: "**The board** shows 48 cities connected by lines, divided into **4 colour regions**:\n- **Blue** — North America and Europe\n- **Yellow** — Central/South America and Africa\n- **Black** — Middle East, Central and South Asia\n- **Red** — East Asia and Oceania\n\n**Setup steps:**\n1. Place a **Research Station** in Atlanta (CDC headquarters)\n2. Place all pawns in Atlanta\n3. Shuffle **Infection cards** and draw 9: place **3 cubes** on the first 3 cities, **2 cubes** on the next 3, **1 cube** on the last 3\n4. Set the **Infection Rate** marker to 2\n5. Shuffle **Epidemic cards** into the Player Deck (4 for easy, 5 for medium, 6 for hard)\n6. Deal Player cards: 4 each (2 players), 3 each (3 players), 2 each (4 players)\n7. Each player draws a **Role card** — roles give unique special abilities",
    is_setup_step: true,
    tip: "Start with 4 Epidemic cards (easy difficulty) for your first game. You'll still likely lose, but you'll learn the mechanics.",
  },
  {
    heading: 'The Diseases',
    body: "There are **4 diseases**, each represented by coloured cubes:\n\n- Each colour has **24 cubes** in the supply\n- Cities can hold **up to 3 cubes** of a colour\n- If a city would get a **4th cube** of any colour, an **Outbreak** occurs instead\n- Diseases spread via the **Infection Deck** — after each turn, cards are drawn and cubes placed\n\n**Your goal:** Discover **cures** for all 4 diseases. You do NOT need to remove every cube — you just need to find the 4 cures.\n\n**Curing a disease:** At a Research Station, discard **5 Player cards of the same colour** to cure that disease. Once cured, removing all cubes of that colour **eradicates** it (no more cubes of that colour can be placed).",
    interactive: {
      type: 'multiple_choice',
      question: 'What do you need to cure a disease?',
      options: [
        { label: 'Remove all cubes of that colour from the board', correct: false },
        { label: 'Discard 5 Player cards of the same colour at a Research Station', correct: true },
        { label: 'Visit all cities of that colour', correct: false },
        { label: 'Play 3 matching cards anywhere on the board', correct: false },
      ],
      explanation: 'To cure a disease, a player must be at a Research Station and discard 5 cards of the disease\'s colour. You don\'t need to eliminate all cubes — just discover the cure.',
    },
  },
  {
    heading: 'Your Turn — 4 Actions',
    body: "Each turn you take **4 actions**, draw 2 Player cards, then infect cities. Actions include:\n\n**Movement (pick any):**\n- **Drive/Ferry** — move to an adjacent connected city\n- **Direct Flight** — discard a city card to fly there\n- **Charter Flight** — discard the card of the city you're IN to fly anywhere\n- **Shuttle Flight** — fly between any two Research Stations\n\n**Other actions:**\n- **Treat Disease** — remove 1 cube from your city (all cubes if disease is cured)\n- **Build Research Station** — discard your current city's card to build one here (max 6 on board)\n- **Share Knowledge** — give or take a city card matching the city you're both in\n- **Discover a Cure** — at a Research Station, discard 5 same-colour cards",
    tip: "Movement is the biggest bottleneck. Every action spent travelling is an action not spent treating or curing. Plan routes carefully and use Research Stations as a shuttle network.",
  },
  {
    heading: 'Drawing Cards & Epidemics',
    body: "After your 4 actions, draw **2 Player cards**. Player cards are mostly city cards (for curing and movement), plus some **Event cards** (free special actions you can play anytime).\n\n**Hand limit: 7 cards.** Discard immediately if you exceed this.\n\n**Epidemic cards** are the worst thing in the deck. When drawn:\n\n1. **Increase** — move the Infection Rate marker up one step (more cities infected each turn)\n2. **Infect** — draw the **bottom** card of the Infection Deck and place **3 cubes** on that city\n3. **Intensify** — shuffle the Infection **discard pile** and place it **back on top** of the Infection Deck\n\nStep 3 is devastating: cities that were already infected will get infected **again**, creating outbreak chains.",
    tip: "The Intensify step is what makes Pandemic brutal. Cities you already treated will come back. This is why managing hotspots (cities with 3 cubes) is critical.",
  },
  {
    heading: 'Outbreaks & Chain Reactions',
    body: "When a city would receive a **4th cube** of any colour, an **Outbreak** occurs:\n\n1. The Outbreak marker advances (8 outbreaks = you lose)\n2. Instead of placing a 4th cube, **every city connected to it** receives 1 cube of that colour\n3. If any of THOSE cities already has 3 cubes, they outbreak too — **chain reaction!**\n\nChain reactions are the most common way to lose. A single badly-timed infection card can cascade across 3-4 cities, advancing the Outbreak tracker by 3-4 steps in one go.\n\n**Prevention:** Never let clusters of 3-cube cities form adjacent to each other. Treat hotspots before they chain.",
    interactive: {
      type: 'multiple_choice',
      question: 'São Paulo has 3 yellow cubes. Bogotá and Buenos Aires (both connected) each have 2. What happens if São Paulo gets infected again?',
      options: [
        { label: 'São Paulo gets a 4th cube', correct: false },
        { label: 'São Paulo outbreaks, Bogotá and Buenos Aires each get 1 cube — no further outbreaks', correct: true },
        { label: 'Nothing — 3 is the maximum', correct: false },
      ],
      explanation: 'São Paulo can\'t take a 4th cube, so it outbreaks. Each connected city gets +1 cube. Bogotá goes to 3 and Buenos Aires goes to 3 — dangerous but no chain reaction this time. If either had been at 3 already, they\'d outbreak too.',
    },
  },
  {
    heading: 'Player Roles',
    body: "Each player has a unique **Role** with a special ability. Roles drastically change your strategy:\n\n- **Medic** — removes ALL cubes of a colour with 1 Treat action (normally just 1). After a cure is found, automatically removes cubes just by entering a city. The most powerful role for containment.\n- **Scientist** — cures a disease with only **4 cards** instead of 5. Speeds up the win condition.\n- **Researcher** — can give any card to another player in the same city (normally must match the city). Supercharges card sharing.\n- **Operations Expert** — can build Research Stations without discarding a card. Builds your shuttle network fast.\n- **Dispatcher** — can move other players' pawns on your turn. Enables powerful team coordination.\n- **Quarantine Specialist** — prevents cubes from being placed in your city and all adjacent cities. A mobile firewall.\n- **Contingency Planner** — can reclaim a discarded Event card. Double-uses powerful events.",
    tip: "Role synergies matter. Researcher + Scientist is devastating: the Researcher feeds cards to the Scientist, who cures with only 4. Plan your strategy around your team's roles.",
  },
  {
    heading: 'Winning & Losing',
    body: "**You win** when all 4 diseases are cured. You do NOT need to remove all cubes — just discover all 4 cures.\n\n**You lose** if ANY of these happen:\n- **8 Outbreaks** occur (Outbreak tracker reaches the skull)\n- **A cube needs to be placed but the supply is empty** for that colour (24 cubes per colour)\n- **The Player Draw pile runs out** — you can't draw 2 cards\n\nMost losses come from outbreak chains or running out of Player cards (time pressure). You're always racing against the clock.",
  },
  {
    heading: 'Strategy — Priority Management',
    body: "Pandemic is fundamentally about **triage** — you can't do everything, so focus on what matters most:\n\n**Priority 1: Prevent chain outbreaks.** Any cluster of 3-cube cities adjacent to each other is an emergency. One infection card can cascade into 3-4 outbreaks and end the game. Treat these immediately.\n\n**Priority 2: Cure diseases.** This is your win condition. Every action should ultimately serve getting 5 same-colour cards to a Research Station. Treating cubes buys time, but curing wins the game.\n\n**Priority 3: Build Research Stations.** 2-3 strategically placed stations create a shuttle network that saves dozens of movement actions over the game. Place them in high-traffic cities.\n\n**Priority 4: Treat isolated cubes.** A single cube in a low-connectivity city is low priority. Don't waste actions travelling to treat it unless it's on your route.",
  },
  {
    heading: 'Strategy — Card Sharing',
    body: "Getting 5 same-colour cards to one player is the hardest part of the game. Here's how to do it efficiently:\n\n**Converge on a plan early.** Decide in the first few turns which player is curing which colour based on starting hands. Don't wait.\n\n**Share Knowledge aggressively.** Meeting another player in a matching city to trade cards is worth spending 2-3 movement actions. Cards in the wrong hand are wasted.\n\n**Use the Researcher.** If you have a Researcher, route cards through them — they can hand off any card in their city, not just the matching one.\n\n**Don't hoard.** If you have 4 blue cards but someone else has 3 blue cards and is closer to a Research Station, feed them your cards instead of trying to collect the 5th yourself.\n\n**Watch the hand limit.** Discarding a card you needed because you hit 7 is devastating. Share or use cards before you're forced to dump them.",
  },
  {
    heading: 'Strategy — Reading the Board',
    body: "Experienced players track the **Infection Discard Pile** — those are the cities that WILL come back after an Epidemic.\n\n**Post-Epidemic awareness:** After the Intensify step shuffles the discard pile on top, you know exactly which cities are about to be drawn again. If any of them have 2-3 cubes, treat them NOW.\n\n**Colour density:** Count how many cubes of each colour are on the board vs. in the supply. If 18 of 24 yellow cubes are placed, you're 6 cubes from losing via cube exhaustion.\n\n**Player deck countdown:** Count remaining Player cards. Divide by 2 (cards drawn per turn per player), then by player count. That's how many rounds you have left. If it's getting low, stop treating and focus entirely on curing.\n\n**Quiet turns are suspicious.** If several turns pass without an Epidemic, one is coming soon. Prepare by treating 3-cube cities.",
    tip: "The infection discard pile is public information. Memorise it — especially which 3-cube cities are in there waiting to come back.",
  },
  {
    heading: 'Common Mistakes to Avoid',
    body: "**1. Playing solo in a co-op game.** Discuss every turn with your team. The best move often involves coordinating two players' positions over multiple turns.\n\n**2. Over-treating cubes.** Treating is necessary for survival, but it doesn't get you closer to winning. Balance containment with cure progress.\n\n**3. Spreading too thin.** Don't send players to all 4 corners of the map. Focus on 1-2 diseases at a time. Cure them, then pivot.\n\n**4. Ignoring the timer.** The Player Deck is a countdown clock. Every turn matters. If you spend 3 turns treating cubes without making cure progress, you're falling behind.\n\n**5. Forgetting Event cards.** Events can be played at ANY time, even during another player's turn or during infection. \"One Quiet Night\" (skip infection) and \"Airlift\" (move any pawn anywhere) are game-savers when used at the right moment.",
  },
  {
    heading: "You're Ready to Save the World!",
    body: "That's everything for Pandemic. Remember:\n\n- **Cure all 4 diseases** to win — you don't need to remove every cube\n- **Outbreaks chain-react** — never let 3-cube cities cluster\n- **Share cards early** — decide who's curing what from the start\n- **Track the Infection Discard Pile** — know what's coming back after Epidemics\n- **It's cooperative** — talk through every turn with your team\n\nStart on easy (4 Epidemics), learn the flow, then crank it up. Good luck, disease fighters!",
    tip: "Winning on 6-Epidemic difficulty is a genuine achievement. Most experienced groups win about 30-40% of the time on hard.",
  },
];

// ─── 7 Wonders Demo ─────────────────────────────────────────────────────────

export const WONDERS_STEPS: ContentStepPayload[] = [
  {
    heading: 'Welcome to 7 Wonders!',
    body: "7 Wonders is a card-drafting civilisation game for **3-7 players** that plays in just **30 minutes** regardless of player count. You lead an ancient civilisation, developing science, military, commerce, and civic structures while building one of the Seven Wonders of the Ancient World.\n\nWhat makes it special: everyone plays **simultaneously** — no waiting for turns.",
    tip: "7 Wonders scales brilliantly. It plays almost identically at 3 players and 7 players because of the simultaneous card selection.",
  },
  {
    heading: 'Setting Up',
    body: "**Per player:**\n- Deal 1 random **Wonder board** (each has a unique power and resource)\n- Take **3 coins** from the bank\n- Your Wonder board's left side shows your **starting resource** (produced for free every turn)\n\n**Card decks (3 Ages):**\n- Separate cards by age (I, II, III) and card back colour\n- Remove cards based on player count (cards are marked — e.g., '3+', '5+')\n- Shuffle **Guild cards** (purple, Age III only) — add a number of random guilds equal to players + 2\n\n**Seating matters:** You only interact with your **immediate neighbours** (left and right). Trading and military happen only with adjacent players.",
    is_setup_step: true,
    tip: "Your Wonder board determines your starting resource and special abilities. Read it carefully before the game begins.",
  },
  {
    heading: 'Card Types',
    body: "There are **7 types of cards**, colour-coded:\n\n- **Brown (Raw Materials)** — produce basic resources: wood, stone, clay, ore\n- **Grey (Manufactured Goods)** — produce refined resources: glass, loom, papyrus\n- **Red (Military)** — provide shield symbols for military conflicts\n- **Blue (Civic)** — worth straight victory points (the simplest scoring)\n- **Green (Science)** — collect matching symbols for exponential scoring\n- **Yellow (Commerce)** — provide coins, trading advantages, or resource flexibility\n- **Purple (Guilds, Age III only)** — score based on what you or your neighbours have built\n\nEach card shows its **cost** (top-left) and **benefit** (centre/bottom). Some cards are free; others require resources or coins.",
    tip: "Brown and grey cards produce resources every turn for free. Building them early means you won't need to buy resources from neighbours later.",
  },
  {
    heading: 'How a Turn Works',
    body: "Each age lasts **6 turns**. Every turn, all players act **simultaneously**:\n\n1. **Look at your hand** of cards\n2. **Choose 1 card** and place it face-down\n3. **Everyone reveals** at the same time\n4. **Play your card** in one of three ways:\n   - **Build it** — pay its resource cost, add it to your tableau\n   - **Build a Wonder stage** — tuck the card face-down under your Wonder board, pay the Wonder stage's cost\n   - **Discard it** — place it in the discard pile, receive **3 coins** from the bank\n5. **Pass remaining cards** to your neighbour (left in Ages I & III, right in Age II)\n\nRepeat until each player has played 6 cards. The 7th card is discarded.",
    interactive: {
      type: 'multiple_choice',
      question: 'If you can\'t afford any card in your hand, what can you always do?',
      options: [
        { label: 'Pass your turn', correct: false },
        { label: 'Discard any card for 3 coins', correct: true },
        { label: 'Take a card for free', correct: false },
        { label: 'Draw from the deck instead', correct: false },
      ],
      explanation: 'You can always discard any card for 3 coins. This is your safety valve — you\'re never stuck. But it\'s usually suboptimal; try to plan your economy so you can build instead.',
    },
  },
  {
    heading: 'Paying for Cards',
    body: "Cards cost **resources** and/or **coins** (shown top-left).\n\n**Free chains:** Some cards list a prerequisite card name on the left. If you already built that card, this one is **free** regardless of its normal cost. Example: Baths (Age I) → Aqueduct (Age II) — building Baths lets you build Aqueduct for free later.\n\n**Getting resources:**\n- **Your own production:** Your Wonder board + any brown/grey cards you've built produce resources for free\n- **Buying from neighbours:** Pay **2 coins** per resource to a neighbour who produces it. You can buy from **both** neighbours in one turn\n- **You never lose resources.** They represent production capacity, not a consumable supply. Your neighbours keep their resources even when you buy from them\n\n**Yellow commerce cards** can reduce the cost of buying from neighbours to **1 coin** per resource.",
    tip: "Resource production is permanent and free. Buying from neighbours costs coins every time. Invest in your own production early to save money long-term.",
  },
  {
    heading: 'Military Conflicts',
    body: "At the end of each Age, every player compares their **total military shields** (from red cards + Wonder stages) with each neighbour:\n\n- **Age I:** Winner gets +1 VP token, loser gets -1 VP token\n- **Age II:** Winner gets +3 VP, loser gets -1 VP\n- **Age III:** Winner gets +5 VP, loser gets -1 VP\n- **Ties:** Neither player gets a token for that conflict\n\nYou fight **both neighbours** separately, so you can win one fight and lose the other.\n\n**Key insight:** You don't need the most military in the game — just more than your two neighbours. 3-4 shields is often enough to beat a non-military neighbour. Check what they're building before investing heavily in red cards.",
    interactive: {
      type: 'multiple_choice',
      question: 'At the end of Age III, you have 6 shields. Your left neighbour has 4 shields, your right has 8. What happens?',
      options: [
        { label: 'You gain +5 VP (left) and -1 VP (right) = net +4', correct: true },
        { label: 'You lose both fights because you\'re not the strongest overall', correct: false },
        { label: 'You gain +5 VP from beating left, nothing from right', correct: false },
      ],
      explanation: 'Military is resolved per-neighbour. You beat your left neighbour (+5 VP) and lose to your right (-1 VP). Each conflict is independent — it doesn\'t matter who has the most shields at the table.',
    },
  },
  {
    heading: 'Science Scoring',
    body: "Green science cards show one of **3 symbols**: Tablet, Compass, or Gear.\n\nScience scores in **two ways** (both stack):\n\n**1. Sets of identical symbols:** Score = (count)² per symbol type\n- 1 Tablet = 1 VP, 2 Tablets = 4 VP, 3 Tablets = 9 VP, 4 Tablets = 16 VP\n\n**2. Complete sets of all 3 different symbols:** Each complete set = **7 VP**\n\nExample: 3 Tablets + 2 Compasses + 1 Gear = 9 + 4 + 1 + 7 (one complete set) = **21 VP**\n\nScience is the **highest-ceiling scoring strategy** in the game — but it requires heavy commitment. A half-hearted science strategy scores poorly; a dedicated one can reach 40+ VP from science alone.",
    tip: "Science is all-or-nothing. Either commit heavily (6+ green cards) or skip it entirely. 2-3 science cards is usually worse than spending those picks on blue or military cards.",
  },
  {
    heading: 'Building Your Wonder',
    body: "Your Wonder board has **2-4 stages** (most have 3), each requiring specific resources. To build a stage:\n\n1. Choose any card from your hand\n2. Tuck it **face-down** under your Wonder board (the card's printed ability is ignored — it's just fuel)\n3. Pay the Wonder stage's resource cost (shown on your board)\n\nWonder stages give powerful benefits: VP, resources, military, free builds, extra cards, science symbols, or coins.\n\n**Stages must be built left to right** — you can't skip ahead.\n\n**You don't have to complete your Wonder.** Sometimes the resources are better spent on cards. But most Wonder stages are efficient — the VP/benefit per resource cost is usually good.",
  },
  {
    heading: 'End-Game Scoring',
    body: "After Age III military conflicts, tally everything:\n\n1. **Military conflict tokens** — sum all +1/+3/+5 and -1 tokens\n2. **Coins** — every **3 coins** = 1 VP\n3. **Wonder stages** — VP printed on each completed stage\n4. **Blue civic cards** — VP printed on each card\n5. **Yellow commerce cards** — some Age III yellow cards score based on conditions\n6. **Purple guild cards** — score based on your/neighbours' tableau\n7. **Science** — calculate sets + squares as described\n\nHighest total wins. Tiebreaker: most coins remaining.\n\nTypical winning scores range from **50-70 VP** depending on player count.",
  },
  {
    heading: 'Strategy — Reading the Draft',
    body: "Since cards pass around the table, you get information about what your neighbours are doing:\n\n**Watch what's missing.** If you pass 7 cards left and get back 6, your neighbour took something. What's gone tells you their strategy.\n\n**Hate-draft when necessary.** Sometimes the best play is to take a card you don't need to prevent a neighbour from completing a devastating combo (like their 4th science symbol or a guild that scores off YOUR cards).\n\n**Track the direction.** Ages I and III pass **left**; Age II passes **right**. In Age I, your right neighbour is feeding you cards — build a relationship with their leftovers. In Age II, it reverses.\n\n**Late-round picks are committed.** By turns 5-6, you're seeing the same small pool. Plan your last 2 picks from the start of the age if possible.",
  },
  {
    heading: 'Strategy — Neighbour Awareness',
    body: "You only interact with your **immediate neighbours**. This creates key dynamics:\n\n**Military is local.** If neither neighbour is building military, you can skip it entirely and spend those picks on VP-generating cards. One red card to \"win\" cheap military is often enough.\n\n**Resource trading matters.** Before buying a resource card, check if a neighbour already produces it. Buying at 2 coins (or 1 with commerce cards) might be cheaper than spending a card pick on production.\n\n**Guilds score off neighbours.** Purple cards in Age III score based on your neighbours' cards. \"Builders Guild\" scores per Wonder stage your neighbours built. If they've built a lot, this guild is worth 10+ VP.\n\n**Don't help your neighbours.** If your right neighbour is going heavy on science, don't pass them science cards. Discard them for coins or hate-draft them even if you can't use them.",
  },
  {
    heading: 'Strategy — Common Archetypes',
    body: "Winning strategies typically follow one of these patterns:\n\n**Blue/Wonder (Civic):** Build blue cards for raw VP + complete your Wonder. Straightforward, consistent, scores 45-55 VP. Good default when unsure.\n\n**Science Engine:** Commit hard to green cards. Aim for 3-3-3 distribution (= 27 + 21 = 48 VP from science alone). Needs 6+ green cards to be worthwhile. High ceiling but vulnerable to hate-drafting.\n\n**Military + Commerce:** Dominate both neighbours militarily (+18 VP from winning all 6 conflicts) while yellow cards generate coins and VP. Flexible and hard to counter.\n\n**Guild Sniper:** Build a balanced tableau in Ages I-II, then pick guilds in Age III that score off your specific neighbours' strengths. Requires reading the table well.\n\n**Adapt, don't force.** The best players read what's available in the draft and pivot. If science cards keep coming, go science. If military cards dry up, pivot to blue. Flexibility wins more than a rigid plan.",
    tip: "There's no single best strategy — that's what makes 7 Wonders replayable. The winner is usually the player who best adapts to what the draft offers.",
  },
  {
    heading: "You're Ready to Build!",
    body: "That's everything for 7 Wonders. Quick reference:\n\n- **Simultaneous play** — everyone picks and reveals at the same time\n- **3 Ages**, 6 cards each, pass hands left/right/left\n- **7 card types** — resources, military, civic, science, commerce, guilds\n- **Buy from neighbours** at 2 coins per resource\n- **Military** is local — only fight your left and right neighbours\n- **Science** scores exponentially — commit fully or skip it\n- **Guilds** (Age III) reward reading your neighbours\n\nPick your Wonder, build your civilisation, and aim for the highest score. May your civilisation stand the test of time!",
    tip: "First game tip: focus on blue civic cards and your Wonder. They're the most intuitive scoring path while you learn the other mechanics.",
  },
];

// ─── Tutorial metadata per ID ───────────────────────────────────────────────

interface DemoTutorialData {
  tutorial: Tutorial & { game?: Game; creator: { display_name: string; avatar_emoji: string } };
  steps: ContentStepPayload[];
}

export const DEMO_TUTORIALS: Record<string, DemoTutorialData> = {
  '00000000-0000-4000-a000-000000000001': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000001',
      game_id: '00000000-0000-4000-b000-000000000001',
      category_id: DEMO_CATEGORY_IDS['board-games'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Learn Catan in 10 Minutes',
      description: 'A complete walkthrough of Catan for first-time players. Covers setup, turn structure, trading, and winning.',
      estimated_minutes: 10,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-20T00:00:00Z',
      game: {
        id: '00000000-0000-4000-b000-000000000001',
        title: 'Catan',
        bgg_id: 13,
        bgg_image_url: 'https://cf.geekdo-images.com/W3Bsga_uLP9kO91gZ7H8yw__original/img/xV7oisd3RQ8R-k18cdWAYthHXsA=/0x0/filters:format(jpeg)/pic2419375.jpg',
        description: 'Trade, build, and settle the island of Catan.',
        complexity: 2,
        min_players: 3,
        max_players: 4,
        play_time_minutes: 90,
        year_published: 1995,
        created_at: '2026-04-01T00:00:00Z',
      },
      creator: { display_name: 'QUOBBY', avatar_emoji: '🎲' },
    },
    steps: CATAN_STEPS,
  },
  '00000000-0000-4000-a000-000000000002': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000002',
      game_id: '00000000-0000-4000-b000-000000000002',
      category_id: DEMO_CATEGORY_IDS['board-games'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Wingspan Quick Start',
      description: 'Learn the basics of Wingspan with an interactive first round. Covers bird cards, food, and egg laying.',
      estimated_minutes: 8,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-04-18T00:00:00Z',
      game: {
        id: '00000000-0000-4000-b000-000000000002',
        title: 'Wingspan',
        bgg_id: 266192,
        bgg_image_url: 'https://cf.geekdo-images.com/yLZJCVLlIx4c7eJEWUNJ7w__original/img/cI782Zis9cT66j2MjSHKJGnFPNw=/0x0/filters:format(jpeg)/pic4458123.jpg',
        description: 'Attract birds to your wildlife preserve.',
        complexity: 3,
        min_players: 1,
        max_players: 5,
        play_time_minutes: 70,
        year_published: 2019,
        created_at: '2026-03-15T00:00:00Z',
      },
      creator: { display_name: 'QUOBBY', avatar_emoji: '🎲' },
    },
    steps: WINGSPAN_STEPS,
  },
  '00000000-0000-4000-a000-000000000003': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000003',
      game_id: '00000000-0000-4000-b000-000000000003',
      category_id: DEMO_CATEGORY_IDS['board-games'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Codenames in 2 Minutes',
      description: 'The fastest way to learn Codenames. Perfect for party game nights.',
      estimated_minutes: 2,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-02-10T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
      game: {
        id: '00000000-0000-4000-b000-000000000003',
        title: 'Codenames',
        bgg_id: 178900,
        bgg_image_url: 'https://cf.geekdo-images.com/F_KDEu0GjdClml8N7c8Imw__itemrep/img/e8zw8YQvQB8q8zfWkHQ48Ls920g=/fit-in/246x300/filters:strip_icc()/pic2582929.jpg',
        description: 'Give one-word clues to identify secret agents.',
        complexity: 1,
        min_players: 2,
        max_players: 8,
        play_time_minutes: 15,
        year_published: 2015,
        created_at: '2026-02-10T00:00:00Z',
      },
      creator: { display_name: 'QUOBBY', avatar_emoji: '🎲' },
    },
    steps: CODENAMES_STEPS,
  },
  '00000000-0000-4000-a000-000000000004': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000004',
      game_id: null,
      category_id: DEMO_CATEGORY_IDS['cooking'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Pasta Aglio e Olio in 20 Minutes',
      description: 'A classic Roman pasta with 6 ingredients. Learn knife skills, garlic technique, and the secret of pasta water.',
      cover_image_url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',
      estimated_minutes: 5,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-04-25T00:00:00Z',
      updated_at: '2026-04-28T00:00:00Z',
      creator: { display_name: 'QUOBBY', avatar_emoji: '👨‍🍳' },
    },
    steps: COOKING_STEPS,
  },
  '00000000-0000-4000-a000-000000000005': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000005',
      game_id: null,
      category_id: DEMO_CATEGORY_IDS['software'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Build a REST API with Express',
      description: 'Create a complete CRUD API from scratch with Node.js and Express. Includes code examples and testing.',
      cover_image_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
      estimated_minutes: 8,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-04-20T00:00:00Z',
      updated_at: '2026-04-26T00:00:00Z',
      creator: { display_name: 'QUOBBY', avatar_emoji: '💻' },
    },
    steps: SOFTWARE_STEPS,
  },
  '00000000-0000-4000-a000-000000000006': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000006',
      game_id: null,
      category_id: DEMO_CATEGORY_IDS['diy-crafts'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Build a Floating Shelf',
      description: 'A beginner woodworking project using a hidden French cleat. No visible brackets, clean modern look.',
      cover_image_url: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&q=80',
      estimated_minutes: 6,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-04-18T00:00:00Z',
      updated_at: '2026-04-24T00:00:00Z',
      creator: { display_name: 'QUOBBY', avatar_emoji: '🔨' },
    },
    steps: DIY_STEPS,
  },
  '00000000-0000-4000-a000-000000000007': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000007',
      game_id: null,
      category_id: DEMO_CATEGORY_IDS['music'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Learn Your First 4 Chords',
      description: 'Play hundreds of songs with just G, D, Em, C. Works for guitar and piano beginners.',
      cover_image_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80',
      estimated_minutes: 6,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-04-15T00:00:00Z',
      updated_at: '2026-04-22T00:00:00Z',
      creator: { display_name: 'QUOBBY', avatar_emoji: '🎸' },
    },
    steps: MUSIC_STEPS,
  },
  '00000000-0000-4000-a000-000000000008': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000008',
      game_id: null,
      category_id: DEMO_CATEGORY_IDS['sports'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Offside Rule in 5 Minutes',
      description: 'Finally understand football\'s most confusing rule. Clear examples, common myths busted.',
      cover_image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
      estimated_minutes: 5,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-04-10T00:00:00Z',
      updated_at: '2026-04-20T00:00:00Z',
      creator: { display_name: 'QUOBBY', avatar_emoji: '⚽' },
    },
    steps: SPORTS_STEPS,
  },
  '00000000-0000-4000-a000-000000000009': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000009',
      game_id: null,
      category_id: DEMO_CATEGORY_IDS['science'],
      creator_id: DEMO_CREATOR_ID,
      title: 'How Batteries Work',
      description: 'Understand the chemistry behind every battery — from AAs to lithium-ion. Covers anodes, cathodes, and why batteries degrade.',
      cover_image_url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80',
      estimated_minutes: 7,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-05T00:00:00Z',
      creator: { display_name: 'QUOBBY', avatar_emoji: '🔬' },
    },
    steps: SCIENCE_STEPS,
  },
  '00000000-0000-4000-a000-000000000010': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000010',
      game_id: '00000000-0000-4000-b000-000000000004',
      category_id: DEMO_CATEGORY_IDS['board-games'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Ticket to Ride Quickstart + Strategy',
      description: 'Complete rules, route strategy, card management, and ticket tactics for Ticket to Ride USA. Beginner to intermediate.',
      estimated_minutes: 12,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-05-20T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      game: {
        id: '00000000-0000-4000-b000-000000000004',
        title: 'Ticket to Ride',
        bgg_id: 9209,
        bgg_image_url: 'https://cf.geekdo-images.com/kdWYkW-7AqG63HhqPL6ekA__original/img/rWF8r4JXXCQQ7QhiWHhmT-rQ3Pc=/0x0/filters:format(jpeg)/pic8937637.jpg',
        description: 'Build train routes across North America and complete destination tickets.',
        complexity: 2,
        min_players: 2,
        max_players: 5,
        play_time_minutes: 60,
        year_published: 2004,
        created_at: '2026-05-20T00:00:00Z',
      },
      creator: { display_name: 'QUOBBY', avatar_emoji: '🎲' },
    },
    steps: TTR_STEPS,
  },
  '00000000-0000-4000-a000-000000000011': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000011',
      game_id: '00000000-0000-4000-b000-000000000005',
      category_id: DEMO_CATEGORY_IDS['board-games'],
      creator_id: DEMO_CREATOR_ID,
      title: 'Pandemic Quickstart + Strategy',
      description: 'Full cooperative rules, role synergies, outbreak prevention, and advanced board-reading tactics for Pandemic.',
      estimated_minutes: 14,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-05-22T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      game: {
        id: '00000000-0000-4000-b000-000000000005',
        title: 'Pandemic',
        bgg_id: 30549,
        bgg_image_url: 'https://cf.geekdo-images.com/S3ybV1LAp-8SnHIXLLjVqA__original/img/IsrvRLpUV1TEyZsO5rC-btXaPz0=/0x0/filters:format(jpeg)/pic1534148.jpg',
        description: 'Work together to stop four deadly diseases from spreading across the globe.',
        complexity: 3,
        min_players: 2,
        max_players: 4,
        play_time_minutes: 45,
        year_published: 2008,
        created_at: '2026-05-22T00:00:00Z',
      },
      creator: { display_name: 'QUOBBY', avatar_emoji: '🎲' },
    },
    steps: PANDEMIC_STEPS,
  },
  '00000000-0000-4000-a000-000000000012': {
    tutorial: {
      id: '00000000-0000-4000-a000-000000000012',
      game_id: '00000000-0000-4000-b000-000000000006',
      category_id: DEMO_CATEGORY_IDS['board-games'],
      creator_id: DEMO_CREATOR_ID,
      title: '7 Wonders Quickstart + Strategy',
      description: 'Card drafting rules, science scoring, military tactics, and archetype strategies for 7 Wonders. From first game to winning.',
      estimated_minutes: 14,
      status: 'published',
      version: 1,
      forked_from: null,
      rating_avg: 0,
      rating_count: 0,
      play_count: 0,
      created_at: '2026-05-25T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      game: {
        id: '00000000-0000-4000-b000-000000000006',
        title: '7 Wonders',
        bgg_id: 68448,
        bgg_image_url: 'https://cf.geekdo-images.com/35h9Za_JvMMMtx_92kT0Jg__original/img/jt70jJDZ1y1FWJs4ZQf5FI8APVY=/0x0/filters:format(jpeg)/pic7149798.jpg',
        description: 'Draft cards to develop your ancient civilisation and build a world wonder.',
        complexity: 3,
        min_players: 3,
        max_players: 7,
        play_time_minutes: 30,
        year_published: 2010,
        created_at: '2026-05-25T00:00:00Z',
      },
      creator: { display_name: 'QUOBBY', avatar_emoji: '🎲' },
    },
    steps: WONDERS_STEPS,
  },
};

export const DEMO_TUTORIAL_LIST = Object.values(DEMO_TUTORIALS).map((d) => d.tutorial);
