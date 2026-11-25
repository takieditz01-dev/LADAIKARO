export type Rarity =
  | 'Common'
  | 'Rare'
  | 'Epic'
  | 'Legendary'
  | 'Mythic'
  | 'Divine'
  | 'Secret';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type WeatherType = 'clear' | 'rain' | 'mist' | 'embers' | 'snow';

export type WeaponType =
  | 'katana'
  | 'dual_blades'
  | 'spear'
  | 'hammer'
  | 'scythe'
  | 'claws'
  | 'greatsword'
  | 'staff'
  | 'gauntlets'
  | 'orb';

export type SilhouetteStyle =
  | 'ronin'
  | 'ranger'
  | 'brawler'
  | 'assassin'
  | 'paladin'
  | 'titan'
  | 'wraith'
  | 'emperor'
  | 'dragon'
  | 'celestial';

export interface FighterVisual {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  skinColor: string;
  auraColor: string;
  weaponType: WeaponType;
  silhouetteStyle: SilhouetteStyle;
  scale: number;
  hasWings?: boolean;
  hasHorns?: boolean;
  hasCrown?: boolean;
  hasCape?: boolean;
}

export interface FighterStats {
  strength: number; // 1 - 100
  speed: number; // 1 - 100
  defense: number; // 1 - 100
}

export interface FighterDef {
  id: string;
  name: string;
  title: string;
  rarity: Rarity;
  apCost: number;
  minLevel: number;
  requiredBossIndex: number; // 0 = no boss required, 1..16 = boss index cleared
  fightingStyle: string;
  specialName: string;
  specialDesc: string;
  specialElement: 'wind' | 'earth' | 'fire' | 'water' | 'shadow' | 'lightning' | 'light' | 'void' | 'ice';
  comboNames: [string, string, string];
  victoryQuote: string;
  stats: FighterStats;
  visual: FighterVisual;
}

export interface BossDef {
  index: number; // 1..16
  id: string;
  name: string;
  difficultyLabel: string;
  arenaId: ArenaId;
  maxHp: number;
  attackPower: number;
  speed: number;
  defense: number;
  apReward: number;
  firstClearBonusAp: number;
  xpReward: number;
  minLevel: number;
  fightingStyle: string;
  specialAttacks: string[];
  introLine: string;
  defeatLine: string;
  isSecret: boolean;
  visual: FighterVisual;
}

export type ArenaId =
  | 'jungle_falls'
  | 'ancient_temple'
  | 'mountain_peak'
  | 'lost_forest'
  | 'volcano_valley'
  | 'tropical_island'
  | 'bamboo_forest'
  | 'mystic_lake';

export interface ArenaDef {
  id: ArenaId;
  name: string;
  subtitle: string;
  weather: WeatherType;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  groundColor: string;
  accentColor: string;
  waterColor: string;
  radius: number;
}

export type MissionDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Legendary';

export type MissionMetric =
  | 'forest_warriors_defeated'
  | 'total_wins'
  | 'elite_defeated'
  | 'bosses_defeated'
  | 'online_wins'
  | 'flawless_rounds'
  | 'combos_landed'
  | 'objects_destroyed'
  | 'ranked_wins'
  | 'specials_hit'
  | 'parries_landed';

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  difficulty: MissionDifficulty;
  minLevel: number;
  metric: MissionMetric;
  target: number;
  xpReward: number;
  apReward: number;
  isDaily?: boolean;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  apBonus: number;
  metric: keyof PlayerStatsSnapshot;
  target: number;
}

export interface PlayerStatsSnapshot {
  level: number;
  xp: number;
  ap: number;
  wins: number;
  losses: number;
  onlineWins: number;
  onlineLosses: number;
  rankedWins: number;
  rankedRating: number;
  highestBossCleared: number;
  bossKillsTotal: number;
  forestWarriorsDefeated: number;
  eliteDefeated: number;
  flawlessRounds: number;
  combosLanded: number;
  objectsDestroyed: number;
  specialsHit: number;
  parriesLanded: number;
}

export interface MatchHistoryEntry {
  id: number;
  mode: string;
  opponentName: string;
  arenaId: ArenaId;
  fighterId: string;
  result: 'WIN' | 'LOSS';
  apEarned: number;
  xpEarned: number;
  roundsWon: number;
  roundsLost: number;
  createdAt: string;
}

export interface PlayerProfile {
  id: number;
  playerCode: string; // e.g. WA-482910
  username: string;
  selectedFighterId: string;
  unlockedFighters: string[];
  claimedMissions: string[];
  claimedAchievements: string[];
  stats: PlayerStatsSnapshot;
  missionProgress: Record<string, number>;
  rankPosition?: number;
}

export interface FriendEntry {
  id: number;
  playerCode: string;
  username: string;
  level: number;
  rankedRating: number;
  online: boolean;
  inMatch: boolean;
}

export interface FriendRequestEntry {
  id: number;
  fromUserId: number;
  fromUsername: string;
  fromPlayerCode: string;
  fromLevel: number;
  createdAt: string;
}

export const RARITY_COLORS: Record<Rarity, { text: string; border: string; bg: string }> = {
  Common: { text: '#c4cec2', border: '#6b7a69', bg: '#1e2620' },
  Rare: { text: '#56b4ff', border: '#2e7fc2', bg: '#102438' },
  Epic: { text: '#c57aff', border: '#893cd1', bg: '#26143b' },
  Legendary: { text: '#ffb84d', border: '#c97b18', bg: '#33200a' },
  Mythic: { text: '#ff5c77', border: '#c42442', bg: '#360d17' },
  Divine: { text: '#ffe680', border: '#e5b82e', bg: '#332b0d' },
  Secret: { text: '#5ef2d6', border: '#1fb59a', bg: '#0c2b26' },
};

export const AP_REWARDS = {
  ONLINE_WIN: 100,
  RANKED_WIN: 150,
  TEAM_2V2_WIN: 125,
  BOSS_DEFEAT: 250,
  SKIRMISH_WIN: 45,
};

export function xpForLevel(level: number): number {
  if (level <= 1) return 100;
  return 100 * level + 55 * (level - 1) * (level - 1);
}

/**
 * Competitive Ranked Balance:
 * Clamps extreme Divine/Secret stat spreads in Ranked PvP so skill, timing,
 * combos, blocking, and parrying decide ranked outcomes while preserving fighter identity.
 */
