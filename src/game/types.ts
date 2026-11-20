export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type MainMode = 'solo' | 'multiplayer';

export type MultiplayerKind = 'online' | 'splitscreen';

export type PlayMode = 'solo' | 'splitscreen' | 'online';

export type TrackDistanceKm = 2 | 3 | 5;

export type TrackId = 'redrock' | 'pinecrest' | 'saltflats';

export type ChassisId = 'striker' | 'bruiser' | 'dart';

export type TireId = 'knobby' | 'paddle' | 'mudder';

export type RigId = 'lightbar' | 'wing' | 'spare';

export type PowerUpType = 'nitro' | 'shockwave' | 'shield' | 'oil' | 'magnet';

export interface BuggyConfig {
  name: string;
  colorHex: string;
  accentHex: string;
  chassis: ChassisId;
  tires: TireId;
  rig: RigId;
}

export interface BuggyStats {
  topSpeed: number; // m/s (1 m/s = 3.6 km/h)
  acceleration: number; // m/s^2
  handling: number; // rad/s turn authority
  offroadGrip: number; // multiplier on rough shoulder / dirt
  mass: number; // collision knockback weight
}

export interface TrackDefinition {
  id: TrackId;
  name: string;
  subtitle: string;
  halfWidth: number;
  skyColor: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  hemiSkyColor: string;
  hemiGroundColor: string;
  roadColor: string;
  shoulderColor: string;
  terrainColor: string;
  biome: 'desert' | 'alpine' | 'salt';
  difficulty: 'Accessible' | 'Technical' | 'High Speed';
}

export interface TrackRamp {
  s: number;
  offset: number;
  width: number;
  length: number;
  height: number;
}

export interface TrackBoostPad {
  s: number;
  offset: number;
  width: number;
  length: number;
}

export interface TrackPickupSpawn {
  id: number;
  s: number;
  offset: number;
}

export interface OilHazard {
  id: number;
  x: number;
  y: number;
  z: number;
  ownerId: string;
  ttl: number;
}

export interface ShockwavePulse {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  colorHex: string;
}

export interface PlayerControlInput {
  throttle: number; // -1..1
  steer: number; // -1 (right)..1 (left)
  boost: boolean;
  useItemJustPressed: boolean;
}

export interface BuggyState {
  id: string;
  label: string;
  isHuman: boolean;
  humanIndex: number; // 0 for P1 (or local client), 1 for P2, etc., -1 for AI
  config: BuggyConfig;
  stats: BuggyStats;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number; // forward scalar m/s
  yaw: number; // radians; 0 faces -Z
  pitch: number;
  roll: number;
  steerAngle: number;
  wheelSpin: number;
  grounded: boolean;
  suspensionCompression: number;
  s: number; // track progress in meters (0..lengthMeters)
  lateralOffset: number;
  boostMeter: number; // 0..100
  isBoosting: boolean;
  heldPowerUp: PowerUpType | null;
  nitroTimer: number;
  shieldTimer: number;
  spinOutTimer: number;
  hitFlashTimer: number;
  finished: boolean;
  finishTime: number | null;
  rank: number;
  aiTargetOffset: number;
  aiDecisionTimer: number;
}

export interface RaceEvent {
  type:
    | 'pickup'
    | 'boostPad'
    | 'nitro'
    | 'shockwave'
    | 'shield'
    | 'oilDrop'
    | 'oilHit'
    | 'magnet'
    | 'collision'
    | 'jump'
    | 'land'
    | 'finish'
    | 'countdown';
  buggyId: string;
  humanIndex: number;
  intensity: number;
  x?: number;
  y?: number;
  z?: number;
  value?: number;
}

export interface RaceSimulation {
  trackId: TrackId;
  distanceKm: TrackDistanceKm;
  lengthMeters: number;
  mode: PlayMode;
  buggies: BuggyState[];
  pickups: { id: number; s: number; offset: number; x: number; y: number; z: number; cooldown: number }[];
  ramps: TrackRamp[];
  boostPads: TrackBoostPad[];
  hazards: OilHazard[];
  shockwaves: ShockwavePulse[];
  elapsedTime: number;
  countdownTimer: number; // > 0 before GO!
  lastCountdownTick: number;
  hitstopTimer: number;
  cameraTrauma: number[];
  graceTimer: number | null;
  allFinished: boolean;
  nextEntityId: number;
  events: RaceEvent[];
}

export interface PlayerHudSnapshot {
  id: string;
  label: string;
  rank: number;
  distanceMeters: number;
  speedKmh: number;
  boostMeter: number;
  heldPowerUp: PowerUpType | null;
  nitroActive: boolean;
  shieldActive: boolean;
  spinOutActive: boolean;
  finished: boolean;
  finishTime: number | null;
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: PlayMode;
  trackId: TrackId;
  distanceKm: TrackDistanceKm;
  lengthMeters: number;
  elapsedTime: number;
  countdownValue: number; // 3, 2, 1, 0 (GO), -1 (active)
  totalRacers: number;
  graceRemaining: number | null;
  players: PlayerHudSnapshot[];
  standings: {
    id: string;
    label: string;
    isHuman: boolean;
    humanIndex: number;
    colorHex: string;
    chassis: ChassisId;
    tires: TireId;
    rank: number;
    distanceMeters: number;
    finishTime: number | null;
  }[];
}

