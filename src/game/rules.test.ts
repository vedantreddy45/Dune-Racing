import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLeaderboardRecord,
  formatRaceTime,
  SEED_LEADERBOARD,
  sortLeaderboardForTrack,
} from './leaderboard.ts';
import {
  activatePowerUp,
  computeBuggyStats,
  createRaceSimulation,
  stepRaceSimulation,
} from './physics.ts';
import {
  distanceKmToMeters,
  groundHeightAt,
  sampleTrackAt,
  trackToWorld,
  worldToTrackCoord,
} from './tracks.ts';
import type { BuggyConfig, PlayerControlInput } from './types.ts';

const p1Config: BuggyConfig = {
  name: 'PLAYER 1',
  colorHex: '#f97316',
  accentHex: '#fde047',
  chassis: 'striker',
  tires: 'knobby',
  rig: 'lightbar',
};

const p2Config: BuggyConfig = {
  name: 'PLAYER 2',
  colorHex: '#0ea5e9',
  accentHex: '#e0f2fe',
  chassis: 'dart',
  tires: 'paddle',
  rig: 'wing',
};

const idleInput: PlayerControlInput = {
  throttle: 0,
  steer: 0,
  boost: false,
  useItemJustPressed: false,
};

test('track spline maps world coordinates back to s and lateralOffset for 2km, 3km, and 5km', () => {
  for (const km of [2, 3, 5] as const) {
    const lengthMeters = distanceKmToMeters(km);
    for (const trackId of ['redrock', 'pinecrest', 'saltflats'] as const) {
      for (const s of [0, 600, lengthMeters * 0.5, lengthMeters]) {
        const world = trackToWorld(trackId, s, 4.5, lengthMeters);
        const mapped = worldToTrackCoord(trackId, world.x, world.z, lengthMeters);
        assert.ok(Math.abs(mapped.s - s) < 0.75, `${trackId} ${km}km at s=${s} mapped to ${mapped.s}`);
        assert.ok(
          Math.abs(mapped.lateralOffset - 4.5) < 0.5,
          `${trackId} ${km}km lateral offset at s=${s} mapped to ${mapped.lateralOffset}`,
        );
      }
      const startSample = sampleTrackAt(trackId, 0, lengthMeters);
      assert.ok(startSample.tz < -0.9, 'Start tangent faces -Z');
    }
  }
});

test('multiplayer supports up to 5 max opponents (6 total racers)', () => {
  const sim = createRaceSimulation({
    trackId: 'redrock',
    distanceKm: 5,
    mode: 'online',
    p1Config,
    maxOpponents: 5,
    fillWithAi: true,
    skipCountdown: true,
  });

  assert.equal(sim.lengthMeters, 5000);
  assert.equal(sim.buggies.length, 6);
});

test('all vehicles have equalized top speed and acceleration while retaining handling/grip customization', () => {
  const dartPaddle = computeBuggyStats({ ...p2Config, chassis: 'dart', tires: 'paddle' });
  const bruiserMudder = computeBuggyStats({ ...p1Config, chassis: 'bruiser', tires: 'mudder' });

  assert.equal(dartPaddle.topSpeed, bruiserMudder.topSpeed);
  assert.equal(dartPaddle.acceleration, bruiserMudder.acceleration);
  assert.ok(bruiserMudder.offroadGrip > dartPaddle.offroadGrip);
  assert.ok(bruiserMudder.mass > dartPaddle.mass);

  const sim = createRaceSimulation({
    trackId: 'saltflats',
    distanceKm: 2,
    mode: 'solo',
    p1Config,
    maxOpponents: 3,
    skipCountdown: true,
  });
  const human = sim.buggies[0];
  const drive: PlayerControlInput = { throttle: 1, steer: 0, boost: false, useItemJustPressed: false };
  for (let i = 0; i < 120; i++) {
    stepRaceSimulation(sim, 0.04, [drive]);
  }
  const fastestAi = Math.max(...sim.buggies.filter((b) => !b.isHuman).map((b) => b.s));
  assert.ok(human.s >= fastestAi - 15, `Human (${human.s}) should keep pace with AI (${fastestAi})`);
});

