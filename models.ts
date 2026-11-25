import * as THREE from 'three';
import { FighterVisual, WeaponType } from '../shared/gameData.ts';
import { createCharacterSurfaceTexture } from './textures.ts';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftForearmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftShinPivot: THREE.Group;
  rightShinPivot: THREE.Group;
  capePivot?: THREE.Group;
  leftWingPivot?: THREE.Group;
  rightWingPivot?: THREE.Group;
  auraRing: THREE.Mesh;
  shadowDisc: THREE.Mesh;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  baseEmissives: THREE.Color[];
  scale: number;
}

// Shared cached procedural character textures
let cachedArmorTex: THREE.CanvasTexture | null = null;
let cachedClothTex: THREE.CanvasTexture | null = null;
let cachedScaleTex: THREE.CanvasTexture | null = null;

function getCharTextures() {
  if (!cachedArmorTex) cachedArmorTex = createCharacterSurfaceTexture('armor');
  if (!cachedClothTex) cachedClothTex = createCharacterSurfaceTexture('cloth');
  if (!cachedScaleTex) cachedScaleTex = createCharacterSurfaceTexture('scales');
  return { armorTex: cachedArmorTex, clothTex: cachedClothTex, scaleTex: cachedScaleTex };
}

function createCurvedBladeGeometry(length: number, width: number, curve: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(curve * 0.45, length * 0.5, curve, length);
  shape.lineTo(curve - width * 0.65, length * 0.94);
  shape.quadraticCurveTo(curve * 0.35 - width, length * 0.48, -width, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 2,
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function createWeaponMesh(
  weaponType: WeaponType,
  primaryMat: THREE.Material,
  metalMat: THREE.Material,
  glowMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  switch (weaponType) {
    case 'katana': {
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), metalMat);
      pommel.position.y = -0.15;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.32, 10), primaryMat);
      const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.025, 16), metalMat);
      tsuba.position.y = 0.17;
      const bladeGeo = createCurvedBladeGeometry(1.18, 0.068, 0.11);
      const blade = new THREE.Mesh(bladeGeo, metalMat);
      blade.position.set(0.02, 0.78, 0);
      blade.rotation.y = Math.PI / 2;
      const hamon = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.06, 0.022), glowMat);
      hamon.position.set(0, 0.76, 0.036);
      g.add(pommel, hilt, tsuba, blade, hamon);
      g.rotation.x = Math.PI / 2;
      break;
    }
    case 'dual_blades': {
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.24, 10), primaryMat);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.026, 0.05), metalMat);
      guard.position.y = 0.13;
      const bladeGeo = createCurvedBladeGeometry(0.76, 0.06, 0.08);
      const blade = new THREE.Mesh(bladeGeo, glowMat);
      blade.position.set(0, 0.52, 0);
      blade.rotation.y = Math.PI / 2;
      g.add(hilt, guard, blade);
      g.rotation.x = Math.PI / 2;
      break;
    }
    case 'spear': {
      const buttCap = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.14, 8), metalMat);
      buttCap.position.y = -0.52;
      buttCap.rotation.x = Math.PI;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 1.92, 10), primaryMat);
      shaft.position.y = 0.44;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.048, 0.16, 12), metalMat);
      collar.position.y = 1.42;
      const crossWingL = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.2, 4), metalMat);
      crossWingL.position.set(-0.08, 1.46, 0);
      crossWingL.rotation.z = 0.9;
      const crossWingR = crossWingL.clone();
      crossWingR.position.x = 0.08;
      crossWingR.rotation.z = -0.9;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.48, 6), glowMat);
      tip.position.y = 1.72;
      g.add(buttCap, shaft, collar, crossWingL, crossWingR, tip);
      g.rotation.x = Math.PI / 2;
      break;
    }
    case 'hammer': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 1.34, 10), primaryMat);
      shaft.position.y = 0.45;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.56, 8), metalMat);
      head.rotation.z = Math.PI / 2;
      head.position.y = 1.12;
      const strikePlateL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 8), glowMat);
      strikePlateL.rotation.z = Math.PI / 2;
      strikePlateL.position.set(-0.28, 1.12, 0);
      const strikePlateR = strikePlateL.clone();
      strikePlateR.position.x = 0.28;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 6), metalMat);
      spike.position.y = 1.38;
      g.add(shaft, head, strikePlateL, strikePlateR, spike);
      g.rotation.x = Math.PI / 2;
      break;
    }
    case 'scythe': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 1.85, 10), primaryMat);
      pole.position.y = 0.4;
      const collar = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), metalMat);
      collar.position.y = 1.32;
      const bladeGeo = createCurvedBladeGeometry(0.88, 0.14, 0.45);
      const crescent = new THREE.Mesh(bladeGeo, glowMat);
      crescent.position.set(0, 1.34, 0.36);
      crescent.rotation.x = Math.PI / 2.2;
      crescent.rotation.y = Math.PI / 2;
      g.add(pole, collar, crescent);
      g.rotation.x = Math.PI / 2;
      break;
    }
    case 'claws': {
      const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.16, 10), metalMat);
      bracer.position.y = 0.02;
      g.add(bracer);
      for (let i = -1; i <= 1; i++) {
        const talon = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.44, 5), glowMat);
        talon.position.set(i * 0.055, -0.02, 0.24);
        talon.rotation.x = Math.PI / 2 + 0.1;
        g.add(talon);
      }
      break;
    }
    case 'greatsword': {
      const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), metalMat);
      pommel.position.y = -0.18;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.04, 0.36, 10), primaryMat);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.09), metalMat);
      cross.position.y = 0.19;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.48, 4), metalMat);
      blade.scale.set(1.2, 1, 0.28);
      blade.position.y = 0.96;
      const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.15, 0.045), glowMat);
      fuller.position.y = 0.85;
      g.add(pommel, hilt, cross, blade, fuller);
      g.rotation.x = Math.PI / 2;
      break;
    }
    case 'staff': {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 1.9, 10), metalMat);
      rod.position.y = 0.42;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 20), metalMat);
      ring.position.y = 1.44;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 1), glowMat);
      core.position.y = 1.44;
      g.add(rod, ring, core);
      g.rotation.x = Math.PI / 2;
      break;
    }
    case 'gauntlets': {
      const knucklePlate = new THREE.Mesh(new THREE.DodecahedronGeometry(0.135, 1), metalMat);
      knucklePlate.scale.set(1.05, 0.88, 1.18);
      knucklePlate.position.set(0, -0.02, 0.02);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.075, 0.13), glowMat);
      crest.position.set(0, -0.02, 0.11);
      g.add(knucklePlate, crest);
      break;
    }
    case 'orb': {
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 2), glowMat);
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 24), metalMat);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.015, 8, 24), metalMat);
      ring1.rotation.x = Math.PI / 3;
      ring2.rotation.y = Math.PI / 3;
      core.position.set(0, 0.04, 0.28);
      ring1.position.copy(core.position);
      ring2.position.copy(core.position);
      g.add(core, ring1, ring2);
      break;
    }
  }
  return g;
}

