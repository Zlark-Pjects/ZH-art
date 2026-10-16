/* Stickville City: everything the game knows that isn't code — the hero's looks, quiz
   questions, what you can build and buy, missions, races and the people of the city. */

export type HairStyle = "none" | "short" | "spiky" | "long" | "ponytail" | "bun" | "curly" | "braids";
export type Headwear = "none" | "cap" | "beret" | "helmet" | "headband" | "bow";
export type Bottom = "pants" | "shorts" | "skirt";

export interface Hero {
  name: string;
  hair: HairStyle;
  hairColor: string;
  headwear: Headwear;
  skin: string;
  top: string;
  bottom: Bottom;
  bottomColor: string;
}

export const HERO_PRESETS: { label: string; hero: Hero }[] = [
  { label: "Ava", hero: { name: "Ava", hair: "ponytail", hairColor: "#3b2416", headwear: "none", skin: "#f1c9a5", top: "#ff6b8a", bottom: "skirt", bottomColor: "#2f3a68" } },
  { label: "Leo", hero: { name: "Leo", hair: "spiky", hairColor: "#1d1d1d", headwear: "cap", skin: "#c68b5e", top: "#3fa7ff", bottom: "pants", bottomColor: "#30343c" } },
  { label: "Zara", hero: { name: "Zara", hair: "braids", hairColor: "#141010", headwear: "headband", skin: "#7a4b2c", top: "#ffb224", bottom: "pants", bottomColor: "#5b3d8f" } },
  { label: "Kai", hero: { name: "Kai", hair: "short", hairColor: "#5a3a1a", headwear: "beret", skin: "#e0b48a", top: "#5fa35a", bottom: "shorts", bottomColor: "#4a4a2a" } },
  { label: "Mia", hero: { name: "Mia", hair: "bun", hairColor: "#b5562a", headwear: "bow", skin: "#f6d6bd", top: "#9b6bff", bottom: "skirt", bottomColor: "#222a3a" } },
  { label: "Sam", hero: { name: "Sam", hair: "curly", hairColor: "#2a1a10", headwear: "helmet", skin: "#9a6440", top: "#ef5a3c", bottom: "pants", bottomColor: "#26303a" } },
];

export const HAIR_STYLES: HairStyle[] = ["none", "short", "spiky", "long", "ponytail", "bun", "curly", "braids"];
export const HEADWEAR: Headwear[] = ["none", "cap", "beret", "helmet", "headband", "bow"];
export const BOTTOMS: Bottom[] = ["pants", "shorts", "skirt"];
export const SKINS = ["#f6d6bd", "#f1c9a5", "#e0b48a", "#c68b5e", "#9a6440", "#7a4b2c", "#4f2f1c"];

/* ---------- Quiz ---------- */

export interface Question {
  cat: string;
  q: string;
  options: string[];
  answer: number;
  why: string;
}