export function getEffectiveStats(fighter: FighterDef, isRanked: boolean): FighterStats {
  if (!isRanked) return fighter.stats;
  const clampStat = (v: number) => Math.round(62 + (v - 50) * 0.48);
  return {
    strength: clampStat(fighter.stats.strength),
    speed: clampStat(fighter.stats.speed),
    defense: clampStat(fighter.stats.defense),
  };
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'jungle_falls',
    name: 'Jungle Falls',
    subtitle: 'Emerald cascades & mossy cliffside ruins',
    weather: 'mist',
    skyTop: '#1f4f4c',
    skyHorizon: '#8bc4b0',
    fogColor: '#6fa897',
    fogDensity: 0.011,
    sunColor: '#fff2cc',
    sunIntensity: 2.3,
    hemiSky: '#a6e3d0',
    hemiGround: '#243d27',
    groundColor: '#365831',
    accentColor: '#4fa874',
    waterColor: '#2ea8a0',
    radius: 22,
  },
  {
    id: 'ancient_temple',
    name: 'Ancient Temple',
    subtitle: 'Sun-scorched sandstone sanctuary & sacred braziers',
    weather: 'clear',
    skyTop: '#2c4c7e',
    skyHorizon: '#e8c79b',
    fogColor: '#d9b587',
    fogDensity: 0.009,
    sunColor: '#ffe0a8',
    sunIntensity: 2.6,
    hemiSky: '#ffe7c2',
    hemiGround: '#59422a',
    groundColor: '#8d7553',
    accentColor: '#d4a84b',
    waterColor: '#3a7a78',
    radius: 22,
  },
  {
    id: 'mountain_peak',
    name: 'Mountain Peak',
    subtitle: 'Frost-crowned summit high above the clouds',
    weather: 'snow',
    skyTop: '#1a2f4d',
    skyHorizon: '#b8d3eb',
    fogColor: '#adc8df',
    fogDensity: 0.012,
    sunColor: '#f5f9ff',
    sunIntensity: 2.4,
    hemiSky: '#cbe2f8',
    hemiGround: '#435261',
    groundColor: '#8493a2',
    accentColor: '#d9eeff',
    waterColor: '#639ec7',
    radius: 22,
  },
  {
    id: 'lost_forest',
    name: 'Lost Forest',
    subtitle: 'Ancient spirit oaks & bioluminescent glade',
    weather: 'mist',
    skyTop: '#10241d',
    skyHorizon: '#48735b',
    fogColor: '#3d634e',
    fogDensity: 0.014,
    sunColor: '#c9ffd9',
    sunIntensity: 1.9,
    hemiSky: '#87c49c',
    hemiGround: '#1a2b1e',
    groundColor: '#28422b',
    accentColor: '#56e8a6',
    waterColor: '#2c7d6e',
    radius: 22,
  },
  {
    id: 'volcano_valley',
    name: 'Volcano Valley',
    subtitle: 'Obsidian caldera ringed by molten magma rivers',
    weather: 'embers',
    skyTop: '#260c0a',
    skyHorizon: '#9e361c',
    fogColor: '#6e2314',
    fogDensity: 0.013,
    sunColor: '#ff9248',
    sunIntensity: 2.5,
    hemiSky: '#ff7a3d',
    hemiGround: '#24120f',
    groundColor: '#2b2526',
    accentColor: '#ff5722',
    waterColor: '#ff4500',
    radius: 22,
  },
  {
    id: 'tropical_island',
    name: 'Tropical Island',
    subtitle: 'Golden coral atoll & turquoise ocean surf',
    weather: 'clear',
    skyTop: '#1767a6',
    skyHorizon: '#9ce6f5',
    fogColor: '#8fdbe8',
    fogDensity: 0.008,
    sunColor: '#fff6d6',
    sunIntensity: 2.7,
    hemiSky: '#b5f0ff',
    hemiGround: '#6b5e3c',
    groundColor: '#d6be86',
    accentColor: '#36c98e',
    waterColor: '#1cb5d4',
    radius: 22,
  },
  {
    id: 'bamboo_forest',
    name: 'Bamboo Forest',
    subtitle: 'Whispering jade stalks & rain-swept stone courtyard',
    weather: 'rain',
    skyTop: '#1d3028',
    skyHorizon: '#678a74',
    fogColor: '#597a65',
    fogDensity: 0.013,
    sunColor: '#dcf2e0',
    sunIntensity: 1.95,
    hemiSky: '#a8cfb4',
    hemiGround: '#293829',
    groundColor: '#4c5c49',
    accentColor: '#6cc96f',
    waterColor: '#3d7068',
    radius: 22,
  },
  {
    id: 'mystic_lake',
    name: 'Mystic Lake',
    subtitle: 'Moonlit mirror shallows & floating spirit lanterns',
    weather: 'mist',
    skyTop: '#0d1429',
    skyHorizon: '#3d5385',
    fogColor: '#2e416e',
    fogDensity: 0.012,
    sunColor: '#c7dcff',
    sunIntensity: 2.0,
    hemiSky: '#7d9ce0',
    hemiGround: '#1a233d',
    groundColor: '#374863',
    accentColor: '#66d9ff',
    waterColor: '#23598c',
    radius: 22,
  },
];

