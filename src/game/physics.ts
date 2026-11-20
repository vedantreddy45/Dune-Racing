import {
  distanceKmToMeters,
  getTrackBoostPads,
  getTrackPickups,
  getTrackRamps,
  groundHeightAt,
  TRACKS,
  trackToWorld,
  worldToTrackCoord,
} from './tracks.ts';
import type {
  BuggyConfig,
  BuggyState,
  BuggyStats,
  HudSnapshot,
  PlayMode,
  PlayerControlInput,
  PowerUpType,
  RaceSimulation,
  TrackDistanceKm,
  TrackId,
} from './types.ts';
import { CHASSIS_OPTIONS, TIRE_OPTIONS } from './types.ts';

const POWERUP_POOL: PowerUpType[] = ['nitro', 'shockwave', 'shield', 'oil', 'magnet'];

export function computeBuggyStats(config: BuggyConfig): BuggyStats {
  const chassis = CHASSIS_OPTIONS.find((c) => c.id === config.chassis) ?? CHASSIS_OPTIONS[0];
  const tires = TIRE_OPTIONS.find((t) => t.id === config.tires) ?? TIRE_OPTIONS[0];

  return {
    topSpeed: 40.0,
    acceleration: 26.5,
    handling: 2.38 * chassis.handlingMod * tires.handlingMod,
    offroadGrip: 0.94 * chassis.offroadMod * tires.offroadMod,
    mass: chassis.mass,
  };
}

export function createAiPoolConfigs(usedColors: string[]): BuggyConfig[] {
  const presets: BuggyConfig[] = [
    { name: 'KAI', colorHex: '#84cc16', accentHex: '#ecfccb', chassis: 'dart', tires: 'paddle', rig: 'wing' },
    { name: 'MARA', colorHex: '#ef4444', accentHex: '#fee2e2', chassis: 'bruiser', tires: 'mudder', rig: 'spare' },
    { name: 'REX', colorHex: '#eab308', accentHex: '#1e293b', chassis: 'striker', tires: 'knobby', rig: 'lightbar' },
    { name: 'ZARA', colorHex: '#475569', accentHex: '#f97316', chassis: 'dart', tires: 'knobby', rig: 'lightbar' },
    { name: 'NOVA', colorHex: '#0ea5e9', accentHex: '#e0f2fe', chassis: 'striker', tires: 'paddle', rig: 'wing' },
    { name: 'BLITZ', colorHex: '#f97316', accentHex: '#fde047', chassis: 'bruiser', tires: 'knobby', rig: 'spare' },
  ];
  const filtered = presets.filter((p) => !usedColors.includes(p.colorHex));
  return filtered.length >= 5 ? filtered : presets;
}

export interface HumanSlotSpec {
  id: string;
  label: string;
  humanIndex: number;
  config: BuggyConfig;
}

