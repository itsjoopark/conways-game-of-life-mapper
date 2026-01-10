import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFloralNode, updateNodeAnimation } from './node-factory.js';
import { ForceDirectedGraph } from './graph-layout.js';
import { GameOfLifeSimulation } from './simulation.js';

// ===== Configuration =====
const CONFIG = {
  backgroundColor: 0xF0EEE9,
  nodeCount: 50,
  speed: 2.0,
  connectionDistance: 120,
  repulsion: 50,
  autoRotate: false,
  showConnections: true,
  simulationInterval: 2000 // ms between generations (faster growth)
};

// ===== Scene Setup =====
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.backgroundColor);

// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.1,
  2000
);
camera.position.set(0, 0, 400);

// Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.8;
controls.minDistance = 100;
controls.maxDistance = 800;
controls.autoRotate = CONFIG.autoRotate;
controls.autoRotateSpeed = 0.5;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
directionalLight.position.set(100, 100, 100);
scene.add(directionalLight);

// ===== State Management =====
let nodes = [];
let connections = [];
let connectionLines = [];
let graph = null;
let simulation = null;
let isPlaying = true;
let lastSimulationTime = 0;
let generation = 0;

// ===== Audio Context for Classical Sound =====
let audioContext = null;
let soundEnabled = true;

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Classical piano-like note when cell is born
function playBirthNote() {
  if (!audioContext || !soundEnabled) return;
  
  // Resume context if suspended
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  const now = audioContext.currentTime;
  
  // Major scale notes (C major) for pleasant sound
  const majorScale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
  const freq = majorScale[Math.floor(Math.random() * majorScale.length)];
  
  // Create oscillators for rich piano-like tone
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  
  // Piano-like waveforms
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(freq, now);
  
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, now); // Octave harmonic
  
  // Warm filter
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500, now);
  filter.Q.setValueAtTime(0.5, now);
  
  // Soft envelope - not too loud
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.08, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  
  // Create gain for second oscillator (quieter)
  const osc2Gain = audioContext.createGain();
  osc2Gain.gain.setValueAtTime(0.02, now);
  
  // Connect nodes
  osc1.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Play
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 1.2);
  osc2.stop(now + 1.2);
}

// ===== Raycaster for Click Detection =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let tooltipTimeout = null;

// ===== Drag State =====
let isDragging = false;
let draggedNode = null;
let dragPlane = new THREE.Plane();
let dragOffset = new THREE.Vector3();
let targetZoom = null;
let zoomAnimating = false;

// ===== 3D Label State =====
let activeLabel = null;
let activeLabelLine = null;
let activeLabelTargetNode = null;

// ===== Node & Connection Groups =====
const nodeGroup = new THREE.Group();
const connectionGroup = new THREE.Group();
scene.add(connectionGroup);
scene.add(nodeGroup);

// ===== Initialize Simulation =====
function initSimulation() {
  // Clear existing
  nodeGroup.clear();
  connectionGroup.clear();
  nodes = [];
  connections = [];
  connectionLines = [];
  generation = 0;

  // Create force-directed graph
  graph = new ForceDirectedGraph({
    nodeCount: CONFIG.nodeCount,
    connectionDistance: CONFIG.connectionDistance,
    repulsion: CONFIG.repulsion,
    bounds: 300
  });

  // Create simulation
  simulation = new GameOfLifeSimulation(graph);

  // Create visual nodes
  const now = performance.now();
  graph.nodes.forEach((nodeData, index) => {
    const floralNode = createFloralNode(nodeData, index);
    floralNode.userData.graphIndex = index;
    floralNode.userData.alive = true;
    floralNode.userData.targetOpacity = 1;
    floralNode.userData.currentOpacity = 1; // Start fully visible
    floralNode.userData.birthTime = now - 1000; // Already "born"
    floralNode.scale.setScalar(1); // Full scale
    nodes.push(floralNode);
    nodeGroup.add(floralNode);
  });

  // Create connections
  updateConnections();
  updateStats();
}

// ===== Connection Rendering =====
function updateConnections() {
  // Clear old connections
  connectionGroup.clear();
  connectionLines = [];

  if (!CONFIG.showConnections) return;

  const connectionSet = new Set();
  
  graph.nodes.forEach((node, i) => {
    if (!nodes[i].userData.alive) return;
    
    node.connections.forEach(j => {
      if (!nodes[j].userData.alive) return;
      
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (connectionSet.has(key)) return;
      connectionSet.add(key);

      const startNode = graph.nodes[i];
      const endNode = graph.nodes[j];
      
      const line = createCurvedConnection(
        new THREE.Vector3(startNode.x, startNode.y, startNode.z),
        new THREE.Vector3(endNode.x, endNode.y, endNode.z)
      );
      
      line.userData.startIndex = i;
      line.userData.endIndex = j;
      connectionLines.push(line);
      connectionGroup.add(line);
    });
  });

  connections = Array.from(connectionSet);
}