export const FIGHTERS: FighterDef[] = [
  // --- STARTER / COMMON (3 unlocked by default) ---
  {
    id: 'kael_strider',
    name: 'Kael Strider',
    title: 'Wind Blade Ronin',
    rarity: 'Common',
    apCost: 0,
    minLevel: 1,
    requiredBossIndex: 0,
    fightingStyle: 'Swift Katana & Gale Footwork',
    specialName: 'Tempest Crescent',
    specialDesc: 'Launches a razor-sharp wind slash wave forward.',
    specialElement: 'wind',
    comboNames: ['Gale Cut', 'Whirlwind Cross', 'Sky Splitter'],
    victoryQuote: 'The wind bows to discipline alone.',
    stats: { strength: 64, speed: 74, defense: 58 },
    visual: {
      primaryColor: '#2b4d3e',
      secondaryColor: '#d4a84b',
      accentColor: '#6ef2c4',
      skinColor: '#d9a78b',
      auraColor: '#6ef2c4',
      weaponType: 'katana',
      silhouetteStyle: 'ronin',
      scale: 1.0,
      hasCape: true,
    },
  },
  {
    id: 'lyra_vale',
    name: 'Lyra Vale',
    title: 'Vine Lash Ranger',
    rarity: 'Common',
    apCost: 0,
    minLevel: 1,
    requiredBossIndex: 0,
    fightingStyle: 'Acrobatic Kicks & Dual Blades',
    specialName: 'Emerald Vortex',
    specialDesc: 'Rapid spinning blade storm that shreds nearby foes.',
    specialElement: 'wind',
    comboNames: ['Briar Snap', 'Leaf Flurry', 'Canopy Drop'],
    victoryQuote: 'Fast as a falling leaf, lethal as a thorn.',
    stats: { strength: 58, speed: 84, defense: 54 },
    visual: {
      primaryColor: '#236943',
      secondaryColor: '#8c5a32',
      accentColor: '#a6ff6b',
      skinColor: '#e2b59b',
      auraColor: '#a6ff6b',
      weaponType: 'dual_blades',
      silhouetteStyle: 'ranger',
      scale: 0.96,
    },
  },
  {
    id: 'torin_oak',
    name: 'Torin Oakshield',
    title: 'Iron Fist Brawler',
    rarity: 'Common',
    apCost: 0,
    minLevel: 1,
    requiredBossIndex: 0,
    fightingStyle: 'Heavy Brawling & Seismic Slam',
    specialName: 'Quake Breaker',
    specialDesc: 'Slams the earth to erupt a shockwave around Torin.',
    specialElement: 'earth',
    comboNames: ['Boulder Jab', 'Timber Hook', 'Avalanche'],
    victoryQuote: 'Mountains do not flinch. Neither do I.',
    stats: { strength: 76, speed: 52, defense: 76 },
    visual: {
      primaryColor: '#6b492d',
      secondaryColor: '#7a878f',
      accentColor: '#e09a48',
      skinColor: '#c98e6b',
      auraColor: '#e09a48',
      weaponType: 'gauntlets',
      silhouetteStyle: 'brawler',
      scale: 1.08,
    },
  },

  // --- RARE (3) ---
  {
    id: 'soren_ash',
    name: 'Soren Ashfall',
    title: 'Ember Fist Monk',
    rarity: 'Rare',
    apCost: 200,
    minLevel: 2,
    requiredBossIndex: 1,
    fightingStyle: 'Blazing Martial Arts & Fire Kicks',
    specialName: 'Cinder Dragon Kick',
    specialDesc: 'Ignites a forward spiral flame burst.',
    specialElement: 'fire',
    comboNames: ['Spark Palm', 'Cinder Wheel', 'Phoenix Heel'],
    victoryQuote: 'Only ashes remain of hesitation.',
    stats: { strength: 72, speed: 78, defense: 60 },
    visual: {
      primaryColor: '#8c281b',
      secondaryColor: '#262121',
      accentColor: '#ff7b2e',
      skinColor: '#d49d7d',
      auraColor: '#ff7b2e',
      weaponType: 'gauntlets',
      silhouetteStyle: 'brawler',
      scale: 1.0,
    },
  },
  {
    id: 'nara_tide',
    name: 'Nara Tidecaller',
    title: 'Hydro Spear Lancer',
    rarity: 'Rare',
    apCost: 250,
    minLevel: 2,
    requiredBossIndex: 1,
    fightingStyle: 'Long-Reach Trident & Surge Thrusts',
    specialName: 'Tidal Impale',
    specialDesc: 'Projects a high-pressure water surge lance.',
    specialElement: 'water',
    comboNames: ['Ripple Poke', 'Riptide Sweep', 'Tsunami Surge'],
    victoryQuote: 'The ocean spares no careless warrior.',
    stats: { strength: 68, speed: 76, defense: 68 },
    visual: {
      primaryColor: '#1b5c7a',
      secondaryColor: '#a6d9e8',
      accentColor: '#3ef0ff',
      skinColor: '#c79b83',
      auraColor: '#3ef0ff',
      weaponType: 'spear',
      silhouetteStyle: 'ranger',
      scale: 0.99,
      hasCape: true,
    },
  },
  {
    id: 'vorn_crag',
    name: 'Vorn Cragbreaker',
    title: 'Stone Hammer Titan',
    rarity: 'Rare',
    apCost: 300,
    minLevel: 3,
    requiredBossIndex: 2,
    fightingStyle: 'Crushing War-Hammer & Armor Guard',
    specialName: 'Tectonic Crush',
    specialDesc: 'Overhead hammer smash that shatters blocks.',
    specialElement: 'earth',
    comboNames: ['Granite Swing', 'Fault Cleave', 'Meteor Maul'],
    victoryQuote: 'Steel bends. Granite endures.',
    stats: { strength: 84, speed: 48, defense: 84 },
    visual: {
      primaryColor: '#4e5459',
      secondaryColor: '#8a6b3e',
      accentColor: '#ffb74d',
      skinColor: '#9c8370',
      auraColor: '#ffb74d',
      weaponType: 'hammer',
      silhouetteStyle: 'titan',
      scale: 1.12,
    },
  },

  // --- EPIC (5) ---
  {
    id: 'kiri_mist',
    name: 'Kiri Mistweaver',
    title: 'Phantom Kunai Assassin',
    rarity: 'Epic',
    apCost: 450,
    minLevel: 4,
    requiredBossIndex: 2,
    fightingStyle: 'Shadow Step & Rapid Twin Strikes',
    specialName: 'Mirage Execution',
    specialDesc: 'Blinks forward in a burst of phantom blades.',
    specialElement: 'shadow',
    comboNames: ['Mist Fang', 'Silent Cross', 'Nightfall Fang'],
    victoryQuote: 'You struck only my shadow.',
    stats: { strength: 74, speed: 92, defense: 58 },
    visual: {
      primaryColor: '#251d36',
      secondaryColor: '#5c3c8a',
      accentColor: '#b77dff',
      skinColor: '#d9c2b8',
      auraColor: '#b77dff',
      weaponType: 'dual_blades',
      silhouetteStyle: 'assassin',
      scale: 0.97,
      hasCape: true,
    },
  },
  {
    id: 'zephyr_claw',
    name: 'Zephyr Skyclaw',
    title: 'Talon Aerialist',
    rarity: 'Epic',
    apCost: 500,
    minLevel: 4,
    requiredBossIndex: 3,
    fightingStyle: 'High-Altitude Dive Kicks & Claws',
    specialName: 'Hurricane Talon',
    specialDesc: 'Unleashes a piercing cyclone vortex.',
    specialElement: 'wind',
    comboNames: ['Hawk Rake', 'Updraft Kick', 'Gale Rend'],
    victoryQuote: 'The sky belongs to the swift.',
    stats: { strength: 76, speed: 90, defense: 62 },
    visual: {
      primaryColor: '#2f636b',
      secondaryColor: '#e0c078',
      accentColor: '#73ffea',
      skinColor: '#d1a288',
      auraColor: '#73ffea',
      weaponType: 'claws',
      silhouetteStyle: 'ranger',
      scale: 1.0,
      hasWings: true,
    },
  },
  {
    id: 'aurelia_sun',
    name: 'Aurelia Sunblade',
    title: 'Radiant Paladin',
    rarity: 'Epic',
    apCost: 550,
    minLevel: 5,
    requiredBossIndex: 3,
    fightingStyle: 'Radiant Greatsword & Solar Ward',
    specialName: 'Solar Flare',
    specialDesc: 'Releases a blinding golden pillar of light.',
    specialElement: 'light',
    comboNames: ['Dawn Edge', 'Sunburst Arc', 'Solstice Cleave'],
    victoryQuote: 'Darkness scatters before the dawn.',
    stats: { strength: 80, speed: 70, defense: 82 },
    visual: {
      primaryColor: '#c9982c',
      secondaryColor: '#f5efe0',
      accentColor: '#fff08a',
      skinColor: '#e5baa0',
      auraColor: '#fff08a',
      weaponType: 'greatsword',
      silhouetteStyle: 'paladin',
      scale: 1.03,
      hasCape: true,
      hasCrown: true,
    },
  },
  {
    id: 'garruk_fang',
    name: 'Garruk Wolfang',
    title: 'Savage Berserker',
    rarity: 'Epic',
    apCost: 600,
    minLevel: 5,
    requiredBossIndex: 4,
    fightingStyle: 'Frenzied Wolf Claws & Pounce',
    specialName: 'Bloodmoon Howl',
    specialDesc: 'Primal roar shockwave with savage claw lunge.',
    specialElement: 'fire',
    comboNames: ['Feral Rip', 'Pack Rush', 'Apex Mauling'],
    victoryQuote: 'The wild claims its prey!',
    stats: { strength: 88, speed: 76, defense: 66 },
    visual: {
      primaryColor: '#4f201d',
      secondaryColor: '#363230',
      accentColor: '#ff4f4f',
      skinColor: '#b38268',
      auraColor: '#ff4f4f',
      weaponType: 'claws',
      silhouetteStyle: 'brawler',
      scale: 1.07,
      hasHorns: true,
    },
  },
  {
    id: 'seraph_frost',
    name: 'Seraphina Frost',
    title: 'Cryo Valkyrie',
    rarity: 'Epic',
    apCost: 650,
    minLevel: 6,
    requiredBossIndex: 4,
    fightingStyle: 'Glacial Spear & Ice Nova',
    specialName: 'Absolute Zero',
    specialDesc: 'Shatters crystalline frost spikes around Seraphina.',
    specialElement: 'ice',
    comboNames: ['Frost Pierce', 'Glacier Arc', 'Blizzard Lance'],
    victoryQuote: 'Frozen in awe, shattered in defeat.',
    stats: { strength: 78, speed: 80, defense: 76 },
    visual: {
      primaryColor: '#255b8a',
      secondaryColor: '#dceeff',
      accentColor: '#7ce8ff',
      skinColor: '#ead3c7',
      auraColor: '#7ce8ff',
      weaponType: 'spear',
      silhouetteStyle: 'paladin',
      scale: 1.01,
      hasWings: true,
    },
  },

  // --- LEGENDARY (3) ---
  {
    id: 'shadow_reaper',
    name: 'Shadow Reaper',
    title: 'Harbinger of Night',
    rarity: 'Legendary',
    apCost: 1000,
    minLevel: 7,
    requiredBossIndex: 4,
    fightingStyle: 'Spectral Scythe & Void Crescent',
    specialName: 'Soul Harvest',
    specialDesc: 'Massive dark crescent sweep that drains enemy vitality.',
    specialElement: 'shadow',
    comboNames: ['Reap Arc', 'Phantom Spin', 'Death Sentence'],
    victoryQuote: 'Your shadow already belonged to me.',
    stats: { strength: 88, speed: 86, defense: 74 },
    visual: {
      primaryColor: '#14111c',
      secondaryColor: '#3c2459',
      accentColor: '#d05cff',
      skinColor: '#8d879e',
      auraColor: '#d05cff',
      weaponType: 'scythe',
      silhouetteStyle: 'wraith',
      scale: 1.06,
      hasCape: true,
      hasHorns: true,
    },
  },
  {
    id: 'crimson_shogun',
    name: 'Crimson Shogun',
    title: 'Infernal Odachi Master',
    rarity: 'Legendary',
    apCost: 1100,
    minLevel: 8,
    requiredBossIndex: 5,
    fightingStyle: 'Iaijutsu Dash & Blazing Katana',
    specialName: 'Scarlet Flash',
    specialDesc: 'High-speed flame draw cut across the arena.',
    specialElement: 'fire',
    comboNames: ['Ember Draw', 'Crimson Lotus', 'Shogun Judgment'],
    victoryQuote: 'A single draw decides eternity.',
    stats: { strength: 90, speed: 84, defense: 78 },
    visual: {
      primaryColor: '#7a1216',
      secondaryColor: '#d9a441',
      accentColor: '#ff5238',
      skinColor: '#cfa28a',
      auraColor: '#ff5238',
      weaponType: 'katana',
      silhouetteStyle: 'ronin',
      scale: 1.05,
      hasHorns: true,
      hasCape: true,
    },
  },
  {
    id: 'jade_empress',
    name: 'Jade Empress',
    title: 'Emerald Dragon Mystic',
    rarity: 'Legendary',
    apCost: 1200,
    minLevel: 9,
    requiredBossIndex: 6,
    fightingStyle: 'Qi Orb Barrage & Dragon Palm',
    specialName: 'Jade Dragon Spiral',
    specialDesc: 'Summons swirling emerald energy orbs.',
    specialElement: 'wind',
    comboNames: ['Lotus Palm', 'Jade Whip', 'Imperial Gale'],
    victoryQuote: 'Harmony and power are one.',
    stats: { strength: 84, speed: 88, defense: 82 },
    visual: {
      primaryColor: '#115946',
      secondaryColor: '#e0c163',
      accentColor: '#4fffb0',
      skinColor: '#e8c4b0',
      auraColor: '#4fffb0',
      weaponType: 'orb',
      silhouetteStyle: 'emperor',
      scale: 1.02,
      hasCrown: true,
      hasCape: true,
    },
  },

  // --- MYTHIC (3) ---
  {
    id: 'inferno_king',
    name: 'Inferno King',
    title: 'Magma Sovereign',
    rarity: 'Mythic',
    apCost: 1600,
    minLevel: 10,
    requiredBossIndex: 7,
    fightingStyle: 'Volcanic Greatsword & Lava Eruption',
    specialName: 'Caldera Cataclysm',
    specialDesc: 'Detonates a volcanic magma ring around Inferno King.',
    specialElement: 'fire',
    comboNames: ['Magma Cleave', 'Obsidian Crush', 'Sovereign Flare'],
    victoryQuote: 'Kneel before the living volcano.',
    stats: { strength: 95, speed: 78, defense: 90 },
    visual: {
      primaryColor: '#2e1614',
      secondaryColor: '#ff4800',
      accentColor: '#ffae33',
      skinColor: '#6b3226',
      auraColor: '#ff5500',
      weaponType: 'greatsword',
      silhouetteStyle: 'emperor',
      scale: 1.14,
      hasCrown: true,
      hasHorns: true,
      hasCape: true,
    },
  },
  {
    id: 'thunder_emperor',
    name: 'Thunder Emperor',
    title: 'Storm Sovereign',
    rarity: 'Mythic',
    apCost: 1750,
    minLevel: 11,
    requiredBossIndex: 8,
    fightingStyle: 'Tempest Staff & Lightning Judgment',
    specialName: 'Skyfall Judgement',
    specialDesc: 'Calls down high-voltage lightning arcs on impact.',
    specialElement: 'lightning',
    comboNames: ['Spark Jab', 'Thunderclap', 'Imperial Bolt'],
    victoryQuote: 'None outrun the lightning.',
    stats: { strength: 92, speed: 94, defense: 80 },
    visual: {
      primaryColor: '#192a56',
      secondaryColor: '#e6c24c',
      accentColor: '#5ce1ff',
      skinColor: '#d1b29e',
      auraColor: '#5ce1ff',
      weaponType: 'staff',
      silhouetteStyle: 'emperor',
      scale: 1.08,
      hasCrown: true,
      hasCape: true,
    },
  },
  {
    id: 'eclipse_valkyrie',
    name: 'Eclipse Valkyrie',
    title: 'Twilight Archon',
    rarity: 'Mythic',
    apCost: 1900,
    minLevel: 12,
    requiredBossIndex: 9,
    fightingStyle: 'Celestial Spear & Lunar-Solar Nova',
    specialName: 'Total Eclipse',
    specialDesc: 'Twin dark-and-gold energy shockwave blast.',
    specialElement: 'light',
    comboNames: ['Crescent Thrust', 'Corona Sweep', 'Archon Dive'],
    victoryQuote: 'Between shadow and starlight, I reign.',
    stats: { strength: 90, speed: 92, defense: 86 },
    visual: {
      primaryColor: '#2c1e4a',
      secondaryColor: '#f2c94c',
      accentColor: '#ff85d8',
      skinColor: '#e2c7c0',
      auraColor: '#ff85d8',
      weaponType: 'spear',
      silhouetteStyle: 'celestial',
      scale: 1.06,
      hasWings: true,
      hasCrown: true,
    },
  },

  // --- DIVINE (3) ---
  {
    id: 'dragon_overlord',
    name: 'Dragon Overlord',
    title: 'Draconic Warlord',
    rarity: 'Divine',
    apCost: 2500,
    minLevel: 13,
    requiredBossIndex: 10,
    fightingStyle: 'Dragon Claws, Wing Slam & Breath',
    specialName: 'Draconic Inferno',
    specialDesc: 'Unleashes a devastating golden dragonfire wave.',
    specialElement: 'fire',
    comboNames: ['Wyrm Rend', 'Tail Sweep', 'Overlord Roar'],
    victoryQuote: 'Mortals fade. Dragons remain eternal.',
    stats: { strength: 98, speed: 88, defense: 94 },
    visual: {
      primaryColor: '#591016',
      secondaryColor: '#e8b938',
      accentColor: '#ff7722',
      skinColor: '#8c2a24',
      auraColor: '#ffaa22',
      weaponType: 'greatsword',
      silhouetteStyle: 'dragon',
      scale: 1.18,
      hasWings: true,
      hasHorns: true,
    },
  },
  {
    id: 'void_destroyer',
    name: 'Void Destroyer',
    title: 'Abyssal Executioner',
    rarity: 'Divine',
    apCost: 2800,
    minLevel: 14,
    requiredBossIndex: 11,
    fightingStyle: 'Singularity Hammer & Gravity Crush',
    specialName: 'Event Horizon',
    specialDesc: 'Collapses dark void gravity around nearby enemies.',
    specialElement: 'void',
    comboNames: ['Null Strike', 'Rift Smash', 'Abyssal End'],
    victoryQuote: 'Everything returns to the void.',
    stats: { strength: 99, speed: 84, defense: 96 },
    visual: {
      primaryColor: '#0e0b14',
      secondaryColor: '#4c1d95',
      accentColor: '#a855f7',
      skinColor: '#4b455e',
      auraColor: '#a855f7',
      weaponType: 'hammer',
      silhouetteStyle: 'titan',
      scale: 1.2,
      hasHorns: true,
      hasCape: true,
    },
  },
  {
    id: 'chronos_warden',
    name: 'Chronos Warden',
    title: 'Temporal Guardian',
    rarity: 'Divine',
    apCost: 3000,
    minLevel: 15,
    requiredBossIndex: 12,
    fightingStyle: 'Time-Lock Twin Blades & Paradox Strike',
    specialName: 'Temporal Shatter',
    specialDesc: 'Freezes momentum and unleashes a triple echo blast.',
    specialElement: 'lightning',
    comboNames: ['Tick Slash', 'Paradox Spin', 'Eternity Cut'],
    victoryQuote: 'Your defeat happened before you swung.',
    stats: { strength: 94, speed: 97, defense: 91 },
    visual: {
      primaryColor: '#163847',
      secondaryColor: '#ffd470',
      accentColor: '#66f7ff',
      skinColor: '#c9d7e0',
      auraColor: '#66f7ff',
      weaponType: 'dual_blades',
      silhouetteStyle: 'celestial',
      scale: 1.09,
      hasCrown: true,
      hasWings: true,
    },
  },

  // --- SECRET (2) ---
  {
    id: 'celestial_warrior',
    name: 'Celestial Warrior',
    title: 'Astral Light Avatar',
    rarity: 'Secret',
    apCost: 3500,
    minLevel: 16,
    requiredBossIndex: 14,
    fightingStyle: 'Astral Blade & Starfall Judgment',
    specialName: 'Starfall Nova',
    specialDesc: 'Calls radiant astral beams across the arena.',
    specialElement: 'light',
    comboNames: ['Nova Slash', 'Comet Thrust', 'Astral Ascension'],
    victoryQuote: 'Stars witness the triumph of pure spirit.',
    stats: { strength: 98, speed: 98, defense: 95 },
    visual: {
      primaryColor: '#f5f2e6',
      secondaryColor: '#ffd35c',
      accentColor: '#6ef7ff',
      skinColor: '#f2dec9',
      auraColor: '#7df9ff',
      weaponType: 'greatsword',
      silhouetteStyle: 'celestial',
      scale: 1.12,
      hasWings: true,
      hasCrown: true,
      hasCape: true,
    },
  },
  {
    id: 'primordial_wild',
    name: 'Apex Wildborn',
    title: 'Spirit of the Arena',
    rarity: 'Secret',
    apCost: 4000,
    minLevel: 18,
    requiredBossIndex: 15,
    fightingStyle: 'All-Elemental Primal Mastery',
    specialName: 'Genesis Cataclysm',
    specialDesc: 'Unleashes earth, storm, and spirit energy simultaneously.',
    specialElement: 'void',
    comboNames: ['Wild Fang', 'Elemental Surge', 'Apex Genesis'],
    victoryQuote: 'I am the arena itself.',
    stats: { strength: 100, speed: 99, defense: 98 },
    visual: {
      primaryColor: '#0e3b33',
      secondaryColor: '#f7c948',
      accentColor: '#45ffcf',
      skinColor: '#98c7b8',
      auraColor: '#45ffcf',
      weaponType: 'orb',
      silhouetteStyle: 'dragon',
      scale: 1.16,
      hasWings: true,
      hasHorns: true,
      hasCrown: true,
    },
  },
];

