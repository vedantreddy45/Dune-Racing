import * as THREE from 'three';
import { BuggyConfig, BuggyState } from '../game/types';

export interface BuggyVisual {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheels: THREE.Group[];
  boostFlames: THREE.Mesh[];
  shieldMesh: THREE.Mesh;
  contactShadow: THREE.Mesh;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  baseColor: THREE.Color;
  dispose: () => void;
}

function createExtrudedHull(chassis: BuggyConfig['chassis']): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  if (chassis === 'dart') {
    // Sleek wedge sand-rail profile (XY side profile extruded along X width)
    shape.moveTo(-1.35, 0.08);
    shape.lineTo(1.25, 0.06);
    shape.lineTo(1.45, 0.24);
    shape.lineTo(0.45, 0.48);
    shape.lineTo(-0.45, 0.52);
    shape.lineTo(-1.35, 0.44);
    shape.closePath();
  } else if (chassis === 'bruiser') {
    // Muscular Baja truck-buggy silhouette
    shape.moveTo(-1.4, 0.12);
    shape.lineTo(1.38, 0.12);
    shape.lineTo(1.44, 0.46);
    shape.lineTo(0.65, 0.62);
    shape.lineTo(-0.45, 0.66);
    shape.lineTo(-1.42, 0.56);
    shape.closePath();
  } else {
    // Dune Striker balanced buggy silhouette
    shape.moveTo(-1.35, 0.1);
    shape.lineTo(1.32, 0.1);
    shape.lineTo(1.4, 0.34);
    shape.lineTo(0.55, 0.56);
    shape.lineTo(-0.4, 0.58);
    shape.lineTo(-1.38, 0.48);
    shape.closePath();
  }

  const width = chassis === 'bruiser' ? 1.42 : chassis === 'dart' ? 1.08 : 1.24;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
    steps: 1,
  });
  // Rotate so profile X -> -Z (forward is -Z) and extrusion depth -> X centered
  geo.rotateY(Math.PI / 2);
  geo.translate(-width / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

function createWheelMesh(
  radius: number,
  width: number,
  tires: BuggyConfig['tires'],
  rimMat: THREE.Material,
  rubberMat: THREE.Material,
  accentMat: THREE.Material,
): THREE.Group {
  const wheel = new THREE.Group();

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, rubberMat);
  tireMesh.castShadow = true;
  wheel.add(tireMesh);

  // Off-road knobby/paddle lugs around circumference
  const lugCount = tires === 'paddle' ? 8 : 10;
  const lugGeo = new THREE.BoxGeometry(width * 0.88, 0.055, tires === 'paddle' ? 0.11 : 0.09);
  for (let i = 0; i < lugCount; i++) {
    const a = (i / lugCount) * Math.PI * 2;
    const lug = new THREE.Mesh(lugGeo, rubberMat);
    lug.position.set(0, Math.cos(a) * radius, Math.sin(a) * radius);
    lug.rotation.x = a;
    wheel.add(lug);
  }

  // Metallic alloy rim & beadlock ring
  const rimGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.03, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  wheel.add(rimMesh);

  const hubGeo = new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width + 0.06, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, accentMat);
  wheel.add(hubMesh);

  return wheel;
}

