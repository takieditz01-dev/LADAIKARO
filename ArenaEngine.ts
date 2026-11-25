import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArenaId,
  BossDef,
  FighterDef,
  getArenaById,
  getBossByIndex,
  getFighterById,
  GraphicsQuality,
  Rarity,
} from '../shared/gameData.ts';
import { buildArenaWorld, BuiltArena } from './arenas.ts';
import { animateCharacterRig, buildCharacterRig, CharacterRig } from './models.ts';
import { soundEngine } from './sound.ts';
import { createRadialShadowTexture } from './textures.ts';

export type EngineMode = 'title' | 'showcase' | 'solo' | 'online' | 'spectate';

export interface HudSnapshot {
  mode: EngineMode;
  phase: 'intro' | 'fighting' | 'round_over' | 'match_over';
  round: number;
  team1Rounds: number;
  team2Rounds: number;
  roundTimeLeft: number;
  bossName?: string;
  bossSubtitle?: string;
  bossPhase?: number;
  bossIntroLine?: string;
  comboCount: number;
  comboLabel: string;
  telegraphWarning: string | null;
  fighters: Array<{
    id: string;
    name: string;
    team: 1 | 2;
    hp: number;
    maxHp: number;
    stamina: number;
    maxStamina: number;
    isLocal: boolean;
  }>;
  soloResult?: {
    won: boolean;
    roundsWon: number;
    roundsLost: number;
    combosLanded: number;
    objectsDestroyed: number;
    specialsHit: number;
    parriesLanded: number;
  };
}

export interface OnlineMatchSnapshot {
  round: number;
  team1Rounds: number;
  team2Rounds: number;
  phase: 'intro' | 'fighting' | 'round_over' | 'match_over';
  roundTimeLeft: number;
  fighters: Record<
    number,
    {
      userId: number;
      username: string;
      fighterId: string;
      team: 1 | 2;
      x: number;
      y: number;
      z: number;
      yaw: number;
      hp: number;
      maxHp: number;
      stamina: number;
      maxStamina: number;
      action: string;
      comboCount: number;
    }
  >;
  destructibles: Array<{ id: number; destroyed: boolean }>;
}

interface LocalActor {
  key: string;
  name: string;
  team: 1 | 2;
  isPlayer: boolean;
  isBoss: boolean;
  fighterDef?: FighterDef;
  bossDef?: BossDef;
  rig: CharacterRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  action: 'idle' | 'move' | 'light' | 'heavy' | 'special' | 'block' | 'dodge' | 'hit' | 'ko' | 'victory' | 'intro';
  actionTimer: number;
  actionDuration: number;
  hitDidConnect: boolean;
  comboStep: number;
  comboCount: number;
  comboResetTimer: number;
  invulnTimer: number;
  parryWindow: number;
  blocking: boolean;
  hitFlash: number;
  aiCooldown: number;
  telegraphTimer: number;
  telegraphType: 'nova' | 'charge' | null;
  bossPhase: number;
}

interface ParticleItem {
  mesh: THREE.Mesh;
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

// Reusable math objects (zero GC in animation loop)
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

export class ArenaEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private isSoftwareGl: boolean;
  private quality: GraphicsQuality = 'high';
  private shadowTex: THREE.CanvasTexture;

  private builtArena: BuiltArena | null = null;
  private currentArenaId: ArenaId = 'jungle_falls';

  private mode: EngineMode = 'title';
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private elapsed = 0;

  // Camera orbit & shake
  private camYaw = 0;
  private camPitch = 0.36;
  private camDist = 9.5;
  private shakeIntensity = 0;
  private hitstopTimer = 0;

  // Input state
  private keys: Record<string, boolean> = {};
  private mobileMoveX = 0;
  private mobileMoveY = 0;
  private isPointerDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastInputSend = 0;

  // Particle pool + boss telegraph ring
  private particles: ParticleItem[] = [];
  private telegraphRing: THREE.Mesh;

  // Solo / Title / Showcase actors
  private actors: LocalActor[] = [];
  private soloPhase: 'intro' | 'fighting' | 'round_over' | 'match_over' = 'fighting';
  private soloPhaseTimer = 0;
  private soloRound = 1;
  private soloTeam1Rounds = 0;
  private soloTeam2Rounds = 0;
  private soloRoundTime = 90;
  private soloStats = { combosLanded: 0, objectsDestroyed: 0, specialsHit: 0, parriesLanded: 0 };
  private currentBoss: BossDef | null = null;
  private soloOpponentRarity: Rarity = 'Common';
  private soloResultEmitted = false;

  // Online / Spectate rigs
  private onlineRigs = new Map<number, { rig: CharacterRig; fighterId: string; hitFlash: number; targetX: number; targetY: number; targetZ: number; targetYaw: number; action: string }>();
  private onlineSnapshot: OnlineMatchSnapshot | null = null;
  private localUserId = 0;

  // Callbacks
  private onHudUpdate?: (hud: HudSnapshot) => void;
  private onOnlineInput?: (input: {
    moveX: number;
    moveZ: number;
    aimYaw: number;
    blocking: boolean;
    action?: 'light' | 'heavy' | 'special' | 'jump' | 'dodge';
  }) => void;
  private lastHudEmit = 0;

  constructor(
    container: HTMLElement,
    options?: {
      onHudUpdate?: (hud: HudSnapshot) => void;
      onOnlineInput?: (input: {
        moveX: number;
        moveZ: number;
        aimYaw: number;
        blocking: boolean;
        action?: 'light' | 'heavy' | 'special' | 'jump' | 'dodge';
      }) => void;
    },
  ) {
    this.container = container;
    this.onHudUpdate = options?.onHudUpdate;
    this.onOnlineInput = options?.onOnlineInput;

    // Detect software WebGL cleanly via renderer string
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.applyQualitySettings('high');

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      54,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      260,
    );

    // Mandatory Studio RoomEnvironment PMREM for PBR metallic highlights
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3-point warm/cool lighting rig
    this.hemiLight = new THREE.HemisphereLight('#a6e3d0', '#243d27', 0.75);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#fff2cc', 2.3);
    this.keyLight.position.set(18, 28, 16);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 80;
    const d = 24;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight('#7cc7ff', 0.65);
    this.rimLight.position.set(-16, 12, -18);
    this.scene.add(this.rimLight);

