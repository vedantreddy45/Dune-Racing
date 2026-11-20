import * as THREE from 'three';
import {
  groundHeightAt,
  sampleTrackAt,
  TRACKS,
  trackToWorld,
} from '../game/tracks';
import { RaceSimulation, TrackId } from '../game/types';
import { createTrackTextures, TrackTextures } from './textures';

export interface TrackSceneHandle {
  group: THREE.Group;
  pickupMeshes: THREE.Group[];
  syncDynamicEntities: (sim: RaceSimulation, elapsed: number) => void;
  dispose: () => void;
}

function buildRoadAndTerrainGeometry(
  trackId: TrackId,
  halfWidth: number,
  lengthMeters: number,
  ramps: RaceSimulation['ramps'],
): { roadGeo: THREE.BufferGeometry; terrainGeo: THREE.BufferGeometry } {
  const sStart = -50;
  // Extend road & terrain 180m past finish line so cars always remain on solid track
  const sEnd = lengthMeters + 180;
  const step = 6;
  const rows = Math.floor((sEnd - sStart) / step) + 1;

  const roadVerts: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  for (let i = 0; i < rows; i++) {
    const s = sStart + i * step;
    const sample = sampleTrackAt(trackId, s, lengthMeters);
    const offsets = [-halfWidth - 1.5, -halfWidth, halfWidth, halfWidth + 1.5];
    const uVals = [0, 0.08, 0.92, 1];
    const yDrops = [-0.25, 0.01, 0.01, -0.25];

    for (let j = 0; j < 4; j++) {
      const off = offsets[j];
      const wx = sample.x + sample.nx * off;
      const wz = sample.z + sample.nz * off;
      const wy = sample.y + off * Math.sin(sample.bank) + yDrops[j];
      roadVerts.push(wx, wy, wz);
      roadUvs.push(uVals[j], s / 18);
    }

    if (i < rows - 1) {
      const base = i * 4;
      const next = (i + 1) * 4;
      for (let j = 0; j < 3; j++) {
        roadIndices.push(base + j, base + j + 1, next + j);
        roadIndices.push(base + j + 1, next + j + 1, next + j);
      }
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();

  const latOffsets = [
    -135, -90, -56, -34, -20, -halfWidth - 0.4,
    halfWidth + 0.4, 20, 34, 56, 90, 135,
  ];
  const cols = latOffsets.length;
  const terrainStep = 10;
  const tRows = Math.floor((sEnd - sStart) / terrainStep) + 1;
  const tVerts: number[] = [];
  const tUvs: number[] = [];
  const tIndices: number[] = [];

  for (let i = 0; i < tRows; i++) {
    const s = sStart + i * terrainStep;
    const sample = sampleTrackAt(trackId, s, lengthMeters);
    for (let j = 0; j < cols; j++) {
      const off = latOffsets[j];
      const wx = sample.x + sample.nx * off;
      const wz = sample.z + sample.nz * off;
      const { groundY } = groundHeightAt(trackId, wx, wz, ramps, lengthMeters);
      const isInner = Math.abs(off) <= halfWidth + 1;
      tVerts.push(wx, isInner ? groundY - 0.18 : groundY, wz);
      tUvs.push((off + 135) / 270, s / 45);
    }
    if (i < tRows - 1) {
      const base = i * cols;
      const next = (i + 1) * cols;
      for (let j = 0; j < cols - 1; j++) {
        if (j === 5) continue;
        tIndices.push(base + j, base + j + 1, next + j);
        tIndices.push(base + j + 1, next + j + 1, next + j);
      }
    }
  }

  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(tVerts, 3));
  terrainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUvs, 2));
  terrainGeo.setIndex(tIndices);
  terrainGeo.computeVertexNormals();

  return { roadGeo, terrainGeo };
}

