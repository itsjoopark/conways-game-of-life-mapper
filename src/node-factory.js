import * as THREE from 'three';

// ===== Glass Mode State =====
let isGlassMode = false;

export function setGlassMode(enabled) {
  isGlassMode = enabled;
}

export function getGlassMode() {
  return isGlassMode;
}

// ===== Color Palette - User specified with DARKER, bold colors =====
// FB522E (coral-red), 214175 (dark blue), FFCB64 (gold), 5D9F59 (green), FF8992 (pink)
const PALETTES = {
  // Coral Red - darker, more saturated
  coralBright: { inner: '#FF6040', outer: '#D03010' },
  coralDeep: { inner: '#FF5030', outer: '#B02008' },
  coralIntense: { inner: '#FF4828', outer: '#C82810' },
  
  // Dark Blue - deeper
  blueBright: { inner: '#4878C0', outer: '#183060' },
  blueDeep: { inner: '#3868B0', outer: '#102550' },
  blueIntense: { inner: '#3060A8', outer: '#142858' },
  
  // Gold/Yellow - richer
  goldBright: { inner: '#FFD060', outer: '#D8A020' },
  goldDeep: { inner: '#FFC840', outer: '#C89010' },
  goldIntense: { inner: '#FFB830', outer: '#B88008' },
  
  // Green - deeper forest tones
  greenBright: { inner: '#68B860', outer: '#408838' },
  greenDeep: { inner: '#58A850', outer: '#307828' },
  greenIntense: { inner: '#50A048', outer: '#287020' },
  
  // Pink - more vivid
  pinkBright: { inner: '#FF90A0', outer: '#E05068' },
  pinkDeep: { inner: '#FF7890', outer: '#D04058' },
  pinkIntense: { inner: '#FF6080', outer: '#C03048' }
};

const PALETTE_KEYS = Object.keys(PALETTES);

// ===== Create Node (dispatches to soft gradient or glass based on mode) =====
export function createFloralNode(nodeData, index) {
  if (isGlassMode) {
    return createGlassNode(nodeData, index);
  }
  return createSoftGradientNode(nodeData, index);
}

// ===== Create Soft Gradient Node =====
function createSoftGradientNode(nodeData, index) {
  const group = new THREE.Group();
  
  // Choose a random palette for this node - fully random for diversity
  const paletteKey = PALETTE_KEYS[Math.floor(Math.random() * PALETTE_KEYS.length)];
  const palette = PALETTES[paletteKey];
  
  // Determine node size based on connections
  const connectionCount = nodeData.connections?.length || 0;
  const baseSize = 8 + Math.min(connectionCount * 1.5, 20);
  
  // Create soft gradient sprite
  const gradientSprite = createSoftGradientSprite(palette, baseSize);
  group.add(gradientSprite);
  
  // Set initial position
  group.position.set(nodeData.x, nodeData.y, nodeData.z);
  
  // Store metadata
  group.userData.palette = palette;
  group.userData.paletteKey = paletteKey;
  group.userData.baseSize = baseSize;
  group.userData.isGlass = false;
  
  return group;
}

// ===== Create Glass Node (Soft Frosted Glass Style - Matching Figma Reference) =====
function createGlassNode(nodeData, index) {
  const group = new THREE.Group();
  
  // Choose palette for subtle color tinting
  const paletteKey = PALETTE_KEYS[Math.floor(Math.random() * PALETTE_KEYS.length)];
  const palette = PALETTES[paletteKey];
  
  // Determine node size based on connections
  const connectionCount = nodeData.connections?.length || 0;
  const baseSize = 8 + Math.min(connectionCount * 1.5, 20);
  
  // Create frosted glass sprite using canvas
  const glassSprite = createFrostedGlassSprite(palette, baseSize);
  group.add(glassSprite);
  
  // Set initial position
  group.position.set(nodeData.x, nodeData.y, nodeData.z);
  
  // Store metadata
  group.userData.palette = palette;
  group.userData.paletteKey = paletteKey;
  group.userData.baseSize = baseSize;
  group.userData.isGlass = true;
  
  return group;
}

