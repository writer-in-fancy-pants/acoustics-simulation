# test_basic.py
import numpy as np
from acoustics_core import MaterialDatabase, Vector3
from acoustics_simulator import AcousticSimulator, GeometryLoader

def test_material_database():
    materials = MaterialDatabase.list_materials()
    assert len(materials) > 0
    
    concrete = MaterialDatabase.get_material('concrete')
    assert concrete.name == 'Concrete'
    assert len(concrete.absorption_coeff) == 6
    print("✓ Material database test passed")

def test_simple_simulation():
    room = GeometryLoader.create_box(Vector3(10, 8, 6), 'concrete')
    sim = AcousticSimulator(room, sample_rate=44100)
    
    from acoustics_core import AudioSource, Microphone
    
    test_signal = np.random.randn(44100)
    source = AudioSource(
        position=Vector3(2, 2, 1.5),
        audio_data=test_signal,
        sample_rate=44100
    )
    sim.add_source(source)
    
    mic = Microphone(position=Vector3(8, 6, 1.5))
    sim.add_microphone(mic)
    
    outputs = sim.simulate()
    assert len(outputs) == 1
    assert len(outputs[0]) > 0
    print("✓ Simulation test passed")

if __name__ == "__main__":
    test_material_database()
    test_simple_simulation()
    print("\n✅ All tests passed!")