test('split-screen simulation spawns both human players safely and advances on throttle', () => {
  const sim = createRaceSimulation({
    trackId: 'redrock',
    distanceKm: 2,
    mode: 'splitscreen',
    p1Config,
    p2Config,
    maxOpponents: 3,
    skipCountdown: true,
  });

  const humans = sim.buggies.filter((b) => b.isHuman);
  assert.equal(humans.length, 2);
  assert.equal(sim.lengthMeters, 2000);

  const startS = humans[0].s;
  const drive: PlayerControlInput = { throttle: 1, steer: 0, boost: false, useItemJustPressed: false };
  for (let i = 0; i < 40; i++) {
    stepRaceSimulation(sim, 0.025, [drive, drive]);
  }

  assert.ok(humans[0].s > startS + 8);
  assert.ok(humans[1].s > startS + 8);
});

test('power-ups apply nitro surge, shockwave knockback, and oil hazard drop', () => {
  const sim = createRaceSimulation({
    trackId: 'saltflats',
    distanceKm: 3,
    mode: 'splitscreen',
    p1Config,
    p2Config,
    skipCountdown: true,
  });
  const p1 = sim.buggies[0];
  const p2 = sim.buggies[1];

  p1.heldPowerUp = 'nitro';
  activatePowerUp(sim, p1);
  assert.equal(p1.heldPowerUp, null);
  assert.ok(p1.nitroTimer > 2.0);
  assert.ok(p1.speed > p1.stats.topSpeed);

  p2.x = p1.x + 4;
  p2.z = p1.z;
  p2.speed = 25;
  p1.heldPowerUp = 'shockwave';
  activatePowerUp(sim, p1);
  assert.ok(p2.speed < 20);
  assert.equal(sim.shockwaves.length, 1);

  p1.heldPowerUp = 'oil';
  activatePowerUp(sim, p1);
  assert.equal(sim.hazards.length, 1);
});

test('crossing finish line immediately ends race and stops car on the track', () => {
  const sim = createRaceSimulation({
    trackId: 'redrock',
    distanceKm: 2,
    mode: 'solo',
    p1Config,
    maxOpponents: 3,
    skipCountdown: true,
  });
  const p1 = sim.buggies[0];
  const nearFinish = trackToWorld('redrock', 2000 - 3, 0, 2000);
  p1.x = nearFinish.x;
  p1.y = nearFinish.y;
  p1.z = nearFinish.z;
  p1.yaw = nearFinish.sample.yaw;
  p1.speed = 35;
  p1.vx = -Math.sin(p1.yaw) * 35;
  p1.vz = -Math.cos(p1.yaw) * 35;

  const drive: PlayerControlInput = { throttle: 1, steer: 0, boost: false, useItemJustPressed: false };
  for (let i = 0; i < 20; i++) {
    stepRaceSimulation(sim, 0.03, [drive, idleInput]);
  }

  assert.equal(p1.finished, true);
  assert.equal(sim.allFinished, true);
  assert.equal(p1.speed, 0, 'Car stops cleanly at finish line');
  assert.ok(p1.s <= 2000, 'Car stays on track instead of driving off into void');

  const gInfo = groundHeightAt('redrock', p1.x, p1.z, sim.ramps, 2000);
  assert.equal(gInfo.onRoad, true);
});

test('leaderboard filters by track and distance (2km, 3km, 5km)', () => {
  assert.equal(formatRaceTime(82.45), '01:22.45');
  const result = addLeaderboardRecord(SEED_LEADERBOARD, {
    trackId: 'redrock',
    distanceKm: 5,
    driverName: 'TEST PILOT',
    vehicleLabel: 'Apex Dart · Paddle',
    colorHex: '#f97316',
    mode: 'online',
    timeSeconds: 125.5,
  });

  assert.equal(result.rank, 1);
  const sorted5k = sortLeaderboardForTrack(result.entries, 'redrock', 5);
  assert.equal(sorted5k[0].driverName, 'TEST PILOT');
  const sorted3k = sortLeaderboardForTrack(result.entries, 'redrock', 3);
  assert.notEqual(sorted3k[0].driverName, 'TEST PILOT');
});
