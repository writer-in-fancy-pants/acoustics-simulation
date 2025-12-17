import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Plus, Trash2, Play, Square, Settings, Download, Save } from 'lucide-react';

const AcousticSimulatorVST = () => {
  // State management
  const [geometry, setGeometry] = useState(null);
  const [sources, setSources] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [medium, setMedium] = useState('air');
  const [selectedPreset, setSelectedPreset] = useState('room');
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rotation, setRotation] = useState({ x: 30, y: 45 });
  
  // Settings state
  const [settings, setSettings] = useState({
    maxReflections: 5,
    maxDistance: 100,
    decayRate: 0.8,
    useFX: false,
    fxType: 'none',
    sampleRate: 44100
  });

  const canvasRef = useRef(null);

  // Preset geometries
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
      material: 'carpet'
    }
  };

  // Initialize with preset
  useEffect(() => {
    loadPreset(selectedPreset);
  }, []);

  // Load preset geometry
  const loadPreset = (presetName) => {
    const preset = presets[presetName];
    if (preset) {
      setGeometry(preset);
      setSelectedPreset(presetName);
    }
  };

  // Add audio source
  const addSource = () => {
    const newSource = {
      id: Date.now(),
      position: [0, 0, 1.5],
      name: `Source ${sources.length + 1}`,
      channel: sources.length + 1
    };
    setSources([...sources, newSource]);
  };

  // Add output channel
  const addOutput = () => {
    const newOutput = {
      id: Date.now(),
      position: [2, 2, 1.5],
      name: `Out ${outputs.length + 1}`,
      channel: outputs.length + 1
    };
    setOutputs([...outputs, newOutput]);
  };

  // Remove source
  const removeSource = (id) => {
    setSources(sources.filter(s => s.id !== id));
  };

  // Remove output
  const removeOutput = (id) => {
    setOutputs(outputs.filter(o => o.id !== id));
  };

  // Update position
  const updatePosition = (type, id, axis, value) => {
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
  };

  // 3D visualization
  useEffect(() => {
    if (!canvasRef.current || !geometry) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Projection function
    const project = (point) => {
      const [x, y, z] = point;
      
      // Rotation
      const rx = rotation.x * Math.PI / 180;
      const ry = rotation.y * Math.PI / 180;
      
      // Rotate around Y
      const x1 = x * Math.cos(ry) - z * Math.sin(ry);
      const z1 = x * Math.sin(ry) + z * Math.cos(ry);
      
      // Rotate around X
      const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      
      // Perspective projection
      const scale = 300 / (z2 + 30);
      const screenX = width / 2 + x1 * scale;
      const screenY = height / 2 - y2 * scale;
      
      return [screenX, screenY, z2];
    };

    // Draw edges
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    
    const edges = [
      [0,1], [1,2], [2,3], [3,0],
      [4,5], [5,6], [6,7], [7,4],
      [0,4], [1,5], [2,6], [3,7]
    ];

    edges.forEach(([i, j]) => {
      const p1 = project(geometry.vertices[i]);
      const p2 = project(geometry.vertices[j]);
      
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    });

    // Draw sources (red)
    sources.forEach(source => {
      const [x, y, z] = project(source.position);
      
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#fca5a5';
      ctx.font = '10px monospace';
      ctx.fillText(source.name, x + 10, y);
    });

    // Draw outputs (yellow)
    outputs.forEach(output => {
      const [x, y, z] = project(output.position);
      
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#fde047';
      ctx.font = '10px monospace';
      ctx.fillText(output.name, x + 10, y);
    });

    // Draw coordinate axes
    const axisLength = 2;
    const origin = project([0, 0, 0]);
    
    // X axis (red)
    const xAxis = project([axisLength, 0, 0]);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(xAxis[0], xAxis[1]);
    ctx.stroke();
    
    // Y axis (green)
    const yAxis = project([0, axisLength, 0]);
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(yAxis[0], yAxis[1]);
    ctx.stroke();
    
    // Z axis (blue)
    const zAxis = project([0, 0, axisLength]);
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(zAxis[0], zAxis[1]);
    ctx.stroke();

  }, [geometry, sources, outputs, rotation]);

  // Mouse drag for rotation
  const handleMouseDown = (e) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const startRot = { ...rotation };

    const handleMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      setRotation({
        x: startRot.x + dy * 0.5,
        y: startRot.y + dx * 0.5
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="w-full h-screen bg-zinc-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-zinc-800 border-b border-zinc-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">Acoustic Simulator VST</h1>
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
          <button className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded flex items-center gap-2">
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Geometry */}
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
              Upload Custom OBJ
            </button>
          </div>

          {geometry && (
            <div className="p-3 border-b border-zinc-700">
              <h3 className="text-sm font-semibold mb-2">Geometry Info</h3>
              <div className="text-xs text-zinc-400 space-y-1">
                <div>Vertices: {geometry.vertices.length}</div>
                <div>Faces: {geometry.faces.length}</div>
                <div>Material: {geometry.material}</div>
              </div>
            </div>
          )}
        </div>

        {/* Center - 3D View */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full h-full cursor-move"
              onMouseDown={handleMouseDown}
            />
            <div className="absolute top-4 right-4 bg-zinc-800/90 px-3 py-2 rounded text-xs">
              <div className="text-zinc-400">Drag to rotate</div>
              <div className="flex gap-4 mt-1">
                <span className="text-red-400">● Sources</span>
                <span className="text-yellow-400">● Outputs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Sources & Outputs */}
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
                      onClick={() => removeSource(source.id)}
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
                          value={source.position[i]}
                          onChange={(e) => updatePosition('source', source.id, i, e.target.value)}
                          step="0.1"
                          className="w-full bg-zinc-800 px-1 py-1 rounded border border-zinc-600"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Channel: {source.channel}
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
                          value={output.position[i]}
                          onChange={(e) => updatePosition('output', output.id, i, e.target.value)}
                          step="0.1"
                          className="w-full bg-zinc-800 px-1 py-1 rounded border border-zinc-600"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Channel: {output.channel}
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

export default AcousticSimulatorVST;