function createCurvedConnection(start, end) {
  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  
  // Add curve offset perpendicular to the line
  const direction = new THREE.Vector3().subVectors(end, start);
  const perpendicular = new THREE.Vector3(-direction.y, direction.x, direction.z * 0.3).normalize();
  const curveAmount = direction.length() * 0.12;
  midPoint.add(perpendicular.multiplyScalar(curveAmount * (Math.random() - 0.5) * 2));

  const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
  const points = curve.getPoints(24);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  
  // Red-tinted connection lines
  const material = new THREE.LineBasicMaterial({
    color: 0xC08070,
    transparent: true,
    opacity: 0.35,
    linewidth: 1,
    depthWrite: false
  });

  return new THREE.Line(geometry, material);
}

// ===== Simulation Step =====
function stepSimulation() {
  if (!simulation || !isPlaying) return;

  const changes = simulation.step();
  generation++;

  // Handle deaths - only mark as dead, let animation handle fading
  changes.deaths.forEach((index) => {
    if (nodes[index] && nodes[index].userData.alive) {
      nodes[index].userData.alive = false;
      nodes[index].userData.targetOpacity = 0;
      nodes[index].userData.deathTime = performance.now();
      // Keep visible during fade
      nodes[index].visible = true;
    }
  });

  // Handle births - play sound for each birth
  changes.births.forEach((birthData, i) => {
    const newNode = createFloralNode(birthData, nodes.length);
    newNode.userData.graphIndex = nodes.length;
    newNode.userData.alive = true;
    newNode.userData.targetOpacity = 1;
    newNode.userData.currentOpacity = 1;
    newNode.userData.birthTime = performance.now();
    newNode.scale.setScalar(0.1); // Start small, will animate to full
    newNode.visible = true;
    
    graph.addNode(birthData);
    nodes.push(newNode);
    nodeGroup.add(newNode);
    
    // Play classical note with slight delay for each birth
    setTimeout(() => playBirthNote(), i * 100);
  });

  updateConnections();
  updateStats();
}

// ===== Stats Update =====
function updateStats() {
  const livingCount = nodes.filter(n => n.userData.alive).length;
  document.getElementById('livingCount').textContent = livingCount;
  document.getElementById('generation').textContent = generation;
  document.getElementById('connectionCount').textContent = connectionLines.length;
}

// ===== Animation Loop =====
function animate(currentTime) {
  requestAnimationFrame(animate);

  // Update controls
  controls.update();
  
  // Smooth zoom animation
  updateZoom();
  
  // Smooth drag animation
  updateDragAnimation();

  // Update graph physics
  if (graph && isPlaying) {
    graph.update(CONFIG.repulsion, CONFIG.connectionDistance);
    
    // Update node positions
    nodes.forEach((node, i) => {
      if (graph.nodes[i]) {
        const target = graph.nodes[i];
        node.position.lerp(new THREE.Vector3(target.x, target.y, target.z), 0.1);
      }
    });
  }

  // Animate node opacities and effects (sprites auto-billboard)
  nodes.forEach(node => {
    updateNodeAnimation(node, currentTime);
  });
  
  // Update 3D label position to follow target node
  updateLabelPosition();

  // Step simulation at intervals
  if (isPlaying && currentTime - lastSimulationTime > CONFIG.simulationInterval / CONFIG.speed) {
    stepSimulation();
    lastSimulationTime = currentTime;
  }

  // Update connection positions
  connectionLines.forEach(line => {
    const startNode = nodes[line.userData.startIndex];
    const endNode = nodes[line.userData.endIndex];
    
    if (startNode && endNode) {
      const start = startNode.position.clone();
      const end = endNode.position.clone();
      const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      
      const direction = new THREE.Vector3().subVectors(end, start);
      const perpendicular = new THREE.Vector3(-direction.y, direction.x, direction.z * 0.3).normalize();
      midPoint.add(perpendicular.multiplyScalar(direction.length() * 0.08));

      const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
      const points = curve.getPoints(20);
      line.geometry.setFromPoints(points);
      
      // Fade connections based on node opacity
      const avgOpacity = (startNode.userData.currentOpacity + endNode.userData.currentOpacity) / 2;
      line.material.opacity = avgOpacity * 0.4;
    }
  });

  renderer.render(scene, camera);
}

