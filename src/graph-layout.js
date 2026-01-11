// ===== Force-Directed Graph Layout =====
// Positions nodes organically using spring physics

export class ForceDirectedGraph {
  constructor(options = {}) {
    this.nodeCount = options.nodeCount || 50;
    this.connectionDistance = options.connectionDistance || 120;
    this.repulsion = options.repulsion || 50;
    this.bounds = options.bounds || 300;
    this.damping = 0.85;
    this.springStrength = 0.03;
    this.centerAttraction = 0.001;
    
    this.nodes = [];
    this.initialize();
  }

  initialize() {
    this.nodes = [];
    
    // Create nodes with random initial positions
    for (let i = 0; i < this.nodeCount; i++) {
      // Distribute in clusters for more organic feel
      const clusterCount = 3 + Math.floor(Math.random() * 3);
      const cluster = i % clusterCount;
      const clusterAngle = (cluster / clusterCount) * Math.PI * 2;
      const clusterDistance = this.bounds * 0.4;
      
      const clusterX = Math.cos(clusterAngle) * clusterDistance;
      const clusterY = Math.sin(clusterAngle) * clusterDistance;
      const clusterZ = (Math.random() - 0.5) * clusterDistance * 0.5;
      
      // Random offset within cluster
      const spread = this.bounds * 0.3;
      const node = {
        x: clusterX + (Math.random() - 0.5) * spread,
        y: clusterY + (Math.random() - 0.5) * spread,
        z: clusterZ + (Math.random() - 0.5) * spread * 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        connections: [],
        mass: 1 + Math.random() * 0.5
      };
      
      this.nodes.push(node);
    }
    
    // Calculate initial connections
    this.recalculateConnections();
  }

  recalculateConnections() {
    // Clear existing connections
    this.nodes.forEach(node => {
      node.connections = [];
    });
    
    // Connect nodes within connection distance
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dist = this.distance(this.nodes[i], this.nodes[j]);
        
        // Connect if within range, with probability based on distance
        if (dist < this.connectionDistance) {
          const connectionProb = 1 - (dist / this.connectionDistance);
          if (Math.random() < connectionProb * 0.6) {
            this.nodes[i].connections.push(j);
            this.nodes[j].connections.push(i);
          }
        }
      }
    }
    
    // Ensure minimum connections for non-isolated nodes
    this.nodes.forEach((node, i) => {
      if (node.connections.length === 0 && Math.random() > 0.3) {
        // Find nearest neighbor and connect
        let nearestIndex = -1;
        let nearestDist = Infinity;
        
        this.nodes.forEach((other, j) => {
          if (i !== j) {
            const dist = this.distance(node, other);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestIndex = j;
            }
          }
        });
        
        if (nearestIndex >= 0) {
          node.connections.push(nearestIndex);
          this.nodes[nearestIndex].connections.push(i);
        }
      }
    });
  }

  distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  update(repulsion = this.repulsion, connectionDistance = this.connectionDistance) {
    this.repulsion = repulsion;
    this.connectionDistance = connectionDistance;
    
    // Apply forces
    this.applyRepulsion();
    this.applySpringForces();
    this.applyCenterAttraction();
    this.applyBoundaryForces();
    
    // Update positions
    this.nodes.forEach(node => {
      // Apply velocity with damping
      node.x += node.vx;
      node.y += node.vy;
      node.z += node.vz;
      
      node.vx *= this.damping;
      node.vy *= this.damping;
      node.vz *= this.damping;
    });
  }

  applyRepulsion() {
    const repulsionStrength = this.repulsion * 100;
    
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];
        
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const dz = nodeA.z - nodeB.z;
        
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 1) dist = 1;
        
        // Coulomb's law-like repulsion
        const force = repulsionStrength / (dist * dist);
        
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        
        nodeA.vx += fx / nodeA.mass;
        nodeA.vy += fy / nodeA.mass;
        nodeA.vz += fz / nodeA.mass * 0.5; // Reduce Z movement for flatter appearance
        
        nodeB.vx -= fx / nodeB.mass;
        nodeB.vy -= fy / nodeB.mass;
        nodeB.vz -= fz / nodeB.mass * 0.5;
      }
    }
  }

  applySpringForces() {
    this.nodes.forEach((node, i) => {
      node.connections.forEach(j => {
        if (j > i) { // Only process each connection once
          const other = this.nodes[j];
          
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dz = other.z - node.z;
          
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < 1) return;
          
          // Spring force (Hooke's law)
          const idealLength = this.connectionDistance * 0.6;
          const displacement = dist - idealLength;
          const force = displacement * this.springStrength;
          
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;
          
          node.vx += fx;
          node.vy += fy;
          node.vz += fz * 0.3;
          
          other.vx -= fx;
          other.vy -= fy;
          other.vz -= fz * 0.3;
        }
      });
    });
  }

  applyCenterAttraction() {
    this.nodes.forEach(node => {
      // Gentle pull toward center
      node.vx -= node.x * this.centerAttraction;
      node.vy -= node.y * this.centerAttraction;
      node.vz -= node.z * this.centerAttraction * 2; // Stronger Z centering
    });
  }

  applyBoundaryForces() {
    const boundary = this.bounds;
    const boundaryForce = 0.5;
    
    this.nodes.forEach(node => {
      // Soft boundary (push back when outside bounds)
      if (Math.abs(node.x) > boundary) {
        node.vx -= Math.sign(node.x) * boundaryForce;
      }
      if (Math.abs(node.y) > boundary) {
        node.vy -= Math.sign(node.y) * boundaryForce;
      }
      if (Math.abs(node.z) > boundary * 0.5) {
        node.vz -= Math.sign(node.z) * boundaryForce;
      }
    });
  }

  addNode(nodeData) {
    const node = {
      x: nodeData.x,
      y: nodeData.y,
      z: nodeData.z,
      vx: 0,
      vy: 0,
      vz: 0,
      connections: nodeData.connections || [],
      mass: 1 + Math.random() * 0.5
    };
    
    this.nodes.push(node);
    
    // Add reciprocal connections
    node.connections.forEach(j => {
      if (this.nodes[j] && !this.nodes[j].connections.includes(this.nodes.length - 1)) {
        this.nodes[j].connections.push(this.nodes.length - 1);
      }
    });
    
    return node;
  }

  removeNode(index) {
    // Remove connections to this node from other nodes
    this.nodes.forEach(node => {
      node.connections = node.connections.filter(i => i !== index);
      // Adjust indices for nodes after the removed one
      node.connections = node.connections.map(i => i > index ? i - 1 : i);
    });
    
    this.nodes.splice(index, 1);
  }

  getNeighbors(index) {
    if (!this.nodes[index]) return [];
    return this.nodes[index].connections;
  }

  getConnectionCount() {
    let count = 0;
    this.nodes.forEach(node => {
      count += node.connections.length;
    });
    return count / 2; // Each connection counted twice
  }
}