export function buildCharacterRig(
  visual: FighterVisual,
  shadowTexture: THREE.Texture,
  castShadow = true,
): CharacterRig {
  const root = new THREE.Group();
  const scale = visual.scale || 1.0;
  const { armorTex, clothTex, scaleTex } = getCharTextures();

  const isScaled = visual.silhouetteStyle === 'dragon' || visual.silhouetteStyle === 'ronin';

  // Physically differentiated PBR materials
  const armorMat = new THREE.MeshStandardMaterial({
    color: visual.primaryColor,
    map: isScaled ? scaleTex : armorTex,
    roughness: 0.36,
    metalness: 0.56,
  });
  const trimMat = new THREE.MeshPhysicalMaterial({
    color: visual.secondaryColor,
    roughness: 0.18,
    metalness: 0.88,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: visual.primaryColor,
    map: clothTex,
    roughness: 0.86,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: visual.skinColor,
    roughness: 0.62,
    metalness: 0.02,
    sheen: 0.3,
    sheenRoughness: 0.6,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#181c20',
    roughness: 0.72,
    metalness: 0.18,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: visual.accentColor,
    emissive: visual.accentColor,
    emissiveIntensity: 1.05,
    roughness: 0.15,
    metalness: 0.3,
  });

  const hitFlashMaterials = [armorMat, trimMat, clothMat, skinMat];
  const baseEmissives = hitFlashMaterials.map((m) => m.emissive.clone());

  // Contact shadow disc grounded at y = 0.02
  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85 * scale, 1.85 * scale),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // Ground aura ring
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(0.68 * scale, 0.82 * scale, 32),
    new THREE.MeshBasicMaterial({
      color: visual.auraColor,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.035;
  root.add(auraRing);

  const bodyPivot = new THREE.Group();
  bodyPivot.scale.setScalar(scale);
  root.add(bodyPivot);

  const isBulk =
    visual.silhouetteStyle === 'titan' ||
    visual.silhouetteStyle === 'brawler' ||
    visual.silhouetteStyle === 'dragon';
  const chestMult = isBulk ? 1.18 : 1.0;

  // 1. Pelvis & Armored Hip Tassets (y = 0.88)
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.88;
  bodyPivot.add(pelvis);

  const pelvisCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * chestMult, 0.15 * chestMult, 0.2, 12),
    darkMat,
  );
  pelvisCore.scale.set(1.15, 1, 0.82);
  pelvis.add(pelvisCore);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205 * chestMult, 0.205 * chestMult, 0.09, 14),
    trimMat,
  );
  belt.scale.set(1.14, 1, 0.84);
  belt.position.y = 0.06;
  pelvis.add(belt);

  const beltBuckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), glowMat);
  beltBuckle.position.set(0, 0.06, 0.175 * chestMult);
  beltBuckle.scale.set(1.1, 1.2, 0.45);
  pelvis.add(beltBuckle);

  // Side armor tassets / faulds + front tabard
  [-1, 1].forEach((side) => {
    const tasset = new THREE.Mesh(new THREE.BoxGeometry(0.16 * chestMult, 0.26, 0.22), armorMat);
    tasset.position.set(side * 0.21 * chestMult, -0.06, 0);
    tasset.rotation.z = side * 0.18;
    pelvis.add(tasset);
  });
  const tabard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.03), clothMat);
  tabard.position.set(0, -0.14, 0.155 * chestMult);
  tabard.rotation.x = -0.1;
  pelvis.add(tabard);

  // 2. Sculpted Anatomical Torso (Lathe V-taper + Pectoral Plates + Collar Gorget)
  const torso = new THREE.Group();
  torso.position.y = 0.1;
  pelvis.add(torso);

  const torsoProfile = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.165 * chestMult, 0.02),
    new THREE.Vector2(0.185 * chestMult, 0.18),
    new THREE.Vector2(0.245 * chestMult, 0.38),
    new THREE.Vector2(0.265 * chestMult, 0.52),
    new THREE.Vector2(0.185 * chestMult, 0.62),
    new THREE.Vector2(0.085, 0.66),
    new THREE.Vector2(0.01, 0.66),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 16);
  const torsoMesh = new THREE.Mesh(torsoGeo, armorMat);
  torsoMesh.scale.set(1.12, 1, 0.72);
  torso.add(torsoMesh);

  // Sculpted pectoral armor plates + abs ridge
  [-1, 1].forEach((side) => {
    const pec = new THREE.Mesh(new THREE.SphereGeometry(0.135 * chestMult, 12, 10), armorMat);
    pec.scale.set(1.1, 0.85, 0.52);
    pec.position.set(side * 0.115 * chestMult, 0.44, 0.145 * chestMult);
    pec.rotation.y = side * 0.22;
    torso.add(pec);
  });

  const sternumCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.085 * chestMult, 0), glowMat);
  sternumCrest.position.set(0, 0.43, 0.2 * chestMult);
  sternumCrest.scale.set(0.95, 1.3, 0.35);
  torso.add(sternumCrest);

  // Gorget neck guard
  const gorget = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.036, 8, 16), trimMat);
  gorget.rotation.x = Math.PI / 2;
  gorget.position.y = 0.62;
  torso.add(gorget);

  // 3. Sculpted Head, Neck, Jawline, Eyes, Helmet / Hair / Horns / Crown
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.68, 0);
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.085, 0.14, 10), skinMat);
  neck.position.y = 0.04;
  headGroup.add(neck);

  // Cranium + sculpted jawline
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), skinMat);
  cranium.position.y = 0.2;
  cranium.scale.set(0.94, 1.06, 1.02);
  headGroup.add(cranium);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.16), skinMat);
  jaw.position.set(0, 0.13, 0.035);
  headGroup.add(jaw);

  // Glowing warrior eyes / brow ridge
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.018, 0.025), glowMat);
    eye.position.set(side * 0.052, 0.2, 0.135);
    eye.rotation.z = side * -0.14;
    headGroup.add(eye);
  });

  // Silhouette-specific headgear / helmet / hood
  if (visual.silhouetteStyle === 'ronin') {
    const kabutoDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.162, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      armorMat,
    );
    kabutoDome.position.y = 0.215;
    const shikoro = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.12, 12, 1, true), trimMat);
    shikoro.position.set(0, 0.16, -0.02);
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 14, Math.PI), trimMat);
    crest.position.set(0, 0.34, 0.12);
    crest.rotation.z = Math.PI;
    const faceMask = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.08, 0.14), darkMat);
    faceMask.position.set(0, 0.13, 0.055);
    headGroup.add(kabutoDome, shikoro, crest, faceMask);
  } else if (visual.silhouetteStyle === 'assassin' || visual.silhouetteStyle === 'ranger') {
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65),
      clothMat,
    );
    hood.position.set(0, 0.21, -0.01);
    const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.11, 0.11, 12), darkMat);
    mask.position.set(0, 0.13, 0.04);
    headGroup.add(hood, mask);
  } else if (visual.silhouetteStyle === 'paladin' || visual.silhouetteStyle === 'celestial' || visual.silhouetteStyle === 'emperor') {
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      trimMat,
    );
    helm.position.y = 0.21;
    const nasalGuard = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.13, 0.05), trimMat);
    nasalGuard.position.set(0, 0.2, 0.145);
    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.24), glowMat);
    plume.position.set(0, 0.36, -0.03);
    headGroup.add(helm, nasalGuard, plume);
  } else if (visual.silhouetteStyle === 'wraith' || visual.silhouetteStyle === 'dragon' || visual.silhouetteStyle === 'titan') {
    const helm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.165, 1), armorMat);
    helm.position.y = 0.21;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.08), glowMat);
    visor.position.set(0, 0.2, 0.13);
    headGroup.add(helm, visor);
  } else {
    // Sculpted spiky warrior hair + headband
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.02, 8, 18), glowMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.25;
    headGroup.add(band);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), darkMat);
      spike.position.set(Math.cos(ang) * 0.08, 0.34, Math.sin(ang) * 0.08);
      spike.rotation.z = -Math.cos(ang) * 0.5;
      spike.rotation.x = Math.sin(ang) * 0.5;
      headGroup.add(spike);
    }
  }

  if (visual.hasCrown) {
    const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.135, 0.08, 8), trimMat);
    crownRing.position.y = 0.35;
    headGroup.add(crownRing);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.11, 4), glowMat);
      spire.position.set(Math.cos(a) * 0.13, 0.42, Math.sin(a) * 0.13);
      headGroup.add(spire);
    }
  }

  if (visual.hasHorns) {
    [-1, 1].forEach((side) => {
      const hornBase = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.22, 8), trimMat);
      hornBase.position.set(side * 0.14, 0.32, 0.02);
      hornBase.rotation.z = -side * 0.72;
      const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.24, 8), glowMat);
      hornTip.position.set(side * 0.24, 0.44, 0.05);
      hornTip.rotation.z = -side * 0.2;
      hornTip.rotation.x = 0.25;
      headGroup.add(hornBase, hornTip);
    });
  }

  // 4. Multi-Jointed Articulated Arms (Shoulder -> Upper Arm -> Forearm Pivot -> Bracer -> Hand)
  const makeArm = (side: -1 | 1) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * (0.29 * chestMult), 0.53, 0);

    // Sculpted layered pauldron
    const pauldronMain = new THREE.Mesh(
      new THREE.SphereGeometry(isBulk ? 0.155 : 0.125, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
      trimMat,
    );
    pauldronMain.rotation.z = -side * 0.32;
    pauldronMain.scale.set(1.25, 0.9, 1.15);
    shoulderPivot.add(pauldronMain);

    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.088 * chestMult, 10, 8), clothMat);
    deltoid.position.y = -0.05;
    shoulderPivot.add(deltoid);

    const bicep = new THREE.Mesh(
      new THREE.CylinderGeometry(0.074 * chestMult, 0.062 * chestMult, 0.26, 10),
      clothMat,
    );
    bicep.position.y = -0.17;
    shoulderPivot.add(bicep);

    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.064 * chestMult, 10, 8), armorMat);
    elbowJoint.position.y = -0.31;
    shoulderPivot.add(elbowJoint);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.y = -0.31;
    shoulderPivot.add(forearmPivot);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068 * chestMult, 0.052 * chestMult, 0.26, 10),
      armorMat,
    );
    forearm.position.y = -0.14;
    forearmPivot.add(forearm);

    const bracerTrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072 * chestMult, 0.058 * chestMult, 0.14, 10),
      trimMat,
    );
    bracerTrim.position.y = -0.16;
    forearmPivot.add(bracerTrim);

    const hand = new THREE.Mesh(new THREE.DodecahedronGeometry(0.056, 1), skinMat);
    hand.position.y = -0.3;
    forearmPivot.add(hand);

    torso.add(shoulderPivot);
    return { shoulderPivot, forearmPivot };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const mainWeapon = createWeaponMesh(visual.weaponType, armorMat, trimMat, glowMat);
  mainWeapon.position.set(0, -0.31, 0.04);
  rightArm.forearmPivot.add(mainWeapon);

  if (
    visual.weaponType === 'dual_blades' ||
    visual.weaponType === 'claws' ||
    visual.weaponType === 'gauntlets'
  ) {
    const offWeapon = createWeaponMesh(visual.weaponType, armorMat, trimMat, glowMat);
    offWeapon.position.set(0, -0.31, 0.04);
    leftArm.forearmPivot.add(offWeapon);
  }

  // 5. Multi-Jointed Articulated Legs (Hip -> Thigh -> Knee Cap -> Shin Pivot -> Greave -> Contoured Boot)
  const makeLeg = (side: -1 | 1) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * (0.125 * chestMult), 0.85, 0);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105 * chestMult, 0.082 * chestMult, 0.38, 12),
      clothMat,
    );
    thigh.position.y = -0.19;
    hipPivot.add(thigh);

    const kneePad = new THREE.Mesh(new THREE.DodecahedronGeometry(0.082 * chestMult, 0), trimMat);
    kneePad.position.set(0, -0.39, 0.03);
    hipPivot.add(kneePad);

    const shinPivot = new THREE.Group();
    shinPivot.position.y = -0.4;
    hipPivot.add(shinPivot);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * chestMult, 0.062 * chestMult, 0.36, 12),
      armorMat,
    );
    shin.position.y = -0.18;
    shinPivot.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.135 * chestMult, 0.1, 0.24), trimMat);
    boot.position.set(0, -0.39, 0.045);
    shinPivot.add(boot);

    const bootToe = new THREE.Mesh(new THREE.ConeGeometry(0.068 * chestMult, 0.12, 6), armorMat);
    bootToe.rotation.x = Math.PI / 2;
    bootToe.position.set(0, -0.4, 0.17);
    shinPivot.add(bootToe);

    bodyPivot.add(hipPivot);
    return { hipPivot, shinPivot };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // 6. Flowing Layered Cape & Multi-Blade Wings
  let capePivot: THREE.Group | undefined;
  if (visual.hasCape) {
    capePivot = new THREE.Group();
    capePivot.position.set(0, 0.56, -0.16 * chestMult);
    const mantle = new THREE.Mesh(new THREE.BoxGeometry(0.46 * chestMult, 0.14, 0.08), trimMat);
    mantle.position.y = 0.02;
    const capeMain = new THREE.Mesh(new THREE.BoxGeometry(0.5 * chestMult, 0.94, 0.03), clothMat);
    capeMain.position.y = -0.46;
    capeMain.rotation.x = 0.14;
    const capeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.52 * chestMult, 0.08, 0.035), trimMat);
    capeTrim.position.set(0, -0.92, -0.06);
    capePivot.add(mantle, capeMain, capeTrim);
    torso.add(capePivot);
  }

  let leftWingPivot: THREE.Group | undefined;
  let rightWingPivot: THREE.Group | undefined;
  if (visual.hasWings) {
    const makeWing = (side: -1 | 1) => {
      const wp = new THREE.Group();
      wp.position.set(side * 0.12, 0.46, -0.16 * chestMult);
      for (let i = 0; i < 3; i++) {
        const len = 0.78 - i * 0.14;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.12 - i * 0.015, 0.03),
          i === 0 ? trimMat : glowMat,
        );
        blade.position.set(side * (len * 0.5 + 0.08), 0.22 - i * 0.16, -0.05);
        blade.rotation.z = side * (0.42 - i * 0.18);
        wp.add(blade);
      }
      torso.add(wp);
      return wp;
    };
    leftWingPivot = makeWing(-1);
    rightWingPivot = makeWing(1);
  }

  bodyPivot.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = castShadow;
      obj.receiveShadow = true;
    }
  });

  return {
    root,
    bodyPivot,
    pelvis,
    torso,
    headGroup,
    leftArmPivot: leftArm.shoulderPivot,
    rightArmPivot: rightArm.shoulderPivot,
    leftForearmPivot: leftArm.forearmPivot,
    rightForearmPivot: rightArm.forearmPivot,
    leftLegPivot: leftLeg.hipPivot,
    rightLegPivot: rightLeg.hipPivot,
    leftShinPivot: leftLeg.shinPivot,
    rightShinPivot: rightLeg.shinPivot,
    capePivot,
    leftWingPivot,
    rightWingPivot,
    auraRing,
    shadowDisc,
    hitFlashMaterials,
    baseEmissives,
    scale,
  };
}