    this.shadowTex = createRadialShadowTexture();

    // Pooled 3D particles
    const pGeo = new THREE.DodecahedronGeometry(0.14, 0);
    for (let i = 0; i < 90; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({ mesh, active: false, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.5 });
    }

    // Boss special telegraph ring
    this.telegraphRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 4.8, 36),
      new THREE.MeshBasicMaterial({
        color: '#ff3b30',
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.telegraphRing.rotation.x = -Math.PI / 2;
    this.telegraphRing.position.y = 0.06;
    this.telegraphRing.visible = false;
    this.scene.add(this.telegraphRing);

    this.bindEvents();
    this.loadTitleScene('jungle_falls');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.startLoop();
  }

  public setQuality(q: GraphicsQuality): void {
    this.quality = q;
    this.applyQualitySettings(q);
    this.loadArena(this.currentArenaId);
  }

  private applyQualitySettings(q: GraphicsQuality): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    if (q === 'low') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.0));
      this.renderer.shadowMap.enabled = false;
    } else if (q === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.25));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      if (this.keyLight) this.keyLight.shadow.mapSize.set(512, 512);
    } else if (q === 'high') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (this.keyLight) this.keyLight.shadow.mapSize.set(1024, 1024);
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (this.keyLight) this.keyLight.shadow.mapSize.set(2048, 2048);
    }
  }

  private loadArena(arenaId: ArenaId): void {
    this.currentArenaId = arenaId;
    const def = getArenaById(arenaId);
    if (this.builtArena) {
      this.scene.remove(this.builtArena.group);
      this.builtArena.dispose();
      this.builtArena = null;
    }
    this.scene.background = new THREE.Color(def.skyHorizon);
    this.scene.fog = new THREE.FogExp2(def.fogColor, def.fogDensity);
    this.keyLight.color.set(def.sunColor);
    this.keyLight.intensity = def.sunIntensity;
    this.hemiLight.color.set(def.hemiSky);
    this.hemiLight.groundColor.set(def.hemiGround);

    this.builtArena = buildArenaWorld(
      def,
      this.quality,
      this.renderer.capabilities.getMaxAnisotropy(),
      this.isSoftwareGl,
    );
    this.scene.add(this.builtArena.group);
  }

  private clearActors(): void {
    this.actors.forEach((a) => this.scene.remove(a.rig.root));
    this.actors = [];
    this.onlineRigs.forEach((o) => this.scene.remove(o.rig.root));
    this.onlineRigs.clear();
    this.telegraphRing.visible = false;
  }

  public loadTitleScene(arenaId: ArenaId = 'jungle_falls'): void {
    this.mode = 'title';
    this.clearActors();
    this.loadArena(arenaId);

    const hero = getFighterById('kael_strider');
    const rival = getFighterById('crimson_shogun');
    const rig1 = buildCharacterRig(hero.visual, this.shadowTex, !this.isSoftwareGl);
    const rig2 = buildCharacterRig(rival.visual, this.shadowTex, !this.isSoftwareGl);
    this.scene.add(rig1.root, rig2.root);

    this.actors = [
      {
        key: 'title_1',
        name: hero.name,
        team: 1,
        isPlayer: false,
        isBoss: false,
        fighterDef: hero,
        rig: rig1,
        x: -3.2,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: Math.PI / 2,
        hp: 200,
        maxHp: 200,
        stamina: 100,
        maxStamina: 100,
        action: 'idle',
        actionTimer: 0,
        actionDuration: 0.4,
        hitDidConnect: false,
        comboStep: 0,
        comboCount: 0,
        comboResetTimer: 0,
        invulnTimer: 0,
        parryWindow: 0,
        blocking: false,
        hitFlash: 0,
        aiCooldown: 0,
        telegraphTimer: 0,
        telegraphType: null,
        bossPhase: 1,
      },
      {
        key: 'title_2',
        name: rival.name,
        team: 2,
        isPlayer: false,
        isBoss: false,
        fighterDef: rival,
        rig: rig2,
        x: 3.2,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: -Math.PI / 2,
        hp: 200,
        maxHp: 200,
        stamina: 100,
        maxStamina: 100,
        action: 'idle',
        actionTimer: 0,
        actionDuration: 0.4,
        hitDidConnect: false,
        comboStep: 0,
        comboCount: 0,
        comboResetTimer: 0,
        invulnTimer: 0,
        parryWindow: 0,
        blocking: false,
        hitFlash: 0,
        aiCooldown: 0,
        telegraphTimer: 0,
        telegraphType: null,
        bossPhase: 1,
      },
    ];
  }

  public showShowcaseFighter(fighterId: string, arenaId?: ArenaId): void {
    this.mode = 'showcase';
    this.clearActors();
    if (arenaId && arenaId !== this.currentArenaId) {
      this.loadArena(arenaId);
    }
    const fighter = getFighterById(fighterId);
    const rig = buildCharacterRig(fighter.visual, this.shadowTex, !this.isSoftwareGl);
    this.scene.add(rig.root);
    this.actors = [
      {
        key: 'showcase',
        name: fighter.name,
        team: 1,
        isPlayer: false,
        isBoss: false,
        fighterDef: fighter,
        rig,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: 0.25,
        hp: 200,
        maxHp: 200,
        stamina: 100,
        maxStamina: 100,
        action: 'idle',
        actionTimer: 0,
        actionDuration: 0.4,
        hitDidConnect: false,
        comboStep: 0,
        comboCount: 0,
        comboResetTimer: 0,
        invulnTimer: 0,
        parryWindow: 0,
        blocking: false,
        hitFlash: 0,
        aiCooldown: 0,
        telegraphTimer: 0,
        telegraphType: null,
        bossPhase: 1,
      },
    ];
  }

  public startSoloMatch(params: {
    fighterId: string;
    arenaId: ArenaId;
    bossIndex?: number;
    opponentFighterId?: string;
    opponentRarity?: Rarity;
  }): void {
    this.mode = 'solo';
    this.clearActors();
    this.loadArena(params.arenaId);

    this.soloRound = 1;
    this.soloTeam1Rounds = 0;
    this.soloTeam2Rounds = 0;
    this.soloRoundTime = 90;
    this.soloStats = { combosLanded: 0, objectsDestroyed: 0, specialsHit: 0, parriesLanded: 0 };
    this.soloResultEmitted = false;
    this.camYaw = Math.PI / 2;
    this.camPitch = 0.34;
    this.camDist = 9.5;

    const pDef = getFighterById(params.fighterId);
    const pRig = buildCharacterRig(pDef.visual, this.shadowTex, !this.isSoftwareGl);
    this.scene.add(pRig.root);
    const pMaxHp = Math.round(190 + pDef.stats.defense * 1.45);

    const playerActor: LocalActor = {
      key: 'player',
      name: pDef.name,
      team: 1,
      isPlayer: true,
      isBoss: false,
      fighterDef: pDef,
      rig: pRig,
      x: -7.5,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.PI / 2,
      hp: pMaxHp,
      maxHp: pMaxHp,
      stamina: 100,
      maxStamina: 100,
      action: 'idle',
      actionTimer: 0,
      actionDuration: 0.4,
      hitDidConnect: false,
      comboStep: 0,
      comboCount: 0,
      comboResetTimer: 0,
      invulnTimer: 0,
      parryWindow: 0,
      blocking: false,
      hitFlash: 0,
      aiCooldown: 0,
      telegraphTimer: 0,
      telegraphType: null,
      bossPhase: 1,
    };

    let enemyActor: LocalActor;
    if (params.bossIndex && params.bossIndex >= 1) {
      const boss = getBossByIndex(params.bossIndex);
      this.currentBoss = boss;
      this.soloOpponentRarity = boss.index >= 8 ? 'Legendary' : boss.index >= 4 ? 'Epic' : 'Rare';
      const bRig = buildCharacterRig(boss.visual, this.shadowTex, !this.isSoftwareGl);
      this.scene.add(bRig.root);
      enemyActor = {
        key: 'boss',
        name: boss.name,
        team: 2,
        isPlayer: false,
        isBoss: true,
        bossDef: boss,
        rig: bRig,
        x: 7.5,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: -Math.PI / 2,
        hp: boss.maxHp,
        maxHp: boss.maxHp,
        stamina: 100,
        maxStamina: 100,
        action: 'intro',
        actionTimer: 0,
        actionDuration: 0.5,
        hitDidConnect: false,
        comboStep: 0,
        comboCount: 0,
        comboResetTimer: 0,
        invulnTimer: 0,
        parryWindow: 0,
        blocking: false,
        hitFlash: 0,
        aiCooldown: 0.8,
        telegraphTimer: 0,
        telegraphType: null,
        bossPhase: 1,
      };
      this.soloPhase = 'intro';
      this.soloPhaseTimer = 2.6;
      soundEngine.playBossRoar();
    } else {
      this.currentBoss = null;
      this.soloOpponentRarity = params.opponentRarity || 'Common';
      const oDef = getFighterById(params.opponentFighterId || 'lyra_vale');
      const oRig = buildCharacterRig(oDef.visual, this.shadowTex, !this.isSoftwareGl);
      this.scene.add(oRig.root);
      const oMaxHp = Math.round(180 + oDef.stats.defense * 1.35);
      enemyActor = {
        key: 'opponent',
        name: oDef.name,
        team: 2,
        isPlayer: false,
        isBoss: false,
        fighterDef: oDef,
        rig: oRig,
        x: 7.5,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: -Math.PI / 2,
        hp: oMaxHp,
        maxHp: oMaxHp,
        stamina: 100,
        maxStamina: 100,
        action: 'idle',
        actionTimer: 0,
        actionDuration: 0.4,
        hitDidConnect: false,
        comboStep: 0,
        comboCount: 0,
        comboResetTimer: 0,
        invulnTimer: 0,
        parryWindow: 0,
        blocking: false,
        hitFlash: 0,
        aiCooldown: 0.6,
        telegraphTimer: 0,
        telegraphType: null,
        bossPhase: 1,
      };
      this.soloPhase = 'intro';
      this.soloPhaseTimer = 1.2;
    }

    this.actors = [playerActor, enemyActor];
    this.emitHud();
  }

  public startOnlineView(arenaId: ArenaId, localUserId: number, isSpectator: boolean): void {
    this.mode = isSpectator ? 'spectate' : 'online';
    this.localUserId = localUserId;
    this.clearActors();
    this.loadArena(arenaId);
    this.camYaw = Math.PI / 2;
    this.camPitch = 0.36;
    this.camDist = isSpectator ? 15 : 9.8;
    this.onlineSnapshot = null;
  }

  public applyOnlineState(state: OnlineMatchSnapshot): void {
    this.onlineSnapshot = state;
    if (this.builtArena) {
      state.destructibles.forEach((d) => {
        const visual = this.builtArena!.destructibles.find((v) => v.id === d.id);
        if (visual && d.destroyed && !visual.destroyed) {
          visual.destroyed = true;
          visual.mesh.visible = false;
        }
      });
    }

    const activeIds = new Set<number>();
    Object.values(state.fighters).forEach((f) => {
      activeIds.add(f.userId);
      let entry = this.onlineRigs.get(f.userId);
      if (!entry) {
        const def = getFighterById(f.fighterId);
        const rig = buildCharacterRig(def.visual, this.shadowTex, !this.isSoftwareGl);
        rig.root.position.set(f.x, f.y, f.z);
        rig.root.rotation.y = f.yaw;
        this.scene.add(rig.root);
        entry = {
          rig,
          fighterId: f.fighterId,
          hitFlash: 0,
          targetX: f.x,
          targetY: f.y,
          targetZ: f.z,
          targetYaw: f.yaw,
          action: f.action,
        };
        this.onlineRigs.set(f.userId, entry);
      } else {
        entry.targetX = f.x;
        entry.targetY = f.y;
        entry.targetZ = f.z;
        entry.targetYaw = f.yaw;
        entry.action = f.action;
      }
    });

    this.onlineRigs.forEach((val, uid) => {
      if (!activeIds.has(uid)) {
        this.scene.remove(val.rig.root);
        this.onlineRigs.delete(uid);
      }
    });
  }

  public handleOnlineEvent(evt: {
    type: string;
    x?: number;
    y?: number;
    z?: number;
    attackType?: string;
    blocked?: boolean;
    targetId?: number;
    fighterId?: string;
    propId?: number;
  }): void {
    if (evt.type === 'hit') {
      const target = evt.targetId ? this.onlineRigs.get(evt.targetId) : undefined;
      if (target && !evt.blocked) target.hitFlash = 1;
      const color = evt.blocked ? '#7ce8ff' : evt.attackType === 'special' ? '#ff9833' : '#ff4757';
      this.spawnParticles(evt.x ?? 0, evt.y ?? 1.2, evt.z ?? 0, color, evt.attackType === 'special' ? 22 : 12);
      if (evt.blocked) soundEngine.playHit('blocked');
      else soundEngine.playHit((evt.attackType as 'light' | 'heavy' | 'special') || 'light');
      if (evt.attackType === 'heavy' || evt.attackType === 'special') {
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.35);
      }
    } else if (evt.type === 'parry') {
      this.spawnParticles(evt.x ?? 0, 1.3, evt.z ?? 0, '#ffe875', 24);
      soundEngine.playParry();
    } else if (evt.type === 'special_cast') {
      const def = evt.fighterId ? getFighterById(evt.fighterId) : undefined;
      this.spawnParticles(evt.x ?? 0, 1.1, evt.z ?? 0, def?.visual.auraColor || '#5ef2d6', 28);
      soundEngine.playSpecialCast();
    } else if (evt.type === 'prop_destroyed') {
      soundEngine.playShatter();
      const prop = this.builtArena?.destructibles.find((d) => d.id === evt.propId);
      if (prop) {
        this.spawnParticles(prop.x, 0.7, prop.z, '#d9b573', 18);
      }
    } else if (evt.type === 'round_over') {
      soundEngine.playVictory();
    }
  }

  public setMobileMove(x: number, y: number): void {
    this.mobileMoveX = x;
    this.mobileMoveY = y;
  }

  public triggerAction(action: 'light' | 'heavy' | 'special' | 'jump' | 'dodge' | 'block_start' | 'block_end'): void {
    soundEngine.unlock();
    if (this.mode === 'online') {
      if (action === 'block_start') {
        this.keys['KeyF'] = true;
        return;
      }
      if (action === 'block_end') {
        this.keys['KeyF'] = false;
        return;
      }
      this.emitOnlineControls(action);
      return;
    }

    if (this.mode !== 'solo' || this.soloPhase !== 'fighting') return;
    const player = this.actors.find((a) => a.isPlayer);
    if (!player || player.hp <= 0) return;

    if (action === 'block_start') {
      if (player.stamina >= 10 && (player.action === 'idle' || player.action === 'move')) {
        player.blocking = true;
        player.parryWindow = 0.25;
        player.action = 'block';
      }
      return;
    }
    if (action === 'block_end') {
      player.blocking = false;
      if (player.action === 'block') player.action = 'idle';
      return;
    }

    const canAct = player.action === 'idle' || player.action === 'move' || player.action === 'block';
    if (!canAct) return;

    if (action === 'jump' && player.y <= 0.02 && player.stamina >= 10) {
      player.vy = 10.8;
      player.stamina -= 10;
    } else if (action === 'dodge' && player.stamina >= 22) {
      player.stamina -= 22;
      player.blocking = false;
      player.action = 'dodge';
      player.actionDuration = 0.34;
      player.actionTimer = 0.34;
      player.invulnTimer = 0.3;
      const move = this.getCameraRelativeMove();
      const dx = Math.abs(move.x) + Math.abs(move.z) > 0.1 ? move.x : Math.sin(player.yaw);
      const dz = Math.abs(move.x) + Math.abs(move.z) > 0.1 ? move.z : Math.cos(player.yaw);
      const len = Math.max(0.01, Math.hypot(dx, dz));
      player.vx = (dx / len) * 14.5;
      player.vz = (dz / len) * 14.5;
      soundEngine.playDodge();
    } else if (action === 'light' && player.stamina >= 8) {
      player.stamina -= 8;
      player.blocking = false;
      this.faceNearestEnemy(player);
      player.action = 'light';
      player.actionDuration = 0.28;
      player.actionTimer = 0.28;
      player.hitDidConnect = false;
      player.comboStep = (player.comboStep + 1) % 3;
      soundEngine.playSwing(false);
    } else if (action === 'heavy' && player.stamina >= 20) {
      player.stamina -= 20;
      player.blocking = false;
      this.faceNearestEnemy(player);
      player.action = 'heavy';
      player.actionDuration = 0.45;
      player.actionTimer = 0.45;
      player.hitDidConnect = false;
      soundEngine.playSwing(true);
    } else if (action === 'special' && player.stamina >= 40) {
      player.stamina -= 40;
      player.blocking = false;
      this.faceNearestEnemy(player);
      player.action = 'special';
      player.actionDuration = 0.56;
      player.actionTimer = 0.56;
      player.hitDidConnect = false;
      this.spawnParticles(player.x, 1.2, player.z, player.fighterDef?.visual.auraColor || '#5ef2d6', 24);
      soundEngine.playSpecialCast();
    }
  }

  private faceNearestEnemy(actor: LocalActor): void {
    let bestDist = Infinity;
    let best: LocalActor | null = null;
    for (const other of this.actors) {
      if (other.team === actor.team || other.hp <= 0) continue;
      const d = Math.hypot(other.x - actor.x, other.z - actor.z);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    if (best) {
      actor.yaw = Math.atan2(best.x - actor.x, best.z - actor.z);
    }
  }

  private getCameraRelativeMove(): { x: number; z: number } {
    let forward = 0;
    let right = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) right += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) right -= 1;

    forward += -this.mobileMoveY;
    right += this.mobileMoveX;

    if (Math.abs(forward) < 0.05 && Math.abs(right) < 0.05) return { x: 0, z: 0 };

    // Camera looks along (-sin(camYaw), -cos(camYaw))
    const fwdX = -Math.sin(this.camYaw);
    const fwdZ = -Math.cos(this.camYaw);
    const rightX = Math.cos(this.camYaw);
    const rightZ = -Math.sin(this.camYaw);

    const x = fwdX * forward + rightX * right;
    const z = fwdZ * forward + rightZ * right;
    const len = Math.max(1, Math.hypot(x, z));
    return { x: x / len, z: z / len };
  }

  private spawnParticles(x: number, y: number, z: number, colorHex: string, count: number): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.life = 0.35 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
      (p.mesh.material as THREE.MeshBasicMaterial).color.set(colorHex);
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 5.5;
      p.vx = Math.cos(ang) * spd;
      p.vy = 2 + Math.random() * 5;
      p.vz = Math.sin(ang) * spd;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private emitOnlineControls(action?: 'light' | 'heavy' | 'special' | 'jump' | 'dodge'): void {
    if (!this.onOnlineInput) return;
    const move = this.getCameraRelativeMove();
    const blocking = Boolean(this.keys['KeyF']);
    const aimYaw = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    this.onOnlineInput({
      moveX: move.x,
      moveZ: move.z,
      aimYaw,
      blocking,
      action,
    });
  }

  private stepSolo(dt: number): void {
    const arena = getArenaById(this.currentArenaId);

    if (this.soloPhase === 'intro') {
      this.soloPhaseTimer -= dt;
      if (this.soloPhaseTimer <= 0) {
        this.soloPhase = 'fighting';
        this.actors.forEach((a) => {
          if (a.action === 'intro') a.action = 'idle';
        });
      }
      return;
    }

    if (this.soloPhase === 'round_over') {
      this.soloPhaseTimer -= dt;
      if (this.soloPhaseTimer <= 0) {
        if (this.soloTeam1Rounds >= 2 || this.soloTeam2Rounds >= 2) {
          this.soloPhase = 'match_over';
          this.emitHud();
        } else {
          this.soloRound += 1;
          this.soloRoundTime = 90;
          this.soloPhase = 'intro';
          this.soloPhaseTimer = 1.0;
          this.actors.forEach((a) => {
            a.hp = a.maxHp;
            a.stamina = a.maxStamina;
            a.x = a.team === 1 ? -7.5 : 7.5;
            a.y = 0;
            a.z = 0;
            a.vx = 0;
            a.vz = 0;
            a.vy = 0;
            a.yaw = a.team === 1 ? Math.PI / 2 : -Math.PI / 2;
            a.action = 'idle';
            a.blocking = false;
            a.telegraphTimer = 0;
            a.telegraphType = null;
          });
          this.telegraphRing.visible = false;
        }
      }
      return;
    }

    if (this.soloPhase === 'match_over') return;

    this.soloRoundTime = Math.max(0, this.soloRoundTime - dt);

    for (const actor of this.actors) {
      if (actor.hitFlash > 0) actor.hitFlash = Math.max(0, actor.hitFlash - dt * 5);
      if (actor.hp <= 0) {
        actor.action = 'ko';
        continue;
      }

      if (actor.invulnTimer > 0) actor.invulnTimer = Math.max(0, actor.invulnTimer - dt);
      if (actor.parryWindow > 0) actor.parryWindow = Math.max(0, actor.parryWindow - dt);
      if (actor.comboResetTimer > 0) {
        actor.comboResetTimer -= dt;
        if (actor.comboResetTimer <= 0) {
          actor.comboStep = 0;
          actor.comboCount = 0;
        }
      }

      if (actor.action === 'idle' || actor.action === 'move') {
        actor.stamina = Math.min(actor.maxStamina, actor.stamina + 20 * dt);
      } else if (actor.blocking) {
        actor.stamina = Math.max(0, actor.stamina - 7 * dt);
        if (actor.stamina <= 0) {
          actor.blocking = false;
          actor.action = 'idle';
        }
      }

      // Gravity
      if (actor.y > 0 || actor.vy !== 0) {
        actor.vy -= 26 * dt;
        actor.y += actor.vy * dt;
        if (actor.y <= 0) {
          actor.y = 0;
          actor.vy = 0;
        }
      }

      // AI Decision for Boss / Skirmish Opponent
      if (!actor.isPlayer) {
        this.stepAiActor(actor, dt);
      } else {
        // Player blocking via KeyF
        const wantBlock = Boolean(this.keys['KeyF']) && (actor.action === 'idle' || actor.action === 'move' || actor.action === 'block');
        if (wantBlock && !actor.blocking && actor.stamina >= 10) {
          actor.blocking = true;
          actor.parryWindow = 0.25;
          actor.action = 'block';
        } else if (!wantBlock && actor.blocking) {
          actor.blocking = false;
          if (actor.action === 'block') actor.action = 'idle';
        }
      }

      // Action state progression & hit detection
      if (actor.action === 'light' || actor.action === 'heavy' || actor.action === 'special' || actor.action === 'dodge' || actor.action === 'hit') {
        actor.actionTimer -= dt;
        if ((actor.action === 'light' || actor.action === 'heavy' || actor.action === 'special') && !actor.hitDidConnect) {
          const threshold = actor.action === 'light' ? 0.14 : actor.action === 'heavy' ? 0.22 : 0.28;
          if (actor.actionTimer <= threshold) {
            actor.hitDidConnect = true;
            this.resolveLocalAttackHit(actor);
          }
        }
        if (actor.actionTimer <= 0) {
          actor.action = actor.blocking ? 'block' : 'idle';
        }
      }

      // Movement
      if (actor.action === 'dodge' || actor.action === 'hit') {
        actor.x += actor.vx * dt;
        actor.z += actor.vz * dt;
        actor.vx *= Math.pow(0.08, dt);
        actor.vz *= Math.pow(0.08, dt);
      } else if (actor.isPlayer && (actor.action === 'idle' || actor.action === 'move')) {
        const move = this.getCameraRelativeMove();
        const spd = 5.6 + ((actor.fighterDef?.stats.speed ?? 70) / 100) * 3.8;
        if (Math.hypot(move.x, move.z) > 0.05) {
          actor.x += move.x * spd * dt;
          actor.z += move.z * spd * dt;
          actor.yaw = Math.atan2(move.x, move.z);
          actor.action = 'move';
        } else {
          actor.action = 'idle';
        }
      }

      // Keep inside natural arena radius
      const dist = Math.hypot(actor.x, actor.z);
      const maxR = arena.radius - 1.4;
      if (dist > maxR) {
        actor.x = (actor.x / dist) * maxR;
        actor.z = (actor.z / dist) * maxR;
      }
    }

    // Round end check
    const player = this.actors.find((a) => a.team === 1)!;
    const enemy = this.actors.find((a) => a.team === 2)!;
    if (player.hp <= 0 || enemy.hp <= 0 || this.soloRoundTime <= 0) {
      const t1Win = enemy.hp <= 0 || (player.hp > 0 && this.soloRoundTime <= 0 && player.hp / player.maxHp >= enemy.hp / enemy.maxHp);
      if (t1Win) {
        this.soloTeam1Rounds += 1;
        player.action = 'victory';
      } else {
        this.soloTeam2Rounds += 1;
        enemy.action = 'victory';
      }
      this.soloPhase = 'round_over';
      this.soloPhaseTimer = 2.2;
      this.telegraphRing.visible = false;
      soundEngine.playVictory();
    }
  }

  private stepAiActor(actor: LocalActor, dt: number): void {
    const player = this.actors.find((a) => a.isPlayer);
    if (!player || player.hp <= 0) return;

    // Boss multi-phase escalation
    if (actor.isBoss && actor.bossDef) {
      const hpRatio = actor.hp / actor.maxHp;
      const nextPhase = hpRatio < 0.3 ? 3 : hpRatio < 0.62 ? 2 : 1;
      if (nextPhase > actor.bossPhase) {
        actor.bossPhase = nextPhase;
        this.spawnParticles(actor.x, 1.6, actor.z, actor.bossDef.visual.auraColor, 32);
        soundEngine.playBossRoar();
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.45);
      }
    }

    // Telegraph windup for boss special attacks
    if (actor.telegraphTimer > 0) {
      actor.telegraphTimer -= dt;
      this.telegraphRing.visible = true;
      this.telegraphRing.position.set(actor.x, 0.06, actor.z);
      const scalePulse = 1 + Math.sin(this.elapsed * 20) * 0.08;
      this.telegraphRing.scale.setScalar(scalePulse);
      if (actor.telegraphTimer <= 0) {
        this.telegraphRing.visible = false;
        actor.telegraphType = null;
        actor.action = 'special';
        actor.actionDuration = 0.56;
        actor.actionTimer = 0.56;
        actor.hitDidConnect = false;
        this.spawnParticles(actor.x, 1.3, actor.z, actor.bossDef?.visual.auraColor || '#ff5722', 30);
        soundEngine.playSpecialCast();
      }
      return;
    }

    const dx = player.x - actor.x;
    const dz = player.z - actor.z;
    const dist = Math.hypot(dx, dz);
    const dirX = dist > 0.01 ? dx / dist : 0;
    const dirZ = dist > 0.01 ? dz / dist : 1;

    if (actor.action === 'idle' || actor.action === 'move' || actor.action === 'block') {
      actor.yaw = Math.atan2(dirX, dirZ);
      actor.aiCooldown = Math.max(0, actor.aiCooldown - dt);

      const spdMult = actor.isBoss
        ? (actor.bossDef?.speed ?? 1) * (1 + (actor.bossPhase - 1) * 0.14)
        : 0.72 + ((actor.fighterDef?.stats.speed ?? 65) / 100) * 0.35;
      const moveSpeed = 5.4 * spdMult;

      if (dist > 2.55) {
        actor.blocking = false;
        actor.x += dirX * moveSpeed * dt;
        actor.z += dirZ * moveSpeed * dt;
        actor.action = 'move';
      } else {
        actor.action = actor.blocking ? 'block' : 'idle';
        if (actor.aiCooldown <= 0) {
          const roll = Math.random();
          if (actor.isBoss && roll < 0.24 + (actor.bossPhase - 1) * 0.12 && actor.stamina >= 30) {
            // Telegraph boss special!
            actor.stamina -= 30;
            actor.telegraphType = 'nova';
            actor.telegraphTimer = Math.max(0.55, 0.9 - (actor.bossPhase - 1) * 0.15);
            actor.aiCooldown = 1.6;
          } else if (roll < 0.42 && player.action !== 'idle' && player.action !== 'move') {
            actor.blocking = true;
            actor.action = 'block';
            actor.aiCooldown = 0.55;
          } else if (roll < 0.72) {
            actor.blocking = false;
            actor.action = 'light';
            actor.actionDuration = 0.32;
            actor.actionTimer = 0.32;
            actor.hitDidConnect = false;
            actor.aiCooldown = actor.isBoss ? Math.max(0.45, 0.85 - actor.bossPhase * 0.12) : 0.9;
            soundEngine.playSwing(false);
          } else {
            actor.blocking = false;
            actor.action = 'heavy';
            actor.actionDuration = 0.5;
            actor.actionTimer = 0.5;
            actor.hitDidConnect = false;
            actor.aiCooldown = 1.15;
            soundEngine.playSwing(true);
          }
        }
      }
    }
  }

  private resolveLocalAttackHit(attacker: LocalActor): void {
    const reach = attacker.action === 'special' ? 4.8 : attacker.action === 'heavy' ? 3.2 : 2.75;
    const fwdX = Math.sin(attacker.yaw);
    const fwdZ = Math.cos(attacker.yaw);

    // Check destructibles
    if (attacker.isPlayer && this.builtArena) {
      for (const prop of this.builtArena.destructibles) {
        if (prop.destroyed) continue;
        const d = Math.hypot(prop.x - attacker.x, prop.z - attacker.z);
        if (d <= reach + 0.8) {
          prop.destroyed = true;
          prop.mesh.visible = false;
          this.soloStats.objectsDestroyed += 1;
          attacker.stamina = Math.min(attacker.maxStamina, attacker.stamina + 18);
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + 12);
          this.spawnParticles(prop.x, 0.7, prop.z, '#d9b573', 18);
          soundEngine.playShatter();
        }
      }
    }

    for (const target of this.actors) {
      if (target.team === attacker.team || target.hp <= 0 || target.invulnTimer > 0) continue;
      const dx = target.x - attacker.x;
      const dz = target.z - attacker.z;
      const dist = Math.hypot(dx, dz);
      if (dist > reach) continue;
      const dot = dist > 0.01 ? (dx / dist) * fwdX + (dz / dist) * fwdZ : 1;
      if (attacker.action !== 'special' && dot < 0.2) continue;

      // Timed Parry!
      if (target.blocking && target.parryWindow > 0 && attacker.action !== 'special') {
        if (target.isPlayer) this.soloStats.parriesLanded += 1;
        attacker.action = 'hit';
        attacker.actionDuration = 0.6;
        attacker.actionTimer = 0.6;
        attacker.vx = -fwdX * 5.5;
        attacker.vz = -fwdZ * 5.5;
        this.hitstopTimer = 0.065;
        this.spawnParticles(target.x, 1.3, target.z, '#ffe875', 24);
        soundEngine.playParry();
        continue;
      }

      const strVal = attacker.isBoss
        ? attacker.bossDef!.attackPower * 2.1 * (1 + (attacker.bossPhase - 1) * 0.12)
        : attacker.fighterDef?.stats.strength ?? 68;
      const defVal = target.isBoss ? target.bossDef!.defense : target.fighterDef?.stats.defense ?? 65;

      const baseDmg = attacker.action === 'special' ? 28 : attacker.action === 'heavy' ? 21 : 12 + attacker.comboStep * 2;
      const strMult = 0.75 + (strVal / 100) * 0.55;
      const defMult = 1 - (defVal / 100) * 0.34;
      let dmg = Math.max(4, Math.round(baseDmg * strMult * defMult));

      const wasBlocked = target.blocking && attacker.action !== 'heavy';
      if (wasBlocked) {
        dmg = Math.max(2, Math.round(dmg * 0.22));
        target.stamina = Math.max(0, target.stamina - 14);
        soundEngine.playHit('blocked');
        this.spawnParticles(target.x, 1.2, target.z, '#7ce8ff', 10);
      } else {
        target.action = 'hit';
        target.actionDuration = attacker.action === 'heavy' || attacker.action === 'special' ? 0.35 : 0.22;
        target.actionTimer = target.actionDuration;
        target.hitFlash = 1;
        const knock = attacker.action === 'special' ? 8.5 : attacker.action === 'heavy' ? 6.0 : 3.2;
        target.vx = fwdX * knock;
        target.vz = fwdZ * knock;

        if (attacker.action === 'heavy' || attacker.action === 'special') {
          this.hitstopTimer = 0.055;
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.38);
        } else {
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.14);
        }
        soundEngine.playHit(attacker.action as 'light' | 'heavy' | 'special');
        this.spawnParticles(
          target.x,
          1.2,
          target.z,
          attacker.action === 'special' ? attacker.fighterDef?.visual.auraColor || '#ffaa33' : '#ff4757',
          attacker.action === 'special' ? 24 : 14,
        );
      }

      target.hp = Math.max(0, target.hp - dmg);
      attacker.comboCount += 1;
      attacker.comboResetTimer = 2.2;
      if (attacker.isPlayer) {
        if (attacker.comboCount === 3) this.soloStats.combosLanded += 1;
        if (attacker.action === 'special') this.soloStats.specialsHit += 1;
      }
    }
  }

  private emitHud(): void {
    if (!this.onHudUpdate) return;
    if (this.mode === 'solo') {
      const player = this.actors.find((a) => a.isPlayer);
      const enemy = this.actors.find((a) => !a.isPlayer);
      const cIdx = Math.min(2, Math.max(0, (player?.comboCount ?? 1) - 1));
      const comboLabel = player?.fighterDef?.comboNames[cIdx] ?? 'Strike';
      this.onHudUpdate({
        mode: 'solo',
        phase: this.soloPhase,
        round: this.soloRound,
        team1Rounds: this.soloTeam1Rounds,
        team2Rounds: this.soloTeam2Rounds,
        roundTimeLeft: Math.ceil(this.soloRoundTime),
        bossName: this.currentBoss?.name,
        bossSubtitle: this.currentBoss ? `Boss ${this.currentBoss.index} · ${this.currentBoss.difficultyLabel}` : undefined,
        bossPhase: enemy?.bossPhase,
        bossIntroLine: this.currentBoss?.introLine,
        comboCount: player?.comboCount ?? 0,
        comboLabel,
        telegraphWarning: enemy?.telegraphTimer && enemy.telegraphTimer > 0 ? 'INCOMING BOSS ATTACK — DODGE (SHIFT)!' : null,
        fighters: this.actors.map((a) => ({
          id: a.key,
          name: a.name,
          team: a.team,
          hp: a.hp,
          maxHp: a.maxHp,
          stamina: a.stamina,
          maxStamina: a.maxStamina,
          isLocal: a.isPlayer,
        })),
        soloResult:
          this.soloPhase === 'match_over'
            ? {
                won: this.soloTeam1Rounds > this.soloTeam2Rounds,
                roundsWon: this.soloTeam1Rounds,
                roundsLost: this.soloTeam2Rounds,
                ...this.soloStats,
              }
            : undefined,
      });
    } else if ((this.mode === 'online' || this.mode === 'spectate') && this.onlineSnapshot) {
      const s = this.onlineSnapshot;
      const localF = s.fighters[this.localUserId];
      const def = localF ? getFighterById(localF.fighterId) : undefined;
      const cIdx = Math.min(2, Math.max(0, (localF?.comboCount ?? 1) - 1));
      this.onHudUpdate({
        mode: this.mode,
        phase: s.phase,
        round: s.round,
        team1Rounds: s.team1Rounds,
        team2Rounds: s.team2Rounds,
        roundTimeLeft: Math.ceil(s.roundTimeLeft),
        comboCount: localF?.comboCount ?? 0,
        comboLabel: def?.comboNames[cIdx] ?? 'Strike',
        telegraphWarning: null,
        fighters: Object.values(s.fighters).map((f) => ({
          id: String(f.userId),
          name: f.username,
          team: f.team,
          hp: f.hp,
          maxHp: f.maxHp,
          stamina: f.stamina,
          maxStamina: f.maxStamina,
          isLocal: f.userId === this.localUserId,
        })),
      });
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    if (this.builtArena) {
      this.builtArena.update(this.elapsed, dt);
    }

    // Update particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life / p.maxLife;
    }

    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.2);
    }

    if (this.mode === 'title') {
      // Atmospheric live-world camera orbit
      const t = this.elapsed * 0.16;
      _camPos.set(Math.cos(t) * 14, 5.2 + Math.sin(t * 1.5) * 0.8, Math.sin(t) * 14);
      this.camera.position.lerp(_camPos, 1 - Math.exp(-5 * dt));
      this.camera.lookAt(0, 1.5, 0);
      this.actors.forEach((a, idx) => {
        a.rig.root.position.set(a.x, 0, a.z);
        a.rig.root.rotation.y = a.yaw;
        animateCharacterRig(a.rig, 'idle', this.elapsed + idx * 1.1, 0, 0, 0);
      });
    } else if (this.mode === 'showcase') {
      const actor = this.actors[0];
      if (actor) {
        actor.yaw += dt * 0.55;
        actor.rig.root.position.set(0, 0, 0);
        actor.rig.root.rotation.y = actor.yaw;
        animateCharacterRig(actor.rig, 'idle', this.elapsed, 0, 0, 0);
      }
      _camPos.set(0, 1.55, 4.1);
      this.camera.position.lerp(_camPos, 1 - Math.exp(-6 * dt));
      this.camera.lookAt(0, 1.1, 0);
    } else if (this.mode === 'solo') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.stepSolo(dt);
      }

      this.actors.forEach((a) => {
        a.rig.root.position.set(a.x, a.y, a.z);
        a.rig.root.rotation.y = a.yaw;
        const prog = a.actionDuration > 0 ? 1 - Math.max(0, a.actionTimer) / a.actionDuration : 0;
        animateCharacterRig(a.rig, a.action, this.elapsed, prog, a.y, a.hitFlash);
      });

      const player = this.actors.find((a) => a.isPlayer);
      const enemy = this.actors.find((a) => !a.isPlayer);

      if (this.soloPhase === 'intro' && this.currentBoss && enemy) {
        // Cinematic boss intro sweep!
        const t = 1 - Math.min(1, this.soloPhaseTimer / 2.6);
        const sweepAng = -0.7 + t * 1.4;
        _camPos.set(
          enemy.x + Math.sin(sweepAng) * 5.8,
          2.6 + Math.sin(t * Math.PI) * 1.2,
          enemy.z + Math.cos(sweepAng) * 5.8,
        );
        this.camera.position.lerp(_camPos, 1 - Math.exp(-8 * dt));
        this.camera.lookAt(enemy.x, 1.9, enemy.z);
      } else if (player) {
        this.updateCombatCamera(player.x, player.y, player.z, dt);
      }

      if (this.elapsed - this.lastHudEmit > 0.06) {
        this.lastHudEmit = this.elapsed;
        this.emitHud();
      }
    } else if (this.mode === 'online' || this.mode === 'spectate') {
      if (this.mode === 'online' && this.elapsed - this.lastInputSend > 0.033) {
        this.lastInputSend = this.elapsed;
        this.emitOnlineControls();
      }

      this.onlineRigs.forEach((entry) => {
        entry.hitFlash = Math.max(0, entry.hitFlash - dt * 5);
        entry.rig.root.position.x = THREE.MathUtils.damp(entry.rig.root.position.x, entry.targetX, 18, dt);
        entry.rig.root.position.y = THREE.MathUtils.damp(entry.rig.root.position.y, entry.targetY, 18, dt);
        entry.rig.root.position.z = THREE.MathUtils.damp(entry.rig.root.position.z, entry.targetZ, 18, dt);
        // Smooth angular interpolation
        let diff = entry.targetYaw - entry.rig.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        entry.rig.root.rotation.y += diff * Math.min(1, dt * 16);
        animateCharacterRig(entry.rig, entry.action, this.elapsed, 0.5, entry.rig.root.position.y, entry.hitFlash);
      });

      const localEntry = this.onlineRigs.get(this.localUserId);
      if (this.mode === 'online' && localEntry) {
        this.updateCombatCamera(localEntry.rig.root.position.x, localEntry.rig.root.position.y, localEntry.rig.root.position.z, dt);
      } else {
        // Spectator free-orbit camera
        const ang = this.camYaw;
        _camPos.set(Math.sin(ang) * this.camDist, 6.5 + this.camPitch * 8, Math.cos(ang) * this.camDist);
        this.camera.position.lerp(_camPos, 1 - Math.exp(-8 * dt));
        this.camera.lookAt(0, 1.5, 0);
      }

      if (this.elapsed - this.lastHudEmit > 0.08) {
        this.lastHudEmit = this.elapsed;
        this.emitHud();
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private updateCombatCamera(tx: number, ty: number, tz: number, dt: number): void {
    const horiz = Math.cos(this.camPitch) * this.camDist;
    const vert = Math.sin(this.camPitch) * this.camDist + 2.2;
    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    _camPos.set(tx + Math.sin(this.camYaw) * horiz + shakeX, ty + vert + shakeY, tz + Math.cos(this.camYaw) * horiz);
    this.camera.position.lerp(_camPos, 1 - Math.exp(-12 * dt));
    _camTarget.set(tx, ty + 1.45, tz);
    this.camera.lookAt(_camTarget);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    this.clock.start();
    this.tick();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      this.triggerAction('jump');
    } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.triggerAction('dodge');
    } else if (e.code === 'KeyE') {
      this.triggerAction('special');
    } else if (e.code === 'KeyJ') {
      this.triggerAction('light');
    } else if (e.code === 'KeyK') {
      this.triggerAction('heavy');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onBlur = () => {
    this.keys = {};
    this.mobileMoveX = 0;
    this.mobileMoveY = 0;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.mode !== 'solo' && this.mode !== 'online' && this.mode !== 'spectate') return;
    soundEngine.unlock();
    if (e.button === 0) {
      this.isPointerDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (this.mode !== 'spectate' && e.pointerType === 'mouse') {
        this.triggerAction('light');
      }
    } else if (e.button === 2) {
      this.triggerAction('heavy');
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (document.pointerLockElement === this.renderer.domElement) {
      this.camYaw -= e.movementX * 0.0045;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0035, 0.12, 0.85);
      return;
    }
    if (!this.isPointerDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.camYaw -= dx * 0.006;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, 0.12, 0.85);
  };

  private onPointerUp = () => {
    this.isPointerDragging = false;
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.mode === 'solo' || this.mode === 'online') {
      e.preventDefault();
    }
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('contextmenu', this.onContextMenu);

    if (this.builtArena) this.builtArena.dispose();
    this.shadowTex.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
