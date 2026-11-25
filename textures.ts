import * as THREE from 'three';

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createArenaFloorTexture(baseHex: string, accentHex: string, maxAnisotropy: number, style: 'stone' | 'earth' | 'sand' | 'volcano'): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Organic grain
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 3.5;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.065)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (style === 'stone') {
    // Ancient stone ring carvings
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 3;
    for (let r = 64; r <= 240; r += 60) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(size / 2 + Math.cos(ang) * 64, size / 2 + Math.sin(ang) * 64);
      ctx.lineTo(size / 2 + Math.cos(ang) * 244, size / 2 + Math.sin(ang) * 244);
      ctx.stroke();
    }
    ctx.strokeStyle = accentHex;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 184, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (style === 'volcano') {
    // Glowing magma cracks
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 18; i++) {
      let cx = Math.random() * size;
      let cy = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) {
        cx += (Math.random() - 0.5) * 90;
        cy += (Math.random() - 0.5) * 90;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    // Subtle natural combat ring indicator
    ctx.strokeStyle = accentHex;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 200, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createWaterTexture(waterHex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = waterHex;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 420; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 12 + Math.random() * 26;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, w, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCharacterSurfaceTexture(style: 'armor' | 'cloth' | 'scales'): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(0, 0, size, size);

  if (style === 'armor') {
    // Brushed metallic grain & micro-rivet trim
    for (let y = 0; y < size; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, size, 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, size - 8, size - 8);
  } else if (style === 'scales') {
    // Layered draconic / lamellar armor plates
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 16 + (row % 2) * 8;
        const y = row * 16;
        ctx.fillStyle = (row + col) % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)';
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  } else {
    // Woven martial fabric / leather crosshatch
    for (let i = 0; i < size; i += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.09)';
      ctx.fillRect(i, 0, 1, size);
      ctx.fillRect(0, i, size, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