export const QUESTIONS: Question[] = [
  { cat: "Maths", q: "A car drives 60 km in 1 hour. How far does it go in 15 minutes?", options: ["10 km", "15 km", "20 km", "30 km"], answer: 1, why: "15 minutes is a quarter of an hour, and a quarter of 60 km is 15 km." },
  { cat: "Maths", q: "What is 7 × 8?", options: ["54", "56", "58", "64"], answer: 1, why: "7 × 8 = 56. A trick: 5, 6, 7, 8 → 56 = 7 × 8." },
  { cat: "Maths", q: "How many degrees are there in a full flip?", options: ["90°", "180°", "270°", "360°"], answer: 3, why: "A full turn is 360°. Two flips on your bike is 720°!" },
  { cat: "Maths", q: "A house costs 40 coins and pays 6 a minute. How many minutes until it pays for itself?", options: ["About 4", "About 7", "About 10", "About 40"], answer: 1, why: "40 ÷ 6 ≈ 6.7, so after about 7 minutes the house has paid you back." },
  { cat: "Maths", q: "What is 25% of 200?", options: ["25", "40", "50", "75"], answer: 2, why: "25% means a quarter. 200 ÷ 4 = 50." },
  { cat: "Maths", q: "Which number is prime?", options: ["21", "27", "29", "33"], answer: 2, why: "29 can only be divided by 1 and itself. 21 = 3×7, 27 = 3×9, 33 = 3×11." },
  { cat: "Maths", q: "A triangle has angles of 90° and 30°. What is the third angle?", options: ["30°", "45°", "60°", "90°"], answer: 2, why: "A triangle's angles always add to 180°: 180 − 90 − 30 = 60." },
  { cat: "Science", q: "What makes things fall back to the ground?", options: ["Magnetism", "Gravity", "Friction", "Wind"], answer: 1, why: "Gravity pulls everything with mass toward everything else. Earth is so big its pull wins." },
  { cat: "Science", q: "Water boils at sea level at…", options: ["50 °C", "90 °C", "100 °C", "120 °C"], answer: 2, why: "100 °C at sea level. High on a mountain the air pressure is lower, so water boils at a lower temperature." },
  { cat: "Science", q: "What gas do plants take in to make food?", options: ["Oxygen", "Carbon dioxide", "Helium", "Nitrogen"], answer: 1, why: "Plants use carbon dioxide, water and sunlight to make sugar — and release oxygen. That's photosynthesis." },
  { cat: "Science", q: "Why do bike tyres have grooves?", options: ["To look cool", "To grip the road", "To be lighter", "To go quieter"], answer: 1, why: "Grooves push water and dirt out of the way so rubber touches the ground: more friction, more grip." },
  { cat: "Science", q: "What's the hardest natural material?", options: ["Gold", "Iron", "Diamond", "Quartz"], answer: 2, why: "Diamond: carbon atoms locked in a tight 3D grid." },
  { cat: "Science", q: "Sound travels fastest through…", options: ["Air", "Water", "Steel", "Space"], answer: 2, why: "Sound is a vibration passed between particles. In steel they're packed tight, so it travels about 15× faster than in air. In space there's nothing to carry it." },
  { cat: "Geography", q: "Which is the largest ocean?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3, why: "The Pacific covers about a third of Earth's surface — bigger than all the land put together." },
  { cat: "Geography", q: "The Sahara is a…", options: ["Rainforest", "Desert", "Mountain range", "Lake"], answer: 1, why: "The Sahara in North Africa is the largest hot desert, about the size of the USA." },
  { cat: "Geography", q: "Which continent has the most countries?", options: ["Asia", "Europe", "Africa", "South America"], answer: 2, why: "Africa has 54 countries." },
  { cat: "Geography", q: "What is the longest river in Africa?", options: ["Congo", "Niger", "Nile", "Zambezi"], answer: 2, why: "The Nile flows about 6,650 km north into the Mediterranean Sea." },
  { cat: "Geography", q: "Which way does a compass needle point?", options: ["East", "South", "North", "Up"], answer: 2, why: "The needle is a small magnet that lines up with Earth's magnetic field, pointing toward magnetic north." },
  { cat: "Road safety", q: "What should you always wear on a bike?", options: ["Sunglasses", "A helmet", "Headphones", "Gloves only"], answer: 1, why: "A helmet protects your brain. It cuts the risk of a serious head injury by about two thirds." },
  { cat: "Road safety", q: "A red traffic light means…", options: ["Speed up", "Stop", "Go carefully", "Turn left"], answer: 1, why: "Red means stop and wait behind the line until it turns green." },
  { cat: "Road safety", q: "Before you cross a road you should…", options: ["Run fast", "Look both ways and listen", "Look at your phone", "Close your eyes"], answer: 1, why: "Stop at the kerb, look and listen both ways, and only cross when it's clear." },
  { cat: "Road safety", q: "Why do cars need more room to stop in the rain?", options: ["Brakes get cold", "Less grip on wet roads", "Rain is heavy", "They don't"], answer: 1, why: "Water between tyre and road lowers friction, so stopping distances can double." },
  { cat: "History", q: "Who were the first people to walk on the Moon (1969)?", options: ["Gagarin & Tereshkova", "Armstrong & Aldrin", "Wright brothers", "Columbus & Magellan"], answer: 1, why: "Neil Armstrong and Buzz Aldrin, on Apollo 11. Michael Collins orbited above them." },
  { cat: "History", q: "The ancient pyramids of Giza are in…", options: ["Mexico", "Egypt", "China", "Peru"], answer: 1, why: "Egypt. The Great Pyramid was the tallest building on Earth for about 3,800 years." },
  { cat: "History", q: "Who was the first woman to win a Nobel Prize?", options: ["Ada Lovelace", "Marie Curie", "Rosalind Franklin", "Florence Nightingale"], answer: 1, why: "Marie Curie (1903, physics). She won a second one in chemistry in 1911." },
  { cat: "History", q: "Which machine did the Wright brothers fly first in 1903?", options: ["A helicopter", "A hot-air balloon", "An aeroplane", "A rocket"], answer: 2, why: "The Wright Flyer — the first powered, controlled aeroplane flight, 12 seconds long." },
  { cat: "Nature", q: "Which animal is the largest ever known?", options: ["African elephant", "Blue whale", "T. rex", "Giraffe"], answer: 1, why: "The blue whale: up to about 30 m long, heavier than any dinosaur." },
  { cat: "Nature", q: "How do bees help plants?", options: ["They water them", "They carry pollen", "They eat pests", "They dig soil"], answer: 1, why: "Bees carry pollen from flower to flower so plants can make seeds and fruit." },
  { cat: "Nature", q: "A tadpole grows up into a…", options: ["Fish", "Frog", "Lizard", "Snake"], answer: 1, why: "Tadpoles grow legs, lose their tails and become frogs: that change is called metamorphosis." },
  { cat: "Space", q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1, why: "Mars looks red because its dust contains iron oxide — rust." },
  { cat: "Space", q: "What is the Sun?", options: ["A planet", "A star", "A moon", "A comet"], answer: 1, why: "The Sun is a star, a huge ball of hot gas. Every star you see at night is a sun too, very far away." },
  { cat: "Space", q: "How long does Earth take to go once around the Sun?", options: ["A day", "A month", "A year", "Ten years"], answer: 2, why: "About 365¼ days — the extra quarter is why we add a leap day every four years." },
  { cat: "Tech", q: "What does a computer use to store everything?", options: ["Letters", "1s and 0s", "Colours", "Sounds"], answer: 1, why: "Binary: every photo, song and game is stored as patterns of 1s and 0s." },
  { cat: "Tech", q: "What does GPS help you do?", options: ["Cook", "Find your location", "Charge a phone", "Send email"], answer: 1, why: "GPS receivers time signals from several satellites to work out exactly where you are." },
  { cat: "Tech", q: "What is a password best made of?", options: ["Your name", "123456", "A long mix of words and symbols", "Your birthday"], answer: 2, why: "Long, unusual passwords are hardest to guess. Never share them — not even with friends." },
];

/** Harder questions for the café, the lab and intel terminals. */
export const HARD_QUESTIONS: Question[] = [
  { cat: "Maths", q: "Solve for x: 3x + 7 = 25", options: ["4", "6", "8", "18"], answer: 1, why: "Take 7 from both sides: 3x = 18, so x = 6." },
  { cat: "Maths", q: "A jacket costs $80 and is 25% off. What do you pay?", options: ["$55", "$60", "$65", "$75"], answer: 1, why: "25% of 80 is 20, so you pay 80 − 20 = $60." },
  { cat: "Maths", q: "What is the square root of 144?", options: ["10", "11", "12", "14"], answer: 2, why: "12 × 12 = 144." },
  { cat: "Maths", q: "The probability of rolling a 6 on a fair die is…", options: ["1/2", "1/3", "1/6", "1/12"], answer: 2, why: "One good outcome out of six equally likely ones." },
  { cat: "Maths", q: "What is 2 to the power of 10?", options: ["100", "512", "1,024", "2,048"], answer: 2, why: "Doubling ten times: 2, 4, 8 … 512, 1,024. It's why a kilobyte is sometimes 1,024 bytes." },
  { cat: "Maths", q: "A car travels 150 km in 2.5 hours. Average speed?", options: ["50 km/h", "60 km/h", "65 km/h", "75 km/h"], answer: 1, why: "Speed = distance ÷ time = 150 ÷ 2.5 = 60 km/h." },
  { cat: "Physics", q: "Which is Newton's third law?", options: ["F = ma", "Every action has an equal and opposite reaction", "Objects stay at rest unless pushed", "Energy is conserved"], answer: 1, why: "Push on a wall and it pushes back on you just as hard. Rockets fly by throwing gas backwards." },
  { cat: "Physics", q: "What is the unit of electrical resistance?", options: ["Volt", "Watt", "Ohm", "Amp"], answer: 2, why: "Ohms (Ω). Ohm's law: voltage = current × resistance." },
  { cat: "Physics", q: "Light from the Sun takes about how long to reach Earth?", options: ["8 seconds", "8 minutes", "8 hours", "8 days"], answer: 1, why: "About 8 minutes 20 seconds, crossing roughly 150 million km." },
  { cat: "Physics", q: "Why do you feel pushed sideways in a car taking a sharp turn?", options: ["Gravity", "Inertia: your body wants to keep going straight", "Magnetism", "Air pressure"], answer: 1, why: "Your body keeps moving in a straight line; the car turns under you. Drift too hard and your tyres feel the same thing." },
  { cat: "Chemistry", q: "What is H₂O?", options: ["Salt", "Water", "Hydrogen peroxide", "Ozone"], answer: 1, why: "Two hydrogen atoms bonded to one oxygen atom." },
  { cat: "Chemistry", q: "What is the pH of pure water?", options: ["0", "5", "7", "14"], answer: 2, why: "7 is neutral. Lower is acidic (lemon juice ≈ 2), higher is alkaline (soap ≈ 10)." },
  { cat: "Chemistry", q: "Which element has the symbol Fe?", options: ["Fluorine", "Iron", "Lead", "Francium"], answer: 1, why: "From the Latin 'ferrum'. Rust is iron oxide." },
  { cat: "Biology", q: "What are the 'powerhouses' of the cell?", options: ["Nuclei", "Ribosomes", "Mitochondria", "Vacuoles"], answer: 2, why: "Mitochondria turn food and oxygen into ATP, the energy cells run on." },
  { cat: "Biology", q: "DNA is shaped like a…", options: ["Single loop", "Double helix", "Cube", "Flat sheet"], answer: 1, why: "Two strands twisted around each other — described in 1953 using Rosalind Franklin's X-ray images." },
  { cat: "Biology", q: "Which blood cells fight infections?", options: ["Red blood cells", "White blood cells", "Platelets", "Plasma"], answer: 1, why: "White blood cells find and destroy germs. Platelets help clotting; red cells carry oxygen." },
  { cat: "World", q: "What is the capital of Nigeria?", options: ["Lagos", "Abuja", "Kano", "Ibadan"], answer: 1, why: "Abuja became the capital in 1991. Lagos is the biggest city." },
  { cat: "World", q: "Which country has the most people (2024)?", options: ["USA", "China", "India", "Indonesia"], answer: 2, why: "India passed China in 2023, with over 1.4 billion people." },
  { cat: "World", q: "The Amazon rainforest is mostly in…", options: ["Brazil", "Mexico", "Kenya", "Indonesia"], answer: 0, why: "About 60% of it is in Brazil; it also spans Peru, Colombia and six more countries." },
  { cat: "World", q: "Mount Kilimanjaro is in…", options: ["Kenya", "Tanzania", "Uganda", "Ethiopia"], answer: 1, why: "Tanzania. At 5,895 m it's Africa's highest mountain." },
  { cat: "History", q: "Nelson Mandela became South Africa's president in…", options: ["1964", "1980", "1994", "2004"], answer: 2, why: "1994, after 27 years in prison, in the country's first fully democratic election." },
  { cat: "History", q: "The World Wide Web was invented by…", options: ["Bill Gates", "Tim Berners-Lee", "Steve Jobs", "Ada Lovelace"], answer: 1, why: "Tim Berners-Lee, in 1989 at CERN. He gave it away for free." },
  { cat: "Money", q: "What does 'interest' on savings mean?", options: ["A bank fee", "Money the bank pays you for keeping money there", "A tax", "A loan"], answer: 1, why: "Banks pay you a percentage for letting them use your money. Over years it compounds: interest earns interest." },
  { cat: "Money", q: "You earn $50 a week and save 20%. How much after 10 weeks?", options: ["$50", "$100", "$200", "$500"], answer: 1, why: "20% of 50 is $10 a week; ten weeks makes $100." },
  { cat: "Money", q: "A 'budget' is…", options: ["A cheap shop", "A plan for how you'll spend and save money", "A type of loan", "A bank account"], answer: 1, why: "Plan first, spend second: it's how you afford the things that matter to you." },
  { cat: "Coding", q: "In programming, a 'loop'…", options: ["Deletes files", "Repeats instructions", "Draws circles", "Connects to Wi-Fi"], answer: 1, why: "Loops repeat code — the game you're playing runs a loop about 60 times a second." },
  { cat: "Coding", q: "What does 'AI' stand for?", options: ["Automatic Input", "Artificial Intelligence", "Advanced Internet", "Analog Interface"], answer: 1, why: "Artificial intelligence: computer systems that learn patterns from data." },
  { cat: "Coding", q: "Which of these is a strong password?", options: ["password1", "Ava2009", "correct-horse-battery-staple!", "qwerty"], answer: 2, why: "Long passphrases are much harder to crack than short words with numbers on the end." },
  { cat: "Online", q: "A stranger online asks for your photo and address. You should…", options: ["Send them", "Send only the photo", "Not share, block and tell someone you trust", "Ask for theirs first"], answer: 2, why: "Never share personal details with people you don't know in real life. Block, report and tell a trusted adult." },
  { cat: "Online", q: "A news story makes you really angry. Before sharing it you should…", options: ["Share fast", "Check who published it and if others report it", "Only share to friends", "Add a comment"], answer: 1, why: "Outrage spreads fast and misinformation relies on it. Check the source first." },
];

/* ---------- Your block: what you can build ---------- */

export type PlotKind = "house" | "garage" | "solar" | "park" | "helipad" | "lab";

export const PLOTS: Record<PlotKind, { label: string; cost: number; income: number; sprite: string; does: string; fact: string }> = {
  house: { label: "Home", cost: 600, income: 15, sprite: "house_orange", does: "Your own house: +$15 a minute, and you wake up here.", fact: "Triangle roofs shed rain and snow, and a triangle can't be squashed out of shape." },
  park: { label: "Park", cost: 300, income: 6, sprite: "park", does: "Trees and a bench for the neighbours: +$6 a minute.", fact: "One big tree can make enough oxygen for two people for a year." },
  garage: { label: "Garage", cost: 900, income: 0, sprite: "garage", does: "Your own car parked outside. Unlocks paint jobs at the Mods shop.", fact: "Electric motors turn about 90% of their energy into motion; petrol engines about 30%." },
  solar: { label: "Solar farm", cost: 1200, income: 30, sprite: "solar", does: "Clean power: +$30 a minute.", fact: "The sunlight hitting Earth in one hour is more energy than humanity uses in a year." },
  lab: { label: "Science lab", cost: 1500, income: 0, sprite: "lab", does: "Harder brain challenges with bigger prizes, any time.", fact: "Scientists test ideas by changing one thing at a time and keeping everything else the same." },
  helipad: { label: "Helipad", cost: 3000, income: 0, sprite: "helipad", does: "Your own helicopter. Fly anywhere, and unlock Sky Patrol.", fact: "A helicopter's spinning blades are wings: curved so air moves faster over the top." },
};
export const PLOT_ORDER: PlotKind[] = ["house", "park", "garage", "solar", "lab", "helipad"];

/* ---------- Upgrades ---------- */

export type UpgradeId = "nitro" | "engine" | "grip" | "armor" | "rapid" | "spread" | "shield";

export const UPGRADES: Record<UpgradeId, { label: string; cost: number; shop: "mods" | "armory"; does: string }> = {
  nitro: { label: "Nitro", cost: 800, shop: "mods", does: "Hold Shift in a vehicle for a burst of speed. Drifting refills it." },
  engine: { label: "Engine tune", cost: 600, shop: "mods", does: "+20% top speed on every vehicle." },
  grip: { label: "Sport tyres", cost: 500, shop: "mods", does: "Sharper steering, less sliding." },
  armor: { label: "Armour plating", cost: 700, shop: "mods", does: "Your vehicles take 40% less damage." },
  rapid: { label: "Rapid blaster", cost: 600, shop: "armory", does: "Fire twice as fast." },
  spread: { label: "Spread shot", cost: 1000, shop: "armory", does: "Three paint pellets per shot." },
  shield: { label: "Shield vest", cost: 800, shop: "armory", does: "+50 shield that recharges out of combat." },
};

export const PAINTS = ["blue", "red", "green", "white", "purple", "black", "pink"] as const;
export type Paint = (typeof PAINTS)[number];
export const PAINT_COST = 150;
export const PAINT_SWATCH: Record<Paint, string> = { blue: "#3fa7ff", red: "#ef5a3c", green: "#5fa35a", white: "#edeae3", purple: "#9b6bff", black: "#2a2a30", pink: "#ff6b8a" };

/** Looks that cost money at the Style shop; everything else is free in the character editor. */
export const STYLE_PRICES: Partial<Record<string, number>> = {
  "hair:braids": 120, "hair:curly": 80, "hair:spiky": 80, "hair:bun": 60,
  "headwear:beret": 150, "headwear:helmet": 200, "headwear:bow": 90, "headwear:headband": 60, "headwear:cap": 50,
  "top:#9b6bff": 100, "top:#ff6b8a": 100, "top:#2a2a30": 120, "top:#ffd36b": 150,
};

/* ---------- Levels ---------- */

export const levelOf = (xp: number) => {
  let lvl = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need && lvl < 30) {
    rest -= need;
    lvl++;
    need = Math.round(need * 1.25);
  }
  return { level: lvl, into: rest, need };
};

