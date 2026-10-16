/* Things that make the city feel lived in: a pet that follows you, texts from the people you
   know, hidden stickers with facts, three daily challenges and the odd rain shower. */

import { CONTACTS, CONTACT_ORDER, type ContactId } from "./data";
import { sfx } from "./audio";
import { T, Tile, type CityMap } from "./map";
import type { City } from "./engine";

/* ---------- Saved state ---------- */

export type PetKind = "dog" | "cat";
export interface PetSave {
  kind: PetKind;
  name: string;
  color: string;
}

export interface Message {
  from: ContactId | "city" | "pet";
  text: string;
  day: number;
  read: boolean;
}

export interface DailyState {
  date: string;
  progress: Record<string, number>;
  claimed: number[];
}

export const PET_COLORS: Record<PetKind, string[]> = {
  dog: ["#c9a26a", "#5a3a1a", "#edeae3", "#2a2a30", "#e08a3a"],
  cat: ["#e08a3a", "#8e8b84", "#2a2a30", "#edeae3", "#c9a26a"],
};

/* ---------- Stickers: 24 hidden around the city, each with a fact ---------- */

export const STICKERS: { icon: string; title: string; fact: string }[] = [
  { icon: "🐙", title: "Three hearts", fact: "An octopus has three hearts and blue blood. Two hearts pump blood to the gills, one to the rest of the body." },
  { icon: "🍯", title: "Forever honey", fact: "Honey doesn't go off: archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible." },
  { icon: "⚡", title: "Lightning", fact: "A lightning bolt is about five times hotter than the surface of the Sun — around 30,000 °C." },
  { icon: "🧠", title: "Brain power", fact: "Your brain uses about 20% of your body's energy while being only 2% of its weight." },
  { icon: "🛰️", title: "Space station", fact: "The International Space Station circles Earth about every 90 minutes — 16 sunrises a day for the crew." },
  { icon: "🐝", title: "Bee maths", fact: "Bees build hexagons because they use the least wax to hold the most honey." },
  { icon: "🌋", title: "Under our feet", fact: "Earth's inner core is a solid ball of iron about as hot as the Sun's surface." },
  { icon: "🧬", title: "Your code", fact: "If you uncoiled the DNA in one of your cells it would stretch about 2 metres." },
  { icon: "🦈", title: "Older than trees", fact: "Sharks have existed for over 400 million years — longer than trees have." },
  { icon: "🌈", title: "Full circle", fact: "Rainbows are actually full circles. From the ground, the horizon hides the bottom half." },
  { icon: "🔭", title: "Looking back", fact: "When you look at a star you see light that left it long ago — some starlight is older than the dinosaurs." },
  { icon: "🧊", title: "Floating ice", fact: "Water expands when it freezes, which is why ice floats and lakes freeze from the top down." },
  { icon: "🦉", title: "Silent flight", fact: "Owls' feathers have soft, comb-like edges that break up air and make their flight almost silent." },
  { icon: "🧲", title: "Magnetic Earth", fact: "Earth's magnetic north pole wanders — it's moving towards Siberia at about 50 km a year." },
  { icon: "🌙", title: "Moving Moon", fact: "The Moon drifts about 3.8 cm further from Earth every year." },
  { icon: "💡", title: "Bright idea", fact: "LED bulbs use about 80% less energy than old-style bulbs and last 25 times longer." },
  { icon: "🎵", title: "Feel the beat", fact: "Music you love releases dopamine, the same feel-good chemical as eating your favourite food." },
  { icon: "🐋", title: "Whale song", fact: "Blue whale calls can travel over 1,000 km under water." },
  { icon: "🌵", title: "Desert sponge", fact: "A big saguaro cactus can soak up and store over 750 litres of water after one rainstorm." },
  { icon: "🚀", title: "Escape speed", fact: "To leave Earth's gravity a rocket needs about 11.2 km per second — 40,000 km/h." },
  { icon: "📡", title: "Radio waves", fact: "Your phone talks to towers with radio waves moving at the speed of light." },
  { icon: "🏛️", title: "Ancient concrete", fact: "Roman concrete gets stronger over time in seawater; scientists are still copying the recipe." },
  { icon: "🧪", title: "Most of you", fact: "About 60% of your body is water. Your brain is around 75%." },
  { icon: "🌍", title: "Spinning planet", fact: "At the equator, Earth's spin carries you at about 1,670 km/h — you just don't feel it." },
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Where the stickers are: the same every game, spread across the city. */
export function stickerSpots(map: CityMap) {
  const r = rng(2024);
  const spots: { x: number; y: number }[] = [];
  const ok = new Set([Tile.Park, Tile.Sidewalk, Tile.Sand, Tile.Concrete, Tile.Grass, Tile.Plot]);
  for (let tries = 0; spots.length < STICKERS.length && tries < 5000; tries++) {
    const x = (3 + r() * 66) * T;
    const y = (3 + r() * 55) * T;
    if (!ok.has(map.tileAt(x, y)) || map.zoneAt(x, y) || map.blocked(x, y, 14)) continue;
    const min = tries < 3000 ? 560 : 300;
    if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < min)) continue;
    spots.push({ x, y });
  }
  return spots;
}

