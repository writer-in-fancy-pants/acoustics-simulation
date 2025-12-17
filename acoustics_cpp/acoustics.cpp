/*
 * High-Performance Acoustics Simulation Library (C++)
 * Optimized ray tracing and convolution for real-time processing
 */

#ifndef ACOUSTICS_HPP
#define ACOUSTICS_HPP

#include <vector>
#include <array>
#include <cmath>
#include <algorithm>
#include <memory>
#include <functional>
#include <string>

namespace acoustics {

// ============================================================================
// Basic Types
// ============================================================================

struct Vector3 {
    float x, y, z;
    
    Vector3() : x(0), y(0), z(0) {}
    Vector3(float x_, float y_, float z_) : x(x_), y(y_), z(z_) {}
    
    Vector3 operator+(const Vector3& v) const {
        return Vector3(x + v.x, y + v.y, z + v.z);
    }
    
    Vector3 operator-(const Vector3& v) const {
        return Vector3(x - v.x, y - v.y, z - v.z);
    }
    
    Vector3 operator*(float s) const {
        return Vector3(x * s, y * s, z * s);
    }
    
    float dot(const Vector3& v) const {
        return x * v.x + y * v.y + z * v.z;
    }
    
    Vector3 cross(const Vector3& v) const {
        return Vector3(
            y * v.z - z * v.y,
            z * v.x - x * v.z,
            x * v.y - y * v.x
        );
    }
    
    float length() const {
        return std::sqrt(x*x + y*y + z*z);
    }
    
    Vector3 normalize() const {
        float len = length();
        if (len > 0.0001f) {
            return Vector3(x/len, y/len, z/len);
        }
        return Vector3(0, 0, 0);
    }
};

// ============================================================================
// Material Properties
// ============================================================================

struct MaterialProperties {
    std::string name;
    std::array<float, 6> absorptionCoeff;  // 125, 250, 500, 1k, 2k, 4k Hz
    std::array<float, 6> reflectionCoeff;
    float diffusionCoeff;
    float density;
    float speedOfSound;
    float impedance;
    
    MaterialProperties() : diffusionCoeff(0.5f), density(1.0f), 
                          speedOfSound(343.0f), impedance(413.0f) {
        absorptionCoeff.fill(0.1f);
        reflectionCoeff.fill(0.9f);
    }
};

class MaterialDatabase {
public:
    static MaterialDatabase& getInstance() {
        static MaterialDatabase instance;
        return instance;
    }
    
    MaterialProperties getMaterial(const std::string& name) {
        auto it = materials_.find(name);
        if (it != materials_.end()) {
            return it->second;
        }
        return materials_["concrete"];
    }
    
private:
    MaterialDatabase() {
        initializeMaterials();
    }
    
    void initializeMaterials() {
        // Concrete
        MaterialProperties concrete;
        concrete.name = "Concrete";
        concrete.absorptionCoeff = {0.01f, 0.01f, 0.02f, 0.02f, 0.03f, 0.04f};
        concrete.reflectionCoeff = {0.99f, 0.99f, 0.98f, 0.98f, 0.97f, 0.96f};
        concrete.diffusionCoeff = 0.15f;
        concrete.density = 2400.0f;
        concrete.speedOfSound = 3200.0f;
        concrete.impedance = 7.68e6f;
        materials_["concrete"] = concrete;
        
        // Oak Wood
        MaterialProperties oak;
        oak.name = "Oak";
        oak.absorptionCoeff = {0.15f, 0.15f, 0.10f, 0.10f, 0.10f, 0.10f};
        oak.reflectionCoeff = {0.85f, 0.85f, 0.90f, 0.90f, 0.90f, 0.90f};
        oak.diffusionCoeff = 0.3f;
        oak.density = 750.0f;
        oak.speedOfSound = 3850.0f;
        oak.impedance = 2.89e6f;
        materials_["oak"] = oak;
        
        // Carpet
        MaterialProperties carpet;
        carpet.name = "Carpet";
        carpet.absorptionCoeff = {0.08f, 0.24f, 0.57f, 0.69f, 0.71f, 0.73f};
        carpet.reflectionCoeff = {0.92f, 0.76f, 0.43f, 0.31f, 0.29f, 0.27f};
        carpet.diffusionCoeff = 0.8f;
        carpet.density = 200.0f;
        carpet.speedOfSound = 100.0f;
        carpet.impedance = 2.0e4f;
        materials_["carpet"] = carpet;
    }
    
    std::unordered_map<std::string, MaterialProperties> materials_;
};

// ============================================================================
// Geometry
// ============================================================================

struct Triangle {
    Vector3 v0, v1, v2;
    std::string material;
    
    Vector3 normal() const {
        Vector3 edge1 = v1 - v0;
        Vector3 edge2 = v2 - v0;
        return edge1.cross(edge2).normalize();
    }
    