export function createRaceSimulation(params: {
  trackId: TrackId;
  distanceKm?: TrackDistanceKm;
  mode: PlayMode;
  p1Config: BuggyConfig;
  p2Config?: BuggyConfig;
  humanSlots?: HumanSlotSpec[];
  maxOpponents?: number; // 1..5
  fillWithAi?: boolean;
  skipCountdown?: boolean;
}): RaceSimulation {
  const {
    trackId,
    distanceKm = 3,
    mode,
    p1Config,
    p2Config,
    humanSlots,
    maxOpponents = 3,
    fillWithAi = true,
    skipCountdown = false,
  } = params;

  const lengthMeters = distanceKmToMeters(distanceKm);
  const clampedOpponents = Math.max(1, Math.min(5, maxOpponents));
  const ramps = getTrackRamps(trackId, lengthMeters);
  const boostPads = getTrackBoostPads(trackId, lengthMeters);
  const pickupSpawns = getTrackPickups(trackId, lengthMeters);

  const pickups = pickupSpawns.map((sp) => {
    const world = trackToWorld(trackId, sp.s, sp.offset, lengthMeters);
    return {
      id: sp.id,
      s: sp.s,
      offset: sp.offset,
      x: world.x,
      y: world.y + 1.05,
      z: world.z,
      cooldown: 0,
    };
  });

  const resolvedHumans: HumanSlotSpec[] = humanSlots
    ? humanSlots
    : mode === 'splitscreen' && p2Config
      ? [
          { id: 'p1', label: p1Config.name || 'PLAYER 1', humanIndex: 0, config: p1Config },
          { id: 'p2', label: p2Config.name || 'PLAYER 2', humanIndex: 1, config: p2Config },
        ]
      : [{ id: 'p1', label: p1Config.name || 'PLAYER 1', humanIndex: 0, config: p1Config }];

  // Total grid size = 1 + clampedOpponents (e.g., 2..5 opponents => 3..6 racers),
  // or if fillWithAi is false in online mode, just the connected human slots.
  const targetTotalRacers = fillWithAi
    ? Math.max(resolvedHumans.length, 1 + clampedOpponents)
    : resolvedHumans.length;
  const aiCount = Math.max(0, targetTotalRacers - resolvedHumans.length);
  const aiPool = createAiPoolConfigs(resolvedHumans.map((h) => h.config.colorHex));

  const gridEntries: {
    id: string;
    label: string;
    isHuman: boolean;
    humanIndex: number;
    config: BuggyConfig;
  }[] = [
    ...resolvedHumans.map((h) => ({
      id: h.id,
      label: h.label,
      isHuman: true,
      humanIndex: h.humanIndex,
      config: h.config,
    })),
  ];

  for (let i = 0; i < aiCount; i++) {
    const cfg = aiPool[i % aiPool.length];
    gridEntries.push({
      id: `ai-${i + 1}`,
      label: cfg.name,
      isHuman: false,
      humanIndex: -1,
      config: cfg,
    });
  }

  // Spread grid cleanly across 2-wide starting rows (max 6 racers = 3 rows)
  const laneOffsets = [-4.0, 4.0];
  const buggies: BuggyState[] = gridEntries.map((entry, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const s = 4 + row * 4.5;
    const offset = gridEntries.length === 1 ? 0 : laneOffsets[col];
    const world = trackToWorld(trackId, s, offset, lengthMeters);

    return {
      id: entry.id,
      label: entry.label,
      isHuman: entry.isHuman,
      humanIndex: entry.humanIndex,
      config: entry.config,
      stats: computeBuggyStats(entry.config),
      x: world.x,
      y: world.y,
      z: world.z,
      vx: 0,
      vy: 0,
      vz: 0,
      speed: 0,
      yaw: world.sample.yaw,
      pitch: 0,
      roll: 0,
      steerAngle: 0,
      wheelSpin: 0,
      grounded: true,
      suspensionCompression: 0,
      s,
      lateralOffset: offset,
      boostMeter: 100,
      isBoosting: false,
      heldPowerUp: null,
      nitroTimer: 0,
      shieldTimer: 0,
      spinOutTimer: 0,
      hitFlashTimer: 0,
      finished: false,
      finishTime: null,
      rank: idx + 1,
      aiTargetOffset: offset,
      aiDecisionTimer: 0.4 + idx * 0.2,
    };
  });

  const traumaCount = Math.max(2, resolvedHumans.length);
  return {
    trackId,
    distanceKm,
    lengthMeters,
    mode,
    buggies,
    pickups,
    ramps,
    boostPads,
    hazards: [],
    shockwaves: [],
    elapsedTime: 0,
    countdownTimer: skipCountdown ? 0 : 1.9,
    lastCountdownTick: skipCountdown ? 0 : 4,
    hitstopTimer: 0,
    cameraTrauma: new Array(traumaCount).fill(0),
    graceTimer: null,
    allFinished: false,
    nextEntityId: 1,
    events: [],
  };
}

function wrapAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function computeAiInput(sim: RaceSimulation, ai: BuggyState, dt: number): PlayerControlInput {
  ai.aiDecisionTimer -= dt;
  if (ai.aiDecisionTimer <= 0) {
    ai.aiDecisionTimer = 0.6 + Math.random() * 0.8;
    let bestOffset = Math.sin(ai.s * 0.015 + ai.rank) * 3.5;

    const leadHumanNow = sim.buggies
      .filter((b) => b.isHuman)
      .reduce((max, h) => Math.max(max, h.s), 0);
    if (ai.s <= leadHumanNow + 5) {
      for (const p of sim.pickups) {
        if (p.cooldown <= 0 && p.s > ai.s + 8 && p.s < ai.s + 55) {
          bestOffset = p.offset;
          break;
        }
      }
      for (const pad of sim.boostPads) {
        if (pad.s > ai.s + 8 && pad.s < ai.s + 55) {
          bestOffset = pad.offset;
          break;
        }
      }
    }
    for (const h of sim.hazards) {
      const distSq = (h.x - ai.x) ** 2 + (h.z - ai.z) ** 2;
      if (distSq < 400) {
        bestOffset = ai.lateralOffset > 0 ? -4.5 : 4.5;
      }
    }

    const halfW = TRACKS[sim.trackId].halfWidth - 2.5;
    ai.aiTargetOffset = Math.max(-halfW, Math.min(halfW, bestOffset));
  }

  const lookAheadS = Math.min(sim.lengthMeters + 40, ai.s + 24);
  const targetWorld = trackToWorld(sim.trackId, lookAheadS, ai.aiTargetOffset, sim.lengthMeters);
  const dx = targetWorld.x - ai.x;
  const dz = targetWorld.z - ai.z;
  const desiredYaw = Math.atan2(-dx, -dz);
  const angleErr = wrapAngle(desiredYaw - ai.yaw);
  const steer = Math.max(-1, Math.min(1, angleErr * 2.1));

  const humans = sim.buggies.filter((b) => b.isHuman);
  const leadHumanS = humans.reduce((max, h) => Math.max(max, h.s), 0);
  const gap = ai.s - leadHumanS;
  let throttle = 0.94;
  const boost = false;

  if (gap > 6) {
    throttle = 0.78;
  } else if (gap < -20) {
    throttle = 1.0;
  }

  let useItemJustPressed = false;
  if (ai.heldPowerUp) {
    if (ai.heldPowerUp === 'nitro' || ai.heldPowerUp === 'magnet') {
      if (gap < 15) useItemJustPressed = true;
    } else if (ai.heldPowerUp === 'shield') {
      useItemJustPressed = true;
    } else if (ai.heldPowerUp === 'shockwave') {
      const nearRival = sim.buggies.some(
        (other) => other.id !== ai.id && Math.hypot(other.x - ai.x, other.z - ai.z) < 12,
      );
      if (nearRival) useItemJustPressed = true;
    } else if (ai.heldPowerUp === 'oil') {
      const chaser = sim.buggies.some(
        (other) => other.id !== ai.id && other.s < ai.s && ai.s - other.s < 28,
      );
      if (chaser) useItemJustPressed = true;
    }
  }

  return { throttle, steer, boost, useItemJustPressed };
}

export function pickPowerUpForRank(rank: number, total: number, rng: () => number = Math.random): PowerUpType {
  const r = rng();
  if (rank >= total) {
    if (r < 0.45) return 'nitro';
    if (r < 0.8) return 'magnet';
    return 'shockwave';
  }
  if (rank === 1) {
    if (r < 0.4) return 'shield';
    if (r < 0.75) return 'oil';
    return 'nitro';
  }
  return POWERUP_POOL[Math.floor(r * POWERUP_POOL.length) % POWERUP_POOL.length];
}

export function activatePowerUp(sim: RaceSimulation, buggy: BuggyState): void {
  const item = buggy.heldPowerUp;
  if (!item) return;
  buggy.heldPowerUp = null;

  if (item === 'nitro') {
    buggy.nitroTimer = 2.6;
    buggy.boostMeter = Math.min(100, buggy.boostMeter + 40);
    buggy.speed = Math.max(buggy.speed, buggy.stats.topSpeed * 1.28);
    if (buggy.isHuman && buggy.humanIndex >= 0 && buggy.humanIndex < sim.cameraTrauma.length) {
      sim.cameraTrauma[buggy.humanIndex] = Math.min(1, sim.cameraTrauma[buggy.humanIndex] + 0.35);
    }
    sim.events.push({
      type: 'nitro',
      buggyId: buggy.id,
      humanIndex: buggy.humanIndex,
      intensity: 1,
      x: buggy.x,
      y: buggy.y,
      z: buggy.z,
    });
  } else if (item === 'shield') {
    buggy.shieldTimer = 6.0;
    buggy.spinOutTimer = 0;
    sim.events.push({
      type: 'shield',
      buggyId: buggy.id,
      humanIndex: buggy.humanIndex,
      intensity: 0.8,
      x: buggy.x,
      y: buggy.y,
      z: buggy.z,
    });
  } else if (item === 'shockwave') {
    const maxRadius = 15;
    sim.shockwaves.push({
      id: sim.nextEntityId++,
      x: buggy.x,
      y: buggy.y + 0.6,
      z: buggy.z,
      radius: 1.5,
      maxRadius,
      alpha: 1,
      colorHex: '#facc15',
    });
    for (const other of sim.buggies) {
      if (other.id === buggy.id || other.finished) continue;
      const dx = other.x - buggy.x;
      const dz = other.z - buggy.z;
      const dist = Math.hypot(dx, dz);
      if (dist < maxRadius && other.shieldTimer <= 0 && other.nitroTimer <= 0) {
        const inv = 1 / Math.max(0.5, dist);
        const push = (1 - dist / maxRadius) * 16;
        other.vx += dx * inv * push;
        other.vz += dz * inv * push;
        other.vy = Math.max(other.vy, 4.5);
        other.speed *= 0.62;
        other.hitFlashTimer = 0.25;
        if (other.isHuman && other.humanIndex >= 0 && other.humanIndex < sim.cameraTrauma.length) {
          sim.cameraTrauma[other.humanIndex] = Math.min(1, sim.cameraTrauma[other.humanIndex] + 0.65);
        }
      }
    }
    sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.045);
    if (buggy.isHuman && buggy.humanIndex >= 0 && buggy.humanIndex < sim.cameraTrauma.length) {
      sim.cameraTrauma[buggy.humanIndex] = Math.min(1, sim.cameraTrauma[buggy.humanIndex] + 0.45);
    }
    sim.events.push({
      type: 'shockwave',
      buggyId: buggy.id,
      humanIndex: buggy.humanIndex,
      intensity: 1,
      x: buggy.x,
      y: buggy.y,
      z: buggy.z,
    });
  } else if (item === 'oil') {
    const fx = -Math.sin(buggy.yaw);
    const fz = -Math.cos(buggy.yaw);
    const dropX = buggy.x - fx * 3.4;
    const dropZ = buggy.z - fz * 3.4;
    const { groundY } = groundHeightAt(sim.trackId, dropX, dropZ, sim.ramps, sim.lengthMeters);
    sim.hazards.push({
      id: sim.nextEntityId++,
      x: dropX,
      y: groundY + 0.05,
      z: dropZ,
      ownerId: buggy.id,
      ttl: 18,
    });
    sim.events.push({
      type: 'oilDrop',
      buggyId: buggy.id,
      humanIndex: buggy.humanIndex,
      intensity: 0.6,
      x: dropX,
      y: groundY,
      z: dropZ,
    });
  } else if (item === 'magnet') {
    const leaderS = sim.buggies.reduce((max, b) => Math.max(max, b.s), 0);
    const deficit = Math.max(0, leaderS - buggy.s);
    const surge = Math.min(18, 9 + deficit * 0.08);
    buggy.boostMeter = 100;
    buggy.speed = Math.max(buggy.speed, buggy.stats.topSpeed + surge * 0.6);
    buggy.nitroTimer = Math.max(buggy.nitroTimer, 1.5);
    sim.events.push({
      type: 'magnet',
      buggyId: buggy.id,
      humanIndex: buggy.humanIndex,
      intensity: 0.9,
      x: buggy.x,
      y: buggy.y,
      z: buggy.z,
    });
  }
}