export const BOSSES: BossDef[] = [
  {
    index: 1,
    id: 'boss_forest_guardian',
    name: 'Forest Guardian',
    difficultyLabel: 'Beginner',
    arenaId: 'lost_forest',
    maxHp: 280,
    attackPower: 14,
    speed: 0.85,
    defense: 12,
    apReward: 250,
    firstClearBonusAp: 100,
    xpReward: 120,
    minLevel: 1,
    fightingStyle: 'Ancient Oak Slam & Root Tremor',
    specialAttacks: ['Timber Smash', 'Briar Shockwave'],
    introLine: 'Trespasser! The ancient woods shall test your resolve!',
    defeatLine: 'The forest... acknowledges your strength.',
    isSecret: false,
    visual: {
      primaryColor: '#2d4d27',
      secondaryColor: '#5c4028',
      accentColor: '#76ff7a',
      skinColor: '#4f3b26',
      auraColor: '#76ff7a',
      weaponType: 'hammer',
      silhouetteStyle: 'titan',
      scale: 1.38,
      hasHorns: true,
    },
  },
  {
    index: 2,
    id: 'boss_stone_warrior',
    name: 'Stone Warrior',
    difficultyLabel: 'Easy',
    arenaId: 'ancient_temple',
    maxHp: 350,
    attackPower: 17,
    speed: 0.88,
    defense: 20,
    apReward: 250,
    firstClearBonusAp: 120,
    xpReward: 160,
    minLevel: 1,
    fightingStyle: 'Monolith Greatsword & Guard Counter',
    specialAttacks: ['Ruins Cleave', 'Sandstone Quake'],
    introLine: 'For a thousand years I have guarded these temple stones!',
    defeatLine: 'My stone armor cracks... pass, challenger.',
    isSecret: false,
    visual: {
      primaryColor: '#7d725f',
      secondaryColor: '#c9a64d',
      accentColor: '#ffd269',
      skinColor: '#696256',
      auraColor: '#ffd269',
      weaponType: 'greatsword',
      silhouetteStyle: 'titan',
      scale: 1.42,
      hasCrown: true,
    },
  },
  {
    index: 3,
    id: 'boss_jungle_beast',
    name: 'Jungle Beast',
    difficultyLabel: 'Medium',
    arenaId: 'jungle_falls',
    maxHp: 430,
    attackPower: 20,
    speed: 1.05,
    defense: 18,
    apReward: 250,
    firstClearBonusAp: 140,
    xpReward: 210,
    minLevel: 2,
    fightingStyle: 'Predator Pounce & Ferocious Claws',
    specialAttacks: ['Waterfall Pounce', 'Feral Spin'],
    introLine: 'ROAAAR! None escape the fangs of the falls!',
    defeatLine: 'The alpha predator bows...',
    isSecret: false,
    visual: {
      primaryColor: '#5c2d16',
      secondaryColor: '#264d24',
      accentColor: '#ff7033',
      skinColor: '#7a4526',
      auraColor: '#ff7033',
      weaponType: 'claws',
      silhouetteStyle: 'brawler',
      scale: 1.45,
      hasHorns: true,
    },
  },
  {
    index: 4,
    id: 'boss_shadow_knight',
    name: 'Shadow Knight',
    difficultyLabel: 'Medium',
    arenaId: 'bamboo_forest',
    maxHp: 520,
    attackPower: 24,
    speed: 1.12,
    defense: 24,
    apReward: 250,
    firstClearBonusAp: 160,
    xpReward: 270,
    minLevel: 3,
    fightingStyle: 'Phantom Scythe & Blink Ambush',
    specialAttacks: ['Bamboo Eclipse', 'Shadow Dash'],
    introLine: 'Step into the mist, and meet your eclipse.',
    defeatLine: 'Light pierces even the deepest blade...',
    isSecret: false,
    visual: {
      primaryColor: '#191526',
      secondaryColor: '#48286e',
      accentColor: '#c36bff',
      skinColor: '#564d6b',
      auraColor: '#c36bff',
      weaponType: 'scythe',
      silhouetteStyle: 'wraith',
      scale: 1.46,
      hasCape: true,
      hasHorns: true,
    },
  },
  {
    index: 5,
    id: 'boss_flame_lord',
    name: 'Flame Lord',
    difficultyLabel: 'Hard',
    arenaId: 'volcano_valley',
    maxHp: 620,
    attackPower: 28,
    speed: 1.08,
    defense: 26,
    apReward: 250,
    firstClearBonusAp: 200,
    xpReward: 340,
    minLevel: 4,
    fightingStyle: 'Molten Odachi & Pyroclasm Nova',
    specialAttacks: ['Magma Pillar', 'Inferno Wave'],
    introLine: 'Feel the wrath of the volcanic core!',
    defeatLine: 'The embers cool... for now.',
    isSecret: false,
    visual: {
      primaryColor: '#4a120c',
      secondaryColor: '#ff4800',
      accentColor: '#ffbb33',
      skinColor: '#7a2515',
      auraColor: '#ff5500',
      weaponType: 'katana',
      silhouetteStyle: 'emperor',
      scale: 1.5,
      hasCrown: true,
      hasHorns: true,
      hasCape: true,
    },
  },
  {
    index: 6,
    id: 'boss_ancient_titan',
    name: 'Ancient Titan',
    difficultyLabel: 'Hard',
    arenaId: 'mountain_peak',
    maxHp: 740,
    attackPower: 32,
    speed: 0.96,
    defense: 36,
    apReward: 250,
    firstClearBonusAp: 220,
    xpReward: 420,
    minLevel: 5,
    fightingStyle: 'Colossal Hammer & Frost Quake',
    specialAttacks: ['Glacial Slam', 'Summit Shatter'],
    introLine: 'I shaped these peaks before time had a name!',
    defeatLine: 'Even titans can be toppled by true mastery.',
    isSecret: false,
    visual: {
      primaryColor: '#415263',
      secondaryColor: '#a8d5f2',
      accentColor: '#69d9ff',
      skinColor: '#5f6f7d',
      auraColor: '#69d9ff',
      weaponType: 'hammer',
      silhouetteStyle: 'titan',
      scale: 1.62,
      hasHorns: true,
    },
  },
  {
    index: 7,
    id: 'boss_storm_emperor',
    name: 'Storm Emperor',
    difficultyLabel: 'Very Hard',
    arenaId: 'tropical_island',
    maxHp: 860,
    attackPower: 35,
    speed: 1.2,
    defense: 30,
    apReward: 250,
    firstClearBonusAp: 250,
    xpReward: 510,
    minLevel: 6,
    fightingStyle: 'Tempest Trident & Lightning Surge',
    specialAttacks: ['Cyclone Strike', 'Thunder Judgment'],
    introLine: 'Sky and sea obey my command!',
    defeatLine: 'The hurricane calms before your blade.',
    isSecret: false,
    visual: {
      primaryColor: '#163d66',
      secondaryColor: '#f5cc51',
      accentColor: '#4ee6ff',
      skinColor: '#91b4c9',
      auraColor: '#4ee6ff',
      weaponType: 'spear',
      silhouetteStyle: 'emperor',
      scale: 1.54,
      hasCrown: true,
      hasCape: true,
    },
  },
  {
    index: 8,
    id: 'boss_dark_champion',
    name: 'Dark Champion',
    difficultyLabel: 'Legendary',
    arenaId: 'mystic_lake',
    maxHp: 990,
    attackPower: 39,
    speed: 1.24,
    defense: 34,
    apReward: 250,
    firstClearBonusAp: 300,
    xpReward: 620,
    minLevel: 7,
    fightingStyle: 'Abyssal Greatsword & Counter Stance',
    specialAttacks: ['Moonlit Cleave', 'Abyssal Counter'],
    introLine: 'Many challengers drowned in this lake. You are next.',
    defeatLine: 'A worthy champion... at last.',
    isSecret: false,
    visual: {
      primaryColor: '#121524',
      secondaryColor: '#5e6b9c',
      accentColor: '#ff477e',
      skinColor: '#767a94',
      auraColor: '#ff477e',
      weaponType: 'greatsword',
      silhouetteStyle: 'paladin',
      scale: 1.58,
      hasCape: true,
      hasHorns: true,
    },
  },
  {
    index: 9,
    id: 'boss_dragon_king',
    name: 'Dragon King',
    difficultyLabel: 'Legendary',
    arenaId: 'volcano_valley',
    maxHp: 1140,
    attackPower: 43,
    speed: 1.22,
    defense: 38,
    apReward: 250,
    firstClearBonusAp: 350,
    xpReward: 750,
    minLevel: 8,
    fightingStyle: 'Draconic Wing Strike & Firestorm',
    specialAttacks: ['Dragon Breath', 'Wing Cataclysm'],
    introLine: 'Behold the sovereign of flame and scale!',
    defeatLine: 'Impossible... a mortal slew the Dragon King!',
    isSecret: false,
    visual: {
      primaryColor: '#6b0f17',
      secondaryColor: '#f5c242',
      accentColor: '#ff6a00',
      skinColor: '#8c2222',
      auraColor: '#ffaa00',
      weaponType: 'greatsword',
      silhouetteStyle: 'dragon',
      scale: 1.7,
      hasWings: true,
      hasHorns: true,
      hasCrown: true,
    },
  },
  {
    index: 10,
    id: 'boss_arena_destroyer',
    name: 'The Arena Destroyer',
    difficultyLabel: 'Ultimate',
    arenaId: 'ancient_temple',
    maxHp: 1320,
    attackPower: 48,
    speed: 1.26,
    defense: 42,
    apReward: 250,
    firstClearBonusAp: 500,
    xpReward: 950,
    minLevel: 9,
    fightingStyle: 'World-Breaker Gauntlets & Ruin Nova',
    specialAttacks: ['Oblivion Slam', 'Arena Rupture'],
    introLine: 'I shatter champions and arenas alike. Show me your peak!',
    defeatLine: 'You have conquered the Wild Arena... yet deeper secrets stir.',
    isSecret: false,
    visual: {
      primaryColor: '#1f191a',
      secondaryColor: '#ff3b3b',
      accentColor: '#ffbe3b',
      skinColor: '#524040',
      auraColor: '#ff3b3b',
      weaponType: 'hammer',
      silhouetteStyle: 'titan',
      scale: 1.78,
      hasHorns: true,
      hasCrown: true,
      hasWings: true,
    },
  },

  // --- 6 SECRET BOSSES (11..16) ---
  {
    index: 11,
    id: 'boss_abyssal_leviathan',
    name: 'Abyssal Leviathan',
    difficultyLabel: 'Secret I',
    arenaId: 'mystic_lake',
    maxHp: 1480,
    attackPower: 52,
    speed: 1.28,
    defense: 44,
    apReward: 300,
    firstClearBonusAp: 450,
    xpReward: 1100,
    minLevel: 10,
    fightingStyle: 'Tidal Trident & Abyssal Vortex',
    specialAttacks: ['Maelstrom Thrust', 'Depth Crush'],
    introLine: 'From the sunken abyss beneath the lake, I awaken!',
    defeatLine: 'The deep returns to slumber...',
    isSecret: true,
    visual: {
      primaryColor: '#0e2d45',
      secondaryColor: '#25b5b0',
      accentColor: '#52ffe8',
      skinColor: '#2b6175',
      auraColor: '#52ffe8',
      weaponType: 'spear',
      silhouetteStyle: 'dragon',
      scale: 1.72,
      hasHorns: true,
      hasWings: true,
    },
  },
  {
    index: 12,
    id: 'boss_phantom_shogun',
    name: 'Phantom Shogun',
    difficultyLabel: 'Secret II',
    arenaId: 'bamboo_forest',
    maxHp: 1640,
    attackPower: 56,
    speed: 1.38,
    defense: 42,
    apReward: 300,
    firstClearBonusAp: 500,
    xpReward: 1250,
    minLevel: 11,
    fightingStyle: 'Ethereal Twin Katana & Instant Dash',
    specialAttacks: ['Ghost Iaijutsu', 'Spirit Storm'],
    introLine: 'A hundred duels won in death. Draw your steel!',
    defeatLine: 'An honorable strike... worthy of legend.',
    isSecret: true,
    visual: {
      primaryColor: '#1b2b36',
      secondaryColor: '#66f2c8',
      accentColor: '#a6ffea',
      skinColor: '#7a9ea3',
      auraColor: '#66f2c8',
      weaponType: 'dual_blades',
      silhouetteStyle: 'ronin',
      scale: 1.56,
      hasHorns: true,
      hasCape: true,
    },
  },
  {
    index: 13,
    id: 'boss_obsidian_colossus',
    name: 'Obsidian Colossus',
    difficultyLabel: 'Secret III',
    arenaId: 'mountain_peak',
    maxHp: 1840,
    attackPower: 60,
    speed: 1.15,
    defense: 54,
    apReward: 325,
    firstClearBonusAp: 550,
    xpReward: 1400,
    minLevel: 12,
    fightingStyle: 'Monolith Fist & Meteor Impact',
    specialAttacks: ['Obsidian Nova', 'Mountain Drop'],
    introLine: 'Forged in starfire and alpine stone!',
    defeatLine: 'Unbreakable... broken.',
    isSecret: true,
    visual: {
      primaryColor: '#1e1c24',
      secondaryColor: '#8d52ff',
      accentColor: '#ff77e9',
      skinColor: '#373342',
      auraColor: '#8d52ff',
      weaponType: 'gauntlets',
      silhouetteStyle: 'titan',
      scale: 1.85,
      hasCrown: true,
    },
  },
  {
    index: 14,
    id: 'boss_solar_seraph',
    name: 'Solar Seraph',
    difficultyLabel: 'Secret IV',
    arenaId: 'tropical_island',
    maxHp: 2020,
    attackPower: 64,
    speed: 1.35,
    defense: 48,
    apReward: 350,
    firstClearBonusAp: 600,
    xpReward: 1600,
    minLevel: 13,
    fightingStyle: 'Radiant Wing Lance & Starburst',
    specialAttacks: ['Supernova', 'Radiant Volley'],
    introLine: 'Stand before the blazing sun of the heavens!',
    defeatLine: 'Your spirit shines brighter than the sun.',
    isSecret: true,
    visual: {
      primaryColor: '#fcf6dc',
      secondaryColor: '#f5b82e',
      accentColor: '#fff280',
      skinColor: '#f0d8bd',
      auraColor: '#ffdf5e',
      weaponType: 'spear',
      silhouetteStyle: 'celestial',
      scale: 1.66,
      hasWings: true,
      hasCrown: true,
    },
  },
  {
    index: 15,
    id: 'boss_void_sovereign',
    name: 'Void Sovereign',
    difficultyLabel: 'Secret V',
    arenaId: 'lost_forest',
    maxHp: 2240,
    attackPower: 68,
    speed: 1.36,
    defense: 52,
    apReward: 375,
    firstClearBonusAp: 700,
    xpReward: 1850,
    minLevel: 14,
    fightingStyle: 'Reality Scythe & Singularity Pull',
    specialAttacks: ['Dimensional Tear', 'Void Collapse'],
    introLine: 'Time and space unravel at my command.',
    defeatLine: 'Even the void yields to an unbroken will.',
    isSecret: true,
    visual: {
      primaryColor: '#0c0817',
      secondaryColor: '#7e22ce',
      accentColor: '#e879f9',
      skinColor: '#4c3d66',
      auraColor: '#c084fc',
      weaponType: 'scythe',
      silhouetteStyle: 'wraith',
      scale: 1.74,
      hasWings: true,
      hasHorns: true,
      hasCape: true,
    },
  },
  {
    index: 16,
    id: 'boss_eternal_apex',
    name: 'Eternal Apex',
    difficultyLabel: 'Final Secret',
    arenaId: 'jungle_falls',
    maxHp: 2550,
    attackPower: 74,
    speed: 1.42,
    defense: 56,
    apReward: 450,
    firstClearBonusAp: 1000,
    xpReward: 2400,
    minLevel: 15,
    fightingStyle: 'Omnipresent Wild Spirit & Genesis Nova',
    specialAttacks: ['Genesis Shockwave', 'Apex Judgment', 'Primal Barrage'],
    introLine: 'You reached the summit of Wild Arena. Face the Eternal Apex!',
    defeatLine: 'True mastery achieved. You are the Eternal Champion of Wild Arena.',
    isSecret: true,
    visual: {
      primaryColor: '#0c3b32',
      secondaryColor: '#ffd34e',
      accentColor: '#42ffcf',
      skinColor: '#8cd4bf',
      auraColor: '#42ffcf',
      weaponType: 'orb',
      silhouetteStyle: 'celestial',
      scale: 1.82,
      hasWings: true,
      hasHorns: true,
      hasCrown: true,
      hasCape: true,
    },
  },
];

