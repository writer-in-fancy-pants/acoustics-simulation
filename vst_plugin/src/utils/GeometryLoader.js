/**
 * Geometry Loader Utility
 * Handles loading and parsing of 3D model files (OBJ, STL, GLTF)
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class GeometryLoader {
  constructor() {
    this.objLoader = new OBJLoader();
    this.stlLoader = new STLLoader();
    this.gltfLoader = new GLTFLoader();
    this.cache = new Map();
  }

  /**
   * Load geometry from file
   * @param {File|string} source - File object or URL
   * @param {string} format - File format (obj, stl, gltf)
   * @returns {Promise<Object>} Parsed geometry data
   */
  async load(source, format = null) {
    // Auto-detect format if not provided
    if (!format) {
      const filename = typeof source === 'string' ? source : source.name;
      format = this.detectFormat(filename);
    }

    // Check cache
    const cacheKey = typeof source === 'string' ? source : source.name;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Load based on format
    let result;
    switch (format.toLowerCase()) {
      case 'obj':
        result = await this.loadOBJ(source);
        break;
      case 'stl':
        result = await this.loadSTL(source);
        break;
      case 'gltf':
      case 'glb':
        result = await this.loadGLTF(source);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Cache result
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Load OBJ file
   */
  async loadOBJ(source) {
    return new Promise((resolve, reject) => {
      const url = this.getSourceURL(source);
      
      this.objLoader.load(
        url,
        (object) => {
          const geometry = this.extractGeometry(object);
          resolve(geometry);
        },
        (progress) => {
          console.log(`Loading OBJ: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        },
        (error) => {
          reject(new Error(`Failed to load OBJ: ${error.message}`));
        }
      );
    });
  }

  /**
   * Load STL file
   */
  async loadSTL(source) {
    return new Promise((resolve, reject) => {
      const url = this.getSourceURL(source);
      
      this.stlLoader.load(
        url,
        (geometry) => {
          const parsed = this.parseSTLGeometry(geometry);
          resolve(parsed);
        },
        (progress) => {
          console.log(`Loading STL: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        },
        (error) => {
          reject(new Error(`Failed to load STL: ${error.message}`));
        }
      );
    });
  }

  /**
   * Load GLTF/GLB file
   */
  async loadGLTF(source) {
    return new Promise((resolve, reject) => {
      const url = this.getSourceURL(source);
      
      this.gltfLoader.load(
        url,
        (gltf) => {
          const geometry = this.extractGeometry(gltf.scene);
          resolve(geometry);
        },
        (progress) => {
          console.log(`Loading GLTF: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        },
        (error) => {
          reject(new Error(`Failed to load GLTF: ${error.message}`));
        }
      );
    });
  }

  /**
   * Extract geometry from Three.js object
   */
  extractGeometry(object) {
    const vertices = [];
    const faces = [];
    const edges = [];
    const materials = new Set();
    let vertexOffset = 0;

    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry;
        
        // Get position attribute
        const positions = geometry.attributes.position;
        if (!positions) return;

        // Extract vertices
        for (let i = 0; i < positions.count; i++) {
          vertices.push([
            positions.getX(i),
            positions.getY(i),
            positions.getZ(i)
          ]);
        }

        // Extract faces
        const indices = geometry.index;
        if (indices) {
          for (let i = 0; i < indices.count; i += 3) {
            faces.push([
              indices.getX(i) + vertexOffset,
              indices.getX(i + 1) + vertexOffset,
              indices.getX(i + 2) + vertexOffset
            ]);
          }
        } else {
          // Non-indexed geometry
          for (let i = 0; i < positions.count; i += 3) {
            faces.push([
              i + vertexOffset,
              i + 1 + vertexOffset,
              i + 2 + vertexOffset
            ]);
          }
        }

        // Track material
        if (child.material) {
          materials.add(child.material.name || 'default');
        }

        vertexOffset += positions.count;
      }
    });

    // Generate edges from faces
    const edgeSet = new Set();
    faces.forEach(face => {
      // Add edges for each face
      for (let i = 0; i < face.length; i++) {
        const v1 = face[i];
        const v2 = face[(i + 1) % face.length];
        const edgeKey = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
        edgeSet.add(edgeKey);
      }
    });

    edgeSet.forEach(key => {
      const [v1, v2] = key.split('-').map(Number);
      edges.push([v1, v2]);
    });

    // Calculate bounding box
    const bbox = this.calculateBoundingBox(vertices);

    return {
      vertices,
      faces,
      edges,
      materials: Array.from(materials),
      material: materials.values().next().value || 'concrete',
      name: object.name || 'Imported Model',
      boundingBox: bbox,
      metadata: {
        vertexCount: vertices.length,
        faceCount: faces.length,
        edgeCount: edges.length
      }
    };
  }

  /**
   * Parse STL geometry
   */
  parseSTLGeometry(geometry) {
    const vertices = [];
    const faces = [];
    const edges = [];

    const positions = geometry.attributes.position;
    
    // Extract vertices
    for (let i = 0; i < positions.count; i++) {
      vertices.push([
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      ]);
    }

    // STL vertices are already organized in triangles
    for (let i = 0; i < vertices.length; i += 3) {
      faces.push([i, i + 1, i + 2]);
    }

    // Generate edges
    const edgeSet = new Set();
    faces.forEach(face => {
      for (let i = 0; i < 3; i++) {
        const v1 = face[i];
        const v2 = face[(i + 1) % 3];
        const edgeKey = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
        edgeSet.add(edgeKey);
      }
    });

    edgeSet.forEach(key => {
      const [v1, v2] = key.split('-').map(Number);
      edges.push([v1, v2]);
    });

    const bbox = this.calculateBoundingBox(vertices);

    return {
      vertices,
      faces,
      edges,
      materials: ['default'],
      material: 'concrete',
      name: 'STL Model',
      boundingBox: bbox,
      metadata: {
        vertexCount: vertices.length,
        faceCount: faces.length,
        edgeCount: edges.length
      }
    };
  }

  /**
   * Calculate bounding box for vertices
   */
  calculateBoundingBox(vertices) {
    if (vertices.length === 0) {
      return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], center: [0, 0, 0] };
    }

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    vertices.forEach(([x, y, z]) => {
      min[0] = Math.min(min[0], x);
      min[1] = Math.min(min[1], y);
      min[2] = Math.min(min[2], z);
      max[0] = Math.max(max[0], x);
      max[1] = Math.max(max[1], y);
      max[2] = Math.max(max[2], z);
    });

    const size = [
      max[0] - min[0],
      max[1] - min[1],
      max[2] - min[2]
    ];

    const center = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2
    ];

    return { min, max, size, center };
  }

  /**
   * Create preset geometries
   */
  createBox(width, height, depth, material = 'concrete') {
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    const vertices = [
      [-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d],
      [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d]
    ];

    const faces = [
      [0, 1, 2], [0, 2, 3], // Front
      [4, 6, 5], [4, 7, 6], // Back
      [0, 3, 7], [0, 7, 4], // Left
      [1, 5, 6], [1, 6, 2], // Right
      [3, 2, 6], [3, 6, 7], // Top
      [0, 4, 5], [0, 5, 1]  // Bottom
    ];

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    return {
      vertices,
      faces,
      edges,
      materials: [material],
      material,
      name: 'Box',
      boundingBox: this.calculateBoundingBox(vertices),
      metadata: {
        vertexCount: vertices.length,
        faceCount: faces.length,
        edgeCount: edges.length
      }
    };
  }

  /**
   * Create room preset
   */
  createRoom(width = 10, height = 8, depth = 6, material = 'concrete') {
    return this.createBox(width, height, depth, material);
  }

  /**
   * Create concert hall preset
   */
  createConcertHall() {
    return this.createBox(30, 20, 16, 'oak');
  }

  /**
   * Create studio preset
   */
  createStudio() {
    return this.createBox(16, 12, 7, 'carpet');
  }

  /**
   * Detect file format from filename
   */
  detectFormat(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['obj'].includes(ext)) return 'obj';
    if (['stl'].includes(ext)) return 'stl';
    if (['gltf', 'glb'].includes(ext)) return 'gltf';
    throw new Error(`Unknown file format: ${ext}`);
  }

  /**
   * Get URL from source (File object or string)
   */
  getSourceURL(source) {
    if (typeof source === 'string') {
      return source;
    }
    if (source instanceof File) {
      return URL.createObjectURL(source);
    }
    throw new Error('Invalid source type');
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Export geometry to JSON
   */
  exportToJSON(geometry) {
    return JSON.stringify(geometry, null, 2);
  }

  /**
   * Import geometry from JSON
   */
  importFromJSON(json) {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  /**
   * Validate geometry structure
   */
  validateGeometry(geometry) {
    const required = ['vertices', 'faces', 'edges', 'material'];
    const missing = required.filter(key => !(key in geometry));
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!Array.isArray(geometry.vertices) || geometry.vertices.length === 0) {
      throw new Error('Invalid or empty vertices array');
    }

    if (!Array.isArray(geometry.faces) || geometry.faces.length === 0) {
      throw new Error('Invalid or empty faces array');
    }

    return true;
  }

  /**
   * Scale geometry
   */
  scaleGeometry(geometry, scale) {
    const scaled = { ...geometry };
    scaled.vertices = geometry.vertices.map(([x, y, z]) => [
      x * scale,
      y * scale,
      z * scale
    ]);
    scaled.boundingBox = this.calculateBoundingBox(scaled.vertices);
    return scaled;
  }

  /**
   * Center geometry at origin
   */
  centerGeometry(geometry) {
    const bbox = geometry.boundingBox || this.calculateBoundingBox(geometry.vertices);
    const center = bbox.center;
    
    const centered = { ...geometry };
    centered.vertices = geometry.vertices.map(([x, y, z]) => [
      x - center[0],
      y - center[1],
      z - center[2]
    ]);
    centered.boundingBox = this.calculateBoundingBox(centered.vertices);
    
    return centered;
  }
}

export default GeometryLoader;