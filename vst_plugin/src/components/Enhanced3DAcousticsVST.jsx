import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, Plus, Trash2, Play, Square, Settings, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

const Enhanced3DAcousticsVST = () => {
  // State
  const [geometry, setGeometry] = useState(null);
  const [sources, setSources] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [medium, setMedium] = useState('air');
  const [selectedPreset, setSelectedPreset] = useState('room');
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 3D View controls
  const [camera, setCamera] = useState({
    zoom: 1.0,
    rotation: { x: 30, y: 45, z: 0 },
    position: { x: 0, y: 0, z: 0 }
  });
  const [selectedObject, setSelectedObject] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState('perspective'); // perspective, top, side, front
  
  // Real-time audio state
  const [audioContext, setAudioContext] = useState(null);
  const [activeNodes, setActiveNodes] = useState(new Map());
  
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mouseDownPos = useRef({ x: 0, y: 0 });

  // Settings
  const [settings, setSettings] = useState({
    maxReflections: 5,
    maxDistance: 100,
    decayRate: 0.8,
    useFX: false,
    fxType: 'none',
    sampleRate: 44100,
    updateRate: 60, // Real-time update rate in Hz
    interpolation: true
  });

  // Presets
  const presets = {
    room: {
      name: 'Small Room',
      vertices: [
        [-5, -4, -3], [5, -4, -3], [5, 4, -3], [-5, 4, -3],
        [-5, -4, 3], [5, -4, 3], [5, 4, 3], [-5, 4, 3]
      ],
      faces: [
        [0,1,2], [0,2,3], [4,6,5], [4,7,6],
        [0,3,7], [0,7,4], [1,5,6], [1,6,2],
        [3,2,6], [3,6,7], [0,4,5], [0,5,1]
      ],
      edges: [
        [0,1], [1,2], [2,3], [3,0],
        [4,5], [5,6], [6,7], [7,4],
        [0,4], [1,5], [2,6], [3,7]
      ],
      material: 'concrete'
    },
    hall: {
      name: 'Concert Hall',
      vertices: [
        [-15, -10, -5], [15, -10, -5], [15, 10, -5], [-15, 10, -5],
        [-15, -10, 8], [15, -10, 8], [15, 10, 8], [-15, 10, 8]
      ],
      faces: [
        [0,1,2], [0,2,3], [4,6,5], [4,7,6],
        [0,3,7], [0,7,4], [1,5,6], [1,6,2],
        [3,2,6], [3,6,7], [0,4,5], [0,5,1]
      ],
      edges: [
        [0,1], [1,2], [2,3], [3,0],
        [4,5], [5,6], [6,7], [7,4],
        [0,4], [1,5], [2,6], [3,7]
      ],
      material: 'oak'
    },
    studio: {
      name: 'Recording Studio',
      vertices: [
        [-8, -6, -3.5], [8, -6, -3.5], [8, 6, -3.5], [-8, 6, -3.5],
        [-8, -6, 3.5], [8, -6, 3.5], [8, 6, 3.5], [-8, 6, 3.5]
      ],
      faces: [
        [0,1,2], [0,2,3], [4,6,5], [4,7,6],
        [0,3,7], [0,7,4], [1,5,6], [1,6,2],
        [3,2,6], [3,6,7], [0,4,5], [0,5,1]
      ],
      edges: [
        [0,1], [1,2], [2,3], [3,0],
        [4,5], [5,6], [6,7], [7,4],
        [0,4], [1,5], [2,6], [3,7]
      ],
      material: 'carpet'
    }
  };

  // Initialize
  useEffect(() => {
    loadPreset(selectedPreset);
    
    // Initialize Web Audio API
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    setAudioContext(ctx);
    
    return () => {
      if (ctx) ctx.close();
    };
  }, []);

  // Load preset
  const loadPreset = (presetName) => {
    const preset = presets[presetName];
    if (preset) {
      setGeometry(preset);
      setSelectedPreset(presetName);
    }
  };

  // Add source/output
  const addSource = () => {
    const newSource = {
      id: Date.now(),
      position: [0, 0, 1.5],
      name: `Source ${sources.length + 1}`,
      channel: sources.length + 1,
      gain: 0.5,
      playing: false
    };
    setSources([...sources, newSource]);
  };

  const addOutput = () => {
    const newOutput = {
      id: Date.now(),
      position: [2, 2, 1.5],
      name: `Out ${outputs.length + 1}`,
      channel: outputs.length + 1,
      gain: 1.0
    };
    setOutputs([...outputs, newOutput]);
  };

  // Remove source/output
  const removeSource = (id) => {
    stopSourceAudio(id);
    setSources(sources.filter(s => s.id !== id));
  };

  const removeOutput = (id) => {
    setOutputs(outputs.filter(o => o.id !== id));
  };

  // Real-time audio control
  const startSourceAudio = useCallback((sourceId) => {
    if (!audioContext) return;
    
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;
    
    // Create oscillator for testing
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.value = 440 + (sourceId % 5) * 110;
    gainNode.gain.value = source.gain;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    setActiveNodes(prev => new Map(prev).set(sourceId, { oscillator, gainNode }));
    
    // Update source state
    setSources(prev => prev.map(s => 
      s.id === sourceId ? { ...s, playing: true } : s
    ));
  }, [audioContext, sources]);

  const stopSourceAudio = useCallback((sourceId) => {
    const nodes = activeNodes.get(sourceId);
    if (nodes) {
      nodes.oscillator.stop();
      nodes.oscillator.disconnect();
      nodes.gainNode.disconnect();
      
      setActiveNodes(prev => {
        const next = new Map(prev);
        next.delete(sourceId);
        return next;
      });
    }
    
    setSources(prev => prev.map(s => 
      s.id === sourceId ? { ...s, playing: false } : s
    ));
  }, [activeNodes]);

  // Update position with real-time audio adjustment
  const updatePosition = useCallback((type, id, axis, value) => {
    const list = type === 'source' ? sources : outputs;
    const setList = type === 'source' ? setSources : setOutputs;
    
    const updated = list.map(item => {
      if (item.id === id) {
        const newPos = [...item.position];
        newPos[axis] = parseFloat(value) || 0;
        return { ...item, position: newPos };
      }
      return item;
    });
    setList(updated);
    
    // Update audio processing in real-time
    if (isPlaying && type === 'source') {
      // Recalculate acoustics and update gain/delay
      // This would trigger the simulation engine in production
      updateAudioProcessing(id, updated.find(s => s.id === id).position);
    }
  }, [sources, outputs, isPlaying]);

  const updateAudioProcessing = useCallback((sourceId, position) => {
    const nodes = activeNodes.get(sourceId);
    if (!nodes) return;
    
    // Calculate distance-based attenuation (simplified)
    const outputPos = outputs[0]?.position || [0, 0, 0];
    const dx = position[0] - outputPos[0];
    const dy = position[1] - outputPos[1];
    const dz = position[2] - outputPos[2];
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    // Update gain based on distance (inverse square law)
    const attenuation = 1.0 / Math.max(distance, 0.5);
    nodes.gainNode.gain.setTargetAtTime(
      attenuation * 0.3,
      audioContext.currentTime,
      0.1
    );
  }, [activeNodes, outputs, audioContext]);

  // 3D projection with view modes
  const project = useCallback((point) => {
    if (!canvasRef.current) return [0, 0, 0];
    
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    
    let [x, y, z] = point;
    
    // Apply camera position offset
    x -= camera.position.x;
    y -= camera.position.y;
    z -= camera.position.z;
    
    // View mode transformations
    if (viewMode === 'top') {
      // Top view (looking down)
      const scale = 20 * camera.zoom;
      return [
        width / 2 + x * scale,
        height / 2 + y * scale,
        z
      ];
    } else if (viewMode === 'side') {
      // Side view (looking from right)
      const scale = 20 * camera.zoom;
      return [
        width / 2 + y * scale,
        height / 2 - z * scale,
        x
      ];
    } else if (viewMode === 'front') {
      // Front view
      const scale = 20 * camera.zoom;
      return [
        width / 2 + x * scale,
        height / 2 - z * scale,
        y
      ];
    }
    
    // Perspective view
    const rx = camera.rotation.x * Math.PI / 180;
    const ry = camera.rotation.y * Math.PI / 180;
    const rz = camera.rotation.z * Math.PI / 180;
    
    // Rotate around Y
    let x1 = x * Math.cos(ry) - z * Math.sin(ry);
    let z1 = x * Math.sin(ry) + z * Math.cos(ry);
    
    // Rotate around X
    let y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
    let z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
    
    // Rotate around Z
    let x3 = x1 * Math.cos(rz) - y2 * Math.sin(rz);
    let y3 = x1 * Math.sin(rz) + y2 * Math.cos(rz);
    
    // Perspective projection with zoom
    const fov = 500 / camera.zoom;
    const scale = fov / (z2 + 30);
    
    return [
      width / 2 + x3 * scale,
      height / 2 - y3 * scale,
      z2
    ];
  }, [camera, viewMode]);

  // Render 3D view
  useEffect(() => {
    if (!canvasRef.current || !geometry) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const render = () => {
      // Clear
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      const gridSize = 20;
      const gridSpacing = 2;
      
      for (let i = -gridSize; i <= gridSize; i += gridSpacing) {
        // X lines
        const p1 = project([i, -gridSize, 0]);
        const p2 = project([i, gridSize, 0]);
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
        
        // Y lines
        const p3 = project([-gridSize, i, 0]);
        const p4 = project([gridSize, i, 0]);
        ctx.beginPath();
        ctx.moveTo(p3[0], p3[1]);
        ctx.lineTo(p4[0], p4[1]);
        ctx.stroke();
      }

      // Draw edges with depth sorting
      const edges = geometry.edges.map(([i, j]) => {
        const p1 = project(geometry.vertices[i]);
        const p2 = project(geometry.vertices[j]);
        const avgDepth = (p1[2] + p2[2]) / 2;
        return { p1, p2, depth: avgDepth };
      }).sort((a, b) => a.depth - b.depth);

      edges.forEach(({ p1, p2 }) => {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      });

      // Draw sources (red) with selection highlight
      sources.forEach(source => {
        const [x, y, z] = project(source.position);
        
        // Selection ring
        if (selectedObject?.type === 'source' && selectedObject.id === source.id) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Source dot
        ctx.fillStyle = source.playing ? '#ef4444' : '#7f1d1d';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Pulsing effect when playing
        if (source.playing) {
          const pulse = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
          ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 8 + pulse * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Label
        ctx.fillStyle = '#fca5a5';
        ctx.font = '11px monospace';
        ctx.fillText(source.name, x + 12, y + 4);
      });

      // Draw outputs (yellow)
      outputs.forEach(output => {
        const [x, y, z] = project(output.position);
        
        // Selection ring
        if (selectedObject?.type === 'output' && selectedObject.id === output.id) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Output dot
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#fde047';
        ctx.font = '11px monospace';
        ctx.fillText(output.name, x + 12, y + 4);
      });

      // Draw coordinate axes
      const axisLength = 3;
      const origin = project([0, 0, 0]);
      
      // X axis (red)
      const xAxis = project([axisLength, 0, 0]);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(xAxis[0], xAxis[1]);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.fillText('X', xAxis[0] + 5, xAxis[1]);
      
      // Y axis (green)
      const yAxis = project([0, axisLength, 0]);
      ctx.strokeStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(yAxis[0], yAxis[1]);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.fillText('Y', yAxis[0] + 5, yAxis[1]);
      
      // Z axis (blue)
      const zAxis = project([0, 0, axisLength]);
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(zAxis[0], zAxis[1]);
      ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.fillText('Z', zAxis[0] + 5, zAxis[1]);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [geometry, sources, outputs, camera, project, selectedObject, viewMode]);

  // Mouse interaction
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    
    // Check if clicked on object
    let clickedObject = null;
    
    for (const source of sources) {
      const [sx, sy] = project(source.position);
      const dist = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
      if (dist < 10) {
        clickedObject = { type: 'source', id: source.id };
        break;
      }
    }
    
    if (!clickedObject) {
      for (const output of outputs) {
        const [ox, oy] = project(output.position);
        const dist = Math.sqrt((x - ox) ** 2 + (y - oy) ** 2);
        if (dist < 10) {
          clickedObject = { type: 'output', id: output.id };
          break;
        }
      }
    }
    
    setSelectedObject(clickedObject);
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    
    if (selectedObject) {
      // Move object
      const sensitivity = 0.05;
      const list = selectedObject.type === 'source' ? sources : outputs;
      const setList = selectedObject.type === 'source' ? setSources : setOutputs;
      
      const updated = list.map(item => {
        if (item.id === selectedObject.id) {
          const newPos = [...item.position];
          newPos[0] += dx * sensitivity;
          newPos[1] -= dy * sensitivity;
          return { ...item, position: newPos };
        }
        return item;
      });
      setList(updated);
      
    } else {
      // Rotate camera
      setCamera(prev => ({
        ...prev,
        rotation: {
          x: prev.rotation.x + dy * 0.5,
          y: prev.rotation.y + dx * 0.5,
          z: prev.rotation.z
        }
      }));
    }
    
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(5, prev.zoom * delta))
    }));
  };

  // Camera controls
  const resetCamera = () => {
    setCamera({
      zoom: 1.0,
      rotation: { x: 30, y: 45, z: 0 },
      position: { x: 0, y: 0, z: 0 }
    });
  };

  const zoomIn = () => {
    setCamera(prev => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.2) }));
  };

  const zoomOut = () => {
    setCamera(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }));
  };

  return (
    <div className="w-full h-screen bg-zinc-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-zinc-800 border-b border-zinc-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">Acoustics Simulator VST</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2"
            >
              {isPlaying ? <Square size={16} /> : <Play size={16} />}
              {isPlaying ? 'Stop' : 'Play'}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center gap-2"
            >
              <Settings size={16} />
              Settings
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className="px-3 py-1.5 bg-zinc-700 rounded border border-zinc-600"
          >
            <option value="air">Air</option>
            <option value="water">Water</option>
            <option value="glass">Glass</option>
            <option value="earth">Earth</option>
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-64 bg-zinc-800 border-r border-zinc-700 flex flex-col">
          <div className="p-3 border-b border-zinc-700">
            <h2 className="font-semibold mb-3">3D Geometry</h2>
            <select
              value={selectedPreset}
              onChange={(e) => loadPreset(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-700 rounded border border-zinc-600 mb-2"
            >
              <option value="room">Small Room</option>
              <option value="hall">Concert Hall</option>
              <option value="studio">Recording Studio</option>
            </select>
            <button className="w-full px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center justify-center gap-2">
              <Upload size={16} />
              Upload OBJ/STL
            </button>
          </div>

          {geometry && (
            <div className="p-3 border-b border-zinc-700">
              <h3 className="text-sm font-semibold mb-2">Info</h3>
              <div className="text-xs text-zinc-400 space-y-1">
                <div>Vertices: {geometry.vertices.length}</div>
                <div>Faces: {geometry.faces.length}</div>
                <div>Material: {geometry.material}</div>
              </div>
            </div>
          )}

          <div className="p-3 border-b border-zinc-700">
            <h3 className="text-sm font-semibold mb-2">View Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              {['perspective', 'top', 'side', 'front'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-2 py-1 text-xs rounded ${
                    viewMode === mode 
                      ? 'bg-blue-600' 
                      : 'bg-zinc-700 hover:bg-zinc-600'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center - 3D View */}
        <div className="flex-1 flex flex-col">
          {/* Camera controls */}
          <div className="bg-zinc-800 border-b border-zinc-700 p-2 flex items-center gap-2">
            <button
              onClick={zoomIn}
              className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={zoomOut}
              className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={resetCamera}
              className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded"
              title="Reset Camera"
            >
              <RotateCw size={16} />
            </button>
            <div className="ml-4 text-xs text-zinc-400">
              Zoom: {camera.zoom.toFixed(2)}x | 
              Rotation: {camera.rotation.x.toFixed(0)}° {camera.rotation.y.toFixed(0)}°
            </div>
            <div className="ml-auto text-xs text-zinc-400">
              {selectedObject 
                ? `Selected: ${selectedObject.type} (drag to move)` 
                : 'Click objects to select • Drag background to rotate'}
            </div>
          </div>

          <div className="flex-1 relative">
            <canvas
              ref={canvasRef}
              width={1000}
              height={700}
              className="w-full h-full cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            />
            <div className="absolute top-4 right-4 bg-zinc-800/90 px-3 py-2 rounded text-xs space-y-1">
              <div className="flex gap-4">
                <span className="text-red-400">● Sources</span>
                <span className="text-yellow-400">● Outputs</span>
              </div>
              <div className="text-zinc-400 mt-2">
                Scroll to zoom • Drag to rotate
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 bg-zinc-800 border-l border-zinc-700 flex flex-col overflow-y-auto">
          {/* Sources */}
          <div className="p-3 border-b border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Audio Sources</h2>
              <button
                onClick={addSource}
                className="p-1.5 bg-red-600 hover:bg-red-700 rounded"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {sources.map(source => (
                <div key={source.id} className="bg-zinc-700 rounded p-2">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      value={source.name}
                      onChange={(e) => {
                        const updated = sources.map(s =>
                          s.id === source.id ? { ...s, name: e.target.value } : s
                        );
                        setSources(updated);
                      }}
                      className="flex-1 bg-zinc-800 px-2 py-1 rounded text-sm border border-zinc-600"
                    />
                    <button
                      onClick={() => 
                        source.playing 
                          ? stopSourceAudio(source.id) 
                          : startSourceAudio(source.id)
                      }
                      className={`ml-2 p-1 rounded ${
                        source.playing 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {source.playing ? <Square size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => removeSource(source.id)}
                      className="ml-1 p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs mb-2">
                    {['X', 'Y', 'Z'].map((axis, i) => (
                      <div key={axis}>
                        <label className="text-zinc-400">{axis}</label>
                        <input
                          type="number"
                          value={source.position[i].toFixed(2)}
                          onChange={(e) => updatePosition('source', source.id, i, e.target.value)}
                          step="0.1"
                          className="w-full bg-zinc-800 px-1 py-1 rounded border border-zinc-600"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400">Gain:</span>
                    <input
                      type="range"
                      value={source.gain}
                      onChange={(e) => {
                        const newGain = parseFloat(e.target.value);
                        setSources(prev => prev.map(s =>
                          s.id === source.id ? { ...s, gain: newGain } : s
                        ));
                        
                        // Update active audio gain
                        const nodes = activeNodes.get(source.id);
                        if (nodes) {
                          nodes.gainNode.gain.setTargetAtTime(
                            newGain,
                            audioContext.currentTime,
                            0.05
                          );
                        }
                      }}
                      min="0"
                      max="1"
                      step="0.01"
                      className="flex-1"
                    />
                    <span className="text-zinc-400 w-8">{source.gain.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outputs */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Output Channels</h2>
              <button
                onClick={addOutput}
                className="p-1.5 bg-yellow-600 hover:bg-yellow-700 rounded"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {outputs.map(output => (
                <div key={output.id} className="bg-zinc-700 rounded p-2">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      value={output.name}
                      onChange={(e) => {
                        const updated = outputs.map(o =>
                          o.id === output.id ? { ...o, name: e.target.value } : o
                        );
                        setOutputs(updated);
                      }}
                      className="flex-1 bg-zinc-800 px-2 py-1 rounded text-sm border border-zinc-600"
                    />
                    <button
                      onClick={() => removeOutput(output.id)}
                      className="ml-2 p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    {['X', 'Y', 'Z'].map((axis, i) => (
                      <div key={axis}>
                        <label className="text-zinc-400">{axis}</label>
                        <input
                          type="number"
                          value={output.position[i].toFixed(2)}
                          onChange={(e) => updatePosition('output', output.id, i, e.target.value)}
                          step="0.1"
                          className="w-full bg-zinc-800 px-1 py-1 rounded border border-zinc-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Simulation Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Max Reflections</label>
                <input
                  type="number"
                  value={settings.maxReflections}
                  onChange={(e) => setSettings({...settings, maxReflections: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-zinc-700 rounded border border-zinc-600"
                  min="1"
                  max="20"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Max Distance (m)</label>
                <input
                  type="number"
                  value={settings.maxDistance}
                  onChange={(e) => setSettings({...settings, maxDistance: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 bg-zinc-700 rounded border border-zinc-600"
                  min="10"
                  max="500"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Decay Rate</label>
                <input
                  type="range"
                  value={settings.decayRate}
                  onChange={(e) => setSettings({...settings, decayRate: parseFloat(e.target.value)})}
                  className="w-full"
                  min="0.1"
                  max="1"
                  step="0.1"
                />
                <div className="text-xs text-zinc-400 text-right">{settings.decayRate}</div>
              </div>

              <div>
                <label className="block text-sm mb-1">Real-time Update Rate (Hz)</label>
                <input
                  type="number"
                  value={settings.updateRate}
                  onChange={(e) => setSettings({...settings, updateRate: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-zinc-700 rounded border border-zinc-600"
                  min="10"
                  max="120"
                />
                <div className="text-xs text-zinc-400 mt-1">
                  Higher = smoother but more CPU usage
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.interpolation}
                    onChange={(e) => setSettings({...settings, interpolation: e.target.checked})}
                    className="rounded"
                  />
                  <span>Smooth Position Interpolation</span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.useFX}
                    onChange={(e) => setSettings({...settings, useFX: e.target.checked})}
                    className="rounded"
                  />
                  <span>Apply FX on Reflections</span>
                </label>
              </div>

              {settings.useFX && (
                <div>
                  <label className="block text-sm mb-1">FX Type</label>
                  <select
                    value={settings.fxType}
                    onChange={(e) => setSettings({...settings, fxType: e.target.value})}
                    className="w-full px-3 py-2 bg-zinc-700 rounded border border-zinc-600"
                  >
                    <option value="none">None</option>
                    <option value="lowpass">Lowpass Filter</option>
                    <option value="highpass">Highpass Filter</option>
                    <option value="chorus">Chorus</option>
                    <option value="delay">Delay</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm mb-1">Sample Rate</label>
                <select
                  value={settings.sampleRate}
                  onChange={(e) => setSettings({...settings, sampleRate: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 bg-zinc-700 rounded border border-zinc-600"
                >
                  <option value="44100">44.1 kHz</option>
                  <option value="48000">48 kHz</option>
                  <option value="96000">96 kHz</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                Apply
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Enhanced3DAcousticsVST;