export const MISSIONS: MissionDef[] = [
  {
    id: 'm_forest_warriors',
    title: 'Trial of the Wilds',
    description: 'Defeat 5 forest warriors in Solo Skirmish battles.',
    difficulty: 'Easy',
    minLevel: 1,
    metric: 'forest_warriors_defeated',
    target: 5,
    xpReward: 150,
    apReward: 120,
  },
  {
    id: 'm_win_3_battles',
    title: 'Arena Contender',
    description: 'Win 3 battles in any combat mode.',
    difficulty: 'Easy',
    minLevel: 1,
    metric: 'total_wins',
    target: 3,
    xpReward: 140,
    apReward: 100,
  },
  {
    id: 'm_destroy_props',
    title: 'Force of Nature',
    description: 'Shatter 10 destructible arena objects during combat.',
    difficulty: 'Easy',
    minLevel: 1,
    metric: 'objects_destroyed',
    target: 10,
    xpReward: 120,
    apReward: 90,
  },
  {
    id: 'm_first_boss',
    title: 'Guardian Slayer',
    description: 'Complete your first Boss Challenge.',
    difficulty: 'Easy',
    minLevel: 1,
    metric: 'bosses_defeated',
    target: 1,
    xpReward: 200,
    apReward: 150,
  },
  {
    id: 'm_combos_25',
    title: 'Flow of Combat',
    description: 'Land 25 multi-hit combos on opponents.',
    difficulty: 'Medium',
    minLevel: 2,
    metric: 'combos_landed',
    target: 25,
    xpReward: 240,
    apReward: 160,
  },
  {
    id: 'm_defeat_elite',
    title: 'Giant Killer',
    description: 'Defeat an Elite fighter (Epic rarity or higher) in battle.',
    difficulty: 'Medium',
    minLevel: 2,
    metric: 'elite_defeated',
    target: 1,
    xpReward: 260,
    apReward: 180,
  },
  {
    id: 'm_online_victory',
    title: 'Real Challenger',
    description: 'Win an online multiplayer battle against a real player.',
    difficulty: 'Medium',
    minLevel: 2,
    metric: 'online_wins',
    target: 1,
    xpReward: 300,
    apReward: 200,
  },
  {
    id: 'm_flawless_round',
    title: 'Untouchable',
    description: 'Complete a battle round without losing a round.',
    difficulty: 'Medium',
    minLevel: 3,
    metric: 'flawless_rounds',
    target: 1,
    xpReward: 280,
    apReward: 180,
  },
  {
    id: 'm_parry_master',
    title: 'Counter Instinct',
    description: 'Land 10 timed blocks / counterattacks.',
    difficulty: 'Medium',
    minLevel: 3,
    metric: 'parries_landed',
    target: 10,
    xpReward: 300,
    apReward: 190,
  },
  {
    id: 'm_boss_5',
    title: 'Conqueror of Five',
    description: 'Defeat 5 campaign bosses.',
    difficulty: 'Hard',
    minLevel: 4,
    metric: 'bosses_defeated',
    target: 5,
    xpReward: 500,
    apReward: 250,
  },
  {
    id: 'm_win_15_battles',
    title: 'Battle-Hardened',
    description: 'Win 15 battles across all modes.',
    difficulty: 'Hard',
    minLevel: 4,
    metric: 'total_wins',
    target: 15,
    xpReward: 550,
    apReward: 250,
  },
  {
    id: 'm_specials_30',
    title: 'Elemental Fury',
    description: 'Hit opponents with 30 Special Abilities.',
    difficulty: 'Hard',
    minLevel: 5,
    metric: 'specials_hit',
    target: 30,
    xpReward: 480,
    apReward: 220,
  },
  {
    id: 'm_online_5',
    title: 'Online Champion',
    description: 'Win 5 online battles against real players.',
    difficulty: 'Hard',
    minLevel: 5,
    metric: 'online_wins',
    target: 5,
    xpReward: 700,
    apReward: 350,
  },
  {
    id: 'm_ranked_3',
    title: 'Ranked Ascendant',
    description: 'Win 3 Ranked online matches.',
    difficulty: 'Hard',
    minLevel: 6,
    metric: 'ranked_wins',
    target: 3,
    xpReward: 800,
    apReward: 400,
  },
  {
    id: 'm_boss_10',
    title: 'Destroyer Vanquished',
    description: 'Defeat 10 campaign bosses including The Arena Destroyer.',
    difficulty: 'Legendary',
    minLevel: 8,
    metric: 'bosses_defeated',
    target: 10,
    xpReward: 1400,
    apReward: 500,
  },
  {
    id: 'm_flawless_5',
    title: 'Perfection Incarnate',
    description: 'Win 5 matches without losing a single round.',
    difficulty: 'Legendary',
    minLevel: 9,
    metric: 'flawless_rounds',
    target: 5,
    xpReward: 1500,
    apReward: 500,
  },
  {
    id: 'm_daily_skirmish',
    title: 'Daily Trial: Arena Duel',
    description: 'Win 2 battles today to claim your Daily Challenge bonus.',
    difficulty: 'Medium',
    minLevel: 1,
    metric: 'total_wins',
    target: 2,
    xpReward: 200,
    apReward: 150,
    isDaily: true,
  },
  {
    id: 'm_secret_bosses',
    title: 'Mythic Sovereign',
    description: 'Defeat 15 bosses including 5 Secret Bosses.',
    difficulty: 'Legendary',
    minLevel: 12,
    metric: 'bosses_defeated',
    target: 15,
    xpReward: 2500,
    apReward: 750,
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach_first_blood',
    name: 'First Victory',
    description: 'Win your very first battle in Wild Arena.',
    apBonus: 50,
    metric: 'wins',
    target: 1,
  },
  {
    id: 'ach_boss_slayer',
    name: 'Boss Hunter',
    description: 'Clear Boss 5 (Flame Lord) in the Boss Campaign.',
    apBonus: 150,
    metric: 'highestBossCleared',
    target: 5,
  },
  {
    id: 'ach_arena_conqueror',
    name: 'Arena Conqueror',
    description: 'Defeat Boss 10 (The Arena Destroyer).',
    apBonus: 350,
    metric: 'highestBossCleared',
    target: 10,
  },
  {
    id: 'ach_secret_master',
    name: 'Master of Secrets',
    description: 'Defeat all 16 Campaign Bosses.',
    apBonus: 600,
    metric: 'highestBossCleared',
    target: 16,
  },
  {
    id: 'ach_online_duelist',
    name: 'Online Duelist',
    description: 'Win 3 real-time online battles.',
    apBonus: 200,
    metric: 'onlineWins',
    target: 3,
  },
  {
    id: 'ach_ranked_gladiator',
    name: 'Ranked Gladiator',
    description: 'Reach 1150 Ranked Rating.',
    apBonus: 300,
    metric: 'rankedRating',
    target: 1150,
  },
  {
    id: 'ach_combo_king',
    name: 'Combo Virtuoso',
    description: 'Land 50 total combos in combat.',
    apBonus: 150,
    metric: 'combosLanded',
    target: 50,
  },
  {
    id: 'ach_demolitionist',
    name: 'Arena Demolitionist',
    description: 'Destroy 30 environmental arena objects.',
    apBonus: 100,
    metric: 'objectsDestroyed',
    target: 30,
  },
];

export function getFighterById(id: string): FighterDef {
  return FIGHTERS.find((f) => f.id === id) ?? FIGHTERS[0];
}

export function getArenaById(id: ArenaId): ArenaDef {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0];
}

export function getBossByIndex(index: number): BossDef {
  return BOSSES.find((b) => b.index === index) ?? BOSSES[0];
}
