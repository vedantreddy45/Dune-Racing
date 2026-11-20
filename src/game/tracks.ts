import type {
  TrackBoostPad,
  TrackDefinition,
  TrackDistanceKm,
  TrackId,
  TrackPickupSpawn,
  TrackRamp,
} from './types.ts';

export const DEFAULT_RACE_LENGTH_METERS = 3000;

export function distanceKmToMeters(km: TrackDistanceKm): number {
  return km * 1000;
}

export const TRACKS: Record<TrackId, TrackDefinition> = {
  redrock: {
    id: 'redrock',
    name: 'Redrock Canyon',
    subtitle: 'Sandstone switchbacks & desert jumps',
    halfWidth: 11.5,
    skyColor: '#8ec5e8',
    fogColor: '#d9b598',
    fogDensity: 0.002,
    sunColor: '#fff1d6',
    hemiSkyColor: '#9ecae8',
    hemiGroundColor: '#a65432',
    roadColor: '#87452a',
    shoulderColor: '#c47448',
    terrainColor: '#b85c37',
    biome: 'desert',
    difficulty: 'Accessible',
  },
  pinecrest: {
    id: 'pinecrest',
    name: 'Pinecrest Ridge',
    subtitle: 'Alpine forest rally & timber ramps',
    halfWidth: 10.5,
    skyColor: '#9dc7e8',
    fogColor: '#b7d4e8',
    fogDensity: 0.0024,
    sunColor: '#fff8e7',
    hemiSkyColor: '#b3daf5',
    hemiGroundColor: '#486144',
    roadColor: '#6d5542',
    shoulderColor: '#4e6942',
    terrainColor: '#3f5938',
    biome: 'alpine',
    difficulty: 'Technical',
  },
  saltflats: {
    id: 'saltflats',
    name: 'Salt Flats & Dunes',
    subtitle: 'Wide high-speed coastal dunes',
    halfWidth: 13.0,
    skyColor: '#a9dcf2',
    fogColor: '#d9ecf4',
    fogDensity: 0.0019,
    sunColor: '#fffaf0',
    hemiSkyColor: '#bfe6f7',
    hemiGroundColor: '#cfc4a8',
    roadColor: '#ded8c8',
    shoulderColor: '#cbb486',
    terrainColor: '#d7c396',
    biome: 'salt',
    difficulty: 'High Speed',
  },
};

export const TRACK_LIST: TrackDefinition[] = [
  TRACKS.redrock,
  TRACKS.pinecrest,
  TRACKS.saltflats,
];

export interface TrackSample {
  s: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  nx: number;
  nz: number;
  yaw: number;
  bank: number;
}

interface Harmonic {
  amp: number;
  freq: number;
  phase: number;
}

const TRACK_CURVES: Record<
  TrackId,
  {
    xHarmonics: Harmonic[];
    yHarmonics: Harmonic[];
    zCompression: number;
  }
> = {
  redrock: {
    xHarmonics: [
      { amp: 46, freq: 0.0042, phase: 0.2 },
      { amp: 24, freq: 0.0095, phase: 1.1 },
      { amp: 10, freq: 0.017, phase: 2.3 },
    ],
    yHarmonics: [
      { amp: 7.5, freq: 0.005, phase: 0.0 },
      { amp: 3.5, freq: 0.012, phase: 1.4 },
    ],
    zCompression: 0.94,
  },
  pinecrest: {
    xHarmonics: [
      { amp: 52, freq: 0.0054, phase: 0.7 },
      { amp: 28, freq: 0.0125, phase: 2.1 },
      { amp: 14, freq: 0.022, phase: 0.4 },
    ],
    yHarmonics: [
      { amp: 11, freq: 0.0044, phase: 0.8 },
      { amp: 4.5, freq: 0.0135, phase: 2.7 },
    ],
    zCompression: 0.91,
  },
  saltflats: {
    xHarmonics: [
      { amp: 60, freq: 0.0031, phase: 1.0 },
      { amp: 20, freq: 0.0072, phase: 0.3 },
      { amp: 7, freq: 0.014, phase: 1.8 },
    ],
    yHarmonics: [
      { amp: 4.8, freq: 0.0048, phase: 0.5 },
      { amp: 2.0, freq: 0.011, phase: 2.2 },
    ],
    zCompression: 0.97,
  },
};

