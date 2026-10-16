/* Stickville: everything the game knows that isn't code — buildings, vehicles, missions,
   quiz questions and the facts hidden around the world. */

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

/* ---------- Vehicles ---------- */

export type VehicleKind = "bike" | "car" | "jeep" | "heli";

export const VEHICLES: Record<VehicleKind, { label: string; accel: number; max: number; air: number; color: string; seats: string }> = {
  bike: { label: "Dirt bike", accel: 900, max: 760, air: 6.5, color: "#ef5a3c", seats: "Flip it in the air for stunt coins" },
  car: { label: "Hatchback", accel: 700, max: 900, air: 3, color: "#3fa7ff", seats: "Fast on the road, steady on hills" },
  jeep: { label: "Army jeep", accel: 650, max: 720, air: 3, color: "#6b7a3a", seats: "Tough: carries supplies and rescued people" },
  heli: { label: "Helicopter", accel: 600, max: 650, air: 0, color: "#ffb224", seats: "Fly anywhere: W up, S down" },
};

/* ---------- Buildings ---------- */

export type BuildingKind = "house" | "school" | "garage" | "barracks" | "workshop" | "solar" | "park" | "hospital" | "helipad";

export interface BuildingDef {
  label: string;
  cost: number;
  /** Coins this building pays every minute. */
  income: number;
  does: string;
  /** The educational note shown when it is finished. */
  fact: string;
  needs?: BuildingKind;
  color: string;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  house: {
    label: "House", cost: 40, income: 6, color: "#e08a5a",
    does: "Neighbours move in and pay rent: +6 coins a minute.",
    fact: "Triangles make roofs strong: a triangle is the only shape that can't be pushed out of shape without bending a side.",
  },
  school: {
    label: "School", cost: 60, income: 0, color: "#c94f4f",
    does: "Take quizzes for coins and XP. Every answer explains itself.",
    fact: "Your brain grows new connections when you learn — and sleep helps lock them in.",
  },
  garage: {
    label: "Garage", cost: 80, income: 0, color: "#4f7fc9",
    does: "Unlocks the hatchback, parked outside.",
    fact: "A car engine turns chemical energy in fuel into heat, then motion. Electric motors skip the heat step, which is why they waste less.",
  },
  barracks: {
    label: "Barracks", cost: 100, income: 0, color: "#6b7a3a",
    does: "Unlocks military missions and the army jeep.",
    fact: "Morse code sends letters as short and long signals. SOS is · · · — — — · · · : easy to send, hard to mistake.",
  },
  workshop: {
    label: "Workshop", cost: 70, income: 0, color: "#8a6a4a",
    does: "Lets you place stunt ramps in the hills (R, 25 coins each).",
    fact: "A ramp is an inclined plane — one of the six simple machines, with the lever, wheel, pulley, wedge and screw.",
  },
  solar: {
    label: "Solar farm", cost: 120, income: 14, color: "#2f5a8a",
    does: "Clean power for the town: +14 coins a minute.",
    fact: "Sunlight takes about 8 minutes and 20 seconds to travel from the Sun to Earth. Solar panels turn it straight into electricity.",
  },
  park: {
    label: "Park", cost: 25, income: 2, color: "#4f9a4a",
    does: "Trees and a bench: +2 coins a minute, and happier citizens.",
    fact: "Trees breathe in carbon dioxide and breathe out oxygen. One big tree can make enough oxygen for two people.",
  },
  hospital: {
    label: "Hospital", cost: 150, income: 4, color: "#e8e8e8",
    does: "Heals you fully whenever you walk past. +4 coins a minute.",
    fact: "Washing your hands for 20 seconds with soap removes most germs — about as long as singing 'Happy Birthday' twice.",
    needs: "house",
  },
  helipad: {
    label: "Helipad", cost: 250, income: 0, color: "#ffb224",
    does: "Unlocks the helicopter and the airlift mission.",
    fact: "Helicopter blades are wings that spin. Each blade is curved so air moves faster over the top, which lifts it.",
    needs: "barracks",
  },
};

export const BUILDING_ORDER: BuildingKind[] = ["park", "house", "school", "workshop", "garage", "barracks", "solar", "hospital", "helipad"];

