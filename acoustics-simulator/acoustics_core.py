"""
Acoustics Simulation Library - Core Module
Supports multi-source, multi-mic 3D acoustic simulation with material properties
"""

import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional, Callable
from enum import Enum
import json

# ============================================================================
# Material Properties Database
# ============================================================================

@dataclass
class MaterialProperties:
    """Acoustic properties of materials"""
    name: str
    absorption_coeff: np.ndarray  # Frequency-dependent [125, 250, 500, 1k, 2k, 4k Hz]
    reflection_coeff: np.ndarray
    diffusion_coeff: float  # 0=specular, 1=diffuse
    density: float  # kg/m³
    speed_of_sound: float  # m/s
    impedance: float  # Rayl

class MaterialDatabase:
    """Database of common material acoustic properties"""
    
    MATERIALS = {
        # Woods
        'oak': MaterialProperties(
            name='Oak Wood',
            absorption_coeff=np.array([0.15, 0.15, 0.10, 0.10, 0.10, 0.10]),
            reflection_coeff=np.array([0.85, 0.85, 0.90, 0.90, 0.90, 0.90]),
            diffusion_coeff=0.3,
            density=750,
            speed_of_sound=3850,
            impedance=2.89e6
        ),
        'pine': MaterialProperties(
            name='Pine Wood',
            absorption_coeff=np.array([0.10, 0.10, 0.08, 0.08, 0.08, 0.08]),
            reflection_coeff=np.array([0.90, 0.90, 0.92, 0.92, 0.92, 0.92]),
            diffusion_coeff=0.25,
            density=550,
            speed_of_sound=3320,
            impedance=1.83e6
        ),
        'maple': MaterialProperties(
            name='Maple Wood',
            absorption_coeff=np.array([0.12, 0.12, 0.09, 0.09, 0.09, 0.09]),
            reflection_coeff=np.array([0.88, 0.88, 0.91, 0.91, 0.91, 0.91]),
            diffusion_coeff=0.28,
            density=705,
            speed_of_sound=4110,
            impedance=2.90e6
        ),
        
        # Metals
        'steel': MaterialProperties(
            name='Steel',
            absorption_coeff=np.array([0.05, 0.05, 0.05, 0.05, 0.05, 0.05]),
            reflection_coeff=np.array([0.95, 0.95, 0.95, 0.95, 0.95, 0.95]),
            diffusion_coeff=0.1,
            density=7850,
            speed_of_sound=5960,
            impedance=4.68e7
        ),
        'aluminum': MaterialProperties(
            name='Aluminum',
            absorption_coeff=np.array([0.05, 0.05, 0.05, 0.05, 0.05, 0.05]),
            reflection_coeff=np.array([0.95, 0.95, 0.95, 0.95, 0.95, 0.95]),
            diffusion_coeff=0.08,
            density=2700,
            speed_of_sound=6420,
            impedance=1.73e7
        ),
        'copper': MaterialProperties(
            name='Copper',
            absorption_coeff=np.array([0.04, 0.04, 0.04, 0.04, 0.04, 0.04]),
            reflection_coeff=np.array([0.96, 0.96, 0.96, 0.96, 0.96, 0.96]),
            diffusion_coeff=0.12,
            density=8960,
            speed_of_sound=4760,
            impedance=4.26e7
        ),
        
        # Building Materials
        'concrete': MaterialProperties(
            name='Concrete',
            absorption_coeff=np.array([0.01, 0.01, 0.02, 0.02, 0.03, 0.04]),
            reflection_coeff=np.array([0.99, 0.99, 0.98, 0.98, 0.97, 0.96]),
            diffusion_coeff=0.15,
            density=2400,
            speed_of_sound=3200,
            impedance=7.68e6
        ),
        'brick': MaterialProperties(
            name='Brick',
            absorption_coeff=np.array([0.03, 0.03, 0.03, 0.04, 0.05, 0.07]),
            reflection_coeff=np.array([0.97, 0.97, 0.97, 0.96, 0.95, 0.93]),
            diffusion_coeff=0.4,
            density=1920,
            speed_of_sound=3650,
            impedance=7.01e6
        ),
        'plaster': MaterialProperties(
            name='Plaster',
            absorption_coeff=np.array([0.02, 0.02, 0.03, 0.04, 0.05, 0.05]),
            reflection_coeff=np.array([0.98, 0.98, 0.97, 0.96, 0.95, 0.95]),
            diffusion_coeff=0.2,
            density=1200,
            speed_of_sound=2000,
            impedance=2.40e6
        ),
        'glass': MaterialProperties(
            name='Glass',
            absorption_coeff=np.array([0.18, 0.06, 0.04, 0.03, 0.02, 0.02]),
            reflection_coeff=np.array([0.82, 0.94, 0.96, 0.97, 0.98, 0.98]),
            diffusion_coeff=0.05,
            density=2500,
            speed_of_sound=5640,
            impedance=1.41e7
        ),
        
        # Soft Materials
        'carpet': MaterialProperties(
            name='Carpet',
            absorption_coeff=np.array([0.08, 0.24, 0.57, 0.69, 0.71, 0.73]),
            reflection_coeff=np.array([0.92, 0.76, 0.43, 0.31, 0.29, 0.27]),
            diffusion_coeff=0.8,
            density=200,
            speed_of_sound=100,
            impedance=2.00e4
        ),
        'curtain': MaterialProperties(
            name='Curtain (Heavy)',
            absorption_coeff=np.array([0.14, 0.35, 0.55, 0.72, 0.70, 0.65]),
            reflection_coeff=np.array([0.86, 0.65, 0.45, 0.28, 0.30, 0.35]),
            diffusion_coeff=0.9,
            density=300,
            speed_of_sound=80,
            impedance=2.40e4
        ),
    }
    
    @classmethod
    def get_material(cls, name: str) -> MaterialProperties:
        """Get material properties by name"""
        return cls.MATERIALS.get(name.lower(), cls.MATERIALS['concrete'])
    
    @classmethod
    def list_materials(cls) -> List[str]:
        """List all available materials"""
        return list(cls.MATERIALS.keys())