function createArchGate(
  trackId: TrackId,
  s: number,
  halfWidth: number,
  lengthMeters: number,
  bannerTex: THREE.Texture,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): THREE.Group {
  const sample = sampleTrackAt(trackId, s, lengthMeters);
  const arch = new THREE.Group();
  arch.position.set(sample.x, sample.y, sample.z);
  arch.rotation.y = sample.yaw;

  const span = halfWidth * 2 + 1.8;
  const pillarGeo = new THREE.CylinderGeometry(0.45, 0.55, 8.2, 8);
  const crossGeo = new THREE.BoxGeometry(span + 1.2, 0.55, 0.8);
  const bannerGeo = new THREE.PlaneGeometry(span - 0.8, 2.5);
  geometries.push(pillarGeo, crossGeo, bannerGeo);

  const trussMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.4,
    metalness: 0.7,
  });
  const bannerMat = new THREE.MeshStandardMaterial({
    map: bannerTex,
    roughness: 0.45,
    side: THREE.FrontSide,
  });
  materials.push(trussMat, bannerMat);

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, trussMat);
    pillar.position.set(side * (span * 0.5), 4.0, 0);
    pillar.castShadow = true;
    arch.add(pillar);
  }

  const topBeam = new THREE.Mesh(crossGeo, trussMat);
  topBeam.position.set(0, 8.1, 0);
  arch.add(topBeam);

  const bannerFront = new THREE.Mesh(bannerGeo, bannerMat);
  bannerFront.position.set(0, 6.5, 0.08);
  const bannerBack = new THREE.Mesh(bannerGeo, bannerMat);
  bannerBack.position.set(0, 6.5, -0.08);
  bannerBack.rotation.y = Math.PI;
  arch.add(bannerFront, bannerBack);

  return arch;
}