function startFinishEnvelope(s: number, lengthMeters: number): number {
  const startT = Math.min(1, Math.max(0, (s - 15) / 85));
  const endT = Math.min(1, Math.max(0, (lengthMeters + 15 - s) / 85));
  const s1 = startT * startT * (3 - 2 * startT);
  const s2 = endT * endT * (3 - 2 * endT);
  return Math.min(s1, s2);
}

export function sampleTrackAt(
  trackId: TrackId,
  rawS: number,
  lengthMeters: number = DEFAULT_RACE_LENGTH_METERS,
): TrackSample {
  const s = Math.max(-60, Math.min(lengthMeters + 220, rawS));
  const curve = TRACK_CURVES[trackId];
  const env = startFinishEnvelope(s, lengthMeters);

  let x = 0;
  let dxds = 0;
  for (const h of curve.xHarmonics) {
    const val = Math.sin(s * h.freq + h.phase) - Math.sin(h.phase);
    const dval = Math.cos(s * h.freq + h.phase) * h.freq;
    x += h.amp * val * env;
    dxds += h.amp * dval * env;
  }

  let y = 0;
  let dyds = 0;
  for (const h of curve.yHarmonics) {
    const val = Math.sin(s * h.freq + h.phase) - Math.sin(h.phase);
    const dval = Math.cos(s * h.freq + h.phase) * h.freq;
    y += h.amp * val * env;
    dyds += h.amp * dval * env;
  }

  const dzds = -curve.zCompression;
  const z = s * dzds;

  const len = Math.hypot(dxds, dyds, dzds) || 1;
  const tx = dxds / len;
  const ty = dyds / len;
  const tz = dzds / len;

  const horizLen = Math.hypot(tx, tz) || 1;
  const htx = tx / horizLen;
  const htz = tz / horizLen;

  const nx = -htz;
  const nz = htx;
  const yaw = Math.atan2(-htx, -htz);
  const bank = Math.max(-0.12, Math.min(0.12, -dxds * 0.14));

  return { s, x, y, z, tx, ty, tz, nx, nz, yaw, bank };
}

export function trackToWorld(
  trackId: TrackId,
  s: number,
  lateralOffset: number,
  lengthMeters: number = DEFAULT_RACE_LENGTH_METERS,
): { x: number; y: number; z: number; sample: TrackSample } {
  const sample = sampleTrackAt(trackId, s, lengthMeters);
  const x = sample.x + sample.nx * lateralOffset;
  const z = sample.z + sample.nz * lateralOffset;
  const y = sample.y + lateralOffset * Math.sin(sample.bank);
  return { x, y, z, sample };
}

export function worldToTrackCoord(
  trackId: TrackId,
  x: number,
  z: number,
  lengthMeters: number = DEFAULT_RACE_LENGTH_METERS,
): { s: number; lateralOffset: number; sample: TrackSample } {
  const curve = TRACK_CURVES[trackId];
  let s = -z / curve.zCompression;
  s = Math.max(-50, Math.min(lengthMeters + 210, s));

  for (let i = 0; i < 3; i++) {
    const sample = sampleTrackAt(trackId, s, lengthMeters);
    const dx = x - sample.x;
    const dz = z - sample.z;
    const horizLen = Math.hypot(sample.tx, sample.tz) || 1;
    const along = (dx * sample.tx + dz * sample.tz) / horizLen;
    s = Math.max(-50, Math.min(lengthMeters + 210, s + along));
  }

  const sample = sampleTrackAt(trackId, s, lengthMeters);
  const dx = x - sample.x;
  const dz = z - sample.z;
  const lateralOffset = dx * sample.nx + dz * sample.nz;
  return { s, lateralOffset, sample };
}