export interface LeaderboardEntry {
  id: string;
  trackId: TrackId;
  distanceKm: TrackDistanceKm;
  driverName: string;
  vehicleLabel: string;
  colorHex: string;
  mode: PlayMode;
  timeSeconds: number;
  createdAt: number;
}

export interface RoomMemberInfo {
  clientId: string;
  slotIndex: number;
  config: BuggyConfig;
  isHost: boolean;
  ready: boolean;
}

export interface RoomStateInfo {
  roomKey: string;
  hostId: string;
  trackId: TrackId;
  distanceKm: TrackDistanceKm;
  maxOpponents: number; // 2..5
  fillWithAi: boolean;
  status: 'lobby' | 'racing' | 'finished';
  members: RoomMemberInfo[];
}

export const DISTANCE_OPTIONS: { km: TrackDistanceKm; meters: number; label: string }[] = [
  { km: 2, meters: 2000, label: '2 km' },
  { km: 3, meters: 3000, label: '3 km' },
  { km: 5, meters: 5000, label: '5 km' },
];

export const PAINT_SWATCHES: { id: string; name: string; hex: string; accent: string }[] = [
  { id: 'orange', name: 'Baja Blaze', hex: '#f97316', accent: '#fde047' },
  { id: 'cobalt', name: 'Electric Cobalt', hex: '#0ea5e9', accent: '#e0f2fe' },
  { id: 'lime', name: 'Rally Acid', hex: '#84cc16', accent: '#ecfccb' },
  { id: 'crimson', name: 'Redline', hex: '#ef4444', accent: '#fee2e2' },
  { id: 'gold', name: 'Sunburst Gold', hex: '#eab308', accent: '#1e293b' },
  { id: 'slate', name: 'Stealth Carbon', hex: '#475569', accent: '#f97316' },
];

export const CHASSIS_OPTIONS: {
  id: ChassisId;
  name: string;
  role: string;
  topSpeedMod: number;
  accelMod: number;
  handlingMod: number;
  offroadMod: number;
  mass: number;
}[] = [
  {
    id: 'striker',
    name: 'Dune Striker',
    role: 'Balanced tubular buggy',
    topSpeedMod: 1.0,
    accelMod: 1.0,
    handlingMod: 1.05,
    offroadMod: 1.0,
    mass: 1.0,
  },
  {
    id: 'bruiser',
    name: 'Baja Bruiser',
    role: 'Heavy off-road grip & ram',
    topSpeedMod: 1.0,
    accelMod: 1.0,
    handlingMod: 0.96,
    offroadMod: 1.12,
    mass: 1.35,
  },
  {
    id: 'dart',
    name: 'Apex Dart',
    role: 'Agile desert sand rail',
    topSpeedMod: 1.0,
    accelMod: 1.0,
    handlingMod: 1.08,
    offroadMod: 0.96,
    mass: 0.85,
  },
];

export const TIRE_OPTIONS: {
  id: TireId;
  name: string;
  role: string;
  topSpeedMod: number;
  accelMod: number;
  handlingMod: number;
  offroadMod: number;
}[] = [
  {
    id: 'knobby',
    name: 'All-Terrain Knobby',
    role: 'Crisp cornering on mixed dirt',
    topSpeedMod: 1.0,
    accelMod: 1.0,
    handlingMod: 1.06,
    offroadMod: 1.0,
  },
  {
    id: 'paddle',
    name: 'Sand Paddle',
    role: 'Deep sand traction & agility',
    topSpeedMod: 1.0,
    accelMod: 1.0,
    handlingMod: 1.0,
    offroadMod: 1.05,
  },
  {
    id: 'mudder',
    name: 'Wide Mudder',
    role: 'Extra grip on rough shoulders',
    topSpeedMod: 1.0,
    accelMod: 1.0,
    handlingMod: 1.02,
    offroadMod: 1.14,
  },
];

export const RIG_OPTIONS: { id: RigId; name: string; role: string }[] = [
  { id: 'lightbar', name: 'Twin Lightbar', role: 'Roof LED rally bar' },
  { id: 'wing', name: 'Aero Wing', role: 'Rear downforce spoiler' },
  { id: 'spare', name: 'Spare Rack', role: 'Baja rear spare tire' },
];

export const POWERUP_INFO: Record<
  PowerUpType,
  { name: string; shortDesc: string; colorHex: string }
> = {
  nitro: { name: 'Nitro Surge', shortDesc: 'Super speed burst', colorHex: '#f97316' },
  shockwave: { name: 'Shockwave', shortDesc: 'Knocks nearby rivals', colorHex: '#eab308' },
  shield: { name: 'Shield Dome', shortDesc: 'Blocks hits + speed', colorHex: '#38bdf8' },
  oil: { name: 'Oil Slick', shortDesc: 'Drop hazard behind', colorHex: '#a855f7' },
  magnet: { name: 'Turbo Draft', shortDesc: 'Catch-up speed surge', colorHex: '#10b981' },
};