export function buildTrackSceneContent(
  sim: RaceSimulation,
  maxAnisotropy: number,
): TrackSceneHandle {
  const track = TRACKS[sim.trackId];
  const group = new THREE.Group();
  const textures: TrackTextures = createTrackTextures(track, sim.distanceKm, maxAnisotropy);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 1. Road & Terrain Skirt
  const { roadGeo, terrainGeo } = buildRoadAndTerrainGeometry(
    sim.trackId,
    track.halfWidth,
    sim.lengthMeters,
    sim.ramps,
  );
  geometries.push(roadGeo, terrainGeo);

  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.roadMap,
    bumpMap: textures.roadBump,
    bumpScale: 0.14,
    roughness: 0.88,
    metalness: 0.04,
  });
  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.terrainMap,
    roughness: 0.94,
    metalness: 0.02,
  });
  materials.push(roadMat, terrainMat);

  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(roadMesh, terrainMesh);

  // 2. Arches: Start (s=24), 1km milestones, and Finish at sim.lengthMeters
  group.add(
    createArchGate(
      sim.trackId,
      24,
      track.halfWidth,
      sim.lengthMeters,
      textures.startBannerMap,
      geometries,
      materials,
    ),
  );
  for (let km = 1; km < sim.distanceKm; km++) {
    const tex = textures.kmBannerMaps[km - 1];
    if (tex) {
      group.add(
        createArchGate(
          sim.trackId,
          km * 1000,
          track.halfWidth,
          sim.lengthMeters,
          tex,
          geometries,
          materials,
        ),
      );
    }
  }
  group.add(
    createArchGate(
      sim.trackId,
      sim.lengthMeters,
      track.halfWidth,
      sim.lengthMeters,
      textures.finishBannerMap,
      geometries,
      materials,
    ),
  );

  // Ground Checkered Finish Line Strip across the road at s = sim.lengthMeters
  const finishSample = sampleTrackAt(sim.trackId, sim.lengthMeters, sim.lengthMeters);
  const stripGeo = new THREE.PlaneGeometry(track.halfWidth * 2, 3.2);
  stripGeo.rotateX(-Math.PI / 2);
  const stripMat = new THREE.MeshStandardMaterial({
    map: textures.finishLineStripMap,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  geometries.push(stripGeo);
  materials.push(stripMat);
  const finishStrip = new THREE.Mesh(stripGeo, stripMat);
  finishStrip.position.set(finishSample.x, finishSample.y + 0.05, finishSample.z);
  finishStrip.rotation.y = finishSample.yaw;
  group.add(finishStrip);

  // 3. Sculpted Jump Ramps
  const rampMat = new THREE.MeshStandardMaterial({
    color: track.biome === 'alpine' ? '#7c4d2b' : '#b45309',
    roughness: 0.78,
    metalness: 0.08,
  });
  const lipMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#ca8a04',
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  materials.push(rampMat, lipMat);

  for (const ramp of sim.ramps) {
    const startW = trackToWorld(sim.trackId, ramp.s, ramp.offset, sim.lengthMeters);
    const rampShape = new THREE.Shape();
    rampShape.moveTo(0, 0);
    rampShape.lineTo(ramp.length, 0);
    rampShape.lineTo(ramp.length, ramp.height);
    rampShape.closePath();

    const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
      depth: ramp.width,
      bevelEnabled: false,
      steps: 1,
    });
    rampGeo.rotateY(Math.PI / 2);
    rampGeo.translate(-ramp.width / 2, 0, 0);
    rampGeo.computeVertexNormals();
    geometries.push(rampGeo);

    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.position.set(startW.x, startW.y - 0.05, startW.z);
    rampMesh.rotation.y = startW.sample.yaw;
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);

    const lipGeo = new THREE.BoxGeometry(ramp.width, 0.14, 0.45);
    geometries.push(lipGeo);
    const lip = new THREE.Mesh(lipGeo, lipMat);
    lip.position.set(0, ramp.height - 0.04, -ramp.length + 0.25);
    rampMesh.add(lip);
  }

  // 4. Boost Pads
  const boostMat = new THREE.MeshStandardMaterial({
    map: textures.boostMap,
    emissive: '#0ea5e9',
    emissiveMap: textures.boostMap,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  materials.push(boostMat);

  for (const pad of sim.boostPads) {
    const midS = pad.s + pad.length * 0.5;
    const world = trackToWorld(sim.trackId, midS, pad.offset, sim.lengthMeters);
    const padGeo = new THREE.PlaneGeometry(pad.width, pad.length);
    padGeo.rotateX(-Math.PI / 2);
    geometries.push(padGeo);

    const padMesh = new THREE.Mesh(padGeo, boostMat);
    padMesh.position.set(world.x, world.y + 0.05, world.z);
    padMesh.rotation.y = world.sample.yaw;
    group.add(padMesh);
  }

  // 5. Instanced Natural Perimeter Props scaled to track length
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const propSpan = sim.lengthMeters + 120;

  const rockGeo = new THREE.DodecahedronGeometry(2.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: track.biome === 'desert' ? '#9e472a' : track.biome === 'alpine' ? '#64748b' : '#c8beaa',
    roughness: 0.9,
    metalness: 0.04,
  });
  geometries.push(rockGeo);
  materials.push(rockMat);

  const rockCount = Math.round(60 * sim.distanceKm);
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = false;
  rockInst.receiveShadow = true;

  for (let i = 0; i < rockCount; i++) {
    const s = 18 + (i / rockCount) * propSpan;
    const side = i % 2 === 0 ? -1 : 1;
    const off = side * (track.halfWidth + 6.5 + ((i * 37) % 36));
    const w = trackToWorld(sim.trackId, s, off, sim.lengthMeters);
    const { groundY } = groundHeightAt(sim.trackId, w.x, w.z, sim.ramps, sim.lengthMeters);
    const sc = 0.7 + ((i * 19) % 10) * 0.16;
    dummy.position.set(w.x, groundY + sc * 0.28, w.z);
    dummy.rotation.set((i * 0.7) % 3, (i * 1.3) % 6, 0);
    dummy.scale.set(sc * 1.25, sc * 0.9, sc);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);

    const tint = 0.86 + ((i * 13) % 10) * 0.028;
    color.setRGB(tint, tint, tint);
    rockInst.setColorAt(i, color);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  const foliageGeo =
    track.biome === 'alpine'
      ? new THREE.ConeGeometry(1.7, 6.4, 7)
      : track.biome === 'desert'
        ? new THREE.CylinderGeometry(0.32, 0.38, 4.2, 7)
        : new THREE.CylinderGeometry(0.28, 0.42, 5.2, 7);
  const foliageMat = new THREE.MeshStandardMaterial({
    color:
      track.biome === 'alpine' ? '#2d5a36' : track.biome === 'desert' ? '#4d7c38' : '#3f7d4d',
    roughness: 0.85,
  });
  geometries.push(foliageGeo);
  materials.push(foliageMat);

  const foliageCount = Math.round(54 * sim.distanceKm);
  const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, foliageCount);
  for (let i = 0; i < foliageCount; i++) {
    const s = 30 + (i / foliageCount) * (propSpan - 10);
    const side = i % 2 === 0 ? 1 : -1;
    const off = side * (track.halfWidth + 5.5 + ((i * 29) % 34));
    const w = trackToWorld(sim.trackId, s, off, sim.lengthMeters);
    const { groundY } = groundHeightAt(sim.trackId, w.x, w.z, sim.ramps, sim.lengthMeters);
    const sc = 0.85 + ((i * 11) % 7) * 0.1;
    const halfH = track.biome === 'alpine' ? 3.1 : 2.1;
    dummy.position.set(w.x, groundY + halfH * sc, w.z);
    dummy.rotation.set(0, (i * 0.9) % 6, 0);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    foliageInst.setMatrixAt(i, dummy.matrix);

    const tint = 0.82 + ((i * 17) % 10) * 0.035;
    color.setRGB(tint, tint, tint);
    foliageInst.setColorAt(i, color);
  }
  foliageInst.instanceMatrix.needsUpdate = true;
  if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
  foliageInst.computeBoundingSphere();
  group.add(foliageInst);

  const pylonGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.9, 6);
  const pylonMat = new THREE.MeshStandardMaterial({
    color: '#f97316',
    emissive: '#ea580c',
    emissiveIntensity: 0.25,
    roughness: 0.45,
  });
  geometries.push(pylonGeo);
  materials.push(pylonMat);

  const pylonPairs = Math.floor((sim.lengthMeters + 80) / 120);
  const pylonInst = new THREE.InstancedMesh(pylonGeo, pylonMat, pylonPairs * 2);
  let pIdx = 0;
  for (let i = 0; i < pylonPairs; i++) {
    const s = 60 + i * 120;
    for (const side of [-1, 1]) {
      const w = trackToWorld(sim.trackId, s, side * (track.halfWidth + 0.9), sim.lengthMeters);
      dummy.position.set(w.x, w.y + 0.95, w.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pylonInst.setMatrixAt(pIdx++, dummy.matrix);
    }
  }
  pylonInst.instanceMatrix.needsUpdate = true;
  pylonInst.computeBoundingSphere();
  group.add(pylonInst);

  // 6. Power-Up Crystal Pods
  const coreGeo = new THREE.OctahedronGeometry(0.75, 0);
  const ringGeo = new THREE.TorusGeometry(1.05, 0.08, 6, 18);
  const shadowDiscGeo = new THREE.CircleGeometry(0.95, 14);
  shadowDiscGeo.rotateX(-Math.PI / 2);
  geometries.push(coreGeo, ringGeo, shadowDiscGeo);

  const coreMat = new THREE.MeshStandardMaterial({
    color: '#fb923c',
    emissive: '#f97316',
    emissiveIntensity: 0.75,
    roughness: 0.18,
    metalness: 0.5,
  });
  const ringMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0ea5e9',
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.6,
  });
  const shadowDiscMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  materials.push(coreMat, ringMat, shadowDiscMat);

  const pickupMeshes: THREE.Group[] = [];
  for (const p of sim.pickups) {
    const pod = new THREE.Group();
    pod.position.set(p.x, p.y, p.z);

    const core = new THREE.Mesh(coreGeo, coreMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 3;
    const disc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
    disc.position.y = -1.0;

    pod.add(core, ring, disc);
    group.add(pod);
    pickupMeshes.push(pod);
  }

  // 7. Dynamic Oil Hazards & Shockwaves Pool
  const oilGeo = new THREE.CylinderGeometry(1.9, 2.0, 0.08, 16);
  const oilMat = new THREE.MeshStandardMaterial({
    color: '#1e1b2e',
    roughness: 0.12,
    metalness: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const waveGeo = new THREE.RingGeometry(0.85, 1.0, 28);
  waveGeo.rotateX(-Math.PI / 2);
  const waveMat = new THREE.MeshBasicMaterial({
    color: '#facc15',
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  geometries.push(oilGeo, waveGeo);
  materials.push(oilMat, waveMat);

  const oilPool: THREE.Mesh[] = [];
  const wavePool: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const om = new THREE.Mesh(oilGeo, oilMat);
    om.visible = false;
    group.add(om);
    oilPool.push(om);
  }
  for (let i = 0; i < 6; i++) {
    const wm = new THREE.Mesh(waveGeo, waveMat);
    wm.visible = false;
    group.add(wm);
    wavePool.push(wm);
  }

  const syncDynamicEntities = (currentSim: RaceSimulation, elapsed: number) => {
    for (let i = 0; i < currentSim.pickups.length; i++) {
      const p = currentSim.pickups[i];
      const mesh = pickupMeshes[i];
      if (!mesh) continue;
      mesh.visible = p.cooldown <= 0;
      if (mesh.visible) {
        mesh.position.y = p.y + Math.sin(elapsed * 3.2 + i) * 0.22;
        mesh.children[0].rotation.y = elapsed * 2.2 + i;
        mesh.children[1].rotation.z = elapsed * 1.8;
      }
    }

    for (let i = 0; i < oilPool.length; i++) {
      const m = oilPool[i];
      const h = currentSim.hazards[i];
      if (h) {
        m.visible = true;
        m.position.set(h.x, h.y, h.z);
      } else {
        m.visible = false;
      }
    }

    for (let i = 0; i < wavePool.length; i++) {
      const m = wavePool[i];
      const sw = currentSim.shockwaves[i];
      if (sw) {
        m.visible = true;
        m.position.set(sw.x, sw.y, sw.z);
        m.scale.setScalar(sw.radius);
      } else {
        m.visible = false;
      }
    }
  };

  return {
    group,
    pickupMeshes,
    syncDynamicEntities,
    dispose: () => {
      textures.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
