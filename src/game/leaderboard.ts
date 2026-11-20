import type { LeaderboardEntry, TrackDistanceKm, TrackId } from './types.ts';

const STORAGE_KEY = 'dune_runners_leaderboard_v2';

export const SEED_LEADERBOARD: LeaderboardEntry[] = [
  // 2 km seeds
  {
    id: 'seed-rr-2k-1',
    trackId: 'redrock',
    distanceKm: 2,
    driverName: 'KAI VANCE',
    vehicleLabel: 'Apex Dart · Paddle',
    colorHex: '#f97316',
    mode: 'solo',
    timeSeconds: 54.82,
    createdAt: 1700000001000,
  },
  {
    id: 'seed-pc-2k-1',
    trackId: 'pinecrest',
    distanceKm: 2,
    driverName: 'ELENA ROSTOVA',
    vehicleLabel: 'Dune Striker · Knobby',
    colorHex: '#ef4444',
    mode: 'solo',
    timeSeconds: 57.94,
    createdAt: 1700000002000,
  },
  {
    id: 'seed-sf-2k-1',
    trackId: 'saltflats',
    distanceKm: 2,
    driverName: 'ZARA KLINE',
    vehicleLabel: 'Apex Dart · Paddle',
    colorHex: '#0ea5e9',
    mode: 'online',
    timeSeconds: 52.15,
    createdAt: 1700000003000,
  },
  // 3 km seeds
  {
    id: 'seed-rr-3k-1',
    trackId: 'redrock',
    distanceKm: 3,
    driverName: 'KAI VANCE',
    vehicleLabel: 'Apex Dart · Paddle',
    colorHex: '#f97316',
    mode: 'solo',
    timeSeconds: 82.45,
    createdAt: 1700000004000,
  },
  {
    id: 'seed-rr-3k-2',
    trackId: 'redrock',
    distanceKm: 3,
    driverName: 'MARA SOLIS',
    vehicleLabel: 'Dune Striker · Knobby',
    colorHex: '#0ea5e9',
    mode: 'splitscreen',
    timeSeconds: 86.12,
    createdAt: 1700000005000,
  },
  {
    id: 'seed-pc-3k-1',
    trackId: 'pinecrest',
    distanceKm: 3,
    driverName: 'ELENA ROSTOVA',
    vehicleLabel: 'Dune Striker · Knobby',
    colorHex: '#ef4444',
    mode: 'solo',
    timeSeconds: 87.34,
    createdAt: 1700000006000,
  },
  {
    id: 'seed-sf-3k-1',
    trackId: 'saltflats',
    distanceKm: 3,
    driverName: 'ZARA KLINE',
    vehicleLabel: 'Apex Dart · Paddle',
    colorHex: '#0ea5e9',
    mode: 'online',
    timeSeconds: 78.92,
    createdAt: 1700000007000,
  },
  // 5 km seeds
  {
    id: 'seed-rr-5k-1',
    trackId: 'redrock',
    distanceKm: 5,
    driverName: 'REX TANAKA',
    vehicleLabel: 'Baja Bruiser · Mudder',
    colorHex: '#84cc16',
    mode: 'online',
    timeSeconds: 138.6,
    createdAt: 1700000008000,
  },
  {
    id: 'seed-pc-5k-1',
    trackId: 'pinecrest',
    distanceKm: 5,
    driverName: 'NOAH CHEN',
    vehicleLabel: 'Baja Bruiser · Mudder',
    colorHex: '#eab308',
    mode: 'solo',
    timeSeconds: 145.22,
    createdAt: 1700000009000,
  },
  {
    id: 'seed-sf-5k-1',
    trackId: 'saltflats',
    distanceKm: 5,
    driverName: 'DEVON PARK',
    vehicleLabel: 'Apex Dart · Paddle',
    colorHex: '#f97316',
    mode: 'online',
    timeSeconds: 131.4,
    createdAt: 1700000010000,
  },
];

export function formatRaceTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return '--:--.--';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds * 100) % 100);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const cc = String(hundredths).padStart(2, '0');
  return `${mm}:${ss}.${cc}`;
}

export function sortLeaderboardForTrack(
  entries: LeaderboardEntry[],
  trackId: TrackId,
  distanceKm?: TrackDistanceKm,
): LeaderboardEntry[] {
  return entries
    .filter((e) => e.trackId === trackId && (distanceKm === undefined || e.distanceKm === distanceKm))
    .slice()
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
}

export function addLeaderboardRecord(
  entries: LeaderboardEntry[],
  record: Omit<LeaderboardEntry, 'id' | 'createdAt'>,
): { entries: LeaderboardEntry[]; inserted: LeaderboardEntry; rank: number } {
  const cleanName = record.driverName.trim().slice(0, 18) || 'DRIVER';
  const inserted: LeaderboardEntry = {
    ...record,
    driverName: cleanName.toUpperCase(),
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };

  const nextAll = [...entries, inserted];
  const forTrackDist = sortLeaderboardForTrack(nextAll, record.trackId, record.distanceKm);
  const rank = forTrackDist.findIndex((e) => e.id === inserted.id) + 1;

  const others = nextAll.filter(
    (e) => !(e.trackId === record.trackId && e.distanceKm === record.distanceKm),
  );
  const trimmed = [...others, ...forTrackDist.slice(0, 12)];
  return { entries: trimmed, inserted, rank };
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_LEADERBOARD;
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return SEED_LEADERBOARD;
    return parsed;
  } catch {
    return SEED_LEADERBOARD;
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

export function resetLeaderboard(): LeaderboardEntry[] {
  saveLeaderboard(SEED_LEADERBOARD);
  return SEED_LEADERBOARD;
}

export function formatVehicleSpec(chassisName: string, tireName: string): string {
  return `${chassisName} · ${tireName}`;
}
