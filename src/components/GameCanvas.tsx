import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SoundEngine } from '../game/audio';
import type { ServerSimConfig, ServerSimState } from '../game/netClient';
import {
  buildHudSnapshot,
  computeBuggyStats,
  createRaceSimulation,
  stepRaceSimulation,
} from '../game/physics';
import { groundHeightAt, TRACKS } from '../game/tracks';
import {
  BuggyConfig,
  GamePhase,
  HudSnapshot,
  PlayMode,
  PlayerControlInput,
  RaceSimulation,
  TrackDistanceKm,
  TrackId,
} from '../game/types';
import { BuggyVisual, createBuggyMesh, syncBuggyVisual } from '../three/buggyMesh';
import { PooledParticleSystem } from '../three/particles';
import { createTrackTextures } from '../three/textures';
import { buildTrackSceneContent, TrackSceneHandle } from '../three/trackBuilder';

export interface EngineActions {
  startRace: (opts?: { skipCountdown?: boolean }) => void;
  startOnlineRace: (
    simConfig: ServerSimConfig,
    initialState: ServerSimState,
    localHumanIndex: number,
  ) => void;
  pushOnlineState: (state: ServerSimState) => void;
  restartRace: () => void;
  pauseRace: () => void;
  resumeRace: () => void;
  returnToTitle: () => void;
  toggleMute: () => boolean;
  setTouchInput: (partial: {
    throttle?: number;
    steer?: number;
    boost?: boolean;
    triggerItem?: boolean;
  }) => void;
}