# ============================================================================
# Medium Properties
# ============================================================================

@dataclass
class MediumProperties:
    """Properties of sound propagation medium"""
    name: str
    speed_of_sound: float  # m/s
    density: float  # kg/m³
    impedance: float  # Rayl
    attenuation_coeff: float  # dB/m/kHz

class MediumDatabase:
    """Database of propagation media"""
    
    MEDIA = {
        'air': MediumProperties(
            name='Air (20°C)',
            speed_of_sound=343.0,
            density=1.204,
            impedance=413.0,
            attenuation_coeff=0.0012
        ),
        'water': MediumProperties(
            name='Water (20°C)',
            speed_of_sound=1482.0,
            density=998.0,
            impedance=1.48e6,
            attenuation_coeff=0.0003
        ),
        'glass': MediumProperties(
            name='Glass',
            speed_of_sound=5640.0,
            density=2500.0,
            impedance=1.41e7,
            attenuation_coeff=0.0001
        ),
        'earth': MediumProperties(
            name='Earth (soil)',
            speed_of_sound=1800.0,
            density=1600.0,
            impedance=2.88e6,
            attenuation_coeff=0.05
        ),
    }
    
    @classmethod
    def get_medium(cls, name: str) -> MediumProperties:
        """Get medium properties by name"""
        return cls.MEDIA.get(name.lower(), cls.MEDIA['air'])

# ============================================================================
# 3D Geometry
# ============================================================================

@dataclass
class Vector3:
    """3D vector"""
    x: float
    y: float
    z: float
    
    def __add__(self, other):
        return Vector3(self.x + other.x, self.y + other.y, self.z + other.z)
    
    def __sub__(self, other):
        return Vector3(self.x - other.x, self.y - other.y, self.z - other.z)
    
    def __mul__(self, scalar):
        return Vector3(self.x * scalar, self.y * scalar, self.z * scalar)
    
    def dot(self, other):
        return self.x * other.x + self.y * other.y + self.z * other.z
    
    def cross(self, other):
        return Vector3(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x
        )
    
    def length(self):
        return np.sqrt(self.x**2 + self.y**2 + self.z**2)
    
    def normalize(self):
        l = self.length()
        if l > 0:
            return Vector3(self.x/l, self.y/l, self.z/l)
        return Vector3(0, 0, 0)
    
    def to_array(self):
        return np.array([self.x, self.y, self.z])

@dataclass
class Triangle:
    """Triangle face with material"""
    v0: Vector3
    v1: Vector3
    v2: Vector3
    material: str
    
    def normal(self) -> Vector3:
        """Calculate surface normal"""
        edge1 = self.v1 - self.v0
        edge2 = self.v2 - self.v0
        return edge1.cross(edge2).normalize()
    
    def center(self) -> Vector3:
        """Calculate centroid"""
        return Vector3(
            (self.v0.x + self.v1.x + self.v2.x) / 3,
            (self.v0.y + self.v1.y + self.v2.y) / 3,
            (self.v0.z + self.v1.z + self.v2.z) / 3
        )
    
    def area(self) -> float:
        """Calculate surface area"""
        edge1 = self.v1 - self.v0
        edge2 = self.v2 - self.v0
        return edge1.cross(edge2).length() / 2.0

