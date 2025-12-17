/**
 * Audio Engine
 * Handles real-time audio processing, synthesis, and acoustic simulation
 */

export class AudioEngine {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
    this.context = null;
    this.masterGain = null;
    this.sources = new Map();
    this.outputs = new Map();
    this.convolver = null;
    this.isInitialized = false;
    
    // Acoustic simulation parameters
    this.speedOfSound = 343; // m/s in air
    this.maxReflections = 5;
    this.decayRate = 0.8;
  }

  /**
   * Initialize Web Audio API
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate,
        latencyHint: 'interactive'
      });

      // Create master gain node
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.context.destination);

      // Create convolver for reverb
      this.convolver = this.context.createConvolver();
      this.convolver.connect(this.masterGain);

      this.isInitialized = true;
      console.log('Audio Engine initialized:', {
        sampleRate: this.context.sampleRate,
        state: this.context.state
      });
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      throw error;
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume() {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Create an audio source
   */
  createSource(id, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Audio engine not initialized');
    }

    const {
      type = 'oscillator',
      frequency = 440,
      gain = 0.5,
      position = [0, 0, 0]
    } = options;

    // Create oscillator
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;

    // Create gain node
    const gainNode = this.context.createGain();
    gainNode.gain.value = gain;

    // Create panner for 3D audio
    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 100;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 0;
    panner.coneOuterGain = 0;
    panner.setPosition(...position);

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.masterGain);

    // Store source
    const source = {
      id,
      oscillator,
      gainNode,
      panner,
      type,
      frequency,
      gain,
      position,
      isPlaying: false,
      startTime: null
    };

    this.sources.set(id, source);
    return source;
  }

  /**
   * Start audio source
   */
  startSource(id) {
    const source = this.sources.get(id);
    if (!source || source.isPlaying) return;

    source.oscillator.start();
    source.isPlaying = true;
    source.startTime = this.context.currentTime;
  }

  /**
   * Stop audio source
   */
  stopSource(id) {
    const source = this.sources.get(id);
    if (!source || !source.isPlaying) return;

    source.oscillator.stop();
    source.isPlaying = false;

    // Recreate oscillator for next play
    const newOscillator = this.context.createOscillator();
    newOscillator.type = source.type;
    newOscillator.frequency.value = source.frequency;
    newOscillator.connect(source.gainNode);

    source.oscillator = newOscillator;
  }

  /**
   * Update source position (real-time)
   */
  updateSourcePosition(id, position) {
    const source = this.sources.get(id);
    if (!source) return;

    source.position = position;
    source.panner.setPosition(...position);

    // Update gain based on distance to listener
    this.updateSourceGain(id);
  }

  /**
   * Update source gain based on distance
   */
  updateSourceGain(id) {
    const source = this.sources.get(id);
    if (!source) return;

    // Calculate distance from listener (at origin)
    const [x, y, z] = source.position;
    const distance = Math.sqrt(x * x + y * y + z * z);

    // Inverse square law attenuation
    const attenuation = 1.0 / Math.max(distance, 0.5);
    const targetGain = source.gain * attenuation * 0.3;

    // Smooth gain transition
    source.gainNode.gain.setTargetAtTime(
      targetGain,
      this.context.currentTime,
      0.1
    );
  }

  /**
   * Set source frequency
   */
  setSourceFrequency(id, frequency) {
    const source = this.sources.get(id);
    if (!source) return;

    source.frequency = frequency;
    source.oscillator.frequency.setTargetAtTime(
      frequency,
      this.context.currentTime,
      0.05
    );
  }

  /**
   * Set source gain
   */
  setSourceGain(id, gain) {
    const source = this.sources.get(id);
    if (!source) return;

    source.gain = gain;
    this.updateSourceGain(id);
  }

  /**
   * Remove source
   */
  removeSource(id) {
    const source = this.sources.get(id);
    if (!source) return;

    if (source.isPlaying) {
      this.stopSource(id);
    }

    source.oscillator.disconnect();
    source.gainNode.disconnect();
    source.panner.disconnect();

    this.sources.delete(id);
  }

  /**
   * Create output/microphone
   */
  createOutput(id, position = [0, 0, 0]) {
    const output = {
      id,
      position,
      gainNode: this.context.createGain(),
      analyser: this.context.createAnalyser()
    };

    output.gainNode.connect(output.analyser);
    output.analyser.connect(this.masterGain);

    this.outputs.set(id, output);
    return output;
  }

  /**
   * Update output position
   */
  updateOutputPosition(id, position) {
    const output = this.outputs.get(id);
    if (!output) return;

    output.position = position;
    
    // Update listener position (for 3D audio)
    this.context.listener.setPosition(...position);
  }

  /**
   * Remove output
   */
  removeOutput(id) {
    const output = this.outputs.get(id);
    if (!output) return;

    output.gainNode.disconnect();
    output.analyser.disconnect();

    this.outputs.delete(id);
  }

  /**
   * Generate impulse response for room acoustics
   */
  generateImpulseResponse(geometry, sourcePos, micPos) {
    const duration = 2.0; // seconds
    const sampleCount = Math.floor(duration * this.sampleRate);
    const impulse = new Float32Array(sampleCount);

    // Calculate direct path
    const directDistance = this.calculateDistance(sourcePos, micPos);
    const directDelay = Math.floor(directDistance / this.speedOfSound * this.sampleRate);
    
    if (directDelay < sampleCount) {
      impulse[directDelay] = 1.0 / Math.max(directDistance, 0.1);
    }

    // Calculate reflections (simplified ray tracing)
    if (geometry && geometry.faces) {
      const reflections = this.traceReflections(geometry, sourcePos, micPos);
      
      reflections.forEach(({ distance, attenuation }) => {
        const delay = Math.floor(distance / this.speedOfSound * this.sampleRate);
        if (delay < sampleCount) {
          impulse[delay] += attenuation / Math.max(distance, 0.1);
        }
      });
    }

    // Apply exponential decay
    for (let i = 0; i < sampleCount; i++) {
      const decay = Math.exp(-i / (this.sampleRate * this.decayRate));
      impulse[i] *= decay;
    }

    // Normalize
    const max = Math.max(...impulse.map(Math.abs));
    if (max > 0) {
      for (let i = 0; i < sampleCount; i++) {
        impulse[i] /= max;
      }
    }

    return impulse;
  }

  /**
   * Trace reflections (simplified)
   */
  traceReflections(geometry, sourcePos, micPos) {
    const reflections = [];
    
    // First-order reflections from each face
    geometry.faces.forEach((face, index) => {
      if (index > 50) return; // Limit for performance
      
      // Get face center as reflection point (simplified)
      const faceCenter = this.calculateFaceCenter(geometry.vertices, face);
      
      // Calculate path length
      const pathLength = 
        this.calculateDistance(sourcePos, faceCenter) +
        this.calculateDistance(faceCenter, micPos);
      
      // Simple attenuation model
      const attenuation = Math.pow(this.decayRate, 1);
      
      reflections.push({
        distance: pathLength,
        attenuation,
        point: faceCenter
      });
    });

    return reflections.slice(0, this.maxReflections);
  }

  /**
   * Calculate face center
   */
  calculateFaceCenter(vertices, face) {
    const v0 = vertices[face[0]];
    const v1 = vertices[face[1]];
    const v2 = vertices[face[2]];

    return [
      (v0[0] + v1[0] + v2[0]) / 3,
      (v0[1] + v1[1] + v2[1]) / 3,
      (v0[2] + v1[2] + v2[2]) / 3
    ];
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(p1, p2) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dz = p2[2] - p1[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Apply impulse response to convolver
   */
  applyImpulseResponse(impulse) {
    if (!this.convolver) return;

    const impulseBuffer = this.context.createBuffer(
      2, // stereo
      impulse.length,
      this.sampleRate
    );

    // Copy impulse to both channels
    const leftChannel = impulseBuffer.getChannelData(0);
    const rightChannel = impulseBuffer.getChannelData(1);
    
    for (let i = 0; i < impulse.length; i++) {
      leftChannel[i] = impulse[i];
      rightChannel[i] = impulse[i];
    }

    this.convolver.buffer = impulseBuffer;
  }

  /**
   * Update simulation for geometry change
   */
  updateSimulation(geometry, sources, outputs) {
    if (!geometry || sources.length === 0 || outputs.length === 0) return;

    // Generate impulse response for first source/output pair
    const sourcePos = sources[0].position;
    const outputPos = outputs[0].position;
    
    const impulse = this.generateImpulseResponse(geometry, sourcePos, outputPos);
    this.applyImpulseResponse(impulse);
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume) {
    if (!this.masterGain) return;
    
    this.masterGain.gain.setTargetAtTime(
      volume,
      this.context.currentTime,
      0.05
    );
  }

  /**
   * Get current time
   */
  getCurrentTime() {
    return this.context ? this.context.currentTime : 0;
  }

  /**
   * Get audio context state
   */
  getState() {
    return this.context ? this.context.state : 'closed';
  }

  /**
   * Export audio buffer to WAV
   */
  async exportToWAV(duration = 5.0) {
    const sampleCount = Math.floor(duration * this.sampleRate);
    const buffer = this.context.createBuffer(2, sampleCount, this.sampleRate);
    
    // Create offline context for rendering
    const offlineContext = new OfflineAudioContext(2, sampleCount, this.sampleRate);
    
    // Recreate audio graph in offline context
    // (simplified - in production, recreate full graph)
    
    const renderedBuffer = await offlineContext.startRendering();
    
    return this.bufferToWAV(renderedBuffer);
  }

  /**
   * Convert AudioBuffer to WAV format
   */
  bufferToWAV(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const data = [];
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        data.push(intSample);
      }
    }
    
    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // Write WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      view.setInt16(offset, data[i], true);
      offset += 2;
    }
    
    return arrayBuffer;
  }

  /**
   * Cleanup and dispose
   */
  dispose() {
    // Stop all sources
    this.sources.forEach((source, id) => {
      if (source.isPlaying) {
        this.stopSource(id);
      }
    });

    // Clear maps
    this.sources.clear();
    this.outputs.clear();

    // Close audio context
    if (this.context) {
      this.context.close();
      this.context = null;
    }

    this.isInitialized = false;
  }
}

export default AudioEngine;