interface GameCanvasProps {
  phase: GamePhase;
  mode: PlayMode;
  trackId: TrackId;
  distanceKm: TrackDistanceKm;
  maxOpponents: number;
  p1Config: BuggyConfig;
  p2Config: BuggyConfig;
  garageOpen: boolean;
  onSendOnlineInput: (input: PlayerControlInput) => void;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onMuteChange: (muted: boolean) => void;
  actionsRef: React.MutableRefObject<EngineActions | null>;
}

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  phase,
  mode,
  trackId,
  distanceKm,
  maxOpponents,
  p1Config,
  p2Config,
  garageOpen,
  onSendOnlineInput,
  onHudUpdate,
  onPhaseChange,
  onMuteChange,
  actionsRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const propsRef = useRef({
    phase,
    mode,
    trackId,
    distanceKm,
    maxOpponents,
    p1Config,
    p2Config,
    garageOpen,
    onSendOnlineInput,
    onHudUpdate,
    onPhaseChange,
    onMuteChange,
  });
  propsRef.current = {
    phase,
    mode,
    trackId,
    distanceKm,
    maxOpponents,
    p1Config,
    p2Config,
    garageOpen,
    onSendOnlineInput,
    onHudUpdate,
    onPhaseChange,
    onMuteChange,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.tabIndex = 0;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight('#9ecae8', '#a65432', 0.72);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#fff1d6', 1.85);
    sunLight.position.set(45, 75, 35);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 200;
    const d = 55;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const cam1 = new THREE.PerspectiveCamera(62, 16 / 9, 0.4, 900);
    const cam2 = new THREE.PerspectiveCamera(62, 16 / 9, 0.4, 900);

    const camStates = [
      { pos: new THREE.Vector3(0, 8, 16), look: new THREE.Vector3(0, 1, -12), fov: 62 },
      { pos: new THREE.Vector3(0, 8, 16), look: new THREE.Vector3(0, 1, -12), fov: 62 },
    ];

    const sound = new SoundEngine();
    const particles = new PooledParticleSystem(scene);
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    let sim: RaceSimulation = createRaceSimulation({
      trackId: propsRef.current.trackId,
      distanceKm: propsRef.current.distanceKm,
      mode: propsRef.current.mode === 'online' ? 'solo' : propsRef.current.mode,
      p1Config: propsRef.current.p1Config,
      p2Config: propsRef.current.p2Config,
      maxOpponents: propsRef.current.maxOpponents,
    });
    let trackHandle: TrackSceneHandle | null = null;
    let buggyVisuals: BuggyVisual[] = [];
    let activeWorldKey = '';
    let localOnlineHumanIndex = 0;
    let pendingOnlineStates: ServerSimState[] = [];

    const setupSceneForSim = (targetSim: RaceSimulation) => {
      const track = TRACKS[targetSim.trackId];

      scene.background = new THREE.Color(track.skyColor);
      scene.fog = new THREE.FogExp2(track.fogColor, track.fogDensity);
      hemiLight.color.set(track.hemiSkyColor);
      hemiLight.groundColor.set(track.hemiGroundColor);
      sunLight.color.set(track.sunColor);

      if (trackHandle) {
        scene.remove(trackHandle.group);
        trackHandle.dispose();
        trackHandle = null;
      }
      for (const bv of buggyVisuals) {
        scene.remove(bv.root);
        bv.dispose();
      }
      buggyVisuals = [];

      trackHandle = buildTrackSceneContent(targetSim, maxAnisotropy);
      scene.add(trackHandle.group);

      const shadowTex = createTrackTextures(track, targetSim.distanceKm, 1);
      for (const b of targetSim.buggies) {
        const bv = createBuggyMesh(b.config, shadowTex.contactShadowMap);
        scene.add(bv.root);
        buggyVisuals.push(bv);
      }
      shadowTex.roadMap.dispose();
      shadowTex.roadBump.dispose();
      shadowTex.terrainMap.dispose();
      shadowTex.boostMap.dispose();
      shadowTex.startBannerMap.dispose();
      shadowTex.finishBannerMap.dispose();
      shadowTex.finishLineStripMap.dispose();
      shadowTex.kmBannerMaps.forEach((m) => m.dispose());
    };

    const snapCameras = (humanIdx0: number, humanIdx1 = 1) => {
      const indices = [humanIdx0, humanIdx1];
      for (let i = 0; i < 2; i++) {
        const target = sim.buggies.find((b) => b.humanIndex === indices[i]) ?? sim.buggies[0];
        if (!target) continue;
        const fx = -Math.sin(target.yaw);
        const fz = -Math.cos(target.yaw);
        camStates[i].pos.set(target.x - fx * 9.5, target.y + 4.2, target.z - fz * 9.5);
        camStates[i].look.set(target.x + fx * 10, target.y + 1.2, target.z + fz * 10);
        camStates[i].fov = 62;
      }
    };

    const rebuildWorld = (skipCountdown = false) => {
      const {
        trackId: tid,
        distanceKm: dkm,
        mode: md,
        maxOpponents: maxOpp,
        p1Config: c1,
        p2Config: c2,
      } = propsRef.current;
      const effectiveMode: PlayMode = md === 'online' ? 'solo' : md;

      sim = createRaceSimulation({
        trackId: tid,
        distanceKm: dkm,
        mode: effectiveMode,
        p1Config: c1,
        p2Config: c2,
        maxOpponents: maxOpp,
        skipCountdown,
      });

      setupSceneForSim(sim);
      snapCameras(0, 1);

      activeWorldKey = `${tid}|${dkm}|${md}|${maxOpp}|${JSON.stringify(c1)}|${JSON.stringify(c2)}`;

      if (!isSoftwareGl) {
        renderer.compile(scene, cam1);
      }
    };

    const emitSimEvents = (events: RaceSimulation['events']) => {
      for (const ev of events) {
        sound.handleEvent(ev);
        if (ev.x !== undefined && ev.y !== undefined && ev.z !== undefined) {
          if (ev.type === 'pickup') {
            particles.burst(ev.x, ev.y, ev.z, 12, '#38bdf8', 7, 0.55);
          } else if (ev.type === 'shockwave') {
            particles.burst(ev.x, ev.y + 0.5, ev.z, 22, '#facc15', 14, 0.75);
          } else if (ev.type === 'collision' || ev.type === 'oilHit') {
            particles.burst(ev.x, ev.y + 0.5, ev.z, 16, '#f97316', 10, 0.55);
          } else if (ev.type === 'land') {
            particles.burst(ev.x, ev.y + 0.2, ev.z, 10, '#d6a47c', 7, 0.7);
          } else if (ev.type === 'boostPad' || ev.type === 'nitro') {
            particles.burst(ev.x, ev.y + 0.4, ev.z, 10, '#38bdf8', 8, 0.5);
          }
        }
      }
    };

    const applyServerStateToSim = (state: ServerSimState, snapPositions = false) => {
      sim.elapsedTime = state.elapsedTime;
      sim.countdownTimer = state.countdownTimer;
      sim.allFinished = state.allFinished;
      sim.hitstopTimer = state.hitstopTimer;
      sim.cameraTrauma = state.cameraTrauma.slice();
      sim.hazards = state.hazards.map((h) => ({ ...h }));
      sim.shockwaves = state.shockwaves.map((sw) => ({ ...sw }));

      for (let i = 0; i < sim.pickups.length && i < state.pickupCooldowns.length; i++) {
        sim.pickups[i].cooldown = state.pickupCooldowns[i];
      }

      for (const sb of state.buggies) {
        const local = sim.buggies.find((b) => b.id === sb.id);
        if (!local) continue;
        const distSq =
          (sb.x - local.x) * (sb.x - local.x) +
          (sb.y - local.y) * (sb.y - local.y) +
          (sb.z - local.z) * (sb.z - local.z);
        if (snapPositions || distSq > 16 || sb.finished) {
          local.x = sb.x;
          local.y = sb.y;
          local.z = sb.z;
        } else {
          local.x += (sb.x - local.x) * 0.65;
          local.y += (sb.y - local.y) * 0.75;
          local.z += (sb.z - local.z) * 0.65;
        }
        local.vx = sb.vx;
        local.vy = sb.vy;
        local.vz = sb.vz;
        local.speed = sb.speed;
        local.yaw = sb.yaw;
        local.pitch = sb.pitch;
        local.roll = sb.roll;
        local.steerAngle = sb.steerAngle;
        local.wheelSpin = sb.wheelSpin;
        local.grounded = sb.grounded;
        local.suspensionCompression = sb.suspensionCompression;
        local.s = sb.s;
        local.lateralOffset = sb.lateralOffset;
        local.boostMeter = sb.boostMeter;
        local.isBoosting = sb.isBoosting;
        local.heldPowerUp = sb.heldPowerUp;
        local.nitroTimer = sb.nitroTimer;
        local.shieldTimer = sb.shieldTimer;
        local.spinOutTimer = sb.spinOutTimer;
        local.hitFlashTimer = sb.hitFlashTimer;
        local.finished = sb.finished;
        local.finishTime = sb.finishTime;
        local.rank = sb.rank;
      }

      if (state.events.length > 0) {
        emitSimEvents(state.events);
      }
    };

    rebuildWorld(false);

    // Input Tracking
    const heldKeys = new Set<string>();
    let p1ItemJustPressed = false;
    let p2ItemJustPressed = false;
    const touchState = { throttle: 0, steer: 0, boost: false };

    const clearInputs = () => {
      heldKeys.clear();
      p1ItemJustPressed = false;
      p2ItemJustPressed = false;
      touchState.throttle = 0;
      touchState.steer = 0;
      touchState.boost = false;
    };

    const setPhase = (next: GamePhase) => {
      document.body.dataset.state = next;
      propsRef.current.onPhaseChange(next);
    };

    const startRace = (opts?: { skipCountdown?: boolean }) => {
      sound.unlock();
      clearInputs();
      pendingOnlineStates = [];
      rebuildWorld(opts?.skipCountdown ?? false);
      setPhase('playing');
      propsRef.current.onHudUpdate(buildHudSnapshot(sim, 'playing'));
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      renderer.domElement.focus();
    };

    const startOnlineRace = (
      simConfig: ServerSimConfig,
      initialState: ServerSimState,
      localHumanIndex: number,
    ) => {
      sound.unlock();
      clearInputs();
      pendingOnlineStates = [];
      localOnlineHumanIndex = localHumanIndex;

      const humanSlots = simConfig.buggies
        .filter((b) => b.isHuman)
        .map((b) => ({
          id: b.id,
          label: b.label,
          humanIndex: b.humanIndex,
          config: b.config,
        }));

      sim = createRaceSimulation({
        trackId: simConfig.trackId,
        distanceKm: simConfig.distanceKm,
        mode: 'online',
        p1Config: simConfig.buggies[0]?.config ?? propsRef.current.p1Config,
        humanSlots,
        maxOpponents: Math.max(1, Math.min(5, simConfig.buggies.length - 1)),
        fillWithAi: true,
      });

      // Align exact buggy metadata from server config
      for (let i = 0; i < simConfig.buggies.length && i < sim.buggies.length; i++) {
        const sb = simConfig.buggies[i];
        sim.buggies[i].id = sb.id;
        sim.buggies[i].label = sb.label;
        sim.buggies[i].isHuman = sb.isHuman;
        sim.buggies[i].humanIndex = sb.humanIndex;
        sim.buggies[i].config = sb.config;
        sim.buggies[i].stats = computeBuggyStats(sb.config);
      }

      setupSceneForSim(sim);
      applyServerStateToSim(initialState, true);
      snapCameras(localHumanIndex, localHumanIndex);

      if (!isSoftwareGl) {
        renderer.compile(scene, cam1);
      }

      setPhase('playing');
      propsRef.current.onHudUpdate(buildHudSnapshot(sim, 'playing', localOnlineHumanIndex));
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      renderer.domElement.focus();
    };

    const pushOnlineState = (state: ServerSimState) => {
      pendingOnlineStates.push(state);
    };

    const restartRace = () => {
      startRace({ skipCountdown: false });
    };

    const pauseRace = () => {
      if (propsRef.current.phase !== 'playing') return;
      clearInputs();
      sound.setEngineActive(false, 0, false);
      setPhase('paused');
      propsRef.current.onHudUpdate(
        buildHudSnapshot(
          sim,
          'paused',
          propsRef.current.mode === 'online' ? localOnlineHumanIndex : undefined,
        ),
      );
    };

    const resumeRace = () => {
      if (propsRef.current.phase !== 'paused') return;
      sound.unlock();
      clearInputs();
      setPhase('playing');
      propsRef.current.onHudUpdate(
        buildHudSnapshot(
          sim,
          'playing',
          propsRef.current.mode === 'online' ? localOnlineHumanIndex : undefined,
        ),
      );
      renderer.domElement.focus();
    };

    const returnToTitle = () => {
      clearInputs();
      pendingOnlineStates = [];
      sound.setEngineActive(false, 0, false);
      rebuildWorld(false);
      setPhase('title');
      propsRef.current.onHudUpdate(buildHudSnapshot(sim, 'title'));
    };

    const toggleMute = () => {
      sound.unlock();
      const nextMuted = sound.toggleMute();
      propsRef.current.onMuteChange(nextMuted);
      return nextMuted;
    };

    const setTouchInput = (partial: {
      throttle?: number;
      steer?: number;
      boost?: boolean;
      triggerItem?: boolean;
    }) => {
      if (partial.throttle !== undefined) touchState.throttle = partial.throttle;
      if (partial.steer !== undefined) touchState.steer = partial.steer;
      if (partial.boost !== undefined) touchState.boost = partial.boost;
      if (partial.triggerItem) p1ItemJustPressed = true;
    };

    actionsRef.current = {
      startRace,
      startOnlineRace,
      pushOnlineState,
      restartRace,
      pauseRace,
      resumeRace,
      returnToTitle,
      toggleMute,
      setTouchInput,
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (isTyping) return;

      const code = e.code;
      const currentPhase = propsRef.current.phase;

      if (currentPhase === 'title') {
        if (
          !propsRef.current.garageOpen &&
          propsRef.current.mode !== 'online' &&
          (code === 'Enter' || code === 'Space')
        ) {
          e.preventDefault();
          startRace();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        if (currentPhase === 'playing') pauseRace();
        else if (currentPhase === 'paused') resumeRace();
        return;
      }

      if (code === 'KeyM') {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (
        code === 'KeyR' &&
        propsRef.current.mode !== 'online' &&
        (currentPhase === 'playing' || currentPhase === 'paused')
      ) {
        e.preventDefault();
        restartRace();
        return;
      }

      if (currentPhase !== 'playing') return;

      if (
        code === 'Space' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      if (!heldKeys.has(code)) {
        if (code === 'Space' || code === 'KeyF') p1ItemJustPressed = true;
        if (code === 'Enter' || code === 'Period' || code === 'Numpad0') p2ItemJustPressed = true;
      }
      heldKeys.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };

    const onVisibilityChange = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);

    let viewportW = container.clientWidth || window.innerWidth;
    let viewportH = container.clientHeight || window.innerHeight;
    renderer.setSize(viewportW, viewportH, false);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          viewportW = Math.floor(width);
          viewportH = Math.floor(height);
          renderer.setSize(viewportW, viewportH, false);
        }
      }
    });
    resizeObserver.observe(container);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const readHumanInputs = (md: PlayMode): [PlayerControlInput, PlayerControlInput] => {
      const singleDevice = md !== 'splitscreen';
      const keyThrottle =
        (heldKeys.has('KeyW') || (singleDevice && heldKeys.has('ArrowUp')) ? 1 : 0) -
        (heldKeys.has('KeyS') || (singleDevice && heldKeys.has('ArrowDown')) ? 1 : 0);
      const keySteer =
        (heldKeys.has('KeyA') || (singleDevice && heldKeys.has('ArrowLeft')) ? 1 : 0) -
        (heldKeys.has('KeyD') || (singleDevice && heldKeys.has('ArrowRight')) ? 1 : 0);
      const p1Throttle = keyThrottle !== 0 ? keyThrottle : touchState.throttle;
      const p1Steer = keySteer !== 0 ? keySteer : touchState.steer;
      const p1Boost = heldKeys.has('ShiftLeft') || heldKeys.has('KeyE') || touchState.boost;

      const p2Throttle = (heldKeys.has('ArrowUp') ? 1 : 0) - (heldKeys.has('ArrowDown') ? 1 : 0);
      const p2Steer = (heldKeys.has('ArrowLeft') ? 1 : 0) - (heldKeys.has('ArrowRight') ? 1 : 0);
      const p2Boost = heldKeys.has('Slash') || heldKeys.has('ShiftRight');

      const p1Item = p1ItemJustPressed;
      const p2Item = p2ItemJustPressed;
      p1ItemJustPressed = false;
      p2ItemJustPressed = false;

      return [
        { throttle: p1Throttle, steer: p1Steer, boost: p1Boost, useItemJustPressed: p1Item },
        { throttle: p2Throttle, steer: p2Steer, boost: p2Boost, useItemJustPressed: p2Item },
      ];
    };

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsedTotal = 0;
    let hudSyncAccum = 0;
    let onlineInputAccum = 0;
    let lastSentInputKey = '';

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const updateCameraFollow = (
      cam: THREE.PerspectiveCamera,
      camIdx: number,
      buggyIdx: number,
      dt: number,
      trauma: number,
    ) => {
      const buggy = sim.buggies[buggyIdx] ?? sim.buggies[0];
      if (!buggy) return;
      const state = camStates[camIdx];
      const fx = -Math.sin(buggy.yaw);
      const fz = -Math.cos(buggy.yaw);

      const speedNorm = Math.min(1.2, Math.abs(buggy.speed) / 38);
      const dist = 8.4 + speedNorm * 1.4;
      const height = 3.6 + speedNorm * 0.4;

      _camPos.set(buggy.x - fx * dist, buggy.y + height, buggy.z - fz * dist);
      _camLook.set(buggy.x + fx * 11, buggy.y + 1.35, buggy.z + fz * 11);

      const dampPos = 1 - Math.exp(-8.5 * dt);
      const dampLook = 1 - Math.exp(-12 * dt);
      state.pos.lerp(_camPos, dampPos);
      state.look.lerp(_camLook, dampLook);

      const targetFov = buggy.nitroTimer > 0 ? 74 : buggy.isBoosting ? 69 : 60 + speedNorm * 5;
      state.fov += (targetFov - state.fov) * (1 - Math.exp(-6 * dt));
      if (Math.abs(cam.fov - state.fov) > 0.05) {
        cam.fov = state.fov;
        cam.updateProjectionMatrix();
      }

      const shake = trauma * trauma * 0.48;
      const sx = shake > 0.002 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0.002 ? (Math.random() - 0.5) * shake : 0;

      cam.position.set(state.pos.x + sx, state.pos.y + sy, state.pos.z);
      cam.lookAt(state.look);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - lastTime) / 1000);
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      elapsedTotal += dt;

      const {
        phase: curPhase,
        mode: curMode,
        trackId: curTrack,
        distanceKm: curDist,
        maxOpponents: curMaxOpp,
        p1Config: c1,
        p2Config: c2,
        garageOpen: gOpen,
      } = propsRef.current;

      if (curPhase === 'title') {
        const wantedKey = `${curTrack}|${curDist}|${curMode}|${curMaxOpp}|${JSON.stringify(c1)}|${JSON.stringify(c2)}`;
        if (wantedKey !== activeWorldKey) {
          rebuildWorld(false);
        }
      }

      let hadEvents = false;

      if (curMode === 'online' && (curPhase === 'playing' || curPhase === 'paused')) {
        // Send local input to authoritative server
        if (curPhase === 'playing') {
          const [localInput] = readHumanInputs('online');
          const key = `${localInput.throttle}|${localInput.steer}|${localInput.boost}`;
          onlineInputAccum += dt;
          if (localInput.useItemJustPressed || key !== lastSentInputKey || onlineInputAccum >= 0.05) {
            onlineInputAccum = 0;
            lastSentInputKey = key;
            propsRef.current.onSendOnlineInput(localInput);
          }
        }

        // Smooth dead-reckoning between server ticks
        if (!sim.allFinished && sim.countdownTimer <= 0) {
          for (const b of sim.buggies) {
            if (!b.finished) {
              b.x += b.vx * dt;
              b.z += b.vz * dt;
              b.wheelSpin += b.speed * dt * 2.1;
            }
          }
        }

        // Apply authoritative server state snapshots
        if (pendingOnlineStates.length > 0) {
          const states = pendingOnlineStates;
          pendingOnlineStates = [];
          for (const st of states) {
            if (st.events.length > 0) hadEvents = true;
            applyServerStateToSim(st, false);
          }
        }

        // Tire dust plumes
        if (!sim.allFinished && sim.countdownTimer <= 0) {
          for (const b of sim.buggies) {
            if (b.grounded && Math.abs(b.speed) > 10 && Math.random() < 0.45) {
              const bx = -Math.sin(b.yaw);
              const bz = -Math.cos(b.yaw);
              const dustColor =
                sim.trackId === 'pinecrest'
                  ? '#78624d'
                  : sim.trackId === 'saltflats'
                    ? '#dfd8c7'
                    : '#c97d50';
              particles.emit(
                b.x - bx * 1.45 + (Math.random() - 0.5) * 1.1,
                b.y + 0.28,
                b.z - bz * 1.45 + (Math.random() - 0.5) * 1.1,
                -b.vx * 0.22 + (Math.random() - 0.5) * 2.5,
                1.4 + Math.random() * 1.5,
                -b.vz * 0.22 + (Math.random() - 0.5) * 2.5,
                b.isBoosting ? '#fb923c' : dustColor,
                b.isBoosting ? 0.65 : 0.8,
                0.38,
              );
            }
          }
        }

        const localBuggy =
          sim.buggies.find((b) => b.humanIndex === localOnlineHumanIndex) ?? sim.buggies[0];
        if (curPhase === 'playing' && localBuggy && !sim.allFinished) {
          const ratio = Math.abs(localBuggy.speed) / Math.max(1, localBuggy.stats.topSpeed);
          sound.setEngineActive(sim.countdownTimer <= 0, ratio, localBuggy.isBoosting);
        } else {
          sound.setEngineActive(false, 0, false);
        }

        if (sim.allFinished) {
          sound.setEngineActive(false, 0, false);
          setPhase('gameover');
          propsRef.current.onHudUpdate(buildHudSnapshot(sim, 'gameover', localOnlineHumanIndex));
        }
      } else if (curPhase === 'playing') {
        const inputs = readHumanInputs(curMode);
        stepRaceSimulation(sim, dt, inputs);
        if (sim.events.length > 0) hadEvents = true;
        emitSimEvents(sim.events);

        for (const b of sim.buggies) {
          if (b.grounded && Math.abs(b.speed) > 10 && Math.random() < 0.45) {
            const bx = -Math.sin(b.yaw);
            const bz = -Math.cos(b.yaw);
            const dustColor =
              sim.trackId === 'pinecrest'
                ? '#78624d'
                : sim.trackId === 'saltflats'
                  ? '#dfd8c7'
                  : '#c97d50';
            particles.emit(
              b.x - bx * 1.45 + (Math.random() - 0.5) * 1.1,
              b.y + 0.28,
              b.z - bz * 1.45 + (Math.random() - 0.5) * 1.1,
              -b.vx * 0.22 + (Math.random() - 0.5) * 2.5,
              1.4 + Math.random() * 1.5,
              -b.vz * 0.22 + (Math.random() - 0.5) * 2.5,
              b.isBoosting ? '#fb923c' : dustColor,
              b.isBoosting ? 0.65 : 0.8,
              0.38,
            );
          }
        }

        const p1 = sim.buggies[0];
        const p2 = curMode === 'splitscreen' && sim.buggies[1] ? sim.buggies[1] : p1;
        const avgRatio =
          (Math.abs(p1.speed) / p1.stats.topSpeed + Math.abs(p2.speed) / p2.stats.topSpeed) * 0.5;
        sound.setEngineActive(sim.countdownTimer <= 0, avgRatio, p1.isBoosting || p2.isBoosting);

        if (sim.allFinished) {
          sound.setEngineActive(false, 0, false);
          setPhase('gameover');
          propsRef.current.onHudUpdate(buildHudSnapshot(sim, 'gameover'));
        }
      } else {
        sound.setEngineActive(false, 0, false);
      }

      // Sync buggy meshes & track dynamic entities
      for (let i = 0; i < sim.buggies.length; i++) {
        const b = sim.buggies[i];
        const bv = buggyVisuals[i];
        if (bv) {
          const { groundY } = groundHeightAt(sim.trackId, b.x, b.z, sim.ramps, sim.lengthMeters);
          syncBuggyVisual(bv, b, groundY, elapsedTotal);
        }
      }
      trackHandle?.syncDynamicEntities(sim, elapsedTotal);
      particles.update(dt);

      const lead =
        curMode === 'online'
          ? sim.buggies.find((b) => b.humanIndex === localOnlineHumanIndex) ?? sim.buggies[0]
          : sim.buggies[0];
      if (lead && !isSoftwareGl) {
        sunLight.position.set(lead.x + 42, lead.y + 72, lead.z + 32);
        sunLight.target.position.set(lead.x, lead.y, lead.z - 15);
      }

      // Render Viewport(s)
      if (curPhase === 'title') {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, viewportW, viewportH);
        const targetAspect = viewportW / Math.max(1, viewportH);
        if (Math.abs(cam1.aspect - targetAspect) > 0.01) {
          cam1.aspect = targetAspect;
          cam1.fov = 52;
          cam1.updateProjectionMatrix();
        }

        if (gOpen) {
          const b0 = sim.buggies[0];
          const midZ = b0 ? b0.z : -4;
          const midY = b0 ? b0.y : 0;
          const angle = Math.sin(elapsedTotal * 0.35) * 0.18;
          cam1.position.set(3.2 + Math.sin(angle) * 3.8, midY + 3.4, midZ - 9.8);
          cam1.lookAt(2.8, midY + 0.8, midZ);
        } else {
          const b0 = sim.buggies[0];
          const gx = b0 ? b0.x : 0;
          const gy = b0 ? b0.y : 0;
          const gz = b0 ? b0.z : -4;
          const orbit = Math.sin(elapsedTotal * 0.22) * 0.35;
          cam1.position.set(
            gx + Math.sin(orbit) * 7 + 5.5,
            gy + 4.4 + Math.sin(elapsedTotal * 0.4) * 0.35,
            gz + 10.5,
          );
          cam1.lookAt(gx - 2.2, gy + 1.8, gz - 18);
        }
        renderer.render(scene, cam1);
      } else if (curMode === 'splitscreen') {
        const halfH = Math.max(1, Math.floor(viewportH / 2));
        const splitAspect = viewportW / halfH;
        if (Math.abs(cam1.aspect - splitAspect) > 0.01) {
          cam1.aspect = splitAspect;
          cam1.updateProjectionMatrix();
        }
        if (Math.abs(cam2.aspect - splitAspect) > 0.01) {
          cam2.aspect = splitAspect;
          cam2.updateProjectionMatrix();
        }

        updateCameraFollow(cam1, 0, 0, dt, sim.cameraTrauma[0] ?? 0);
        updateCameraFollow(cam2, 1, 1, dt, sim.cameraTrauma[1] ?? 0);

        renderer.setScissorTest(true);

        renderer.setViewport(0, viewportH - halfH, viewportW, halfH);
        renderer.setScissor(0, viewportH - halfH, viewportW, halfH);
        renderer.render(scene, cam1);

        renderer.setViewport(0, 0, viewportW, halfH);
        renderer.setScissor(0, 0, viewportW, halfH);
        renderer.render(scene, cam2);

        renderer.setScissorTest(false);
      } else {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, viewportW, viewportH);
        const fullAspect = viewportW / Math.max(1, viewportH);
        if (Math.abs(cam1.aspect - fullAspect) > 0.01) {
          cam1.aspect = fullAspect;
          cam1.updateProjectionMatrix();
        }
        const followIdx =
          curMode === 'online'
            ? Math.max(
                0,
                sim.buggies.findIndex((b) => b.humanIndex === localOnlineHumanIndex),
              )
            : 0;
        const trauma =
          curMode === 'online'
            ? (sim.cameraTrauma[localOnlineHumanIndex] ?? 0)
            : (sim.cameraTrauma[0] ?? 0);
        updateCameraFollow(cam1, 0, followIdx, dt, trauma);
        renderer.render(scene, cam1);
      }

      // Throttled HUD snapshot push (~12Hz)
      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.08 || hadEvents) {
        hudSyncAccum = 0;
        if (curPhase === 'playing' || (curMode === 'online' && curPhase === 'paused')) {
          propsRef.current.onHudUpdate(
            buildHudSnapshot(
              sim,
              curPhase,
              curMode === 'online' ? localOnlineHumanIndex : undefined,
            ),
          );
        }
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setTimeout(() => {
        if (!disposed) startRace({ skipCountdown: true });
      }, 60);
    } else {
      document.body.dataset.state = 'title';
      propsRef.current.onHudUpdate(buildHudSnapshot(sim, 'title'));
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      sound.dispose();
      particles.dispose();
      if (trackHandle) trackHandle.dispose();
      for (const bv of buggyVisuals) bv.dispose();
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [actionsRef]);

  return (
    <div
      ref={mountRef}
      data-testid="game-viewport"
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#0d1017]"
    />
  );
};
