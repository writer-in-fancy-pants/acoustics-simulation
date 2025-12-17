import React, { useState, useEffect } from 'react';
import Enhanced3DAcousticsVST from './components/Enhanced3DAcousticsVST';
import { AudioEngine } from './utils/audioEngine';
import { GeometryLoader } from './utils/geometryLoader';

// From Enhanced3DAcousticsVST.jsx
import { Camera, Upload, Plus, Trash2, Play, Square, Settings } from 'lucide-react';

// From other component files
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper } from '@react-three/drei';

/**
 * Main Application Component
 * Orchestrates all sub-components and manages global state
 */


// import Enhanced3DAcousticsVST from './components/Enhanced3DAcousticsVST';
// import { AudioEngine } from './utils/audioEngine';
// import { GeometryLoader } from './utils/geometryLoader';

function App() {
  const [audioEngine] = useState(() => new AudioEngine());
  const [geometryLoader] = useState(() => new GeometryLoader());
  const [isElectron] = useState(() => {
    return typeof window !== 'undefined' && window.process?.type === 'renderer';
  });

  // Listen for Electron menu events
  useEffect(() => {
    if (!isElectron) return;

    const { ipcRenderer } = window.require('electron');

    // Menu event handlers
    const handlers = {
      'menu-new-project': handleNewProject,
      'menu-open-project': handleOpenProject,
      'menu-save-project': handleSaveProject,
      'menu-import-model': handleImportModel,
      'menu-export-audio': handleExportAudio,
      'menu-view-mode': handleViewMode,
      'menu-reset-camera': handleResetCamera,
      'menu-toggle-playback': handleTogglePlayback,
      'menu-add-source': handleAddSource,
      'menu-add-output': handleAddOutput,
      'menu-open-settings': handleOpenSettings
    };

    // Register all handlers
    Object.entries(handlers).forEach(([channel, handler]) => {
      ipcRenderer.on(channel, handler);
    });

    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([channel, handler]) => {
        ipcRenderer.removeListener(channel, handler);
      });
    };
  }, [isElectron]);

  // Event handlers (these will be passed to child components)
  const handleNewProject = () => {
    if (window.confirm('Create a new project? Unsaved changes will be lost.')) {
      window.location.reload();
    }
  };

  const handleOpenProject = (event, projectData) => {
    try {
      const data = JSON.parse(projectData);
      // Handle project loading
      console.log('Loading project:', data);
    } catch (error) {
      console.error('Error loading project:', error);
    }
  };

  const handleSaveProject = async () => {
    if (!isElectron) return;
    
    const { ipcRenderer } = window.require('electron');
    const projectData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      // Add project data here
    };

    const result = await ipcRenderer.invoke('save-project', projectData);
    if (result.success) {
      console.log('Project saved:', result.path);
    }
  };

  const handleImportModel = async (event, filePath) => {
    if (!isElectron) return;
    
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('load-model', filePath);
    
    if (result.success) {
      console.log('Model loaded:', result.filename);
      // Handle model import
    }
  };

  const handleExportAudio = async (event, filePath) => {
    console.log('Exporting audio to:', filePath);
    // Handle audio export
  };

  const handleViewMode = (event, mode) => {
    console.log('View mode:', mode);
    // Handle view mode change
  };

  const handleResetCamera = () => {
    console.log('Reset camera');
    // Handle camera reset
  };

  const handleTogglePlayback = () => {
    console.log('Toggle playback');
    // Handle playback toggle
  };

  const handleAddSource = () => {
    console.log('Add source');
    // Handle add source
  };

  const handleAddOutput = () => {
    console.log('Add output');
    // Handle add output
  };

  const handleOpenSettings = () => {
    console.log('Open settings');
    // Handle open settings
  };

  return (
    <div className="app">
      <Enhanced3DAcousticsVST 
        audioEngine={audioEngine}
        geometryLoader={geometryLoader}
      />
    </div>
  );
}

export default App;