// ===== Event Handlers =====
function setupEventListeners() {
  // Window resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Node count slider
  const nodeCountSlider = document.getElementById('nodeCount');
  const nodeCountValue = document.getElementById('nodeCountValue');
  nodeCountSlider.addEventListener('input', (e) => {
    CONFIG.nodeCount = parseInt(e.target.value);
    nodeCountValue.textContent = CONFIG.nodeCount;
  });
  nodeCountSlider.addEventListener('change', () => {
    initSimulation();
  });

  // Speed slider
  const speedSlider = document.getElementById('speed');
  const speedValue = document.getElementById('speedValue');
  speedSlider.addEventListener('input', (e) => {
    CONFIG.speed = parseFloat(e.target.value);
    speedValue.textContent = CONFIG.speed.toFixed(1) + 'x';
  });

  // Connection distance slider
  const connectionDistanceSlider = document.getElementById('connectionDistance');
  const connectionDistanceValue = document.getElementById('connectionDistanceValue');
  connectionDistanceSlider.addEventListener('input', (e) => {
    CONFIG.connectionDistance = parseInt(e.target.value);
    connectionDistanceValue.textContent = CONFIG.connectionDistance;
    if (graph) {
      graph.connectionDistance = CONFIG.connectionDistance;
      graph.recalculateConnections();
      updateConnections();
      updateStats();
    }
  });

  // Repulsion slider
  const repulsionSlider = document.getElementById('repulsion');
  const repulsionValue = document.getElementById('repulsionValue');
  repulsionSlider.addEventListener('input', (e) => {
    CONFIG.repulsion = parseInt(e.target.value);
    repulsionValue.textContent = CONFIG.repulsion;
  });

  // Auto rotate toggle
  const autoRotateToggle = document.getElementById('autoRotate');
  autoRotateToggle.addEventListener('change', (e) => {
    CONFIG.autoRotate = e.target.checked;
    controls.autoRotate = CONFIG.autoRotate;
  });

  // Show connections toggle
  const showConnectionsToggle = document.getElementById('showConnections');
  showConnectionsToggle.addEventListener('change', (e) => {
    CONFIG.showConnections = e.target.checked;
    updateConnections();
  });

  // Play/Pause button
  const playPauseBtn = document.getElementById('playPause');
  playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    const playIcon = playPauseBtn.querySelector('.play');
    const pauseIcon = playPauseBtn.querySelector('.pause');
    const btnText = playPauseBtn.querySelector('.btn-text');
    
    if (isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'inline';
      btnText.textContent = 'Pause';
    } else {
      playIcon.style.display = 'inline';
      pauseIcon.style.display = 'none';
      btnText.textContent = 'Play';
    }
  });

  // Reset button
  const resetBtn = document.getElementById('reset');
  resetBtn.addEventListener('click', () => {
    initSimulation();
  });
}

// ===== Zoom Controls =====
function setupZoomControls() {
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  
  if (zoomIn) {
    zoomIn.addEventListener('click', () => {
      // Smooth animated zoom in
      const currentDistance = camera.position.length();
      targetZoom = Math.max(controls.minDistance, currentDistance * 0.75);
      zoomAnimating = true;
    });
  }
  
  if (zoomOut) {
    zoomOut.addEventListener('click', () => {
      // Smooth animated zoom out
      const currentDistance = camera.position.length();
      targetZoom = Math.min(controls.maxDistance, currentDistance * 1.35);
      zoomAnimating = true;
    });
  }
}

// Smooth zoom animation (called in animate loop)
function updateZoom() {
  if (!zoomAnimating || targetZoom === null) return;
  
  const currentDistance = camera.position.length();
  const diff = targetZoom - currentDistance;
  
  if (Math.abs(diff) < 1) {
    zoomAnimating = false;
    targetZoom = null;
    return;
  }
  
  // Smooth easing
  const step = diff * 0.08;
  const direction = camera.position.clone().normalize();
  const newDistance = currentDistance + step;
  camera.position.copy(direction.multiplyScalar(newDistance));
}

// ===== Sidebar Toggle =====
function setupSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      toggleBtn.classList.toggle('collapsed');
    });
  }
}

