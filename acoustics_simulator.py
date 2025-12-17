"""
Acoustics Simulation Engine
Main simulation engine with reverb processing and FX chain support
"""

import numpy as np
from scipy import signal
from typing import List, Callable, Optional, Tuple
from dataclasses import dataclass

from acoustics_core import (
    Vector3, Triangle, AudioSource, Microphone, 
    RayTracer, Reflection, MediumDatabase, MaterialDatabase
)

# ============================================================================
# Impulse Response Generator
# ============================================================================

class ImpulseResponseGenerator:
    """Generate impulse responses from reflection data"""
    
    def __init__(self, sample_rate: int, medium_speed: float = 343.0):
        self.sample_rate = sample_rate
        self.medium_speed = medium_speed
    
    def generate_ir(self, reflections: List[Reflection], 
                    duration_sec: float = 2.0) -> np.ndarray:
        """Generate impulse response from reflections"""
        num_samples = int(duration_sec * self.sample_rate)
        ir = np.zeros(num_samples)
        
        for refl in reflections:
            # Calculate delay in samples
            delay_sec = refl.path_length / self.medium_speed
            delay_samples = int(delay_sec * self.sample_rate)
            
            if delay_samples < num_samples:
                # Use average attenuation across frequency bands
                amplitude = np.mean(refl.attenuation)
                
                # Add impulse with exponential decay for diffuse reflections
                if refl.triangle:
                    mat = MaterialDatabase.get_material(refl.triangle.material)
                    decay = 1.0 - mat.diffusion_coeff * 0.3
                else:
                    decay = 1.0
                
                # Create short pulse with decay
                pulse_len = min(64, num_samples - delay_samples)
                pulse = amplitude * np.exp(-np.arange(pulse_len) / (self.sample_rate * 0.01))
                pulse *= decay
                
                ir[delay_samples:delay_samples + pulse_len] += pulse
        
        return ir
    
    def generate_frequency_dependent_ir(self, reflections: List[Reflection],
                                       duration_sec: float = 2.0) -> np.ndarray:
        """Generate frequency-dependent impulse response using filterbank"""
        num_samples = int(duration_sec * self.sample_rate)
        
        # Frequency bands (Hz)
        bands = np.array([125, 250, 500, 1000, 2000, 4000])
        
        # Create filterbank
        irs_per_band = []
        for i, freq in enumerate(bands):
            ir_band = np.zeros(num_samples)
            
            for refl in reflections:
                delay_sec = refl.path_length / self.medium_speed
                delay_samples = int(delay_sec * self.sample_rate)
                
                if delay_samples < num_samples:
                    amplitude = refl.attenuation[i]
                    pulse_len = min(64, num_samples - delay_samples)
                    pulse = amplitude * np.exp(-np.arange(pulse_len) / (self.sample_rate * 0.01))
                    ir_band[delay_samples:delay_samples + pulse_len] += pulse
            
            irs_per_band.append(ir_band)
        
        # Combine bands using bandpass filters
        ir_combined = np.zeros(num_samples)
        for i, (ir_band, freq) in enumerate(zip(irs_per_band, bands)):
            # Design bandpass filter
            if i == 0:
                # Lowpass for first band
                sos = signal.butter(4, freq * 1.5, 'low', fs=self.sample_rate, output='sos')
            elif i == len(bands) - 1:
                # Highpass for last band
                sos = signal.butter(4, freq * 0.67, 'high', fs=self.sample_rate, output='sos')
            else:
                # Bandpass for middle bands
                low = freq * 0.67
                high = freq * 1.5
                sos = signal.butter(4, [low, high], 'band', fs=self.sample_rate, output='sos')
            
            # Filter and add
            ir_filtered = signal.sosfilt(sos, ir_band)
            ir_combined += ir_filtered
        
        return ir_combined

# ============================================================================
# FX Chain Processor
# ============================================================================

class FXChain:
    """Effects chain for processing individual reflections"""
    
    def __init__(self):
        self.processors: List[Callable[[np.ndarray], np.ndarray]] = []
    
    def add_processor(self, processor: Callable[[np.ndarray], np.ndarray]):
        """Add effect processor to chain"""
        self.processors.append(processor)
    
    def process(self, audio: np.ndarray) -> np.ndarray:
        """Process audio through effect chain"""
        output = audio.copy()
        for proc in self.processors:
            output = proc(output)
        return output
    
    def clear(self):
        """Clear all processors"""
        self.processors.clear()