/* ---------- Missions (from Sgt. Okafor at the base) ---------- */

export type MissionKind = "defense" | "convoy" | "stealth" | "hack" | "extract" | "sky";

export interface MissionDef {
  id: string;
  kind: MissionKind;
  title: string;
  brief: string;
  reward: number;
  xp: number;
  level: number;
  needs?: PlotKind;
  /** Seconds for 3 and 2 stars. */
  stars: [number, number];
}

export const MISSIONS: MissionDef[] = [
  { id: "defense", kind: "defense", title: "Hold the Base", brief: "Rogue drones are hitting the base. Survive three waves — the last one has a heavy drone. Aim with the mouse, click to fire.", reward: 400, xp: 120, level: 1, stars: [70, 110] },
  { id: "convoy", kind: "convoy", title: "Convoy", brief: "A supply truck is leaving the Depot in the industrial zone for the base. Drones will go for it. Keep it alive all the way.", reward: 550, xp: 160, level: 2, stars: [0.75, 0.4] },
  { id: "stealth", kind: "stealth", title: "Ghost Recon", brief: "Slip into the Red Zone on foot and photograph three targets. Stay out of the searchlights and the guard bots' sight. Get seen and it's over.", reward: 650, xp: 200, level: 3, stars: [80, 130] },
  { id: "hack", kind: "hack", title: "Codebreaker", brief: "Three terminals in the Red Zone are locked with questions. Answer right to download the files. A wrong answer sets off the alarm.", reward: 750, xp: 240, level: 4, stars: [0, 1] },
  { id: "extract", kind: "extract", title: "Extraction", brief: "Three engineers are held in the Red Zone. Free them, then lead them out to the base HQ while the guards hunt you.", reward: 900, xp: 300, level: 5, stars: [100, 160] },
  { id: "sky", kind: "sky", title: "Sky Patrol", brief: "Drones are swarming the city. Take your helicopter up and clear twelve of them.", reward: 1200, xp: 380, level: 6, needs: "helipad", stars: [90, 140] },
];