export function stepRaceSimulation(
  sim: RaceSimulation,
  rawDt: number,
  humanInputs: PlayerControlInput[],
): void {
  const dt = Math.min(rawDt, 0.05);
  sim.events.length = 0;

  for (let i = 0; i < sim.cameraTrauma.length; i++) {
    sim.cameraTrauma[i] = Math.max(0, sim.cameraTrauma[i] - dt * 1.85);
  }
  for (const b of sim.buggies) {
    if (b.hitFlashTimer > 0) b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
  }

  if (sim.hitstopTimer > 0) {
    sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
    return;
  }

  if (sim.countdownTimer > 0) {
    sim.countdownTimer = Math.max(0, sim.countdownTimer - dt);
    const tick = sim.countdownTimer > 1.25 ? 3 : sim.countdownTimer > 0.65 ? 2 : sim.countdownTimer > 0.05 ? 1 : 0;
    if (tick !== sim.lastCountdownTick) {
      sim.lastCountdownTick = tick;
      sim.events.push({
        type: 'countdown',
        buggyId: 'system',
        humanIndex: -1,
        intensity: tick === 0 ? 1 : 0.5,
        value: tick,
      });
    }
    return;
  }

  if (sim.allFinished) {
    return;
  }

  sim.elapsedTime += dt;

  for (const p of sim.pickups) {
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
  }

  for (let i = sim.hazards.length - 1; i >= 0; i--) {
    sim.hazards[i].ttl -= dt;
    if (sim.hazards[i].ttl <= 0) {
      sim.hazards.splice(i, 1);
    }
  }

  for (let i = sim.shockwaves.length - 1; i >= 0; i--) {
    const sw = sim.shockwaves[i];
    sw.radius += dt * 36;
    sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
    if (sw.radius >= sw.maxRadius) {
      sim.shockwaves.splice(i, 1);
    }
  }

  const track = TRACKS[sim.trackId];

  for (const buggy of sim.buggies) {
    if (buggy.nitroTimer > 0) buggy.nitroTimer = Math.max(0, buggy.nitroTimer - dt);
    if (buggy.shieldTimer > 0) buggy.shieldTimer = Math.max(0, buggy.shieldTimer - dt);
    if (buggy.spinOutTimer > 0) buggy.spinOutTimer = Math.max(0, buggy.spinOutTimer - dt);
    buggy.suspensionCompression = Math.max(0, buggy.suspensionCompression - dt * 4.5);

    // If finished, brake smoothly to a stop right on the finish runoff apron (never drive off track!)
    if (buggy.finished) {
      buggy.isBoosting = false;
      buggy.speed = Math.max(0, buggy.speed - dt * 55);
      buggy.vx *= Math.max(0, 1 - dt * 8);
      buggy.vz *= Math.max(0, 1 - dt * 8);
      buggy.x += buggy.vx * dt;
      buggy.z += buggy.vz * dt;
      const g = groundHeightAt(sim.trackId, buggy.x, buggy.z, sim.ramps, sim.lengthMeters);
      buggy.y = g.groundY;
      buggy.wheelSpin += (buggy.speed * dt) / 0.48;
      continue;
    }

    let input: PlayerControlInput;
    if (buggy.isHuman) {
      input = humanInputs[buggy.humanIndex] ?? {
        throttle: 0,
        steer: 0,
        boost: false,
        useItemJustPressed: false,
      };
    } else {
      input = computeAiInput(sim, buggy, dt);
    }

    if (input.useItemJustPressed) {
      activatePowerUp(sim, buggy);
    }

    const wantsBoost = input.boost && buggy.boostMeter > 2 && input.throttle >= 0;
    buggy.isBoosting = wantsBoost || buggy.nitroTimer > 0;
    if (wantsBoost && buggy.nitroTimer <= 0) {
      buggy.boostMeter = Math.max(0, buggy.boostMeter - dt * 34);
    } else {
      const regenRate = Math.abs(input.steer) > 0.5 && buggy.speed > 18 ? 16 : 9;
      buggy.boostMeter = Math.min(100, buggy.boostMeter + dt * regenRate);
    }

    const spinControlFactor = buggy.spinOutTimer > 0 ? 0.35 : 1.0;
    const speedRatio = Math.min(1, Math.abs(buggy.speed) / 14);
    const reverseSign = buggy.speed < -0.5 ? -1 : 1;
    const targetSteerAngle = input.steer * 0.45;
    buggy.steerAngle += (targetSteerAngle - buggy.steerAngle) * Math.min(1, dt * 14);

    if (buggy.spinOutTimer > 0) {
      buggy.yaw = wrapAngle(buggy.yaw + dt * 6.8);
    } else {
      const turnRate =
        input.steer *
        buggy.stats.handling *
        (0.35 + 0.65 * speedRatio) *
        reverseSign *
        (buggy.grounded ? 1.0 : 0.38);
      buggy.yaw = wrapAngle(buggy.yaw + turnRate * dt);
    }

    const coordBefore = worldToTrackCoord(sim.trackId, buggy.x, buggy.z, sim.lengthMeters);
    if (buggy.isHuman && Math.abs(input.steer) < 0.08 && buggy.speed > 12) {
      const yawDiff = wrapAngle(coordBefore.sample.yaw - buggy.yaw);
      if (Math.abs(yawDiff) < 0.55) {
        buggy.yaw = wrapAngle(buggy.yaw + yawDiff * dt * 1.5);
      }
    }

    const groundInfo = groundHeightAt(sim.trackId, buggy.x, buggy.z, sim.ramps, sim.lengthMeters);
    const offRoadPenalty = groundInfo.onRoad ? 1.0 : Math.min(1.0, Math.max(0.86, 0.86 * buggy.stats.offroadGrip));

    const boostMult =
      buggy.nitroTimer > 0 ? 1.32 : wantsBoost ? 1.18 : buggy.shieldTimer > 0 ? 1.1 : 1.0;
    const throttleCap = input.throttle > 0.05 ? Math.min(1, input.throttle) : 1;
    const effectiveTopSpeed = buggy.stats.topSpeed * boostMult * offRoadPenalty * spinControlFactor * throttleCap;
    const effectiveAccel = buggy.stats.acceleration * (wantsBoost || buggy.nitroTimer > 0 ? 1.45 : 1.0);

    if (input.throttle > 0.05) {
      if (buggy.speed < effectiveTopSpeed) {
        buggy.speed = Math.min(effectiveTopSpeed, buggy.speed + effectiveAccel * input.throttle * dt);
      } else {
        buggy.speed = Math.max(effectiveTopSpeed, buggy.speed - dt * 14);
      }
    } else if (input.throttle < -0.05) {
      const minRev = -14;
      const brakePower = buggy.speed > 0 ? 38 : 18;
      buggy.speed = Math.max(minRev, buggy.speed + input.throttle * brakePower * dt);
    } else {
      const drag = buggy.grounded ? 8.5 : 1.8;
      if (buggy.speed > 0) {
        buggy.speed = Math.max(0, buggy.speed - drag * dt);
      } else {
        buggy.speed = Math.min(0, buggy.speed + drag * dt);
      }
    }

    const fx = -Math.sin(buggy.yaw);
    const fz = -Math.cos(buggy.yaw);
    const gripFactor = buggy.grounded ? (groundInfo.onRoad ? 7.5 : 5.2) : 0.8;
    const targetVx = fx * buggy.speed;
    const targetVz = fz * buggy.speed;
    const blend = Math.min(1, dt * gripFactor);
    buggy.vx += (targetVx - buggy.vx) * blend;
    buggy.vz += (targetVz - buggy.vz) * blend;

    buggy.x += buggy.vx * dt;
    buggy.z += buggy.vz * dt;

    const coordAfter = worldToTrackCoord(sim.trackId, buggy.x, buggy.z, sim.lengthMeters);
    const maxOffset = track.halfWidth + 2.2;
    if (Math.abs(coordAfter.lateralOffset) > maxOffset) {
      const sign = Math.sign(coordAfter.lateralOffset);
      const clampedOffset = sign * maxOffset;
      const clampedWorld = trackToWorld(sim.trackId, coordAfter.s, clampedOffset, sim.lengthMeters);
      buggy.x = clampedWorld.x;
      buggy.z = clampedWorld.z;
      const inwardCorrection = wrapAngle(coordAfter.sample.yaw - buggy.yaw);
      buggy.yaw = wrapAngle(buggy.yaw + inwardCorrection * 0.35);
      buggy.speed *= 0.86;
      buggy.vx = -Math.sin(buggy.yaw) * buggy.speed;
      buggy.vz = -Math.cos(buggy.yaw) * buggy.speed;
      if (buggy.isHuman && buggy.speed > 14 && buggy.humanIndex >= 0 && buggy.humanIndex < sim.cameraTrauma.length) {
        sim.cameraTrauma[buggy.humanIndex] = Math.min(1, sim.cameraTrauma[buggy.humanIndex] + 0.22);
      }
    }

    const prevGroundY = groundInfo.groundY;
    const nextGround = groundHeightAt(sim.trackId, buggy.x, buggy.z, sim.ramps, sim.lengthMeters);

    if (buggy.grounded) {
      const slopeVy = (nextGround.groundY - prevGroundY) / Math.max(0.001, dt);
      if (groundInfo.rampSlope > 0.08 && nextGround.rampSlope === 0 && buggy.speed > 14) {
        buggy.vy = Math.max(6.2, buggy.speed * groundInfo.rampSlope * 1.15);
        buggy.y += buggy.vy * dt;
        buggy.grounded = false;
        sim.events.push({
          type: 'jump',
          buggyId: buggy.id,
          humanIndex: buggy.humanIndex,
          intensity: 0.7,
          x: buggy.x,
          y: buggy.y,
          z: buggy.z,
        });
      } else {
        buggy.y = nextGround.groundY;
        buggy.vy = Math.min(8, slopeVy * 0.45);
      }
    } else {
      buggy.vy -= 22.0 * dt;
      buggy.y += buggy.vy * dt;
      if (buggy.y <= nextGround.groundY) {
        const impactSpeed = -buggy.vy;
        buggy.y = nextGround.groundY;
        buggy.vy = 0;
        buggy.grounded = true;
        buggy.suspensionCompression = Math.min(1, impactSpeed / 12);
        if (impactSpeed > 4.5) {
          if (buggy.isHuman && buggy.humanIndex >= 0 && buggy.humanIndex < sim.cameraTrauma.length) {
            sim.cameraTrauma[buggy.humanIndex] = Math.min(
              1,
              sim.cameraTrauma[buggy.humanIndex] + Math.min(0.45, impactSpeed * 0.03),
            );
          }
          sim.events.push({
            type: 'land',
            buggyId: buggy.id,
            humanIndex: buggy.humanIndex,
            intensity: Math.min(1, impactSpeed / 14),
            x: buggy.x,
            y: buggy.y,
            z: buggy.z,
          });
        }
      }
    }

    const targetPitch = buggy.grounded
      ? nextGround.rampSlope * 0.75 + (input.throttle > 0 ? -0.03 : 0)
      : Math.max(-0.35, Math.min(0.35, buggy.vy * 0.035));
    const targetRoll = -input.steer * speedRatio * 0.14 + coordAfter.sample.bank * 0.6;
    buggy.pitch += (targetPitch - buggy.pitch) * Math.min(1, dt * 10);
    buggy.roll += (targetRoll - buggy.roll) * Math.min(1, dt * 10);

    buggy.wheelSpin += (buggy.speed * dt) / 0.48;

    const finalCoord = worldToTrackCoord(sim.trackId, buggy.x, buggy.z, sim.lengthMeters);
    buggy.s = Math.max(0, finalCoord.s);
    buggy.lateralOffset = finalCoord.lateralOffset;

    if (buggy.grounded) {
      for (const pad of sim.boostPads) {
        if (
          buggy.s >= pad.s &&
          buggy.s <= pad.s + pad.length &&
          Math.abs(buggy.lateralOffset - pad.offset) <= pad.width * 0.6
        ) {
          const leadHumanS = sim.buggies
            .filter((h) => h.isHuman)
            .reduce((max, h) => Math.max(max, h.s), 0);
          const aiAlreadyAhead = !buggy.isHuman && buggy.s > leadHumanS + 2;
          if (!aiAlreadyAhead && buggy.nitroTimer < 0.7) {
            buggy.nitroTimer = 0.85;
            buggy.boostMeter = Math.min(100, buggy.boostMeter + 28);
            buggy.speed = Math.max(buggy.speed, buggy.stats.topSpeed * 1.24);
            if (buggy.isHuman && buggy.humanIndex >= 0 && buggy.humanIndex < sim.cameraTrauma.length) {
              sim.cameraTrauma[buggy.humanIndex] = Math.min(1, sim.cameraTrauma[buggy.humanIndex] + 0.28);
            }
            sim.events.push({
              type: 'boostPad',
              buggyId: buggy.id,
              humanIndex: buggy.humanIndex,
              intensity: 0.8,
              x: buggy.x,
              y: buggy.y,
              z: buggy.z,
            });
          }
        }
      }
    }

    for (const p of sim.pickups) {
      if (p.cooldown > 0) continue;
      const distSq = (p.x - buggy.x) ** 2 + (p.z - buggy.z) ** 2;
      if (distSq < 7.2) {
        p.cooldown = 4.5;
        if (!buggy.heldPowerUp) {
          buggy.heldPowerUp = pickPowerUpForRank(buggy.rank, sim.buggies.length);
        } else {
          buggy.boostMeter = Math.min(100, buggy.boostMeter + 35);
        }
        sim.events.push({
          type: 'pickup',
          buggyId: buggy.id,
          humanIndex: buggy.humanIndex,
          intensity: 0.7,
          x: p.x,
          y: p.y,
          z: p.z,
        });
      }
    }

    if (buggy.grounded && buggy.shieldTimer <= 0 && buggy.nitroTimer <= 0) {
      for (let i = sim.hazards.length - 1; i >= 0; i--) {
        const h = sim.hazards[i];
        if (h.ownerId === buggy.id && h.ttl > 16.5) continue;
        const distSq = (h.x - buggy.x) ** 2 + (h.z - buggy.z) ** 2;
        if (distSq < 6.2) {
          sim.hazards.splice(i, 1);
          buggy.spinOutTimer = 1.15;
          buggy.speed *= 0.55;
          buggy.hitFlashTimer = 0.25;
          if (buggy.isHuman && buggy.humanIndex >= 0 && buggy.humanIndex < sim.cameraTrauma.length) {
            sim.cameraTrauma[buggy.humanIndex] = Math.min(1, sim.cameraTrauma[buggy.humanIndex] + 0.5);
          }
          sim.events.push({
            type: 'oilHit',
            buggyId: buggy.id,
            humanIndex: buggy.humanIndex,
            intensity: 0.9,
            x: buggy.x,
            y: buggy.y,
            z: buggy.z,
          });
          break;
        }
      }
    }

    // Finish Line check: clamp buggy at finish arch & stop immediately when human crosses
    if (buggy.s >= sim.lengthMeters) {
      buggy.finished = true;
      buggy.finishTime = sim.elapsedTime;
      buggy.s = sim.lengthMeters;
      const finishPos = trackToWorld(sim.trackId, sim.lengthMeters + 4, buggy.lateralOffset, sim.lengthMeters);
      buggy.x = finishPos.x;
      buggy.z = finishPos.z;
      buggy.y = finishPos.y;
      buggy.speed = 0;
      buggy.vx = 0;
      buggy.vz = 0;
      buggy.vy = 0;
      buggy.isBoosting = false;

      sim.events.push({
        type: 'finish',
        buggyId: buggy.id,
        humanIndex: buggy.humanIndex,
        intensity: 1,
        x: buggy.x,
        y: buggy.y,
        z: buggy.z,
        value: sim.elapsedTime,
      });

      if (buggy.isHuman) {
        sim.allFinished = true;
      }
    }
  }

  // Buggy-to-buggy collisions
  const minDist = 2.65;
  for (let i = 0; i < sim.buggies.length; i++) {
    for (let j = i + 1; j < sim.buggies.length; j++) {
      const a = sim.buggies[i];
      const b = sim.buggies[j];
      if (Math.abs(a.y - b.y) > 2.2) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001 && dist < minDist) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = minDist - dist;
        const totalMass = a.stats.mass + b.stats.mass;
        const aShare = b.stats.mass / totalMass;
        const bShare = a.stats.mass / totalMass;

        a.x -= nx * overlap * aShare;
        a.z -= nz * overlap * aShare;
        b.x += nx * overlap * bShare;
        b.z += nz * overlap * bShare;

        const relVx = b.vx - a.vx;
        const relVz = b.vz - a.vz;
        const relNormal = relVx * nx + relVz * nz;
        if (relNormal < 0) {
          const impulse = -relNormal * 0.85;
          a.vx -= nx * impulse * aShare;
          a.vz -= nz * impulse * aShare;
          b.vx += nx * impulse * bShare;
          b.vz += nz * impulse * bShare;

          if (Math.abs(relNormal) > 7) {
            a.hitFlashTimer = 0.12;
            b.hitFlashTimer = 0.12;
            sim.hitstopTimer = Math.max(sim.hitstopTimer, 0.032);
            if (a.isHuman && a.humanIndex >= 0 && a.humanIndex < sim.cameraTrauma.length) {
              sim.cameraTrauma[a.humanIndex] = Math.min(1, sim.cameraTrauma[a.humanIndex] + 0.35);
            }
            if (b.isHuman && b.humanIndex >= 0 && b.humanIndex < sim.cameraTrauma.length) {
              sim.cameraTrauma[b.humanIndex] = Math.min(1, sim.cameraTrauma[b.humanIndex] + 0.35);
            }
            sim.events.push({
              type: 'collision',
              buggyId: a.id,
              humanIndex: a.humanIndex,
              intensity: Math.min(1, Math.abs(relNormal) / 20),
              x: (a.x + b.x) * 0.5,
              y: (a.y + b.y) * 0.5,
              z: (a.z + b.z) * 0.5,
            });
          }
        }
      }
    }
  }

  // Rankings
  const sorted = sim.buggies.slice().sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.s - a.s;
  });
  sorted.forEach((b, idx) => {
    b.rank = idx + 1;
  });

  // If race just ended when a human crossed the finish line, freeze all remaining cars immediately
  if (sim.allFinished) {
    for (const b of sim.buggies) {
      b.speed = 0;
      b.vx = 0;
      b.vz = 0;
      b.vy = 0;
      b.isBoosting = false;
    }
  }
}