# Common FX processors
class FXProcessors:
    """Common audio effect processors"""
    
    @staticmethod
    def lowpass_filter(cutoff_hz: float, sample_rate: int):
        """Create lowpass filter processor"""
        def process(audio: np.ndarray) -> np.ndarray:
            sos = signal.butter(4, cutoff_hz, 'low', fs=sample_rate, output='sos')
            return signal.sosfilt(sos, audio)
        return process
    
    @staticmethod
    def highpass_filter(cutoff_hz: float, sample_rate: int):
        """Create highpass filter processor"""
        def process(audio: np.ndarray) -> np.ndarray:
            sos = signal.butter(4, cutoff_hz, 'high', fs=sample_rate, output='sos')
            return signal.sosfilt(sos, audio)
        return process
    
    @staticmethod
    def delay(delay_ms: float, sample_rate: int, feedback: float = 0.3):
        """Create delay effect processor"""
        def process(audio: np.ndarray) -> np.ndarray:
            delay_samples = int(delay_ms * sample_rate / 1000)
            output = audio.copy()
            if delay_samples < len(audio):
                output[delay_samples:] += audio[:-delay_samples] * feedback
            return output
        return process
    
    @staticmethod
    def chorus(rate_hz: float = 1.5, depth: float = 0.002, sample_rate: int = 44100):
        """Create chorus effect processor"""
        def process(audio: np.ndarray) -> np.ndarray:
            num_samples = len(audio)
            t = np.arange(num_samples) / sample_rate
            
            # LFO for delay modulation
            lfo = np.sin(2 * np.pi * rate_hz * t)
            delay_samples = (depth * sample_rate * lfo).astype(int)
            
            output = audio.copy()
            for i in range(num_samples):
                delayed_idx = i - delay_samples[i]
                if 0 <= delayed_idx < num_samples:
                    output[i] = 0.7 * audio[i] + 0.3 * audio[delayed_idx]
            
            return output
        return process

# ============================================================================
# Acoustic Simulator
# ============================================================================

class AcousticSimulator:
    """Main acoustic simulation engine"""
    
    def __init__(self, geometry: List[Triangle], medium: str = 'air',
                 sample_rate: int = 44100):
        self.geometry = geometry
        self.medium = MediumDatabase.get_medium(medium)
        self.sample_rate = sample_rate
        self.sources: List[AudioSource] = []
        self.microphones: List[Microphone] = []
        self.fx_chain: Optional[FXChain] = None
        
        # Simulation parameters
        self.max_reflections = 5
        self.max_distance = 100.0
        self.use_frequency_dependent = True
        
        # Initialize ray tracer
        self.ray_tracer = RayTracer(
            self.geometry, 
            self.medium,
            self.max_reflections,
            self.max_distance
        )
        
        # IR generator
        self.ir_gen = ImpulseResponseGenerator(
            self.sample_rate,
            self.medium.speed_of_sound
        )
    
    def add_source(self, source: AudioSource):
        """Add audio source"""
        self.sources.append(source)
    
    def add_microphone(self, mic: Microphone):
        """Add microphone"""
        self.microphones.append(mic)
    
    def set_fx_chain(self, fx_chain: FXChain):
        """Set FX chain for reflection processing"""
        self.fx_chain = fx_chain
    
    def simulate(self) -> List[np.ndarray]:
        """Simulate acoustics for all microphones"""
        outputs = []
        
        for mic in self.microphones:
            mic_output = np.zeros(
                max(src.audio_data.shape[0] for src in self.sources) + 
                int(2.0 * self.sample_rate)  # Add 2 sec for reverb tail
            )
            
            for source in self.sources:
                # Trace paths from source to mic
                reflections = self.ray_tracer.trace_path(
                    source.position,
                    mic.position
                )
                
                # Generate impulse response
                if self.use_frequency_dependent:
                    ir = self.ir_gen.generate_frequency_dependent_ir(reflections)
                else:
                    ir = self.ir_gen.generate_ir(reflections)
                
                # Apply FX chain to IR if enabled
                if self.fx_chain:
                    ir = self.fx_chain.process(ir)
                
                # Convolve source audio with impulse response
                convolved = signal.fftconvolve(source.audio_data, ir, mode='full')
                
                # Mix into mic output
                mic_output[:len(convolved)] += convolved
            
            # Normalize
            max_val = np.max(np.abs(mic_output))
            if max_val > 0:
                mic_output = mic_output / max_val * 0.9
            
            outputs.append(mic_output)
        
        return outputs
    
    def get_room_response(self, source_pos: Vector3, mic_pos: Vector3,
                         duration: float = 2.0) -> Tuple[np.ndarray, List[Reflection]]:
        """Get impulse response and reflection data for a source-mic pair"""
        reflections = self.ray_tracer.trace_path(source_pos, mic_pos)
        
        if self.use_frequency_dependent:
            ir = self.ir_gen.generate_frequency_dependent_ir(reflections, duration)
        else:
            ir = self.ir_gen.generate_ir(reflections, duration)
        
        return ir, reflections