/* ---------- Races ---------- */

export interface RaceDef {
  id: string;
  title: string;
  /** Checkpoints as [col, row] road tiles; the last one is the finish. */
  route: [number, number][];
  laps: number;
  vehicle?: "bike";
  prize: [number, number, number];
  level: number;
}

export const RACES: RaceDef[] = [
  { id: "downtown", title: "Downtown Dash", route: [[21, 5], [37, 5], [53, 5], [53, 17], [37, 17], [21, 17], [21, 5]], laps: 1, prize: [350, 180, 90], level: 1 },
  { id: "bike", title: "Bike Sprint", vehicle: "bike", route: [[5, 29], [5, 41], [21, 41], [21, 53], [37, 53], [37, 41], [53, 41]], laps: 1, prize: [400, 200, 100], level: 2 },
  { id: "grand", title: "Grand Loop", route: [[5, 5], [69, 5], [69, 53], [5, 53], [5, 5]], laps: 1, prize: [800, 400, 200], level: 4 },
];

/* ---------- People of the city ---------- */

export type ContactId = "okafor" | "maya" | "rio" | "dre" | "lin" | "bea";

export interface StepDef {
  /** What you must do. */
  kind: "talk" | "fetch" | "find" | "riddle" | "stunt" | "race" | "trivia" | "mission" | "deliveries";
  text: string;
  /** Lines the contact says when giving this step. */
  say: string[];
  done: string;
  reward: number;
  xp: number;
  /** fetch/find: where the thing is, as a named place. */
  at?: string;
  to?: ContactId;
  item?: string;
  goal?: number;
  race?: string;
  mission?: string;
  question?: Question;
  unlock?: string;
}