export function animateCharacterRig(
  rig: CharacterRig,
  action: string,
  elapsed: number,
  actionProgress: number,
  yPos: number,
  hitFlash: number,
): void {
  rig.shadowDisc.position.y = -yPos + 0.02;
  const shadowScale = Math.max(0.45, 1 - yPos * 0.18);
  rig.shadowDisc.scale.setScalar(shadowScale);
  rig.auraRing.position.y = -yPos + 0.035;
  rig.auraRing.rotation.z = elapsed * 1.4;

  for (let i = 0; i < rig.hitFlashMaterials.length; i++) {
    const mat = rig.hitFlashMaterials[i];
    if (hitFlash > 0) {
      mat.emissive.setRGB(hitFlash * 0.9, hitFlash * 0.25, hitFlash * 0.2);
    } else {
      mat.emissive.copy(rig.baseEmissives[i]);
    }
  }

  // Neutralize joints cleanly
  rig.pelvis.position.y = 0.88;
  rig.pelvis.rotation.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);
  rig.leftArmPivot.rotation.set(0, 0, 0);
  rig.rightArmPivot.rotation.set(0, 0, 0);
  rig.leftForearmPivot.rotation.set(0, 0, 0);
  rig.rightForearmPivot.rotation.set(0, 0, 0);
  rig.leftLegPivot.rotation.set(0, 0, 0);
  rig.rightLegPivot.rotation.set(0, 0, 0);
  rig.leftShinPivot.rotation.set(0, 0, 0);
  rig.rightShinPivot.rotation.set(0, 0, 0);

  if (rig.capePivot) {
    rig.capePivot.rotation.x = 0.12 + Math.sin(elapsed * 4.5) * 0.08;
  }
  if (rig.leftWingPivot && rig.rightWingPivot) {
    const flap = Math.sin(elapsed * 4.2) * 0.18;
    rig.leftWingPivot.rotation.y = 0.28 + flap;
    rig.rightWingPivot.rotation.y = -0.28 - flap;
  }

  switch (action) {
    case 'move': {
      const stride = Math.sin(elapsed * 11.5);
      rig.pelvis.position.y = 0.86 + Math.abs(Math.cos(elapsed * 11.5)) * 0.05;
      rig.torso.rotation.x = 0.2;
      rig.headGroup.rotation.x = -0.14;
      rig.leftLegPivot.rotation.x = stride * 0.68;
      rig.rightLegPivot.rotation.x = -stride * 0.68;
      // Natural knee flexion on back-swing
      rig.leftShinPivot.rotation.x = Math.max(0, -stride * 0.85) + 0.12;
      rig.rightShinPivot.rotation.x = Math.max(0, stride * 0.85) + 0.12;

      rig.leftArmPivot.rotation.x = -stride * 0.5;
      rig.rightArmPivot.rotation.x = stride * 0.42 - 0.35;
      rig.leftForearmPivot.rotation.x = -0.65;
      rig.rightForearmPivot.rotation.x = -0.55;
      if (rig.capePivot) rig.capePivot.rotation.x = 0.5 + Math.sin(elapsed * 11.5) * 0.14;
      break;
    }
    case 'light': {
      const swing = Math.sin(actionProgress * Math.PI);
      rig.torso.rotation.y = -0.45 + swing * 1.05;
      rig.torso.rotation.x = 0.16;
      rig.rightArmPivot.rotation.x = -1.6 + swing * 2.05;
      rig.rightArmPivot.rotation.z = -0.28;
      rig.rightForearmPivot.rotation.x = -0.45 + swing * 0.3;
      rig.leftArmPivot.rotation.x = 0.35;
      rig.leftForearmPivot.rotation.x = -0.8;
      rig.leftLegPivot.rotation.x = -0.35;
      rig.leftShinPivot.rotation.x = 0.35;
      rig.rightLegPivot.rotation.x = 0.32;
      break;
    }
    case 'heavy': {
      const swing = Math.sin(actionProgress * Math.PI);
      rig.torso.rotation.x = -0.26 + swing * 0.72;
      rig.torso.rotation.y = -0.65 + swing * 1.3;
      rig.rightArmPivot.rotation.x = -2.35 + swing * 2.75;
      rig.rightForearmPivot.rotation.x = -0.25;
      rig.leftArmPivot.rotation.x = -0.9 + swing * 1.1;
      rig.leftForearmPivot.rotation.x = -0.6;
      rig.rightLegPivot.rotation.x = -0.42;
      rig.rightShinPivot.rotation.x = 0.45;
      rig.leftLegPivot.rotation.x = 0.42;
      break;
    }
    case 'special': {
      const burst = Math.sin(actionProgress * Math.PI);
      rig.pelvis.position.y = 0.92 + burst * 0.3;
      rig.torso.rotation.x = -0.16;
      rig.leftArmPivot.rotation.z = -0.95 - burst * 0.42;
      rig.rightArmPivot.rotation.z = 0.95 + burst * 0.42;
      rig.rightArmPivot.rotation.x = -1.1;
      rig.leftArmPivot.rotation.x = -1.1;
      rig.leftShinPivot.rotation.x = 0.35;
      rig.rightShinPivot.rotation.x = 0.35;
      rig.auraRing.scale.setScalar(1 + burst * 1.35);
      break;
    }
    case 'block': {
      rig.pelvis.position.y = 0.82;
      rig.torso.rotation.y = -0.35;
      rig.torso.rotation.x = 0.12;
      rig.leftArmPivot.rotation.x = -0.9;
      rig.leftForearmPivot.rotation.x = -0.95;
      rig.leftArmPivot.rotation.y = 0.55;
      rig.rightArmPivot.rotation.x = -0.85;
      rig.rightForearmPivot.rotation.x = -0.9;
      rig.rightArmPivot.rotation.y = -0.5;
      rig.leftLegPivot.rotation.x = -0.32;
      rig.leftShinPivot.rotation.x = 0.4;
      rig.rightLegPivot.rotation.x = 0.28;
      rig.rightShinPivot.rotation.x = 0.2;
      break;
    }
    case 'dodge': {
      rig.pelvis.position.y = 0.72;
      rig.torso.rotation.x = 0.72;
      rig.leftArmPivot.rotation.x = 0.85;
      rig.rightArmPivot.rotation.x = 0.85;
      rig.leftShinPivot.rotation.x = 0.55;
      rig.rightShinPivot.rotation.x = 0.55;
      break;
    }
    case 'hit': {
      rig.torso.rotation.x = -0.36;
      rig.headGroup.rotation.x = -0.28;
      rig.leftArmPivot.rotation.z = -0.45;
      rig.rightArmPivot.rotation.z = 0.45;
      break;
    }
    case 'ko': {
      rig.pelvis.position.y = 0.24;
      rig.pelvis.rotation.x = -1.48;
      rig.leftShinPivot.rotation.x = 0.3;
      rig.rightShinPivot.rotation.x = 0.4;
      break;
    }
    case 'victory': {
      rig.pelvis.position.y = 0.9 + Math.abs(Math.sin(elapsed * 5)) * 0.1;
      rig.rightArmPivot.rotation.x = -2.45;
      rig.rightForearmPivot.rotation.x = -0.25;
      rig.leftArmPivot.rotation.z = -0.45;
      rig.auraRing.scale.setScalar(1.25 + Math.sin(elapsed * 6) * 0.15);
      break;
    }
    case 'intro': {
      const pulse = Math.sin(elapsed * 5);
      rig.pelvis.position.y = 0.9 + pulse * 0.04;
      rig.rightArmPivot.rotation.x = -1.25 + pulse * 0.18;
      rig.rightForearmPivot.rotation.x = -0.45;
      rig.leftArmPivot.rotation.z = -0.5;
      rig.auraRing.scale.setScalar(1.45 + pulse * 0.25);
      break;
    }
    default: {
      // Realistic martial arts breathing & ready guard
      const breathe = Math.sin(elapsed * 2.9);
      rig.pelvis.position.y = 0.85 + breathe * 0.016;
      rig.torso.rotation.y = 0.26;
      rig.torso.rotation.x = 0.06;
      rig.headGroup.rotation.y = -0.18;
      rig.rightArmPivot.rotation.x = -0.48 + breathe * 0.05;
      rig.rightForearmPivot.rotation.x = -0.85;
      rig.leftArmPivot.rotation.x = -0.38 - breathe * 0.05;
      rig.leftForearmPivot.rotation.x = -0.95;
      rig.leftArmPivot.rotation.z = -0.14;
      rig.rightArmPivot.rotation.z = 0.14;
      rig.leftLegPivot.rotation.x = -0.22;
      rig.leftShinPivot.rotation.x = 0.28;
      rig.rightLegPivot.rotation.x = 0.22;
      rig.rightShinPivot.rotation.x = 0.18;
      rig.auraRing.scale.setScalar(1);
      break;
    }
  }
}