// ===== Sound Toggle =====
function setupSoundToggle() {
  const soundToggle = document.getElementById('soundEnabled');
  if (soundToggle) {
    soundToggle.addEventListener('change', (e) => {
      soundEnabled = e.target.checked;
      // Initialize audio context on first enable
      if (soundEnabled) {
        initAudio();
      }
    });
  }
}

// ===== Create 3D Text Label =====
function createTextLabel(text, color = '#FB522E') {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = 256;
  canvas.height = 64;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw text
  ctx.font = '500 24px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  // Draw number in coral
  ctx.fillStyle = color;
  const numText = text.split(' ')[0];
  ctx.fillText(numText, 10, 32);
  const numWidth = ctx.measureText(numText + ' ').width;
  
  // Draw rest in gray
  ctx.fillStyle = '#9E9890';
  ctx.fillText('connections', 10 + numWidth, 32);
  
  // Create texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Create sprite
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(50, 12.5, 1);
  
  return sprite;
}

// ===== Create Dotted Line =====
function createDottedLine(start, end) {
  const points = [start, end];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  
  const material = new THREE.LineDashedMaterial({
    color: 0x9E9890,
    dashSize: 3,
    gapSize: 3,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  });
  
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  
  return line;
}

// ===== Remove Active Label =====
function removeActiveLabel() {
  if (activeLabel) {
    scene.remove(activeLabel);
    activeLabel.material.map.dispose();
    activeLabel.material.dispose();
    activeLabel = null;
  }
  if (activeLabelLine) {
    scene.remove(activeLabelLine);
    activeLabelLine.geometry.dispose();
    activeLabelLine.material.dispose();
    activeLabelLine = null;
  }
  activeLabelTargetNode = null;
}

// ===== Update Label Position (called in animation loop) =====
function updateLabelPosition() {
  if (!activeLabel || !activeLabelTargetNode || !activeLabelLine) return;
  
  // Position label offset from node
  const nodePos = activeLabelTargetNode.position;
  const offset = new THREE.Vector3(40, 25, 0);
  activeLabel.position.copy(nodePos).add(offset);
  
  // Update line to connect node to label
  const lineStart = nodePos.clone();
  const lineEnd = activeLabel.position.clone().add(new THREE.Vector3(-20, 0, 0));
  
  const positions = activeLabelLine.geometry.attributes.position;
  positions.setXYZ(0, lineStart.x, lineStart.y, lineStart.z);
  positions.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z);
  positions.needsUpdate = true;
  activeLabelLine.computeLineDistances();
}

// ===== Node Click Handler for 3D Label =====
function setupNodeClickHandler() {
  renderer.domElement.addEventListener('click', (event) => {
    // Don't show label if we were dragging
    if (isDragging) return;
    
    // Initialize audio on first click (required by browsers)
    initAudio();
    
    // Calculate mouse position in normalized device coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with nodes
    const intersects = raycaster.intersectObjects(nodeGroup.children, true);
    
    if (intersects.length > 0) {
      // Find the parent node group
      let clickedNode = intersects[0].object;
      while (clickedNode.parent && clickedNode.parent !== nodeGroup) {
        clickedNode = clickedNode.parent;
      }
      
      if (clickedNode && clickedNode.userData.graphIndex !== undefined) {
        const nodeIndex = clickedNode.userData.graphIndex;
        const graphNode = graph.nodes[nodeIndex];
        
        if (graphNode && clickedNode.userData.alive) {
          // Remove existing label
          removeActiveLabel();
          
          // Count live connections
          const liveConnections = graphNode.connections.filter(i => 
            nodes[i] && nodes[i].userData.alive
          ).length;
          
          // Create 3D label
          activeLabel = createTextLabel(liveConnections + ' connections');
          activeLabelTargetNode = clickedNode;
          
          // Position label
          const nodePos = clickedNode.position;
          const offset = new THREE.Vector3(40, 25, 0);
          activeLabel.position.copy(nodePos).add(offset);
          
          // Create connecting line
          const lineStart = nodePos.clone();
          const lineEnd = activeLabel.position.clone().add(new THREE.Vector3(-20, 0, 0));
          activeLabelLine = createDottedLine(lineStart, lineEnd);
          
          // Add to scene
          scene.add(activeLabelLine);
          scene.add(activeLabel);
          
          // Auto-hide after delay
          clearTimeout(tooltipTimeout);
          tooltipTimeout = setTimeout(() => {
            removeActiveLabel();
          }, 3000);
        }
      }
    } else {
      // Clicked empty space - remove label
      removeActiveLabel();
    }
  });
}

