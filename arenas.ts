import * as THREE from 'three';
import { ArenaDef, GraphicsQuality } from '../shared/gameData.ts';
import { createArenaFloorTexture, createWaterTexture } from './textures.ts';

export interface DestructibleVisual {
  id: number;
  mesh: THREE.Group;
  x: number;
  z: number;
  destroyed: boolean;
}

export interface BuiltArena {
  group: THREE.Group;
  destructibles: DestructibleVisual[];
  update: (elapsed: number, dt: number) => void;
  dispose: () => void;
}

function getQualityScale(quality: GraphicsQuality): { foliageMult: number; weatherCount: number } {
  switch (quality) {
    case 'low':
      return { foliageMult: 0.4, weatherCount: 120 };
    case 'medium':
      return { foliageMult: 0.7, weatherCount: 280 };
    case 'high':
      return { foliageMult: 1.0, weatherCount: 520 };
    case 'ultra':
      return { foliageMult: 1.35, weatherCount: 850 };
  }
}

function buildDestructibleProp(arena: ArenaDef, id: number, x: number, z: number, castShadow: boolean): DestructibleVisual {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  if (arena.id === 'volcano_valley' || arena.id === 'mountain_peak') {
    // Crystal spire cluster
    const mat = new THREE.MeshStandardMaterial({
      color: arena.accentColor,
      emissive: arena.accentColor,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.35,
    });
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: '#45484f', roughness: 0.85 }));
    base.position.y = 0.25;
    const shard1 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.15, 5), mat);
    shard1.position.y = 0.72;
    const shard2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 5), mat);
    shard2.position.set(0.24, 0.52, 0.12);
    shard2.rotation.z = -0.35;
    g.add(base, shard1, shard2);
  } else if (arena.id === 'ancient_temple' || arena.id === 'mystic_lake') {
    // Carved temple urn / lantern pedestal
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#9c8c72', roughness: 0.8 });
    const trimMat = new THREE.MeshStandardMaterial({ color: arena.accentColor, roughness: 0.35, metalness: 0.6 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.3, 10), stoneMat);
    ped.position.y = 0.15;
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.75, 12), trimMat);
    urn.position.y = 0.66;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 14), stoneMat);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 1.04;
    g.add(ped, urn, lip);
  } else {
    // Bamboo/Wood supply crate with iron bands
    const woodMat = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.82 });
    const bandMat = new THREE.MeshStandardMaterial({ color: '#4a5259', roughness: 0.35, metalness: 0.75 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.88, 0.88), woodMat);
    box.position.y = 0.44;
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.92), bandMat);
    band1.position.y = 0.24;
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.92), bandMat);
    band2.position.y = 0.68;
    g.add(box, band1, band2);
  }

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = castShadow;
      o.receiveShadow = true;
    }
  });

  return { id, mesh: g, x, z, destroyed: false };
}