    Vector3 center() const {
        return Vector3(
            (v0.x + v1.x + v2.x) / 3.0f,
            (v0.y + v1.y + v2.y) / 3.0f,
            (v0.z + v1.z + v2.z) / 3.0f
        );
    }
    
    float area() const {
        Vector3 edge1 = v1 - v0;
        Vector3 edge2 = v2 - v0;
        return edge1.cross(edge2).length() / 2.0f;
    }
    
    bool intersect(const Vector3& origin, const Vector3& dir, 
                   float& t, float& u, float& v) const {
        // Möller-Trumbore intersection algorithm
        const float EPSILON = 0.0000001f;
        Vector3 edge1 = v1 - v0;
        Vector3 edge2 = v2 - v0;
        Vector3 h = dir.cross(edge2);
        float a = edge1.dot(h);
        
        if (a > -EPSILON && a < EPSILON) {
            return false;  // Ray parallel to triangle
        }
        
        float f = 1.0f / a;
        Vector3 s = origin - v0;
        u = f * s.dot(h);
        
        if (u < 0.0f || u > 1.0f) {
            return false;
        }
        
        Vector3 q = s.cross(edge1);
        v = f * dir.dot(q);
        
        if (v < 0.0f || u + v > 1.0f) {
            return false;
        }
        
        t = f * edge2.dot(q);
        return t > EPSILON;
    }
};

// ============================================================================
// Reflection
// ============================================================================

struct Reflection {
    float pathLength;
    Vector3 reflectionPoint;
    int reflectionCount;
    std::array<float, 6> attenuation;
    const Triangle* triangle;
    
    Reflection() : pathLength(0), reflectionCount(0), triangle(nullptr) {
        attenuation.fill(1.0f);
    }
};

// ============================================================================
// Ray Tracer
// ============================================================================

class RayTracer {
public:
    RayTracer(const std::vector<Triangle>* geometry, 
              float speedOfSound = 343.0f,
              int maxReflections = 10,
              float maxDistance = 100.0f)
        : geometry_(geometry),
          speedOfSound_(speedOfSound),
          maxReflections_(maxReflections),
          maxDistance_(maxDistance) {}
    
    std::vector<Reflection> tracePath(const Vector3& source, 
                                      const Vector3& mic) {
        std::vector<Reflection> reflections;
        
        // Direct path
        float directDist = (mic - source).length();
        if (directDist <= maxDistance_) {
            Reflection direct;
            direct.pathLength = directDist;
            direct.reflectionPoint = source;
            direct.reflectionCount = 0;
            direct.attenuation = calculateAttenuation(directDist, 
                std::array<float, 6>{1,1,1,1,1,1});
            direct.triangle = nullptr;
            reflections.push_back(direct);
        }
        
        // First-order reflections
        for (const auto& tri : *geometry_) {
            Vector3 refPoint = findReflectionPoint(source, mic, tri);
            float pathLen = (refPoint - source).length() + (mic - refPoint).length();
            
            if (pathLen <= maxDistance_) {
                MaterialProperties mat = MaterialDatabase::getInstance()
                    .getMaterial(tri.material);
                
                Reflection refl;
                refl.pathLength = pathLen;
                refl.reflectionPoint = refPoint;
                refl.reflectionCount = 1;
                refl.attenuation = calculateAttenuation(pathLen, mat.reflectionCoeff);
                refl.triangle = &tri;
                reflections.push_back(refl);
            }
        }
        
        return reflections;
    }
    
private:
    Vector3 findReflectionPoint(const Vector3& source, const Vector3& mic,
                                const Triangle& tri) {
        // Simplified: use triangle center
        // Full implementation would mirror source and find intersection
        return tri.center();
    }
    
    std::array<float, 6> calculateAttenuation(float distance, 
                                              std::array<float, 6> reflCoeff) {
        std::array<float, 6> result;
        
        // Distance attenuation (inverse square law)
        float distAtten = 1.0f / std::max(distance, 0.1f);
        
        // Air absorption (frequency dependent)
        std::array<float, 6> freqs = {125, 250, 500, 1000, 2000, 4000};
        
        for (int i = 0; i < 6; i++) {
            float airAtten = std::exp(-0.0012f * distance * freqs[i] / 1000.0f);
            result[i] = reflCoeff[i] * distAtten * airAtten;
        }
        
        return result;
    }
    
    const std::vector<Triangle>* geometry_;
    float speedOfSound_;
    int maxReflections_;
    float maxDistance_;
};

// ============================================================================
// Fast Convolution (FFT-based)
// ============================================================================

class FastConvolution {
public:
    static std::vector<float> convolve(const std::vector<float>& signal,
                                      const std::vector<float>& ir) {
        size_t resultSize = signal.size() + ir.size() - 1;
        std::vector<float> result(resultSize, 0.0f);
        
        // Simple time-domain convolution
        // For production, use FFT-based convolution (FFTW, etc.)
        for (size_t i = 0; i < signal.size(); i++) {
            for (size_t j = 0; j < ir.size(); j++) {
                result[i + j] += signal[i] * ir[j];
            }
        }
        
        return result;
    }
    