# ============================================================================
# Audio Source and Microphone
# ============================================================================

@dataclass
class AudioSource:
    """Audio source in 3D space"""
    position: Vector3
    audio_data: np.ndarray  # Audio samples
    sample_rate: int
    name: str = "Source"
    
@dataclass
class Microphone:
    """Microphone in 3D space"""
    position: Vector3
    name: str = "Mic"
    directivity_pattern: str = "omnidirectional"  # or "cardioid", "figure8"

# ============================================================================
# Reflection and Ray Tracing
# ============================================================================

@dataclass
class Reflection:
    """Single reflection event"""
    path_length: float
    reflection_point: Vector3
    reflection_count: int
    attenuation: np.ndarray  # Frequency-dependent
    delay_samples: int
    triangle: Triangle

class RayTracer:
    """Ray tracing for acoustic reflections"""
    
    def __init__(self, geometry: List[Triangle], medium: MediumProperties, 
                 max_reflections: int = 10, max_distance: float = 100.0):
        self.geometry = geometry
        self.medium = medium
        self.max_reflections = max_reflections
        self.max_distance = max_distance
    
    def trace_path(self, source: Vector3, mic: Vector3) -> List[Reflection]:
        """Trace all significant paths from source to mic"""
        reflections = []
        
        # Direct path
        direct_dist = (mic - source).length()
        if direct_dist <= self.max_distance:
            direct_atten = self._calculate_attenuation(direct_dist, np.ones(6))
            reflections.append(Reflection(
                path_length=direct_dist,
                reflection_point=source,
                reflection_count=0,
                attenuation=direct_atten,
                delay_samples=0,
                triangle=None
            ))
        
        # First-order reflections
        for tri in self.geometry:
            ref_point = self._find_reflection_point(source, mic, tri)
            if ref_point:
                path_len = (ref_point - source).length() + (mic - ref_point).length()
                if path_len <= self.max_distance:
                    mat = MaterialDatabase.get_material(tri.material)
                    atten = self._calculate_attenuation(path_len, mat.reflection_coeff)
                    reflections.append(Reflection(
                        path_length=path_len,
                        reflection_point=ref_point,
                        reflection_count=1,
                        attenuation=atten,
                        delay_samples=0,
                        triangle=tri
                    ))
        
        return reflections
    
    def _find_reflection_point(self, source: Vector3, mic: Vector3, 
                               tri: Triangle) -> Optional[Vector3]:
        """Find reflection point on triangle (simplified)"""
        # Mirror source across plane
        normal = tri.normal()
        d = normal.dot(tri.v0 - source)
        mirror = source + normal * (2 * d)
        
        # Check if line from mirror to mic intersects triangle
        return tri.center()  # Simplified: use centroid
    
    def _calculate_attenuation(self, distance: float, 
                               reflection_coeff: np.ndarray) -> np.ndarray:
        """Calculate frequency-dependent attenuation"""
        # Distance attenuation (inverse square law)
        dist_atten = 1.0 / max(distance, 0.1)
        
        # Air absorption (frequency dependent)
        freqs = np.array([125, 250, 500, 1000, 2000, 4000])
        air_atten = np.exp(-self.medium.attenuation_coeff * distance * freqs / 1000.0)
        
        return reflection_coeff * dist_atten * air_atten

# ============================================================================
# Export Database to JSON
# ============================================================================

def export_material_database(filename: str = "materials.json"):
    """Export material database to JSON"""
    data = {}
    for name, mat in MaterialDatabase.MATERIALS.items():
        data[name] = {
            'name': mat.name,
            'absorption_coeff': mat.absorption_coeff.tolist(),
            'reflection_coeff': mat.reflection_coeff.tolist(),
            'diffusion_coeff': mat.diffusion_coeff,
            'density': mat.density,
            'speed_of_sound': mat.speed_of_sound,
            'impedance': mat.impedance
        }
    
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"Material database exported to {filename}")

if __name__ == "__main__":
    # Export database
    export_material_database()
    
    # Example usage
    print("Available materials:")
    for mat in MaterialDatabase.list_materials():
        props = MaterialDatabase.get_material(mat)
        print(f"  {props.name}: absorption @ 1kHz = {props.absorption_coeff[3]:.2f}")