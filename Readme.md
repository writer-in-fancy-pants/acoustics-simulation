# Acoustics Simulation Library - Deployment Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Python Library Installation](#python-library-installation)
3. [C++ Library Compilation](#c-library-compilation)
4. [Web-Based Plugin Deployment](#web-based-plugin-deployment)

---

## 🔧 Prerequisites

### System Requirements
- **OS**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 20.04+)
- **Python**: 3.8 or higher
- **C++ Compiler**: 
  - Windows: Visual Studio 2019+ or MinGW-w64
  - macOS: Xcode Command Line Tools
  - Linux: GCC 9+ or Clang 10+
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 500MB free space

### Software Dependencies
```bash
# Python packages
pip install numpy scipy matplotlib

# Optional for advanced features
pip install soundfile librosa pydub

# For C++ compilation
# Windows: Visual Studio with C++ workload
# macOS: xcode-select --install
# Linux: sudo apt-get install build-essential cmake
```

---

## 📦 Python Library Installation
TODO : Create and test installation scripts
The python installation currently isn't supported, stay tuned...
Meanwhile, you can clone the package and use the code as is.
### Method 1: pip Install (Recommended)
```bash
# Create virtual environment
python -m venv acoustics_env
source acoustics_env/bin/activate  # On Windows: acoustics_env\Scripts\activate

# Install library
pip install acoustics-simulation

# Verify installation
python -c "from acoustics_core import MaterialDatabase; print('✓ Installation successful')"
```

### Method 2: From Source
```bash
# Clone repository
git clone https://github.com/writer-in-fancy-pants/acoustics-simulation.git
cd acoustics-simulation

# Install in development mode
pip install -e .

# Run tests
python -m pytest tests/
```

---

## ⚙️ C++ Library Compilation

### Using CMake (Cross-platform)
Install `fftw` before building 
```bash
# Create build directory
mkdir build && cd build

# Configure
cmake .. -DCMAKE_BUILD_TYPE=Release

# Build
cmake --build . --config Release

# Install (optional)
sudo cmake --install .
```

---

## Web audio & visualization plugin
`cd vst_plugins`

```bash
# Install dependencies
npm install

# Web development
npm run dev

# Electron desktop development
npm run electron:dev

# Build for production
npm run electron:build        # All platforms
npm run electron:build:win    # Windows only
npm run electron:build:mac    # macOS only
npm run electron:build:linux  # Linux only
```

---