/* ---------- Ranks ---------- */

export const RANKS = [
  { xp: 0, name: "Recruit" },
  { xp: 60, name: "Private" },
  { xp: 160, name: "Corporal" },
  { xp: 320, name: "Sergeant" },
  { xp: 560, name: "Lieutenant" },
  { xp: 900, name: "Captain" },
  { xp: 1400, name: "Major" },
  { xp: 2100, name: "General" },
];

export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1];
  return { index: i, name: RANKS[i].name, next: next?.xp ?? null, from: RANKS[i].xp };
}

/* ---------- Missions ---------- */

export type MissionKind = "recon" | "supply" | "drill" | "intel" | "rescue" | "airlift" | "defend";

export interface MissionDef {
  id: string;
  kind: MissionKind;
  title: string;
  brief: string;
  time: number;
  reward: number;
  xp: number;
  needs?: BuildingKind;
}

export const MISSIONS: MissionDef[] = [
  { id: "recon", kind: "recon", title: "Recon run", brief: "Scout the desert: reach the watchtower flag and get back to town before the clock runs out.", time: 100, reward: 60, xp: 40 },
  { id: "supply", kind: "supply", title: "Supply drop", brief: "Pick up the supply crate at the depot, then deliver it to the outpost far in the desert. Ride something fast.", time: 120, reward: 80, xp: 50 },
  { id: "drill", kind: "drill", title: "Drone drill", brief: "Training drones are loose over the desert. Pop 8 of them with your paint blaster (F).", time: 90, reward: 90, xp: 60 },
  { id: "intel", kind: "intel", title: "Codebreaker", brief: "Three intel terminals are locked with questions. Reach each one and answer correctly to download the files.", time: 150, reward: 110, xp: 80 },
  { id: "rescue", kind: "rescue", title: "Rescue squad", brief: "Three hikers are stranded in the hills and desert. Reach each one to pick them up, then bring everyone back to town.", time: 160, reward: 130, xp: 90 },
  { id: "airlift", kind: "airlift", title: "Airlift", brief: "Fly the helicopter through all five signal rings above the mountains.", time: 120, reward: 150, xp: 110, needs: "helipad" },
  { id: "defend", kind: "defend", title: "Hold the outpost", brief: "Drones are attacking the outpost — and they shoot back. Pop 15 before time runs out. Keep moving!", time: 150, reward: 220, xp: 160 },
];

/* ---------- Quiz ---------- */

export interface Question {
  cat: "Maths" | "Science" | "Geography" | "Road safety" | "History" | "Nature" | "Space" | "Tech" | "My questions";
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

/* ---------- Facts hidden in the world ---------- */

export const FACTS: { title: string; text: string }[] = [
  { title: "Speed", text: "Speed = distance ÷ time. Your speedometer shows it live when you drive." },
  { title: "Momentum", text: "Heavier, faster things are harder to stop. That's momentum: mass × velocity." },
  { title: "Friction", text: "Friction is the force that slows things rubbing together. Without it, tyres couldn't grip and you couldn't walk." },
  { title: "Gravity", text: "On the Moon gravity is about one-sixth of Earth's: you could jump six times higher." },
  { title: "Deserts", text: "Deserts get less than 25 cm of rain a year. Antarctica counts — it's the largest desert on Earth." },
  { title: "Camouflage", text: "Desert uniforms are sandy brown for the same reason lions are: to blend in with the ground." },
  { title: "Rotation", text: "Spin is easier when you tuck in. Divers, skaters and bike riders all spin faster by pulling their bodies tight." },
  { title: "Teamwork", text: "Rescue teams use the buddy system: never go alone, always know where your partner is." },
  { title: "Radio", text: "Radio waves travel at the speed of light: about 300,000 km every second." },
  { title: "Engineering", text: "Bridges, ramps and roofs use triangles because they spread weight evenly." },
  { title: "Saving", text: "Spending less than you earn, and putting the difference to work, is how towns — and people — grow." },
  { title: "Kindness", text: "Helping someone releases chemicals in your brain that make you feel good too. Heroes are kind first." },
];