export function getTrackRamps(
  trackId: TrackId,
  lengthMeters: number = DEFAULT_RACE_LENGTH_METERS,
): TrackRamp[] {
  const seed = trackId === 'redrock' ? 0 : trackId === 'pinecrest' ? 1 : 2;
  const ramps: TrackRamp[] = [];
  const offsetChoices = [0, -3.8, 3.8, -2.5, 2.5];
  let idx = 0;
  for (let s = 210; s < lengthMeters - 180; s += 310) {
    const offset = offsetChoices[(idx + seed) % offsetChoices.length];
    ramps.push({
      s: s + seed * 15,
      offset,
      width: 5.4,
      length: 11,
      height: trackId === 'pinecrest' ? 1.85 : 2.1,
    });
    idx++;
  }
  return ramps;
}

export function getTrackBoostPads(
  trackId: TrackId,
  lengthMeters: number = DEFAULT_RACE_LENGTH_METERS,
): TrackBoostPad[] {
  const seed = trackId === 'redrock' ? 0 : trackId === 'pinecrest' ? 2 : 1;
  const pads: TrackBoostPad[] = [];
  for (let s = 140; s < lengthMeters - 110; s += 230) {
    const idx = Math.floor(s / 230);
    const offset = ((idx + seed) % 3 - 1) * 4.2;
    pads.push({
      s: s + seed * 12,
      offset,
      width: 3.8,
      length: 7.5,
    });
  }
  return pads;
}

export function getTrackPickups(
  trackId: TrackId,
  lengthMeters: number = DEFAULT_RACE_LENGTH_METERS,
): TrackPickupSpawn[] {
  const pickups: TrackPickupSpawn[] = [];
  let id = 1;
  const step = trackId === 'saltflats' ? 175 : 190;
  for (let s = 115; s < lengthMeters - 130; s += step) {
    const offsets = id % 2 === 1 ? [-4.6, 0, 4.6] : [-3.5, 3.5];
    for (const offset of offsets) {
      pickups.push({ id: id++, s, offset });
    }
  }
  return pickups;
}

export function groundHeightAt(
  trackId: TrackId,
  x: number,
  z: number,
  ramps: TrackRamp[],
  lengthMeters: number = DEFAULT_RACE_LENGTH_METERS,
): { groundY: number; onRoad: boolean; rampSlope: number } {
  const track = TRACKS[trackId];
  const { s, lateralOffset, sample } = worldToTrackCoord(trackId, x, z, lengthMeters);
  const absOff = Math.abs(lateralOffset);
  const onRoad = absOff <= track.halfWidth;

  let groundY = sample.y + lateralOffset * Math.sin(sample.bank);
  let rampSlope = 0;

  if (!onRoad) {
    const outside = absOff - track.halfWidth;
    const hillWave =
      Math.sin(x * 0.045) * Math.cos(z * 0.035) * (trackId === 'pinecrest' ? 5.5 : 3.8) +
      Math.sin(x * 0.018 + z * 0.02) * 3.0;
    const rise = Math.min(26, outside * 0.24 + Math.max(0, hillWave) * Math.min(1, outside / 14));
    groundY += rise;
  } else {
    for (const ramp of ramps) {
      const ds = s - ramp.s;
      if (ds >= 0 && ds <= ramp.length && Math.abs(lateralOffset - ramp.offset) <= ramp.width * 0.52) {
        const t = ds / ramp.length;
        const rampH = ramp.height * (t * t * 0.55 + t * 0.45);
        groundY += rampH;
        rampSlope = (ramp.height / ramp.length) * (1.1 * t + 0.45);
        break;
      }
    }
  }

  return { groundY, onRoad, rampSlope };
}