export function buildHudSnapshot(
  sim: RaceSimulation,
  phase: HudSnapshot['phase'],
  localHumanIndex?: number,
): HudSnapshot {
  const countdownValue =
    sim.countdownTimer > 1.25
      ? 3
      : sim.countdownTimer > 0.65
        ? 2
        : sim.countdownTimer > 0.05
          ? 1
          : sim.countdownTimer > 0
            ? 0
            : -1;

  const humans = sim.buggies
    .filter((b) =>
      localHumanIndex !== undefined
        ? b.isHuman && b.humanIndex === localHumanIndex
        : b.isHuman,
    )
    .sort((a, b) => a.humanIndex - b.humanIndex);

  const standings = sim.buggies
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((b) => ({
      id: b.id,
      label: b.label,
      isHuman: b.isHuman,
      humanIndex: b.humanIndex,
      colorHex: b.config.colorHex,
      chassis: b.config.chassis,
      tires: b.config.tires,
      rank: b.rank,
      distanceMeters: Math.min(sim.lengthMeters, Math.round(b.s)),
      finishTime: b.finishTime,
    }));

  return {
    phase,
    mode: sim.mode,
    trackId: sim.trackId,
    distanceKm: sim.distanceKm,
    lengthMeters: sim.lengthMeters,
    elapsedTime: sim.elapsedTime,
    countdownValue,
    totalRacers: sim.buggies.length,
    graceRemaining: sim.graceTimer,
    players: humans.map((b) => ({
      id: b.id,
      label: b.label,
      rank: b.rank,
      distanceMeters: Math.min(sim.lengthMeters, Math.round(b.s)),
      speedKmh: Math.round(Math.abs(b.speed) * 3.6),
      boostMeter: Math.round(b.boostMeter),
      heldPowerUp: b.heldPowerUp,
      nitroActive: b.nitroTimer > 0,
      shieldActive: b.shieldTimer > 0,
      spinOutActive: b.spinOutTimer > 0,
      finished: b.finished,
      finishTime: b.finishTime,
    })),
    standings,
  };
}