// ===== Create Frosted Glass Sprite (Soft, Matte - 2X Darker & More Visible) =====
function createFrostedGlassSprite(palette, size) {
  const canvas = document.createElement('canvas');
  const resolution = 256;
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  
  const centerX = resolution / 2;
  const centerY = resolution / 2;
  const maxRadius = resolution / 2;
  
  // Parse colors - use both inner and outer for more depth
  const baseColor = hexToRgb(palette.inner);
  const outerColor = hexToRgb(palette.outer);
  
  // Create frosted glass gradient - 2X DARKER with strong color presence
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, maxRadius
  );
  
  // Much darker, highly visible glass effect - strong color saturation
  gradient.addColorStop(0, `rgba(${lerp(255, baseColor.r, 0.4)}, ${lerp(255, baseColor.g, 0.4)}, ${lerp(255, baseColor.b, 0.4)}, 1)`);
  gradient.addColorStop(0.08, `rgba(${lerp(240, baseColor.r, 0.6)}, ${lerp(240, baseColor.g, 0.6)}, ${lerp(240, baseColor.b, 0.6)}, 1)`);
  gradient.addColorStop(0.2, `rgba(${lerp(200, baseColor.r, 0.75)}, ${lerp(200, baseColor.g, 0.75)}, ${lerp(200, baseColor.b, 0.75)}, 0.98)`);
  gradient.addColorStop(0.4, `rgba(${lerp(160, baseColor.r, 0.8)}, ${lerp(160, baseColor.g, 0.8)}, ${lerp(160, baseColor.b, 0.8)}, 0.92)`);
  gradient.addColorStop(0.55, `rgba(${lerp(140, outerColor.r, 0.7)}, ${lerp(140, outerColor.g, 0.7)}, ${lerp(140, outerColor.b, 0.7)}, 0.8)`);
  gradient.addColorStop(0.7, `rgba(${lerp(120, outerColor.r, 0.6)}, ${lerp(120, outerColor.g, 0.6)}, ${lerp(120, outerColor.b, 0.6)}, 0.55)`);
  gradient.addColorStop(0.85, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0.25)`);
  gradient.addColorStop(0.95, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0.08)`);
  gradient.addColorStop(1, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0)`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, resolution, resolution);
  
  // Add inner highlight for glass-like depth (smaller, more subtle for darker look)
  const highlightGradient = ctx.createRadialGradient(
    centerX * 0.6, centerY * 0.6, 0,
    centerX * 0.8, centerY * 0.8, maxRadius * 0.35
  );
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  highlightGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.25)');
  highlightGradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = highlightGradient;
  ctx.fillRect(0, 0, resolution, resolution);
  
  // Add stronger shadow at bottom for 3D depth
  ctx.globalCompositeOperation = 'multiply';
  const shadowGradient = ctx.createRadialGradient(
    centerX * 1.2, centerY * 1.3, maxRadius * 0.15,
    centerX, centerY, maxRadius * 0.8
  );
  shadowGradient.addColorStop(0, `rgba(${outerColor.r * 0.4}, ${outerColor.g * 0.4}, ${outerColor.b * 0.4}, 0.5)`);
  shadowGradient.addColorStop(0.35, `rgba(${outerColor.r * 0.5}, ${outerColor.g * 0.5}, ${outerColor.b * 0.5}, 0.2)`);
  shadowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = shadowGradient;
  ctx.fillRect(0, 0, resolution, resolution);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Create sprite material - full opacity
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size * 2.5, size * 2.5, 1);
  
  return sprite;
}

// ===== Create Soft Gradient Sprite =====
function createSoftGradientSprite(palette, size) {
  const canvas = document.createElement('canvas');
  const resolution = 256;
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  
  const centerX = resolution / 2;
  const centerY = resolution / 2;
  const maxRadius = resolution / 2;
  
  // Parse colors
  const innerColor = hexToRgb(palette.inner);
  const outerColor = hexToRgb(palette.outer);
  
  // Create multi-stop radial gradient with BOLD inner core
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, maxRadius
  );
  
  // Bold inner core that fades to darker outer - shader-like effect
  gradient.addColorStop(0, `rgba(${innerColor.r}, ${innerColor.g}, ${innerColor.b}, 1)`);
  gradient.addColorStop(0.08, `rgba(${innerColor.r}, ${innerColor.g}, ${innerColor.b}, 0.98)`);
  gradient.addColorStop(0.2, `rgba(${innerColor.r}, ${innerColor.g}, ${innerColor.b}, 0.95)`);
  gradient.addColorStop(0.35, `rgba(${lerp(innerColor.r, outerColor.r, 0.5)}, ${lerp(innerColor.g, outerColor.g, 0.5)}, ${lerp(innerColor.b, outerColor.b, 0.5)}, 0.9)`);
  gradient.addColorStop(0.5, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0.8)`);
  gradient.addColorStop(0.65, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0.55)`);
  gradient.addColorStop(0.8, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0.25)`);
  gradient.addColorStop(0.92, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0.08)`);
  gradient.addColorStop(1, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0)`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, resolution, resolution);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Create sprite material
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size * 2.5, size * 2.5, 1);
  
  return sprite;
}

