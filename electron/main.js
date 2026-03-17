const { app, BrowserWindow, Menu, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const APP_TITLE = 'Rescue Wings';
const BACKEND_PORT = 5000;
const MONGO_PORT = 27018;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const MONGO_URI = `mongodb://127.0.0.1:${MONGO_PORT}/rescue-wings`;

let splashWindow = null;
let mainWindow = null;
let mongoProcess = null;
let backendProcess = null;
let shuttingDown = false;

const isWindows = process.platform === 'win32';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isHttpReady = (url) => new Promise((resolve) => {
  const req = http.get(url, (res) => {
    res.resume();
    resolve(res.statusCode >= 200 && res.statusCode < 500);
  });
  req.on('error', () => resolve(false));
  req.setTimeout(1500, () => {
    req.destroy();
    resolve(false);
  });
});

const waitForHttp = async (url, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHttpReady(url)) return true;
    await delay(350);
  }
  return false;
};

const isPortOpen = (port) => new Promise((resolve) => {
  const socket = new net.Socket();
  socket.setTimeout(800);
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('timeout', () => {
    socket.destroy();
    resolve(false);
  });
  socket.once('error', () => {
    socket.destroy();
    resolve(false);
  });
  socket.connect(port, '127.0.0.1');
});

const waitForPort = async (port, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return true;
    await delay(300);
  }
  return false;
};

const appIconPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', 'app.ico');
  }
  return path.join(app.getAppPath(), 'resources', 'icons', 'app.ico');
};

const createSplashWindow = () => {
  splashWindow = new BrowserWindow({
    width: 620,
    height: 420,
    show: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    title: APP_TITLE,
    icon: appIconPath(),
    backgroundColor: '#111827',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
};

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    title: APP_TITLE,
    icon: appIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(BACKEND_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });
};

const resourcePath = (...parts) => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...parts);
  }
  return path.join(app.getAppPath(), ...parts);
};

const startMongo = async (userDataPath) => {
  const dbPath = path.join(userDataPath, 'db');
  const logPath = path.join(userDataPath, 'mongodb.log');
  fs.mkdirSync(dbPath, { recursive: true });

  const mongoBin = app.isPackaged
    ? resourcePath('mongodb', 'bin', 'mongod.exe')
    : resourcePath('resources', 'mongodb', 'win32-x64', 'mongod.exe');

  if (!fs.existsSync(mongoBin)) {
    throw new Error(`Embedded MongoDB binary not found at ${mongoBin}`);
  }

  mongoProcess = spawn(mongoBin, [
    '--dbpath', dbPath,
    '--bind_ip', '127.0.0.1',
    '--port', String(MONGO_PORT),
    '--logpath', logPath,
    '--logappend',
  ], {
    windowsHide: true,
    stdio: 'ignore',
  });

  mongoProcess.on('error', (error) => {
    console.error('MongoDB process failed:', error.message);
  });

  const ready = await waitForPort(MONGO_PORT, 30000);
  if (!ready) {
    throw new Error('Embedded MongoDB did not start in time.');
  }
};

const startBackend = async (userDataPath) => {
  const uploadsDir = path.join(userDataPath, 'uploads');
  const runtimeConfigDir = path.join(userDataPath, 'config');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(runtimeConfigDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    MONGODB_URI: MONGO_URI,
    CLIENT_URL: BACKEND_URL,
    APP_BASE_URL: BACKEND_URL,
    SEED_DEMO_USERS: 'true',
    AUTH_RATE_LIMIT_MAX: '200',
    RUNTIME_CONFIG_DIR: runtimeConfigDir,
    UPLOAD_DIR: uploadsDir,
    NODE_ENV: 'production',
    CLIENT_DIST_PATH: app.isPackaged
      ? resourcePath('client', 'dist')
      : path.join(app.getAppPath(), 'client', 'dist'),
  };

  if (app.isPackaged) {
    const backendBin = resourcePath('backend', 'rescue-wings-server.exe');
    if (!fs.existsSync(backendBin)) {
      throw new Error(`Bundled backend binary not found at ${backendBin}`);
    }
    backendProcess = spawn(backendBin, [], {
      env,
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    const backendEntry = path.join(app.getAppPath(), 'server', 'index.js');
    backendProcess = spawn('node', [backendEntry], {
      env,
      windowsHide: true,
      stdio: 'inherit',
    });
  }

  backendProcess.on('error', (error) => {
    console.error('Backend process failed:', error.message);
  });

  const ready = await waitForHttp(`${BACKEND_URL}/api/health`, 45000);
  if (!ready) {
    throw new Error('Backend server did not become ready in time.');
  }
};

const stopProcess = async (proc) => {
  if (!proc || proc.killed) return;

  if (isWindows) {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
    });
    return;
  }

  proc.kill('SIGTERM');
};

const stopServices = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  await stopProcess(backendProcess);
  await stopProcess(mongoProcess);
};

app.on('before-quit', async (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  await stopServices();
  app.exit(0);
});

app.whenReady().then(async () => {
  try {
    createSplashWindow();
    const userDataPath = app.getPath('userData');
    await startMongo(userDataPath);
    await startBackend(userDataPath);
    createMainWindow();
  } catch (error) {
    console.error('Startup failed:', error.message);
    dialog.showErrorBox('Startup Error', `${error.message}\n\nPlease reinstall the app package.`);
    await stopServices();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && !shuttingDown) {
    createMainWindow();
  }
});
