import * as THREE from 'three';
import { TrackDefinition, TrackDistanceKm } from '../game/types';

export interface TrackTextures {
  roadMap: THREE.CanvasTexture;
  roadBump: THREE.CanvasTexture;
  terrainMap: THREE.CanvasTexture;
  boostMap: THREE.CanvasTexture;
  startBannerMap: THREE.CanvasTexture;
  finishBannerMap: THREE.CanvasTexture;
  finishLineStripMap: THREE.CanvasTexture;
  kmBannerMaps: THREE.CanvasTexture[];
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function createRoadTextures(track: TrackDefinition, anisotropy: number): {
  roadMap: THREE.CanvasTexture;
  roadBump: THREE.CanvasTexture;
} {
  const [c, ctx] = makeCanvas(256, 256);
  const [bc, bctx] = makeCanvas(256, 256);

  ctx.fillStyle = track.roadColor;
  ctx.fillRect(0, 0, 256, 256);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  ctx.fillRect(0, 0, 26, 256);
  ctx.fillRect(230, 0, 26, 256);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(72, 0, 22, 256);
  ctx.fillRect(162, 0, 22, 256);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  for (let y = 12; y < 256; y += 64) {
    ctx.fillRect(125, y, 6, 32);
  }

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 1800; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 1 + rand() * 2.5;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.11)';
    ctx.fillRect(x, y, r, r);

    const g = Math.floor(90 + rand() * 80);
    bctx.fillStyle = `rgb(${g},${g},${g})`;
    bctx.fillRect(x, y, r + 0.5, r + 0.5);
  }

  const roadMap = new THREE.CanvasTexture(c);
  roadMap.colorSpace = THREE.SRGBColorSpace;
  roadMap.wrapS = THREE.RepeatWrapping;
  roadMap.wrapT = THREE.RepeatWrapping;
  roadMap.anisotropy = anisotropy;

  const roadBump = new THREE.CanvasTexture(bc);
  roadBump.wrapS = THREE.RepeatWrapping;
  roadBump.wrapT = THREE.RepeatWrapping;
  roadBump.anisotropy = anisotropy;

  return { roadMap, roadBump };
}

function createTerrainTexture(
  track: TrackDefinition,
  distanceKm: TrackDistanceKm,
  anisotropy: number,
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = track.terrainColor;
  ctx.fillRect(0, 0, 256, 256);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 1400; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const w = 2 + rand() * 6;
    const h = 1 + rand() * 3;
    ctx.fillStyle = rand() > 0.45 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, w, h);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, Math.round(distanceKm * 105));
  tex.anisotropy = anisotropy;
  return tex;
}

function createBoostTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 256);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 128, 256);

  for (let i = 0; i < 3; i++) {
    const y = 32 + i * 74;
    ctx.fillStyle = i === 0 ? '#38bdf8' : i === 1 ? '#22d3ee' : '#f97316';
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(116, y + 40);
    ctx.lineTo(116, y + 60);
    ctx.lineTo(64, y + 20);
    ctx.lineTo(12, y + 60);
    ctx.lineTo(12, y + 40);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function createFinishStripTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 64);
  const size = 32;
  for (let y = 0; y < 64; y += size) {
    for (let x = 0; x < 512; x += size) {
      const even = ((x / size) + (y / size)) % 2 === 0;
      ctx.fillStyle = even ? '#f8fafc' : '#0f172a';
      ctx.fillRect(x, y, size, size);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function createBannerTexture(label: string, checkered: boolean, anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 128);
  if (checkered) {
    const size = 32;
    for (let y = 0; y < 128; y += size) {
      for (let x = 0; x < 512; x += size) {
        const even = ((x / size) + (y / size)) % 2 === 0;
        ctx.fillStyle = even ? '#f8fafc' : '#0f172a';
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(104, 26, 304, 76);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.strokeRect(104, 26, 304, 76);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, 512, 14);
    ctx.fillRect(0, 114, 512, 14);
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 66);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTrackTextures(
  track: TrackDefinition,
  distanceKm: TrackDistanceKm,
  anisotropy: number,
): TrackTextures {
  const { roadMap, roadBump } = createRoadTextures(track, anisotropy);
  const terrainMap = createTerrainTexture(track, distanceKm, anisotropy);
  const boostMap = createBoostTexture(anisotropy);
  const startBannerMap = createBannerTexture(`START · ${distanceKm}.0 KM`, false, anisotropy);
  const finishBannerMap = createBannerTexture(`FINISH · ${distanceKm}.0 KM`, true, anisotropy);
  const finishLineStripMap = createFinishStripTexture(anisotropy);
  const kmBannerMaps: THREE.CanvasTexture[] = [];
  for (let km = 1; km < distanceKm; km++) {
    kmBannerMaps.push(createBannerTexture(`${km}.0 KM MARKER`, false, anisotropy));
  }
  const contactShadowMap = createContactShadowTexture();

  return {
    roadMap,
    roadBump,
    terrainMap,
    boostMap,
    startBannerMap,
    finishBannerMap,
    finishLineStripMap,
    kmBannerMaps,
    contactShadowMap,
    dispose: () => {
      roadMap.dispose();
      roadBump.dispose();
      terrainMap.dispose();
      boostMap.dispose();
      startBannerMap.dispose();
      finishBannerMap.dispose();
      finishLineStripMap.dispose();
      kmBannerMaps.forEach((m) => m.dispose());
      contactShadowMap.dispose();
    },
  };
}
