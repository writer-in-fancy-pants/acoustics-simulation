"""
Complete Usage Examples for Acoustics Simulation Library
Demonstrates all major features including 3D geometry, materials, and FX chains
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy.io import wavfile

# Import our library modules
from acoustics_core import (
    Vector3, Triangle, AudioSource, Microphone,
    MaterialDatabase, MediumDatabase, GeometryLoader
)
from acoustics_simulator import (
    AcousticSimulator, FXChain, FXProcessors,
    ImpulseResponseGenerator
)

# ============================================================================
# Example 1: Simple Room Simulation
# ============================================================================

def example_simple_room():
    """Basic room acoustics simulation"""
    print("=" * 60)
    print("Example 1: Simple Room Simulation")
    print("=" * 60)
    
    # Create room geometry (5m x 4m x 3m)
    room = GeometryLoader.create_box(Vector3(10, 8, 6), 'concrete')
    
    # Create simulator
    sim = AcousticSimulator(room, medium='air', sample_rate=44100)
    sim.max_reflections = 10
    sim.use_frequency_dependent = True
    
    # Generate test tone (440 Hz sine wave, 1 second)
    duration = 1.0
    sample_rate = 44100
    t = np.linspace(0, duration, int(sample_rate * duration))
    test_signal = 0.5 * np.sin(2 * np.pi * 440 * t)
    
    # Add source
    source = AudioSource(
        position=Vector3(2, 2, 1.5),
        audio_data=test_signal,
        sample_rate=sample_rate,
        name="Speaker"
    )
    sim.add_source(source)
    
    # Add microphone
    mic = Microphone(position=Vector3(8, 6, 1.5), name="Mic 1")
    sim.add_microphone(mic)
    
    # Simulate
    print("Running simulation...")
    outputs = sim.simulate()
    
    print(f"✓ Generated {len(outputs)} output channel(s)")
    print(f"✓ Output length: {len(outputs[0])} samples "
          f"({len(outputs[0])/sample_rate:.2f} seconds)")
    
    # Save output
    output_normalized = np.int16(outputs[0] / np.max(np.abs(outputs[0])) * 32767)
    wavfile.write('output_simple_room.wav', sample_rate, output_normalized)
    print("✓ Saved to output_simple_room.wav")
    
    return outputs[0], sample_rate

# ============================================================================
# Example 2: Multi-Source Stereo Recording
# ============================================================================

def example_stereo_recording():
    """Simulate stereo recording with multiple sources"""
    print("\n" + "=" * 60)
    print("Example 2: Multi-Source Stereo Recording")
    print("=" * 60)
    
    # Create concert hall
    hall = GeometryLoader.create_box(Vector3(30, 20, 16), 'oak')
    
    # Create simulator
    sim = AcousticSimulator(hall, medium='air', sample_rate=44100)
    sim.max_reflections = 8
    
    sample_rate = 44100
    duration = 2.0
    t = np.linspace(0, duration, int(sample_rate * duration))
    
    # Source 1: Low frequency (100 Hz)
    signal1 = 0.3 * np.sin(2 * np.pi * 100 * t)
    source1 = AudioSource(
        position=Vector3(-5, 0, 1.5),
        audio_data=signal1,
        sample_rate=sample_rate,
        name="Bass"
    )
    sim.add_source(source1)
    
    # Source 2: Mid frequency (440 Hz)
    signal2 = 0.3 * np.sin(2 * np.pi * 440 * t)
    source2 = AudioSource(
        position=Vector3(5, 0, 1.5),
        audio_data=signal2,
        sample_rate=sample_rate,
        name="Lead"
    )
    sim.add_source(source2)
    
    # Source 3: High frequency (1000 Hz)
    signal3 = 0.2 * np.sin(2 * np.pi * 1000 * t)
    source3 = AudioSource(
        position=Vector3(0, 3, 1.5),
        audio_data=signal3,
        sample_rate=sample_rate,
        name="Hi-hat"
    )
    sim.add_source(source3)
    
    # Stereo microphones (left and right)
    mic_left = Microphone(position=Vector3(10, -2, 1.8), name="Left")
    mic_right = Microphone(position=Vector3(10, 2, 1.8), name="Right")
    sim.add_microphone(mic_left)
    sim.add_microphone(mic_right)
    
    # Simulate
    print("Running stereo simulation with 3 sources...")
    outputs = sim.simulate()
    
    print(f"✓ Generated stereo output: {len(outputs)} channels")
    print(f"✓ Left channel: {len(outputs[0])} samples")
    print(f"✓ Right channel: {len(outputs[1])} samples")
    
    # Save stereo output
    stereo_output = np.column_stack([outputs[0], outputs[1]])
    stereo_normalized = np.int16(stereo_output / np.max(np.abs(stereo_output)) * 32767)
    wavfile.write('output_stereo.wav', sample_rate, stereo_normalized)
    print("✓ Saved to output_stereo.wav")
    
    return outputs

# ============================================================================
# Example 3: FX Chain on Reflections
# ============================================================================

def example_fx_chain():
    """Demonstrate FX processing on reflections"""
    print("\n" + "=" * 60)
    print("Example 3: FX Chain on Reflections")
    print("=" * 60)
    
    # Create room with reflective material
    room = GeometryLoader.create_box(Vector3(12, 10, 7), 'steel')
    
    # Create simulator
    sim = AcousticSimulator(room, medium='air', sample_rate=44100)
    
    # Create FX chain
    fx = FXChain()
    fx.add_processor(FXProcessors.lowpass_filter(4000, 44100))
    fx.add_processor(FXProcessors.delay(50, 44100, feedback=0.2))
    fx.add_processor(FXProcessors.chorus(1.5, 0.002, 44100))
    
    sim.set_fx_chain(fx)
    
    # Generate impulse
    impulse = np.zeros(44100)
    impulse[0] = 1.0
    
    source = AudioSource(
        position=Vector3(3, 2, 1.5),
        audio_data=impulse,
        sample_rate=44100,
        name="Impulse"
    )
    sim.add_source(source)
    
    mic = Microphone(position=Vector3(9, 8, 1.5), name="Mic")
    sim.add_microphone(mic)
    
    print("Processing with FX chain (lowpass -> delay -> chorus)...")
    outputs = sim.simulate()
    
    print(f"✓ Generated impulse response with FX: {len(outputs[0])} samples")
    
    # Save
    output_normalized = np.int16(outputs[0] / np.max(np.abs(outputs[0])) * 32767)
    wavfile.write('output_fx_chain.wav', 44100, output_normalized)
    print("✓ Saved to output_fx_chain.wav")
    
    return outputs[0]

# ============================================================================
# Example 4: Different Media Comparison
# ============================================================================

def example_media_comparison():
    """Compare sound propagation in different media"""
    print("\n" + "=" * 60)
    print("Example 4: Different Media Comparison")
    print("=" * 60)
    
    room = GeometryLoader.create_box(Vector3(10, 8, 6), 'concrete')
    
    media = ['air', 'water', 'glass']
    results = {}
    
    # Test signal
    sample_rate = 44100
    duration = 0.5
    t = np.linspace(0, duration, int(sample_rate * duration))
    test_signal = 0.5 * np.sin(2 * np.pi * 440 * t)
    
    for medium_name in media:
        print(f"\nSimulating in {medium_name}...")
        
        medium = MediumDatabase.get_medium(medium_name)
        print(f"  Speed of sound: {medium.speed_of_sound:.1f} m/s")
        
        sim = AcousticSimulator(room, medium=medium_name, sample_rate=sample_rate)
        sim.max_reflections = 5
        
        source = AudioSource(
            position=Vector3(2, 2, 1.5),
            audio_data=test_signal,
            sample_rate=sample_rate
        )
        sim.add_source(source)
        
        mic = Microphone(position=Vector3(8, 6, 1.5))
        sim.add_microphone(mic)
        
        outputs = sim.simulate()
        results[medium_name] = outputs[0]
        
        print(f"  ✓ Generated {len(outputs[0])} samples")
    
    # Plot comparison
    fig, axes = plt.subplots(len(media), 1, figsize=(10, 8))
    for i, medium_name in enumerate(media):
        axes[i].plot(results[medium_name][:int(sample_rate * 0.1)])  # First 100ms
        axes[i].set_title(f'Medium: {medium_name}')
        axes[i].set_ylabel('Amplitude')
        if i == len(media) - 1:
            axes[i].set_xlabel('Samples')
    
    plt.tight_layout()
    plt.savefig('media_comparison.png')
    print("\n✓ Saved comparison plot to media_comparison.png")
    
    return results

# ============================================================================
# Example 5: Material Database Exploration
# ============================================================================

def example_material_database():
    """Explore material acoustic properties"""
    print("\n" + "=" * 60)
    print("Example 5: Material Database Exploration")
    print("=" * 60)
    
    materials = MaterialDatabase.list_materials()
    
    print(f"\nAvailable materials: {len(materials)}")
    print("-" * 60)
    
    freq_bands = ['125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz']
    
    for mat_name in sorted(materials):
        mat = MaterialDatabase.get_material(mat_name)
        print(f"\n{mat.name}:")
        print(f"  Density: {mat.density:.1f} kg/m³")
        print(f"  Speed of sound: {mat.speed_of_sound:.1f} m/s")
        print(f"  Diffusion: {mat.diffusion_coeff:.2f}")
        print(f"  Absorption coefficients:")
        for freq, coeff in zip(freq_bands, mat.absorption_coeff):
            print(f"    {freq:>6s}: {coeff:.3f}")
    
    # Plot absorption curves
    fig, ax = plt.subplots(figsize=(12, 6))
    
    freqs = [125, 250, 500, 1000, 2000, 4000]
    for mat_name in ['concrete', 'oak', 'carpet', 'glass']:
        mat = MaterialDatabase.get_material(mat_name)
        ax.plot(freqs, mat.absorption_coeff, marker='o', label=mat.name)
    
    ax.set_xlabel('Frequency (Hz)')
    ax.set_ylabel('Absorption Coefficient')
    ax.set_title('Material Absorption vs Frequency')
    ax.set_xscale('log')
    ax.grid(True, alpha=0.3)
    ax.legend()
    
    plt.tight_layout()
    plt.savefig('material_absorption.png')
    print("\n✓ Saved absorption plot to material_absorption.png")

# ============================================================================
# Example 6: Room Response Analysis
# ============================================================================

def example_room_response():
    """Analyze and visualize room impulse response"""
    print("\n" + "=" * 60)
    print("Example 6: Room Response Analysis")
    print("=" * 60)
    
    # Create room
    room = GeometryLoader.create_box(Vector3(10, 8, 6), 'oak')
    
    sim = AcousticSimulator(room, medium='air', sample_rate=44100)
    sim.max_reflections = 15
    
    # Get impulse response
    source_pos = Vector3(2, 2, 1.5)
    mic_pos = Vector3(8, 6, 1.5)
    
    ir, reflections = sim.get_room_response(source_pos, mic_pos, duration=1.0)
    
    print(f"✓ Generated IR with {len(reflections)} reflections")
    print(f"✓ IR length: {len(ir)} samples ({len(ir)/44100:.2f} seconds)")
    
    # Analyze reflections
    print("\nReflection analysis:")
    print(f"  Direct path: {reflections[0].path_length:.2f} m")
    print(f"  First reflection: {reflections[1].path_length:.2f} m")
    
    reflection_counts = {}
    for refl in reflections:
        count = refl.reflection_count
        reflection_counts[count] = reflection_counts.get(count, 0) + 1
    
    print("\nReflections by order:")
    for order, count in sorted(reflection_counts.items()):
        print(f"  Order {order}: {count} reflections")
    
    # Plot impulse response
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    
    # Time domain
    time = np.arange(len(ir)) / 44100
    ax1.plot(time, ir)
    ax1.set_xlabel('Time (s)')
    ax1.set_ylabel('Amplitude')
    ax1.set_title('Room Impulse Response (Time Domain)')
    ax1.grid(True, alpha=0.3)
    
    # Frequency domain
    fft = np.fft.rfft(ir)
    freqs = np.fft.rfftfreq(len(ir), 1/44100)
    magnitude_db = 20 * np.log10(np.abs(fft) + 1e-10)
    
    ax2.plot(freqs, magnitude_db)
    ax2.set_xlabel('Frequency (Hz)')
    ax2.set_ylabel('Magnitude (dB)')
    ax2.set_title('Room Frequency Response')
    ax2.set_xlim(20, 20000)
    ax2.set_xscale('log')
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('room_response.png')
    print("\n✓ Saved response plots to room_response.png")
    
    return ir

# ============================================================================
# Main Execution
# ============================================================================

if __name__ == "__main__":
    print("\nAcoustics Simulation Library - Examples\n")
    print("This will generate several audio files and plots demonstrating")
    print("the library's capabilities.\n")
    
    try:
        # Run examples
        example_simple_room()
        example_stereo_recording()
        example_fx_chain()
        example_media_comparison()
        example_material_database()
        example_room_response()
        
        print("\n" + "=" * 60)
        print("All examples completed successfully!")
        print("=" * 60)
        print("\nGenerated files:")
        print("  - output_simple_room.wav")
        print("  - output_stereo.wav")
        print("  - output_fx_chain.wav")
        print("  - media_comparison.png")
        print("  - material_absorption.png")
        print("  - room_response.png")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()