export function buildArenaWorld(
  arena: ArenaDef,
  quality: GraphicsQuality,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): BuiltArena {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const castShadow = !isSoftwareGl && quality !== 'low';
  const { foliageMult, weatherCount } = getQualityScale(quality);

  const floorStyle =
    arena.id === 'ancient_temple' || arena.id === 'mystic_lake'
      ? 'stone'
      : arena.id === 'volcano_valley'
        ? 'volcano'
        : arena.id === 'tropical_island'
          ? 'sand'
          : 'earth';

  const floorTex = createArenaFloorTexture(arena.groundColor, arena.accentColor, maxAnisotropy, floorStyle);
  disposables.push(floorTex);

  // Outer natural landscape skirt (extends far into horizon fog so nothing looks boxed in)
  const outerGeo = new THREE.CircleGeometry(140, 48);
  const outerMat = new THREE.MeshStandardMaterial({
    color: arena.id === 'tropical_island' || arena.id === 'mystic_lake' ? arena.waterColor : arena.groundColor,
    roughness: arena.id === 'tropical_island' || arena.id === 'mystic_lake' ? 0.22 : 0.9,
    metalness: arena.id === 'tropical_island' || arena.id === 'mystic_lake' ? 0.35 : 0.05,
  });
  const outerGround = new THREE.Mesh(outerGeo, outerMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.15;
  outerGround.receiveShadow = true;
  group.add(outerGround);
  disposables.push(outerGeo, outerMat);

  // Main playable combat platform
  const arenaGeo = new THREE.CylinderGeometry(arena.radius, arena.radius + 1.4, 0.34, 48);
  const arenaMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: floorStyle === 'stone' ? 0.65 : 0.85,
    metalness: 0.08,
  });
  const arenaFloor = new THREE.Mesh(arenaGeo, arenaMat);
  arenaFloor.position.y = -0.17;
  arenaFloor.receiveShadow = true;
  group.add(arenaFloor);
  disposables.push(arenaGeo, arenaMat);

  // Natural perimeter ring stones / curb markers
  const rockGeo = new THREE.DodecahedronGeometry(1.3, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: arena.id === 'volcano_valley' ? '#2c2526' : arena.id === 'mountain_peak' ? '#7b8b99' : '#5e665c',
    roughness: 0.88,
    metalness: 0.08,
  });
  const perimeterCount = Math.round(32 * foliageMult);
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, perimeterCount);
  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();
  for (let i = 0; i < perimeterCount; i++) {
    const ang = (i / perimeterCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
    const dist = arena.radius + 1.6 + Math.random() * 6;
    dummy.position.set(Math.cos(ang) * dist, 0.35 + Math.random() * 0.8, Math.sin(ang) * dist);
    dummy.rotation.set(Math.random() * 2, Math.random() * Math.PI, Math.random() * 0.5);
    const s = 0.85 + Math.random() * 1.4;
    dummy.scale.set(s * 1.2, s * (0.8 + Math.random() * 0.8), s);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
    colorTmp.set(rockMat.color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
    rockInst.setColorAt(i, colorTmp);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  rockInst.castShadow = castShadow;
  rockInst.receiveShadow = true;
  group.add(rockInst);
  disposables.push(rockGeo, rockMat);

  // Distant mountain / cliff silhouettes on the horizon
  const peakGeo = new THREE.ConeGeometry(12, 26, 6);
  const peakMat = new THREE.MeshStandardMaterial({
    color: arena.id === 'volcano_valley' ? '#361c1a' : arena.id === 'mountain_peak' ? '#a5bfd4' : '#2a4538',
    roughness: 0.92,
  });
  const peakCount = 16;
  const peakInst = new THREE.InstancedMesh(peakGeo, peakMat, peakCount);
  for (let i = 0; i < peakCount; i++) {
    const ang = (i / peakCount) * Math.PI * 2;
    const dist = 62 + (i % 3) * 14;
    dummy.position.set(Math.cos(ang) * dist, 9 + (i % 2) * 5, Math.sin(ang) * dist);
    dummy.rotation.set(0, ang, 0);
    dummy.scale.set(1.2 + (i % 3) * 0.4, 0.9 + (i % 4) * 0.35, 1.2);
    dummy.updateMatrix();
    peakInst.setMatrixAt(i, dummy.matrix);
  }
  peakInst.instanceMatrix.needsUpdate = true;
  peakInst.computeBoundingSphere();
  group.add(peakInst);
  disposables.push(peakGeo, peakMat);

  // Arena-specific architectural & natural centerpieces
  let animatedWaterMesh: THREE.Mesh | null = null;
  let waterTex: THREE.CanvasTexture | null = null;
  let waterfallMesh: THREE.Mesh | null = null;

  if (arena.id === 'jungle_falls' || arena.id === 'mystic_lake' || arena.id === 'tropical_island') {
    waterTex = createWaterTexture(arena.waterColor);
    const wGeo = new THREE.RingGeometry(arena.radius + 0.6, 54, 48);
    const wMat = new THREE.MeshStandardMaterial({
      map: waterTex,
      color: arena.waterColor,
      roughness: 0.14,
      metalness: 0.45,
      transparent: true,
      opacity: 0.88,
    });
    animatedWaterMesh = new THREE.Mesh(wGeo, wMat);
    animatedWaterMesh.rotation.x = -Math.PI / 2;
    animatedWaterMesh.position.y = 0.02;
    group.add(animatedWaterMesh);
    disposables.push(waterTex, wGeo, wMat);
  }

  if (arena.id === 'jungle_falls') {
    // Tall cliff + cascading waterfall on far edge
    const cliffMat = new THREE.MeshStandardMaterial({ color: '#465445', roughness: 0.9 });
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(16, 18, 6), cliffMat);
    cliff.position.set(0, 8, -32);
    group.add(cliff);
    const fallTex = createWaterTexture('#7df9ff');
    const fallMat = new THREE.MeshStandardMaterial({
      map: fallTex,
      color: '#8cf2f0',
      emissive: '#1e6e70',
      emissiveIntensity: 0.35,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    });
    waterfallMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 17), fallMat);
    waterfallMesh.position.set(0, 8.2, -28.9);
    group.add(waterfallMesh);
    disposables.push(cliffMat, fallTex, fallMat);
  } else if (arena.id === 'ancient_temple') {
    // Ring of sandstone pillars + glowing braziers
    const colMat = new THREE.MeshStandardMaterial({ color: '#a88c62', roughness: 0.78 });
    const flameMat = new THREE.MeshStandardMaterial({
      color: '#ff9d3b',
      emissive: '#ff5e00',
      emissiveIntensity: 1.6,
    });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + 0.2;
      const r = arena.radius + 1.8;
      const h = i % 3 === 0 ? 4.2 : 7.5;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, h, 10), colMat);
      pillar.position.set(Math.cos(ang) * r, h / 2, Math.sin(ang) * r);
      pillar.castShadow = castShadow;
      group.add(pillar);
      if (i % 2 === 0) {
        const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), flameMat);
        bowl.position.set(Math.cos(ang) * (r - 1.5), 1.4, Math.sin(ang) * (r - 1.5));
        group.add(bowl);
      }
    }
    disposables.push(colMat, flameMat);
  } else if (arena.id === 'volcano_valley') {
    // Glowing magma moat around obsidian ring
    waterTex = createWaterTexture('#ff4500');
    const lavaGeo = new THREE.RingGeometry(arena.radius + 0.3, 50, 48);
    const lavaMat = new THREE.MeshStandardMaterial({
      map: waterTex,
      color: '#ff5500',
      emissive: '#ff3300',
      emissiveIntensity: 1.35,
      roughness: 0.3,
    });
    animatedWaterMesh = new THREE.Mesh(lavaGeo, lavaMat);
    animatedWaterMesh.rotation.x = -Math.PI / 2;
    animatedWaterMesh.position.y = 0.01;
    group.add(animatedWaterMesh);
    disposables.push(waterTex, lavaGeo, lavaMat);
  } else if (arena.id === 'bamboo_forest') {
    // Instanced tall jade bamboo stalks + stone torii gate
    const bamCount = Math.round(90 * foliageMult);
    const bamGeo = new THREE.CylinderGeometry(0.14, 0.18, 12, 7);
    const bamMat = new THREE.MeshStandardMaterial({ color: '#4d9c4b', roughness: 0.55 });
    const bamInst = new THREE.InstancedMesh(bamGeo, bamMat, bamCount);
    for (let i = 0; i < bamCount; i++) {
      const ang = (i / bamCount) * Math.PI * 2 + Math.random() * 0.2;
      const dist = arena.radius + 2.2 + Math.random() * 18;
      dummy.position.set(Math.cos(ang) * dist, 6, Math.sin(ang) * dist);
      dummy.rotation.set((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08);
      dummy.scale.set(0.85 + Math.random() * 0.4, 0.8 + Math.random() * 0.5, 0.85 + Math.random() * 0.4);
      dummy.updateMatrix();
      bamInst.setMatrixAt(i, dummy.matrix);
    }
    bamInst.instanceMatrix.needsUpdate = true;
    bamInst.computeBoundingSphere();
    bamInst.castShadow = castShadow;
    group.add(bamInst);
    disposables.push(bamGeo, bamMat);
  }

  // Trees for forest / jungle / tropical / lake arenas
  if (
    arena.id === 'lost_forest' ||
    arena.id === 'jungle_falls' ||
    arena.id === 'tropical_island' ||
    arena.id === 'mystic_lake'
  ) {
    const treeCount = Math.round(38 * foliageMult);
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 4.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#4f3723', roughness: 0.9 });
    const canopyGeo =
      arena.id === 'tropical_island'
        ? new THREE.ConeGeometry(2.6, 1.5, 7)
        : new THREE.DodecahedronGeometry(2.3, 1);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: arena.id === 'mystic_lake' ? '#2c596b' : '#2e7037',
      roughness: 0.8,
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    for (let i = 0; i < treeCount; i++) {
      const ang = (i / treeCount) * Math.PI * 2 + Math.random() * 0.15;
      const dist = arena.radius + 4 + Math.random() * 18;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const s = 0.85 + Math.random() * 0.6;
      dummy.position.set(x, 2.0 * s, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 4.6 * s, z);
      dummy.scale.set(s * 1.15, s, s * 1.15);
      dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);
      colorTmp.set(canopyMat.color).offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.1);
      canopies.setColorAt(i, colorTmp);
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    canopies.computeBoundingSphere();
    trunks.castShadow = castShadow;
    canopies.castShadow = castShadow;
    group.add(trunks, canopies);
    disposables.push(trunkGeo, trunkMat, canopyGeo, canopyMat);
  }

  // Destructible environmental props inside arena perimeter
  const destructibles: DestructibleVisual[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.35;
    const dist = 10 + (i % 2) * 4.5;
    const prop = buildDestructibleProp(arena, i + 1, Math.cos(ang) * dist, Math.sin(ang) * dist, castShadow);
    group.add(prop.mesh);
    destructibles.push(prop);
  }

  // Weather particle system
  const weatherPositions = new Float32Array(weatherCount * 3);
  for (let i = 0; i < weatherCount; i++) {
    weatherPositions[i * 3] = (Math.random() - 0.5) * 56;
    weatherPositions[i * 3 + 1] = Math.random() * 20;
    weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 56;
  }
  const weatherGeo = new THREE.BufferGeometry();
  weatherGeo.setAttribute('position', new THREE.BufferAttribute(weatherPositions, 3));
  const weatherColor =
    arena.weather === 'embers'
      ? '#ff7a29'
      : arena.weather === 'snow'
        ? '#eef7ff'
        : arena.weather === 'rain'
          ? '#a6d4e8'
          : '#d6ffe8';
  const weatherMat = new THREE.PointsMaterial({
    color: weatherColor,
    size: arena.weather === 'rain' ? 0.14 : 0.22,
    transparent: true,
    opacity: arena.weather === 'clear' ? 0.25 : 0.68,
  });
  const weatherPoints = new THREE.Points(weatherGeo, weatherMat);
  group.add(weatherPoints);
  disposables.push(weatherGeo, weatherMat);

  const update = (elapsed: number, dt: number) => {
    if (waterTex) {
      waterTex.offset.x = (elapsed * 0.04) % 1;
      waterTex.offset.y = (elapsed * 0.03) % 1;
    }
    if (waterfallMesh) {
      const mat = waterfallMesh.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.offset.y = -(elapsed * 0.9) % 1;
    }

    const posAttr = weatherGeo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < weatherCount; i++) {
      const idx = i * 3;
      if (arena.weather === 'embers') {
        arr[idx + 1] += dt * 2.4;
        arr[idx] += Math.sin(elapsed + i) * dt * 0.7;
        if (arr[idx + 1] > 18) arr[idx + 1] = 0.2;
      } else if (arena.weather === 'rain') {
        arr[idx + 1] -= dt * 16;
        if (arr[idx + 1] < 0) arr[idx + 1] = 19;
      } else if (arena.weather === 'snow') {
        arr[idx + 1] -= dt * 2.2;
        arr[idx] += Math.cos(elapsed * 0.8 + i) * dt * 0.6;
        if (arr[idx + 1] < 0) arr[idx + 1] = 19;
      } else {
        arr[idx + 1] += Math.sin(elapsed * 0.9 + i) * dt * 0.25;
      }
    }
    posAttr.needsUpdate = true;
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return { group, destructibles, update, dispose };
}