/* ---------- Daily challenges ---------- */

export interface DailyDef {
  key: string;
  label: string;
  goal: number;
  /** "max" keeps the best single value; otherwise values add up. */
  max?: boolean;
}

const DAILY_POOL: DailyDef[] = [
  { key: "pizza", label: "Deliver 3 pizzas", goal: 3 },
  { key: "stunt", label: "Land a 600-point stunt", goal: 600, max: true },
  { key: "drift", label: "Drift 1,500 points in total", goal: 1500 },
  { key: "drones", label: "Pop 12 drones", goal: 12 },
  { key: "quiz", label: "Answer 8 quiz questions right", goal: 8 },
  { key: "sticker", label: "Find 2 stickers", goal: 2 },
  { key: "race", label: "Win a street race", goal: 1 },
  { key: "km", label: "Travel 3 km", goal: 3 },
  { key: "photo", label: "Take a photo with your camera", goal: 1 },
  { key: "fare", label: "Complete 2 taxi fares", goal: 2 },
  { key: "mission", label: "Finish any mission", goal: 1 },
  { key: "pet", label: "Walk 1 km with your pet", goal: 1 },
];

export const DAILY_REWARD = 150;
export const DAILY_BONUS = 300;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function dailyFor(date: string): DailyDef[] {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = rng(h);
  const pool = [...DAILY_POOL];
  const out: DailyDef[] = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

/* ---------- The runtime ---------- */

export interface PetRuntime {
  x: number;
  y: number;
  facing: 1 | -1;
  phase: number;
  bark: number;
  sniff: number | null;
  metres: number;
}

export class Extras {
  pet: PetRuntime | null = null;
  stickers: { x: number; y: number }[];
  notice: { from: Message["from"]; text: string; t: number } | null = null;
  rain = 0;
  private rainTarget = 0;
  private rainT = 240;
  private textT = 4;
  private checkT = 0;

  constructor(private g: City) {
    this.stickers = stickerSpots(g.map);
  }

  /* ---------- Messages ---------- */

  sender(from: Message["from"]) {
    if (from === "city") return "City Hall";
    if (from === "pet") return this.g.save.pet?.name ?? "Your pet";
    return CONTACTS[from].name;
  }

  text(from: Message["from"], text: string) {
    const s = this.g.save;
    s.messages.push({ from, text, day: Math.floor(this.g.time / 360), read: false });
    if (s.messages.length > 60) s.messages.splice(0, s.messages.length - 60);
    this.notice = { from, text, t: 5 };
    sfx.page();
  }

  unread() {
    return this.g.save.messages.filter((m) => !m.read).length;
  }

  /** People text you when they have something new for you (one at a time, not all at once). */
  private checkTexts(dt: number) {
    this.textT -= dt;
    if (this.textT > 0) return;
    const s = this.g.save;
    for (const id of CONTACT_ORDER) {
      const step = this.g.currentStep(id);
      const q = this.g.save.quests[id];
      if (!step || !this.g.hasNews(id)) continue;
      // Only text about the first few people until you've met Nana Bea
      if (id !== "bea" && (s.quests.bea?.step ?? 0) === 0) break;
      const key = `${id}:${q?.step ?? 0}:${q?.accepted ? "ready" : "new"}`;
      if (s.texted.includes(key)) continue;
      s.texted.push(key);
      const body = q?.accepted ? "You did it! Come and see me." : step.say[0] + (step.say[1] ? ` ${step.say[1]}` : "");
      this.text(id, body);
      this.textT = 25;
      return;
    }
    // Once you've met your neighbour, the shelter has someone for you
    if (!s.pet && (s.quests.bea?.step ?? 0) >= 1 && !s.texted.includes("pet-offer")) {
      s.texted.push("pet-offer");
      this.text("city", "The city animal shelter has a dog and a cat looking for a home. Adopt one free: phone → Pet.");
      this.textT = 25;
      return;
    }
    if ((s.quests.bea?.step ?? 0) >= 1 && !s.texted.includes("sticker-hint") && this.g.time > 120) {
      s.texted.push("sticker-hint");
      this.text("city", "There are 24 stickers hidden around the city, each with a fact on it. Collect them all for $1,000 — see phone → Stickers.");
      this.textT = 25;
      return;
    }
    this.textT = 5;
  }

  /* ---------- Daily challenges ---------- */

  daily() {
    const s = this.g.save;
    const date = today();
    if (!s.daily || s.daily.date !== date) {
      const first = !s.daily;
      s.daily = { date, progress: {}, claimed: [] };
      if (!first) this.text("city", "New daily challenges are up — check the Daily app on your phone.");
    }
    return { defs: dailyFor(date), state: s.daily };
  }

  bump(key: string, n = 1) {
    const { defs, state } = this.daily();
    defs.forEach((d, i) => {
      if (d.key !== key || state.claimed.includes(i)) return;
      const before = state.progress[key] ?? 0;
      state.progress[key] = d.max ? Math.max(before, n) : before + n;
      if (state.progress[key] >= d.goal) {
        state.claimed.push(i);
        const bonus = state.claimed.length === 3 ? DAILY_BONUS : 0;
        this.g.reward(DAILY_REWARD + bonus, 50, `Daily challenge done: ${d.label} +$${DAILY_REWARD + bonus}`);
        if (bonus) this.g.toast("ALL DAILY CHALLENGES DONE", "#8bd99b", true);
        sfx.success();
      }
    });
  }

  /* ---------- Pet ---------- */

  adopt(kind: PetKind, name: string, color: string) {
    const first = !this.g.save.pet;
    this.g.save.pet = { kind, name: name.trim().slice(0, 14) || (kind === "dog" ? "Biscuit" : "Mochi"), color };
    const f = this.g.focus();
    this.pet = { x: f.x - 30, y: f.y + 10, facing: 1, phase: 0, bark: 1, sniff: null, metres: 0 };
    if (first) this.text("pet", kind === "dog" ? "Woof! 🐾 (I can sniff out hidden stickers — follow me when I bark!)" : "Mrrow. 🐾 (I can find hidden stickers. Follow me when I meow.)");
    this.g.emitSave();
  }

  private updatePet(dt: number) {
    const s = this.g.save;
    if (!s.pet) {
      this.pet = null;
      return;
    }
    const p = this.g.player;
    if (!this.pet) this.pet = { x: p.x - 30, y: p.y + 10, facing: 1, phase: 0, bark: 3, sniff: null, metres: 0 };
    const pet = this.pet;
    if (p.vehicle) {
      // Riding along
      pet.x = p.vehicle.x;
      pet.y = p.vehicle.y;
      return;
    }
    // Sniffing: an uncollected sticker nearby pulls the pet towards it
    pet.sniff = null;
    let best = 460;
    this.stickers.forEach((st, i) => {
      if (s.stickers.includes(i)) return;
      const d = Math.hypot(st.x - p.x, st.y - p.y);
      if (d < best) {
        best = d;
        pet.sniff = i;
      }
    });
    let tx = p.x - p.facing * 34;
    let ty = p.y + 12;
    if (pet.sniff !== null) {
      const st = this.stickers[pet.sniff];
      const d = Math.hypot(st.x - p.x, st.y - p.y);
      const k = Math.min(1, 150 / d);
      tx = p.x + (st.x - p.x) * k;
      ty = p.y + (st.y - p.y) * k;
      pet.bark -= dt;
      if (pet.bark <= 0) {
        pet.bark = 4;
        this.g.toast(`${s.pet.name} smells something nearby!`, "#ffb224");
      }
    }
    const dx = tx - pet.x;
    const dy = ty - pet.y;
    const d = Math.hypot(dx, dy);
    if (d > 900) {
      pet.x = p.x - 30;
      pet.y = p.y + 10;
      return;
    }
    if (d > 6) {
      const speed = Math.min(320, d * 3.5);
      const mx = (dx / d) * speed * dt;
      const my = (dy / d) * speed * dt;
      if (!this.g.blocked(pet.x + mx, pet.y + my, 6)) {
        pet.x += mx;
        pet.y += my;
      } else {
        pet.x += mx * 0.3;
        pet.y += my * 0.3;
      }
      if (Math.abs(dx) > 2) pet.facing = dx > 0 ? 1 : -1;
      pet.phase += speed * dt * 0.08;
      pet.metres += (speed * dt) / 24;
      if (pet.metres >= 1000) {
        pet.metres -= 1000;
        this.bump("pet");
      }
    }
  }

  /* ---------- Stickers ---------- */

  private updateStickers() {
    const s = this.g.save;
    const f = this.g.focus();
    this.stickers.forEach((st, i) => {
      if (s.stickers.includes(i) || Math.hypot(st.x - f.x, st.y - f.y) > 46) return;
      s.stickers.push(i);
      const k = STICKERS[i];
      this.g.reward(50, 20, `Sticker ${s.stickers.length}/${STICKERS.length}: ${k.icon} ${k.title} +$50`);
      this.g.confetti(st.x, st.y);
      this.g.onSticker(i);
      this.bump("sticker");
      if (s.stickers.length === STICKERS.length) {
        this.g.reward(1000, 300);
        this.g.toast("ALBUM COMPLETE · +$1,000", "#8bd99b", true);
      }
    });
  }

  /* ---------- Weather ---------- */

  private updateWeather(dt: number) {
    this.rainT -= dt;
    if (this.rainT <= 0) {
      if (this.rainTarget > 0) {
        this.rainTarget = 0;
        this.rainT = 240 + Math.random() * 240;
      } else {
        this.rainTarget = 0.6 + Math.random() * 0.4;
        this.rainT = 60 + Math.random() * 50;
        this.g.toast("It's starting to rain — roads are slippery", "#9fd3ff");
      }
    }
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.25);
  }

  /** How well tyres grip right now (wet roads are slippy). */
  grip() {
    return 1 - this.rain * 0.4;
  }

  update(dt: number) {
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 1;
      this.checkTexts(1);
      this.daily();
    }
    if (this.notice) {
      this.notice.t -= dt;
      if (this.notice.t <= 0) this.notice = null;
    }
    this.updatePet(dt);
    this.updateStickers();
    this.updateWeather(dt);
  }
}
