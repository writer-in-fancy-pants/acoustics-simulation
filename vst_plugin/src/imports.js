


import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';

function OBJModel({ url, material = 'concrete' }) {
  const obj = useLoader(OBJLoader, url);
  
  return (
    <primitive 
      object={obj} 
      scale={0.01} // Adjust scale as needed
    >
      <meshStandardMaterial 
        color="#3b82f6"
        transparent
        opacity={0.1}
      />
    </primitive>
  );
}

// Usage
// <OBJModel url="/models/room.obj" material="concrete" />

function STLModel({ url }) {
  const geometry = useLoader(STLLoader, url);
  
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial 
        color="#3b82f6"
        transparent
        opacity={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ModelUploader({ onLoad }) {
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'obj') {
      const loader = new OBJLoader();
      loader.load(url, (obj) => {
        onLoad(obj);
        URL.revokeObjectURL(url);
      });
    } else if (ext === 'stl') {
      const loader = new STLLoader();
      loader.load(url, (geometry) => {
        onLoad(geometry);
        URL.revokeObjectURL(url);
      });
    }
  };
  
  return (
    <input
      type="file"
      accept=".obj,.stl"
      onChange={handleFileUpload}
      className="..."
    />
  );
}

function CameraPresets() {
  const { camera, gl } = useThree();
  
  const setCameraView = (view) => {
    const positions = {
      perspective: [20, 15, 20],
      top: [0, 50, 0],
      front: [0, 0, 50],
      side: [50, 0, 0],
      iso: [30, 30, 30]
    };
    
    const lookAt = [0, 0, 0];
    
    camera.position.set(...positions[view]);
    camera.lookAt(...lookAt);
    gl.render();
  };
  
  return (
    <div className="flex gap-2">
      {['perspective', 'top', 'front', 'side', 'iso'].map(view => (
        <button 
          key={view}
          onClick={() => setCameraView(view)}
          className="px-3 py-1 bg-zinc-700 rounded text-xs"
        >
          {view}
        </button>
      ))}
    </div>
  );
}

function SmoothSource({ targetPosition, ...props }) {
  const meshRef = useRef();
  const currentPos = useRef(targetPosition);
  
  useFrame(() => {
    if (!meshRef.current) return;
    
    // Lerp to target position
    currentPos.current[0] += (targetPosition[0] - currentPos.current[0]) * 0.1;
    currentPos.current[1] += (targetPosition[1] - currentPos.current[1]) * 0.1;
    currentPos.current[2] += (targetPosition[2] - currentPos.current[2]) * 0.1;
    
    meshRef.current.position.set(...currentPos.current);
  });
  
  return <AudioSource ref={meshRef} {...props} />;
}

import { DragControls } from '@react-three/drei';

function DraggableSource({ position, onDrag, bounds }) {
  const constrainPosition = (pos) => {
    return [
      Math.max(bounds.min[0], Math.min(bounds.max[0], pos[0])),
      Math.max(bounds.min[1], Math.min(bounds.max[1], pos[1])),
      Math.max(bounds.min[2], Math.min(bounds.max[2], pos[2]))
    ];
  };
  
  return (
    <DragControls
      onDrag={(local) => {
        const constrained = constrainPosition(local.toArray());
        onDrag(constrained);
      }}
    >
      <AudioSource position={position} />
    </DragControls>
  );
}

import { Lod } from '@react-three/drei';

function OptimizedRoom({ geometry }) {
  return (
    <Lod distances={[0, 20, 40]}>
      {/* High detail */}
      <mesh geometry={highDetailGeometry}>
        <meshStandardMaterial />
      </mesh>
      
      {/* Medium detail */}
      <mesh geometry={mediumDetailGeometry}>
        <meshStandardMaterial />
      </mesh>
      
      {/* Low detail */}
      <mesh geometry={lowDetailGeometry}>
        <meshBasicMaterial />
      </mesh>
    </Lod>
  );
}

import { Instances, Instance } from '@react-three/drei';

function MultiSources({ sources }) {
  return (
    <Instances limit={1000}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial />
      
      {sources.map((source, i) => (
        <Instance 
          key={i}
          position={source.position}
          color={source.playing ? '#ef4444' : '#7f1d1d'}
        />
      ))}
    </Instances>
  );
}


// Advanced sound effects
import { Points, PointMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

function SoundParticles({ source, intensity }) {
  const particlesRef = useRef();
  const [positions] = useState(() => {
    const pos = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    return pos;
  });
  
  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    
    const time = clock.elapsedTime;
    for (let i = 0; i < 1000; i++) {
      const i3 = i * 3;
      const radius = 0.5 + (time * 0.5) % 2;
      const angle = (i / 1000) * Math.PI * 2;
      
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.sin(angle) * radius;
      positions[i3 + 2] = Math.sin(time + i) * 0.5;
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });
  
  return (
    <Points ref={particlesRef} positions={positions}>
      <PointMaterial 
        size={0.05} 
        color="#ef4444"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </Points>
  );
}

function Scene() {
  return (
    <>
      <Canvas>
        {/* Scene content */}
      </Canvas>
      
      <EffectComposer>
        <Bloom 
          intensity={0.5}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
        />
        <ChromaticAberration offset={[0.001, 0.001]} />
      </EffectComposer>
    </>
  );
}