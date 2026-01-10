# Conway's Mind Map

An artistic visualization of Conway's Game of Life as an evolving mind map network. Ideas (nodes) spread, evolve, and die based on their connections to other ideas.

## Features

- **3D Network Visualization** - Navigate a three-dimensional mind map with orbital camera controls
- **Conway's Game of Life Rules** - Nodes survive, die, or spawn based on their connections:
  - Nodes with 2-3 connections survive
  - Nodes with fewer than 2 connections die (isolation)
  - Nodes with more than 4 connections die (overcrowding)
  - New nodes spawn in areas with 3+ active neighbors
- **Force-Directed Layout** - Nodes organically position themselves using spring physics
- **Artistic Floral Nodes** - Concentric circles with warm color palettes (coral, teal, mustard, terracotta)
- **Interactive Controls** - Adjust simulation parameters in real-time

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm

### Installation

```bash
# Install dependencies
npm install

# Start the application
npm start

# Development mode (with DevTools)
npm run dev
```

## Controls

### Sidebar Parameters

| Parameter | Description |
|-----------|-------------|
| **Idea Nodes** | Initial number of nodes (20-150) |
| **Evolution Speed** | How fast generations progress (0.1x - 3x) |
| **Connection Reach** | Maximum distance for node connections |
| **Node Repulsion** | How strongly nodes push apart |
| **Auto Rotate** | Automatically rotate the camera |
| **Show Connections** | Toggle connection line visibility |

### Camera Controls

- **Drag** - Rotate the view
- **Scroll** - Zoom in/out
- **Right-click drag** - Pan the view

## Architecture

```
src/
├── renderer.js      # Three.js scene setup & main render loop
├── simulation.js    # Conway's Game of Life logic for networks
├── node-factory.js  # Artistic floral node generator
├── graph-layout.js  # Force-directed graph positioning
└── styles.css       # Light mode UI styling
```

## Color Palette

The visualization uses a warm, organic color palette:

- **Coral** `#E07A5F`
- **Teal** `#5B9A8B`
- **Mustard** `#D4A84B`
- **Purple** `#9B7E9B`
- **Terracotta** `#C66D4D`
- **Sage** `#8B9F7D`
- **Dusty Rose** `#C4A4A4`
- **Ochre** `#C98B4B`

## Built With

- [Electron](https://www.electronjs.org/) - Desktop application framework
- [Three.js](https://threejs.org/) - 3D visualization library

## License

MIT