export interface ContactDef {
  name: string;
  role: string;
  look: Hero;
  place: string;
  steps: StepDef[];
}

export const CONTACTS: Record<ContactId, ContactDef> = {
  okafor: {
    name: "Sgt. Okafor", role: "Base commander", place: "hq",
    look: { name: "", hair: "short", hairColor: "#141010", headwear: "beret", skin: "#4f2f1c", top: "#6b7a3a", bottom: "pants", bottomColor: "#4a4a2a" },
    steps: [
      { kind: "mission", mission: "defense", text: "Complete Hold the Base", say: ["Recruit! Good timing.", "Rogue drones have been hitting the base. I need someone fast with a blaster.", "Open your phone → Missions, or press E here to start."], done: "Not bad at all. You've got a future here.", reward: 0, xp: 0 },
      { kind: "mission", mission: "convoy", text: "Complete Convoy", say: ["Our supplies come in by truck from the Depot.", "Drones keep ambushing it. Ride along and keep it alive."], done: "Every crate made it. The base runs on that.", reward: 100, xp: 40 },
      { kind: "mission", mission: "stealth", text: "Complete Ghost Recon", say: ["Something's going on in the Red Zone south of here.", "I need eyes inside. Quiet ones."], done: "These photos change everything. Well done, agent.", reward: 150, xp: 60 },
    ],
  },
  maya: {
    name: "Maya", role: "Runs the café", place: "cafe",
    look: { name: "", hair: "ponytail", hairColor: "#3b2416", headwear: "none", skin: "#c68b5e", top: "#5fa35a", bottom: "skirt", bottomColor: "#2f3a68" },
    steps: [
      { kind: "talk", text: "Say hi to Maya at the café", say: ["Hey! You're new in town? I'm Maya. This café is my baby.", "Want to make some cash? Answer my trivia — every right answer pays."], done: "Come back any time for trivia!", reward: 50, xp: 20 },
      { kind: "fetch", item: "coffee crate", at: "depot", to: "maya", text: "Bring the coffee crate from the Depot", say: ["Disaster — my coffee delivery is stuck at the Depot.", "Could you grab the crate and bring it here? There's a tip in it."], done: "You're a lifesaver. Free coffee forever.", reward: 150, xp: 50 },
      { kind: "trivia", goal: 4, text: "Score 4/5 in café trivia", say: ["Bet you can't get four out of five in my trivia."], done: "Okay, genius. I'm impressed.", reward: 200, xp: 70 },
      { kind: "deliveries", goal: 5, text: "Make 5 pizza deliveries", say: ["My friend at the pizza place is swamped.", "Help her out — 5 deliveries. The tips are good."], done: "She says you're the fastest she's ever had!", reward: 250, xp: 90 },
    ],
  },
  rio: {
    name: "Rio", role: "Mods garage", place: "mods",
    look: { name: "", hair: "spiky", hairColor: "#ff6b8a", headwear: "none", skin: "#e0b48a", top: "#2a2a30", bottom: "pants", bottomColor: "#30343c" },
    steps: [
      { kind: "talk", text: "Visit Rio's Mods garage", say: ["Yo. Rio. I make cars fast and loud.", "Nitro, tyres, armour, paint — if you've got the cash, I've got the parts."], done: "Come back when your ride needs love.", reward: 0, xp: 20 },
      { kind: "race", race: "downtown", text: "Win Downtown Dash", say: ["Wanna prove yourself? Win the Downtown Dash.", "Start flag's on the main road, north side."], done: "Ha! Now THAT was driving.", reward: 300, xp: 100, unlock: "nitro-discount" },
      { kind: "race", race: "grand", text: "Win the Grand Loop", say: ["The Grand Loop. All the way round the city. The big one."], done: "Legend. Your name's on my wall now.", reward: 600, xp: 200 },
    ],
  },
  dre: {
    name: "Coach Dre", role: "Stunt park", place: "stunt",
    look: { name: "", hair: "curly", hairColor: "#2a1a10", headwear: "cap", skin: "#7a4b2c", top: "#ffb224", bottom: "shorts", bottomColor: "#3a3a42" },
    steps: [
      { kind: "stunt", goal: 500, text: "Land a 500-point stunt", say: ["Welcome to the park! Hit a ramp fast, spin with A/D in the air, land straight.", "Show me a 500-point jump."], done: "Clean! You've got the feel for it.", reward: 150, xp: 60 },
      { kind: "stunt", goal: 1500, text: "Land a 1,500-point stunt", say: ["Now go big. Boost pad, ramp, double spin. 1,500."], done: "WHAT. Okay. You're my favourite.", reward: 350, xp: 120 },
    ],
  },
  lin: {
    name: "Dr. Lin", role: "Scientist", place: "school",
    look: { name: "", hair: "bun", hairColor: "#141010", headwear: "none", skin: "#f1c9a5", top: "#edeae3", bottom: "pants", bottomColor: "#30343c" },
    steps: [
      { kind: "riddle", text: "Answer Dr. Lin's riddle", question: { cat: "Physics", q: "A bike and rider weigh 100 kg and go 10 m/s. What's their momentum?", options: ["10 kg·m/s", "100 kg·m/s", "1,000 kg·m/s", "10,000 kg·m/s"], answer: 2, why: "Momentum = mass × velocity = 100 × 10 = 1,000 kg·m/s." }, say: ["Ah, a curious mind. Try this one."], done: "Exactly right. Physics is everywhere in this city.", reward: 120, xp: 50 },
      { kind: "find", item: "lost notebook", at: "lake", to: "lin", text: "Find Dr. Lin's notebook by the lake", say: ["I left my research notebook somewhere by the lake in the park.", "Years of work! Please find it."], done: "My notebook! You've saved my research.", reward: 200, xp: 70, unlock: "lab-discount" },
    ],
  },
  bea: {
    name: "Nana Bea", role: "Neighbour", place: "home",
    look: { name: "", hair: "curly", hairColor: "#c9c9c9", headwear: "none", skin: "#9a6440", top: "#ff6b8a", bottom: "skirt", bottomColor: "#5b3d8f" },
    steps: [
      { kind: "talk", text: "Meet your neighbour Nana Bea", say: ["Welcome to the street, dear! Those empty plots on our block are yours to build on.", "Earn some money and build yourself a home. Press E on a plot."], done: "You'll fit right in.", reward: 100, xp: 20 },
      { kind: "find", item: "cat Biscuit", at: "beach", to: "bea", text: "Find Biscuit the cat on the beach", say: ["Oh no, my cat Biscuit got out again!", "Last time he was down at the beach, sunbathing. Could you look?"], done: "Biscuit! You naughty thing. Thank you, dear.", reward: 180, xp: 60 },
    ],
  },
};

export const CONTACT_ORDER: ContactId[] = ["bea", "maya", "okafor", "rio", "dre", "lin"];

/** Names for random passers-by. */
export const CITIZEN_TOPS = ["#ef5a3c", "#3fa7ff", "#ffb224", "#5fa35a", "#9b6bff", "#ff6b8a", "#edeae3", "#2a2a30", "#4fa3a0"];
export const QUIPS = ["Whoa!", "Hey!", "Watch it!", "Nice ride!", "Slow down!", "Eek!", "Wild!"];