export function createBuggyMesh(
  config: BuggyConfig,
  contactShadowMap: THREE.Texture,
): BuggyVisual {
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  chassisGroup.position.y = 0.42;
  root.add(chassisGroup);

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];

  const baseColor = new THREE.Color(config.colorHex);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: baseColor.clone(),
    roughness: 0.34,
    metalness: 0.28,
    clearcoat: 0.72,
    clearcoatRoughness: 0.16,
  });
  const cageMat = new THREE.MeshStandardMaterial({
    color: '#1e2430',
    roughness: 0.28,
    metalness: 0.82,
  });
  const rubberMat = new THREE.MeshStandardMaterial({
    color: '#191b20',
    roughness: 0.88,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.22,
    metalness: 0.88,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: config.accentHex,
    roughness: 0.35,
    metalness: 0.45,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.12,
    metalness: 0.9,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#fff4cc',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#ef4444',
    emissiveIntensity: 1.5,
    roughness: 0.3,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.88,
  });
  const shieldMat = new THREE.MeshPhysicalMaterial({
    color: '#38bdf8',
    emissive: '#0284c7',
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.26,
    roughness: 0.1,
    metalness: 0.1,
    depthWrite: false,
  });

  materialsToDispose.push(
    bodyMaterial,
    cageMat,
    rubberMat,
    rimMat,
    accentMat,
    visorMat,
    headlightMat,
    tailLightMat,
    flameMat,
    shieldMat,
  );

  // 1. Primary Silhouette: Extruded beveled chassis hull
  const hullGeo = createExtrudedHull(config.chassis);
  geometriesToDispose.push(hullGeo);
  const hullMesh = new THREE.Mesh(hullGeo, bodyMaterial);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  chassisGroup.add(hullMesh);

  // 2. Underbody skid plate & front bumper
  const skidGeo = new THREE.BoxGeometry(config.chassis === 'bruiser' ? 1.25 : 0.96, 0.1, 2.7);
  geometriesToDispose.push(skidGeo);
  const skidMesh = new THREE.Mesh(skidGeo, cageMat);
  skidMesh.position.set(0, 0.07, 0);
  chassisGroup.add(skidMesh);

  const bumperGeo = new THREE.CylinderGeometry(0.045, 0.045, config.chassis === 'bruiser' ? 1.48 : 1.15, 8);
  bumperGeo.rotateZ(Math.PI / 2);
  geometriesToDispose.push(bumperGeo);
  const bumperMesh = new THREE.Mesh(bumperGeo, accentMat);
  bumperMesh.position.set(0, 0.22, -1.44);
  chassisGroup.add(bumperMesh);

  // 3. Tubular Roll Cage (TubeGeometry)
  const cageSpan = config.chassis === 'bruiser' ? 0.58 : 0.48;
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * cageSpan, 0.34, -0.78),
      new THREE.Vector3(side * (cageSpan * 0.88), 0.94, -0.25),
      new THREE.Vector3(side * (cageSpan * 0.88), 0.94, 0.55),
      new THREE.Vector3(side * cageSpan, 0.42, 1.25),
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.042, 6, false);
    geometriesToDispose.push(tubeGeo);
    const tubeMesh = new THREE.Mesh(tubeGeo, cageMat);
    tubeMesh.castShadow = true;
    chassisGroup.add(tubeMesh);
  }
  const crossBarGeo = new THREE.CylinderGeometry(0.038, 0.038, cageSpan * 1.85, 6);
  crossBarGeo.rotateZ(Math.PI / 2);
  geometriesToDispose.push(crossBarGeo);
  const roofFrontBar = new THREE.Mesh(crossBarGeo, cageMat);
  roofFrontBar.position.set(0, 0.94, -0.22);
  chassisGroup.add(roofFrontBar);
  const roofRearBar = new THREE.Mesh(crossBarGeo, cageMat);
  roofRearBar.position.set(0, 0.94, 0.52);
  chassisGroup.add(roofRearBar);

  // 4. Driver Helmet & Visor inside cockpit
  const helmetGeo = new THREE.SphereGeometry(0.22, 14, 12);
  geometriesToDispose.push(helmetGeo);
  const helmet = new THREE.Mesh(helmetGeo, accentMat);
  helmet.position.set(0, 0.68, 0.14);
  chassisGroup.add(helmet);

  const visorGeo = new THREE.BoxGeometry(0.32, 0.11, 0.24);
  geometriesToDispose.push(visorGeo);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.69, 0.02);
  chassisGroup.add(visor);

  // 5. Twin Headlights & Rear Tail Bar
  const lightGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10);
  lightGeo.rotateX(Math.PI / 2);
  geometriesToDispose.push(lightGeo);
  for (const side of [-0.36, 0.36]) {
    const hl = new THREE.Mesh(lightGeo, headlightMat);
    hl.position.set(side, 0.35, -1.36);
    chassisGroup.add(hl);
  }

  const tailGeo = new THREE.BoxGeometry(0.92, 0.08, 0.06);
  geometriesToDispose.push(tailGeo);
  const tailBar = new THREE.Mesh(tailGeo, tailLightMat);
  tailBar.position.set(0, 0.44, 1.38);
  chassisGroup.add(tailBar);

  // 6. Twin Rear Exhaust Pipes + Boost Flame Cones
  const pipeGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.48, 8);
  pipeGeo.rotateX(Math.PI / 2 - 0.25);
  geometriesToDispose.push(pipeGeo);

  const flameGeo = new THREE.ConeGeometry(0.11, 0.72, 8);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.36);
  geometriesToDispose.push(flameGeo);

  const boostFlames: THREE.Mesh[] = [];
  for (const side of [-0.28, 0.28]) {
    const pipe = new THREE.Mesh(pipeGeo, rimMat);
    pipe.position.set(side, 0.28, 1.4);
    chassisGroup.add(pipe);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(side, 0.31, 1.56);
    flame.visible = false;
    chassisGroup.add(flame);
    boostFlames.push(flame);
  }

  // 7. Customizable Roof / Rear Rig
  if (config.rig === 'lightbar') {
    const barGeo = new THREE.BoxGeometry(0.88, 0.1, 0.14);
    const lensGeo = new THREE.BoxGeometry(0.8, 0.06, 0.04);
    geometriesToDispose.push(barGeo, lensGeo);
    const bar = new THREE.Mesh(barGeo, cageMat);
    bar.position.set(0, 1.0, -0.2);
    const lens = new THREE.Mesh(lensGeo, headlightMat);
    lens.position.set(0, 1.0, -0.27);
    chassisGroup.add(bar, lens);
  } else if (config.rig === 'wing') {
    const wingGeo = new THREE.BoxGeometry(1.48, 0.07, 0.36);
    const strutGeo = new THREE.BoxGeometry(0.07, 0.42, 0.22);
    geometriesToDispose.push(wingGeo, strutGeo);
    const wing = new THREE.Mesh(wingGeo, bodyMaterial);
    wing.position.set(0, 0.92, 1.18);
    wing.rotation.x = 0.14;
    wing.castShadow = true;
    chassisGroup.add(wing);
    for (const side of [-0.42, 0.42]) {
      const strut = new THREE.Mesh(strutGeo, cageMat);
      strut.position.set(side, 0.68, 1.18);
      chassisGroup.add(strut);
    }
  } else {
    // Baja Spare Tire Rack
    const spareWheel = createWheelMesh(0.36, 0.24, config.tires, rimMat, rubberMat, accentMat);
    spareWheel.rotation.z = Math.PI / 2;
    spareWheel.rotation.x = -0.55;
    spareWheel.position.set(0, 0.62, 1.15);
    chassisGroup.add(spareWheel);
  }

  // 8. Articulated Suspension Arms + 4 Wheels
  const wheelRadius = config.tires === 'mudder' ? 0.5 : config.tires === 'paddle' ? 0.48 : 0.46;
  const wheelWidth = config.tires === 'mudder' ? 0.42 : config.tires === 'paddle' ? 0.36 : 0.32;
  const trackHalfSpan = config.chassis === 'bruiser' ? 1.04 : 0.94;

  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(-trackHalfSpan, wheelRadius, -0.95);
  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(trackHalfSpan, wheelRadius, -0.95);

  const flWheel = createWheelMesh(wheelRadius * 0.95, wheelWidth * 0.9, config.tires, rimMat, rubberMat, accentMat);
  const frWheel = createWheelMesh(wheelRadius * 0.95, wheelWidth * 0.9, config.tires, rimMat, rubberMat, accentMat);
  frontLeftPivot.add(flWheel);
  frontRightPivot.add(frWheel);

  const rlWheel = createWheelMesh(wheelRadius, wheelWidth, config.tires, rimMat, rubberMat, accentMat);
  rlWheel.position.set(-trackHalfSpan, wheelRadius, 0.98);
  const rrWheel = createWheelMesh(wheelRadius, wheelWidth, config.tires, rimMat, rubberMat, accentMat);
  rrWheel.position.set(trackHalfSpan, wheelRadius, 0.98);

  root.add(frontLeftPivot, frontRightPivot, rlWheel, rrWheel);

  // Suspension strut bars connecting chassis to wheel hubs
  const armGeo = new THREE.CylinderGeometry(0.032, 0.032, trackHalfSpan * 0.72, 6);
  armGeo.rotateZ(Math.PI / 2);
  geometriesToDispose.push(armGeo);
  for (const zPos of [-0.95, 0.98]) {
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, accentMat);
      arm.position.set(side * (trackHalfSpan * 0.56), 0.14, zPos);
      arm.rotation.z = side * -0.18;
      chassisGroup.add(arm);
    }
  }

  // 9. Shield Dome (for Shield power-up)
  const shieldGeo = new THREE.SphereGeometry(1.95, 18, 14);
  geometriesToDispose.push(shieldGeo);
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.position.y = 0.72;
  shieldMesh.visible = false;
  root.add(shieldMesh);

  // 10. Grounded Radial Contact Shadow Disc
  const shadowGeo = new THREE.PlaneGeometry(3.2, 4.1);
  shadowGeo.rotateX(-Math.PI / 2);
  geometriesToDispose.push(shadowGeo);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowMap,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  materialsToDispose.push(shadowMat);
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  return {
    root,
    chassisGroup,
    frontLeftPivot,
    frontRightPivot,
    wheels: [flWheel, frWheel, rlWheel, rrWheel],
    boostFlames,
    shieldMesh,
    contactShadow,
    bodyMaterial,
    baseColor,
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
    },
  };
}

