import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Grid, 
  GizmoHelper, 
  GizmoViewcube,
  PerspectiveCamera,
  useGLTF,
  Html,
  Line
} from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

// Audio Source Marker Component
function AudioSource({ position, name, isPlaying, onDragEnd, selected }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current && isPlaying) {
      // Pulsing animation when playing
      const scale = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
      meshRef.current.scale.setScalar(scale);
    }
  });
  
  return (
    <group position={position}>
      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={() => setDragging(true)}
        onPointerUp={(e) => {
          setDragging(false);
          onDragEnd?.(e.point);
        }}
      >
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial 
          color={isPlaying ? '#ef4444' : '#7f1d1d'}
          emissive={isPlaying ? '#ef4444' : '#000'}
          emissiveIntensity={isPlaying ? 0.5 : 0}
        />
      </mesh>
      
      {/* Selection ring */}
      {(selected || hovered) && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.3, 32]} />
          <meshBasicMaterial 
            color={selected ? '#fbbf24' : '#ffffff'} 
            side={THREE.DoubleSide}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
      
      {/* Sound waves when playing */}
      {isPlaying && (
        <>
          {[1, 2, 3].map((i) => (
            <WaveRing key={i} delay={i * 0.3} />
          ))}
        </>
      )}
      
      {/* Label */}
      <Html distanceFactor={10}>
        <div className="bg-black/70 text-red-400 px-2 py-1 rounded text-xs whitespace-nowrap">
          {name}
        </div>
      </Html>
    </group>
  );
}

// Animated wave ring for playing sources
function WaveRing({ delay = 0 }) {
  const meshRef = useRef();
  
  useFrame((state) => {
    if (meshRef.current) {
      const t = (state.clock.elapsedTime - delay) % 2;
      meshRef.current.scale.setScalar(1 + t * 2);
      meshRef.current.material.opacity = Math.max(0, 1 - t);
    }
  });
  
  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 0.35, 32]} />
      <meshBasicMaterial 
        color="#ef4444" 
        transparent 
        opacity={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Output/Microphone Marker Component
function OutputMarker({ position, name, onDragEnd, selected }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  
  return (
    <group position={position}>
      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#eab308" />
      </mesh>
      
      {/* Selection ring */}
      {(selected || hovered) && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.3, 32]} />
          <meshBasicMaterial 
            color={selected ? '#fbbf24' : '#ffffff'} 
            side={THREE.DoubleSide}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
      
      {/* Label */}
      <Html distanceFactor={10}>
        <div className="bg-black/70 text-yellow-400 px-2 py-1 rounded text-xs whitespace-nowrap">
          {name}
        </div>
      </Html>
    </group>
  );
}

// Room geometry component
function RoomGeometry({ geometry, material = 'concrete' }) {
  const meshRef = useRef();
  
  useEffect(() => {
    if (!geometry || !meshRef.current) return;
    
    const vertices = new Float32Array(geometry.vertices.flat());
    const indices = new Uint16Array(geometry.faces.flat());
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    
    meshRef.current.geometry = geom;
  }, [geometry]);
  
  return (
    <group>
      {/* Solid mesh with transparency */}
      <mesh ref={meshRef}>
        <meshStandardMaterial 
          color="#3b82f6"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Wireframe edges */}
      {geometry?.edges && geometry.edges.map((edge, i) => {
        const [v1, v2] = edge;
        const start = geometry.vertices[v1];
        const end = geometry.vertices[v2];
        
        return (
          <Line
            key={i}
            points={[start, end]}
            color="#3b82f6"
            lineWidth={2}
          />
        );
      })}
    </group>
  );
}

// Main 3D Viewer Component
function AcousticsViewer3D({ 
  geometry, 
  sources, 
  outputs,
  onSourceUpdate,
  onOutputUpdate,
  selectedObject
}) {
  const controlsRef = useRef();
  
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [20, 15, 20], fov: 50 }}
        shadows
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={0.8}
          castShadow
        />
        <pointLight position={[-10, 10, -10]} intensity={0.3} />
        
        {/* Camera controls */}
        <OrbitControls 
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={100}
          makeDefault
        />
        
        {/* Grid */}
        <Grid 
          args={[50, 50]}
          cellSize={2}
          cellThickness={0.5}
          cellColor="#1a1a1a"
          sectionSize={10}
          sectionThickness={1}
          sectionColor="#2a2a2a"
          fadeDistance={100}
          fadeStrength={1}
        />
        
        {/* Coordinate axes helper */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewcube />
        </GizmoHelper>
        
        {/* Room geometry */}
        {geometry && <RoomGeometry geometry={geometry} />}
        
        {/* Audio sources */}
        {sources.map(source => (
          <AudioSource
            key={source.id}
            position={source.position}
            name={source.name}
            isPlaying={source.playing}
            selected={selectedObject?.type === 'source' && selectedObject.id === source.id}
            onDragEnd={(point) => onSourceUpdate?.(source.id, point)}
          />
        ))}
        
        {/* Outputs */}
        {outputs.map(output => (
          <OutputMarker
            key={output.id}
            position={output.position}
            name={output.name}
            selected={selectedObject?.type === 'output' && selectedObject.id === output.id}
            onDragEnd={(point) => onOutputUpdate?.(output.id, point)}
          />
        ))}
        
        {/* Ray paths (optional - shows sound paths) */}
        {sources.map(source => 
          outputs.map(output => (
            <Line
              key={`${source.id}-${output.id}`}
              points={[source.position, output.position]}
              color="#ef4444"
              lineWidth={1}
              transparent
              opacity={0.2}
              dashed
              dashScale={50}
            />
          ))
        )}
      </Canvas>
      
      {/* Overlay controls */}
      <div className="absolute top-4 left-4 bg-zinc-800/90 p-3 rounded text-xs space-y-2">
        <div className="font-semibold">Controls</div>
        <div className="text-zinc-400">
          <div>Left Click + Drag: Rotate</div>
          <div>Right Click + Drag: Pan</div>
          <div>Scroll: Zoom</div>
          <div>Click Object: Select</div>
        </div>
      </div>
    </div>
  );
}

export default AcousticsViewer3D;