// ===== Node Dragging =====
let dragTargetPos = new THREE.Vector3();
let connectedNodeTargets = new Map();

function setupNodeDragging() {
  let wasDragging = false;
  
  renderer.domElement.addEventListener('mousedown', (event) => {
    // Only handle left click
    if (event.button !== 0) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeGroup.children, true);
    
    if (intersects.length > 0) {
      // Find the parent node group
      let clickedNode = intersects[0].object;
      while (clickedNode.parent && clickedNode.parent !== nodeGroup) {
        clickedNode = clickedNode.parent;
      }
      
      if (clickedNode && clickedNode.userData.graphIndex !== undefined && clickedNode.userData.alive) {
        isDragging = true;
        wasDragging = false;
        draggedNode = clickedNode;
        controls.enabled = false;
        
        // Create drag plane facing camera
        dragPlane.setFromNormalAndCoplanarPoint(
          camera.getWorldDirection(new THREE.Vector3()).negate(),
          clickedNode.position
        );
        
        // Store offset
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane, intersection);
        dragOffset.subVectors(clickedNode.position, intersection);
        dragTargetPos.copy(clickedNode.position);
        
        // Initialize connected node targets
        connectedNodeTargets.clear();
        const graphNode = graph.nodes[clickedNode.userData.graphIndex];
        if (graphNode && graphNode.connections) {
          graphNode.connections.forEach(connectedIndex => {
            const connectedNode = nodes[connectedIndex];
            if (connectedNode && connectedNode.userData.alive) {
              connectedNodeTargets.set(connectedIndex, connectedNode.position.clone());
            }
          });
        }
        
        // Remove label while dragging
        removeActiveLabel();
      }
    }
  });
  
  renderer.domElement.addEventListener('mousemove', (event) => {
    if (!isDragging || !draggedNode) return;
    
    wasDragging = true;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    
    if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
      const newPos = intersection.add(dragOffset);
      const nodeIndex = draggedNode.userData.graphIndex;
      
      // Calculate movement delta from original position
      const delta = new THREE.Vector3().subVectors(newPos, dragTargetPos);
      
      // Update target position for dragged node
      dragTargetPos.copy(newPos);
      
      // Update connected node targets with pull effect
      const graphNode = graph.nodes[nodeIndex];
      if (graphNode && graphNode.connections) {
        graphNode.connections.forEach(connectedIndex => {
          if (connectedNodeTargets.has(connectedIndex)) {
            const currentTarget = connectedNodeTargets.get(connectedIndex);
            currentTarget.add(delta.clone().multiplyScalar(0.25));
          }
        });
      }
    }
  });
  
  const endDrag = () => {
    if (isDragging) {
      isDragging = false;
      draggedNode = null;
      controls.enabled = true;
      connectedNodeTargets.clear();
      
      if (wasDragging) {
        setTimeout(() => { wasDragging = false; }, 50);
      }
    }
  };
  
  renderer.domElement.addEventListener('mouseup', endDrag);
  renderer.domElement.addEventListener('mouseleave', endDrag);
}

// Smooth drag animation (called in animate loop)
function updateDragAnimation() {
  if (!isDragging || !draggedNode) return;
  
  const nodeIndex = draggedNode.userData.graphIndex;
  
  // Smoothly interpolate dragged node to target
  draggedNode.position.lerp(dragTargetPos, 0.3);
  if (graph.nodes[nodeIndex]) {
    graph.nodes[nodeIndex].x = draggedNode.position.x;
    graph.nodes[nodeIndex].y = draggedNode.position.y;
    graph.nodes[nodeIndex].z = draggedNode.position.z;
  }
  
  // Smoothly interpolate connected nodes
  connectedNodeTargets.forEach((targetPos, connectedIndex) => {
    const connectedNode = nodes[connectedIndex];
    const connectedGraphNode = graph.nodes[connectedIndex];
    
    if (connectedNode && connectedGraphNode) {
      connectedNode.position.lerp(targetPos, 0.15);
      connectedGraphNode.x = connectedNode.position.x;
      connectedGraphNode.y = connectedNode.position.y;
      connectedGraphNode.z = connectedNode.position.z;
    }
  });
}

// ===== Initialize =====
setupEventListeners();
setupZoomControls();
setupSidebarToggle();
setupSoundToggle();
setupNodeClickHandler();
setupNodeDragging();
initSimulation();
animate(0);