# ============================================================================
# Geometry Loaders
# ============================================================================

class GeometryLoader:
    """Load 3D geometry from various formats"""
    
    @staticmethod
    def load_obj(filename: str, default_material: str = 'concrete') -> List[Triangle]:
        """Load geometry from OBJ file"""
        vertices = []
        triangles = []
        
        with open(filename, 'r') as f:
            for line in f:
                parts = line.strip().split()
                if not parts:
                    continue
                
                if parts[0] == 'v':
                    # Vertex
                    x, y, z = map(float, parts[1:4])
                    vertices.append(Vector3(x, y, z))
                
                elif parts[0] == 'f':
                    # Face (assuming triangles)
                    indices = [int(p.split('/')[0]) - 1 for p in parts[1:4]]
                    triangles.append(Triangle(
                        vertices[indices[0]],
                        vertices[indices[1]],
                        vertices[indices[2]],
                        default_material
                    ))
        
        return triangles
    
    @staticmethod
    def create_box(size: Vector3, material: str = 'concrete') -> List[Triangle]:
        """Create box geometry"""
        x, y, z = size.x / 2, size.y / 2, size.z / 2
        
        # 8 vertices of box
        v = [
            Vector3(-x, -y, -z), Vector3(x, -y, -z),
            Vector3(x, y, -z), Vector3(-x, y, -z),
            Vector3(-x, -y, z), Vector3(x, -y, z),
            Vector3(x, y, z), Vector3(-x, y, z)
        ]
        
        # 12 triangles (2 per face)
        triangles = [
            # Front
            Triangle(v[0], v[1], v[2], material), Triangle(v[0], v[2], v[3], material),
            # Back
            Triangle(v[4], v[6], v[5], material), Triangle(v[4], v[7], v[6], material),
            # Left
            Triangle(v[0], v[3], v[7], material), Triangle(v[0], v[7], v[4], material),
            # Right
            Triangle(v[1], v[5], v[6], material), Triangle(v[1], v[6], v[2], material),
            # Top
            Triangle(v[3], v[2], v[6], material), Triangle(v[3], v[6], v[7], material),
            # Bottom
            Triangle(v[0], v[4], v[5], material), Triangle(v[0], v[5], v[1], material),
        ]
        
        return triangles

# Example usage
if __name__ == "__main__":
    # Create simple room
    room = GeometryLoader.create_box(Vector3(10, 8, 6), 'concrete')
    
    # Create simulator
    sim = AcousticSimulator(room, medium='air', sample_rate=44100)
    
    # Add source
    test_audio = np.random.randn(44100)  # 1 second of noise
    source = AudioSource(
        position=Vector3(2, 2, 1.5),
        audio_data=test_audio,
        sample_rate=44100,
        name="Test Source"
    )
    sim.add_source(source)
    
    # Add microphone
    mic = Microphone(position=Vector3(8, 6, 1.5), name="Test Mic")
    sim.add_microphone(mic)
    
    # Simulate
    print("Running simulation...")
    outputs = sim.simulate()
    print(f"Generated {len(outputs)} output channels")
    print(f"Output length: {len(outputs[0])} samples ({len(outputs[0])/44100:.2f} seconds)")