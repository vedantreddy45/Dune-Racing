import * as THREE from 'three';

const POOL_SIZE = 220;

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class PooledParticleSystem {
  public readonly mesh: THREE.InstancedMesh;
  private readonly slots: ParticleSlot[] = [];
  private cursor = 0;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.DodecahedronGeometry(0.32, 0);
    this.material = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.72,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, POOL_SIZE);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < POOL_SIZE; i++) {
      this.slots.push({
        active: false,
        x: 0,
        y: -500,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0.001,
      });
      _dummy.position.set(0, -500, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      this.mesh.setColorAt(i, _color.set('#d6a47c'));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  public emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: string,
    size: number,
    maxLife: number,
  ): void {
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % POOL_SIZE;

    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.size = size;

    _color.set(colorHex);
    const idx = (this.cursor + POOL_SIZE - 1) % POOL_SIZE;
    this.mesh.setColorAt(idx, _color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public burst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: string,
    speed: number,
    size: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      this.emit(
        x + (Math.random() - 0.5) * 0.8,
        y + 0.3,
        z + (Math.random() - 0.5) * 0.8,
        Math.cos(a) * speed * (0.5 + Math.random() * 0.7),
        up * speed * 0.7,
        Math.sin(a) * speed * (0.5 + Math.random() * 0.7),
        colorHex,
        size,
        0.35 + Math.random() * 0.35,
      );
    }
  }

  public update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < POOL_SIZE; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      dirty = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _dummy.position.set(0, -500, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      s.vy -= 5.5 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const t = s.life / s.maxLife;
      const scale = s.size * (0.3 + t * 0.9);
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.scale.setScalar(scale);
      _dummy.rotation.set(s.life * 2, s.life * 3, 0);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