    static std::vector<float> convolveOptimized(const std::vector<float>& signal,
                                               const std::vector<float>& ir) {
        // Overlap-add FFT convolution for real-time performance
        // This is a placeholder - implement with FFT library
        return convolve(signal, ir);
    }
};

// ============================================================================
// Impulse Response Generator
// ============================================================================

class ImpulseResponseGenerator {
public:
    ImpulseResponseGenerator(int sampleRate, float speedOfSound = 343.0f)
        : sampleRate_(sampleRate), speedOfSound_(speedOfSound) {}
    
    std::vector<float> generateIR(const std::vector<Reflection>& reflections,
                                  float durationSec = 2.0f) {
        int numSamples = static_cast<int>(durationSec * sampleRate_);
        std::vector<float> ir(numSamples, 0.0f);
        
        for (const auto& refl : reflections) {
            float delaySec = refl.pathLength / speedOfSound_;
            int delaySamples = static_cast<int>(delaySec * sampleRate_);
            
            if (delaySamples < numSamples) {
                // Average attenuation across bands
                float amplitude = 0.0f;
                for (float a : refl.attenuation) {
                    amplitude += a;
                }
                amplitude /= refl.attenuation.size();
                
                // Add impulse with exponential decay
                int pulseLen = std::min(64, numSamples - delaySamples);
                for (int i = 0; i < pulseLen; i++) {
                    float decay = std::exp(-i / (sampleRate_ * 0.01f));
                    ir[delaySamples + i] += amplitude * decay;
                }
            }
        }
        
        return ir;
    }
    
private:
    int sampleRate_;
    float speedOfSound_;
};

// ============================================================================
// Acoustic Simulator
// ============================================================================

class AcousticSimulator {
public:
    AcousticSimulator(const std::vector<Triangle>* geometry,
                     int sampleRate = 44100)
        : geometry_(*geometry),
          sampleRate_(sampleRate),
          rayTracer_(geometry),
          irGen_(sampleRate) {}
    
    std::vector<float> simulate(const Vector3& sourcePos,
                                const std::vector<float>& sourceAudio,
                                const Vector3& micPos) {
        // Trace reflections
        auto reflections = rayTracer_.tracePath(sourcePos, micPos);
        
        // Generate impulse response
        auto ir = irGen_.generateIR(reflections);
        
        // Convolve
        auto output = FastConvolution::convolve(sourceAudio, ir);
        
        // Normalize
        float maxVal = 0.0f;
        for (float sample : output) {
            maxVal = std::max(maxVal, std::abs(sample));
        }
        if (maxVal > 0.0f) {
            for (float& sample : output) {
                sample = sample / maxVal * 0.9f;
            }
        }
        
        return output;
    }
    
    void setMaxReflections(int max) {
        rayTracer_ = RayTracer(&geometry_, 343.0f, max, 100.0f);
    }
    
private:
    std::vector<Triangle> geometry_;
    int sampleRate_;
    RayTracer rayTracer_;
    ImpulseResponseGenerator irGen_;
};

} // namespace acoustics

#endif // ACOUSTICS_HPP

// ============================================================================
// Example Usage
// ============================================================================

/*
#include "acoustics.hpp"
#include <iostream>

int main() {
    using namespace acoustics;
    
    // Create simple room geometry
    std::vector<Triangle> room;
    
    // Floor
    room.push_back({{-5, -3, 0}, {5, -3, 0}, {5, 3, 0}, "concrete"});
    room.push_back({{-5, -3, 0}, {5, 3, 0}, {-5, 3, 0}, "concrete"});
    
    // Ceiling
    room.push_back({{-5, -3, 4}, {5, 3, 4}, {5, -3, 4}, "concrete"});
    room.push_back({{-5, -3, 4}, {-5, 3, 4}, {5, 3, 4}, "concrete"});
    
    // Walls (simplified)
    // ... add more triangles for walls
    
    // Create simulator
    AcousticSimulator sim(room, 44100);
    
    // Create test signal
    std::vector<float> testSignal(44100);  // 1 second
    for (int i = 0; i < 44100; i++) {
        testSignal[i] = std::sin(2.0f * M_PI * 440.0f * i / 44100.0f) * 0.5f;
    }
    
    // Simulate
    Vector3 sourcePos(0, 0, 1.5f);
    Vector3 micPos(3, 2, 1.5f);
    
    auto output = sim.simulate(sourcePos, testSignal, micPos);
    
    std::cout << "Generated " << output.size() << " samples\n";
    
    return 0;
}
*/