// ===== Helper: Hex to RGB =====
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

// ===== Helper: Linear interpolation =====
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// ===== Update Node Animation =====
export function updateNodeAnimation(node, currentTime) {
  const userData = node.userData;
  
  // Initialize currentOpacity if not set
  if (userData.currentOpacity === undefined) {
    userData.currentOpacity = 1;
  }
  
  // Smooth opacity transitions - ONLY for dead nodes
  if (!userData.alive && userData.deathTime) {
    const opacitySpeed = 0.015; // Very slow fade
    const targetOpacity = 0;
    
    if (userData.currentOpacity > 0.01) {
      userData.currentOpacity = userData.currentOpacity + (targetOpacity - userData.currentOpacity) * opacitySpeed;
    } else {
      userData.currentOpacity = 0;
    }
  } else {
    // Alive nodes always have full opacity
    userData.currentOpacity = 1;
    userData.targetOpacity = 1;
  }
  
  // Apply opacity to all child materials (sprites or meshes)
  const opacity = userData.currentOpacity;
  node.children.forEach(child => {
    if (child.material) {
      if (userData.isGlass) {
        // For glass nodes, adjust transmission-based opacity
        if (child.material.transmission !== undefined) {
          child.material.opacity = opacity;
        } else {
          child.material.opacity = opacity * (child.material.userData?.baseOpacity || child.material.opacity);
        }
      } else {
        child.material.opacity = opacity;
      }
      child.material.needsUpdate = true;
    }
  });
  
  // Gentle floating animation for alive nodes
  if (userData.alive) {
    const birthTime = userData.birthTime || 0;
    const age = (currentTime - birthTime) * 0.001;
    const floatOffset = Math.sin(age * 0.3 + node.position.x * 0.008) * 0.4;
    if (userData.lastFloatOffset === undefined) {
      userData.lastFloatOffset = 0;
    }
    const floatDelta = (floatOffset - userData.lastFloatOffset) * 0.03;
    node.position.z += floatDelta;
    userData.lastFloatOffset = floatOffset;
  }
  
  // Scale animation on birth
  if (userData.alive && userData.birthTime && currentTime - userData.birthTime < 800) {
    const progress = (currentTime - userData.birthTime) / 800;
    const scale = easeOutElastic(Math.min(progress, 1));
    node.scale.setScalar(Math.max(0.1, scale));
  } else if (userData.alive) {
    // Very gentle breathing effect
    const breathe = 1 + Math.sin(currentTime * 0.0008 + node.position.x * 0.05) * 0.03;
    node.scale.setScalar(breathe);
  }
  
  // Slow shrink on death
  if (!userData.alive && userData.deathTime) {
    const deathProgress = (currentTime - userData.deathTime) / 3000; // Very slow death
    if (deathProgress < 1) {
      const scale = 1 - easeInQuad(Math.min(deathProgress, 1)) * 0.6;
      node.scale.setScalar(Math.max(0.4, scale));
    } else {
      node.scale.setScalar(0.4);
    }
  }
  
  // Make node visible
  node.visible = userData.currentOpacity > 0.01 || userData.alive;
}

// ===== Easing Functions =====
function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 :
    Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeInQuad(t) {
  return t * t;
}
