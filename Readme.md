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

### Method 1: pip Install (Recommended)
```bash
# Create virtual environment
python -m venv acoustics_env
source acoustics_env/bin/activate  # On Windows: acoustics_env\Scripts\activate

# Install library
pip install acoustics-simulator

# Verify installation
python -c "from acoustics_core import MaterialDatabase; print('✓ Installation successful')"
```

### Method 2: From Source
```bash
# Clone repository
git clone https://github.com/your-repo/acoustics-simulator.git
cd acoustics-simulator

# Install in development mode
pip install -e .

# Run tests
python -m pytest tests/
```

### Project Structure
```
acoustics-simulator/
├── acoustics_core.py          # Core module with materials & geometry
├── acoustics_simulator.py     # Simulation engine
├── acoustics_cpp/             # C++ implementation
│   ├── acoustics.hpp
│   ├── acoustics.cpp
│   └── CMakeLists.txt
├── vst_plugin/                # VST plugin files
│   └── max_vst_plugin.jsx
├── web_plugin/                # Web-based version
│   └── index.html
├── examples/                  # Usage examples
│   └── usage_examples.py
├── tests/                     # Unit tests
├── materials.json             # Material database export
├── setup.py                   # Installation script
└── README.md
```

---

## ⚙️ C++ Library Compilation

### Using CMake (Cross-platform)

**1. Create CMakeLists.txt:**
```cmake
cmake_minimum_required(VERSION 3.12)
project(AcousticsSimulator)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Optimization flags
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(MSVC)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /O2 /fp:fast")
    else()
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -march=native -ffast-math")
    endif()
endif()

# Find dependencies
find_package(FFTW3 REQUIRED)  # For fast convolution

# Library
add_library(acoustics SHARED
    acoustics_cpp/acoustics.cpp
)

target_include_directories(acoustics PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/acoustics_cpp
    ${FFTW3_INCLUDE_DIRS}
)

target_link_libraries(acoustics
    ${FFTW3_LIBRARIES}
)

# Python bindings (optional)
find_package(pybind11 CONFIG)
if(pybind11_FOUND)
    pybind11_add_module(acoustics_cpp_py
        acoustics_cpp/python_bindings.cpp
    )
    target_link_libraries(acoustics_cpp_py PRIVATE acoustics)
endif()

# Install
install(TARGETS acoustics
    LIBRARY DESTINATION lib
    RUNTIME DESTINATION bin
)
```

**2. Build:**
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

# Web audio & visualization plugin
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