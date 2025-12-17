/**
 * Electron Main Process
 * Entry point for the native desktop application
 */

const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference to prevent garbage collection
let mainWindow;

// Development mode detection
const isDevelopment = process.env.NODE_ENV !== 'production';

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#18181b',
    title: 'Acoustics Simulator VST',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: true,
      // Enable Web Audio API
      experimentalFeatures: true
    },
    show: false // Don't show until ready
  });

  // Load the app
  if (isDevelopment) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Acoustics Project', extensions: ['acp'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              const projectData = fs.readFileSync(result.filePaths[0], 'utf8');
              mainWindow.webContents.send('menu-open-project', projectData);
            }
          }
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-project');
          }
        },
        { type: 'separator' },
        {
          label: 'Import 3D Model...',
          accelerator: 'CmdOrCtrl+I',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: '3D Models', extensions: ['obj', 'stl', 'gltf', 'glb'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('menu-import-model', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Export Audio...',
          accelerator: 'CmdOrCtrl+E',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              filters: [
                { name: 'WAV Audio', extensions: ['wav'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePath) {
              mainWindow.webContents.send('menu-export-audio', result.filePath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Perspective View',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('menu-view-mode', 'perspective');
          }
        },
        {
          label: 'Top View',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('menu-view-mode', 'top');
          }
        },
        {
          label: 'Front View',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.send('menu-view-mode', 'front');
          }
        },
        {
          label: 'Side View',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow.webContents.send('menu-view-mode', 'side');
          }
        },
        { type: 'separator' },
        {
          label: 'Reset Camera',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.send('menu-reset-camera');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Simulation',
      submenu: [
        {
          label: 'Start/Stop',
          accelerator: 'Space',
          click: () => {
            mainWindow.webContents.send('menu-toggle-playback');
          }
        },
        { type: 'separator' },
        {
          label: 'Add Source',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('menu-add-source');
          }
        },
        {
          label: 'Add Output',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            mainWindow.webContents.send('menu-add-output');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu-open-settings');
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/your-repo/acoustics-simulator/docs');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/your-repo/acoustics-simulator/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Acoustics Simulator VST',
              message: 'Acoustics Simulator VST',
              detail: `Version: 1.0.0
              
A professional acoustic simulation tool for music production,
architectural acoustics, and audio research.

© 2025 Your Company. All rights reserved.`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Window menu
    template[4].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for file operations
ipcMain.handle('save-project', async (event, projectData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Acoustics Project', extensions: ['acp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(projectData, null, 2));
    return { success: true, path: result.filePath };
  }
  
  return { success: false };
});

ipcMain.handle('load-model', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    return {
      success: true,
      data: data.toString('base64'),
      extension: ext,
      filename: path.basename(filePath)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-audio', async (event, audioData, filePath) => {
  try {
    const buffer = Buffer.from(audioData);
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Error', `An error occurred: ${error.message}`);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the existing window if someone tries to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}