export function syncBuggyVisual(
  visual: BuggyVisual,
  state: BuggyState,
  groundY: number,
  elapsed: number,
): void {
  visual.root.position.set(state.x, state.y, state.z);
  visual.root.rotation.set(0, state.yaw, 0);

  // Suspension squash & pitch/roll on chassis group
  visual.chassisGroup.position.y = 0.42 - state.suspensionCompression * 0.13;
  visual.chassisGroup.rotation.set(state.pitch, 0, state.roll);

  // Steering & wheel spin
  visual.frontLeftPivot.rotation.y = state.steerAngle;
  visual.frontRightPivot.rotation.y = state.steerAngle;
  for (const w of visual.wheels) {
    w.rotation.x = -state.wheelSpin;
  }

  // Hit flash emissive pulse
  if (state.hitFlashTimer > 0) {
    visual.bodyMaterial.emissive.set('#ffffff');
    visual.bodyMaterial.emissiveIntensity = 0.85;
  } else if (state.nitroTimer > 0) {
    visual.bodyMaterial.emissive.set('#f97316');
    visual.bodyMaterial.emissiveIntensity = 0.25;
  } else {
    visual.bodyMaterial.emissive.set('#000000');
    visual.bodyMaterial.emissiveIntensity = 0;
  }

  // Boost flames
  const showFlame = state.isBoosting && state.speed > 5;
  const flicker = 0.85 + Math.sin(elapsed * 42) * 0.25;
  for (const flame of visual.boostFlames) {
    flame.visible = showFlame;
    if (showFlame) {
      flame.scale.set(1, 1, (state.nitroTimer > 0 ? 1.55 : 1.0) * flicker);
    }
  }

  // Shield dome
  visual.shieldMesh.visible = state.shieldTimer > 0;
  if (state.shieldTimer > 0) {
    visual.shieldMesh.rotation.y = elapsed * 1.4;
  }

  // Contact shadow stays glued to ground beneath airborne buggy
  const heightAboveGround = Math.max(0, state.y - groundY);
  visual.contactShadow.position.y = groundY - state.y + 0.03;
  const shadowScale = Math.max(0.55, 1 - heightAboveGround * 0.08);
  visual.contactShadow.scale.set(shadowScale, 1, shadowScale);
}
