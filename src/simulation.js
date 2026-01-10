// ===== Conway's Game of Life for Networks =====
// Rules adapted for graph connections (relaxed for visual appeal):
// - Hub nodes (many connections) are stable and survive
// - Isolated nodes (0-1 connections) slowly fade
// - New nodes spawn near active clusters
// - Focus on growth and organic evolution rather than death

export class GameOfLifeSimulation {
  constructor(graph) {
    this.graph = graph;
    this.aliveNodes = new Set();
    this.generation = 0;
    
    // Initialize all nodes as alive
    for (let i = 0; i < this.graph.nodes.length; i++) {
      this.aliveNodes.add(i);
    }
    
    // Configuration - much more relaxed rules for stable visualization
    this.minConnections = 1;  // Only truly isolated nodes can die
    this.deathProbability = 0.1; // Low chance of death even when isolated
    this.birthThreshold = 2;  // Connections needed for birth
    this.birthProbability = 0.4; // Higher chance of birth
    this.maxNodes = 250; // Maximum total nodes
    this.maxDeathsPerStep = 2; // Limit deaths per generation
  }

  step() {
    const deaths = [];
    const births = [];
    
    // Evaluate each alive node - much gentler rules
    this.aliveNodes.forEach(index => {
      const node = this.graph.nodes[index];
      if (!node) return;
      
      // Count alive neighbors
      const aliveNeighbors = this.countAliveNeighbors(index);
      
      // Only isolated nodes (0 connections) have a chance to die
      // Hub nodes with many connections NEVER die
      if (aliveNeighbors < this.minConnections && Math.random() < this.deathProbability) {
        deaths.push(index);
      }
      // Nodes with connections always survive - no overcrowding death
    });
    
    // Find potential birth locations
    if (this.graph.nodes.length < this.maxNodes) {
      const birthCandidates = this.findBirthCandidates();
      
      birthCandidates.forEach(candidate => {
        if (Math.random() < this.birthProbability) {
          births.push(candidate);
        }
      });
    }
    
    // Limit deaths per step to prevent mass extinction
    const limitedDeaths = deaths.slice(0, this.maxDeathsPerStep);
    
    // Apply changes
    limitedDeaths.forEach(index => {
      this.aliveNodes.delete(index);
    });
    
    births.forEach(birthData => {
      this.aliveNodes.add(this.graph.nodes.length); // Will be added at this index
    });
    
    this.generation++;
    
    return { deaths: limitedDeaths, births };
  }

  countAliveNeighbors(index) {
    const node = this.graph.nodes[index];
    if (!node) return 0;
    
    let count = 0;
    node.connections.forEach(neighborIndex => {
      if (this.aliveNodes.has(neighborIndex)) {
        count++;
      }
    });
    
    return count;
  }

  findBirthCandidates() {
    const candidates = [];
    const checkedPositions = new Set();
    
    // Look for areas with high activity (many alive neighbors)
    this.aliveNodes.forEach(index => {
      const node = this.graph.nodes[index];
      if (!node) return;
      
      const aliveNeighbors = this.countAliveNeighbors(index);
      
      // If this node has many alive neighbors, consider spawning nearby
      if (aliveNeighbors >= this.birthThreshold - 1) {
        // Calculate spawn position
        const spawnPos = this.calculateSpawnPosition(index);
        
        if (spawnPos) {
          const posKey = `${Math.round(spawnPos.x/10)},${Math.round(spawnPos.y/10)},${Math.round(spawnPos.z/10)}`;
          
          if (!checkedPositions.has(posKey)) {
            checkedPositions.add(posKey);
            
            // Find potential connections for new node
            const potentialConnections = this.findNearbyAliveNodes(spawnPos);
            
            if (potentialConnections.length >= this.birthThreshold) {
              candidates.push({
                x: spawnPos.x,
                y: spawnPos.y,
                z: spawnPos.z,
                connections: potentialConnections.slice(0, 4) // Limit initial connections
              });
            }
          }
        }
      }
    });
    
    // Limit births per generation to prevent explosion
    return candidates.slice(0, 3);
  }

  calculateSpawnPosition(nearIndex) {
    const node = this.graph.nodes[nearIndex];
    if (!node) return null;
    
    // Get alive neighbors
    const aliveNeighborIndices = node.connections.filter(i => this.aliveNodes.has(i));
    
    if (aliveNeighborIndices.length < 2) return null;
    
    // Calculate centroid of alive neighbors
    let cx = 0, cy = 0, cz = 0;
    aliveNeighborIndices.forEach(i => {
      const n = this.graph.nodes[i];
      if (n) {
        cx += n.x;
        cy += n.y;
        cz += n.z;
      }
    });
    
    const count = aliveNeighborIndices.length;
    cx /= count;
    cy /= count;
    cz /= count;
    
    // Offset from centroid
    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetDist = 30 + Math.random() * 40;
    
    return {
      x: cx + Math.cos(offsetAngle) * offsetDist,
      y: cy + Math.sin(offsetAngle) * offsetDist,
      z: cz + (Math.random() - 0.5) * 20
    };
  }

  findNearbyAliveNodes(position, maxDist = 100) {
    const nearby = [];
    
    this.aliveNodes.forEach(index => {
      const node = this.graph.nodes[index];
      if (!node) return;
      
      const dist = Math.sqrt(
        Math.pow(node.x - position.x, 2) +
        Math.pow(node.y - position.y, 2) +
        Math.pow(node.z - position.z, 2)
      );
      
      if (dist < maxDist) {
        nearby.push({ index, dist });
      }
    });
    
    // Sort by distance and return indices
    nearby.sort((a, b) => a.dist - b.dist);
    return nearby.map(n => n.index);
  }

  isAlive(index) {
    return this.aliveNodes.has(index);
  }

  getAliveCount() {
    return this.aliveNodes.size;
  }

  reviveNode(index) {
    if (this.graph.nodes[index]) {
      this.aliveNodes.add(index);
    }
  }

  killNode(index) {
    this.aliveNodes.delete(index);
  }

  reset() {
    this.aliveNodes.clear();
    for (let i = 0; i < this.graph.nodes.length; i++) {
      this.aliveNodes.add(i);
    }
    this.generation = 0;
  }
}

