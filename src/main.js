const { app, BrowserWindow, WebContentsView, ipcMain, shell, nativeTheme, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// Permitir la reproducción de alertas de sonido sin necesidad de interacción previa
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const TITLEBAR_HEIGHT = 44;
const WHATSAPP_URL = 'https://web.whatsapp.com';
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

app.setName('WhatsApp');
app.setAppUserModelId('com.eslzr.whatsapp-desktop');
if (process.platform === 'linux' && typeof app.setDesktopName === 'function') {
  app.setDesktopName('whatsapp-desktop.desktop');
}

// Bloqueo de instancia única
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let whatsappView = null;
let lastUnreadCount = 0;
let lastNotificationTime = 0;

function isWhatsAppUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return host === 'whatsapp.com' ||
           host.endsWith('.whatsapp.com') ||
           host.endsWith('.whatsapp.net');
  } catch {
    return false;
  }
}

function loadWindowState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return { width: 1100, height: 750, isMaximized: false };
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getNormalBounds ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch {}
}

function updateViewBounds() {
  if (!mainWindow || !whatsappView) return;
  const [width, height] = mainWindow.getContentSize();
  whatsappView.setBounds({
    x: 0,
    y: TITLEBAR_HEIGHT,
    width: width,
    height: Math.max(0, height - TITLEBAR_HEIGHT)
  });
}

function createWindow() {
  const isDark = nativeTheme.shouldUseDarkColors;
  const bgColor = isDark ? '#111b21' : '#f0f2f5';
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width || 1100,
    height: state.height || 750,
    x: state.x,
    y: state.y,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    backgroundColor: bgColor,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  // Cargar barra de título personalizada
  mainWindow.loadFile(path.join(__dirname, 'titlebar.html'));

  // Crear vista web con sesión persistente
  whatsappView = new WebContentsView({
    webPreferences: {
      partition: 'persist:whatsapp',
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  mainWindow.contentView.addChildView(whatsappView);

  // Sincronizar dimensiones iniciales de la vista
  updateViewBounds();
  setTimeout(updateViewBounds, 50);
  setTimeout(updateViewBounds, 250);

  // Permisos requeridos para WhatsApp Web (audio, cámara, notificaciones, portapapeles)
  const session = whatsappView.webContents.session;
  const allowedPermissions = [
    'notifications',
    'media',
    'audio-capture',
    'video-capture',
    'display-capture',
    'clipboard-read',
    'clipboard-write',
    'clipboard-sanitized-write'
  ];

  session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(allowedPermissions.includes(permission));
  });

  session.setPermissionCheckHandler((webContents, permission) => {
    return allowedPermissions.includes(permission);
  });

  // Limpiar User-Agent para evitar advertencias de navegador no compatible
  const defaultUA = whatsappView.webContents.userAgent;
  const cleanUA = defaultUA
    .replace(/Electron\/[0-9\.]+\s?/, '')
    .replace(/whatsapp-desktop\/[0-9\.]+\s?/, '');
  whatsappView.webContents.setUserAgent(cleanUA);
  session.setUserAgent(cleanUA);

  whatsappView.webContents.loadURL(WHATSAPP_URL);

  mainWindow.on('resize', updateViewBounds);
  mainWindow.on('show', updateViewBounds);
  mainWindow.on('restore', updateViewBounds);

  mainWindow.on('maximize', () => {
    updateViewBounds();
    mainWindow.webContents.send('window-maximize-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    updateViewBounds();
    mainWindow.webContents.send('window-maximize-changed', false);
  });

  // Manejo de enlaces externos: Abrir enlaces fuera de WhatsApp en el navegador del sistema
  whatsappView.webContents.setWindowOpenHandler(({ url }) => {
    if (isWhatsAppUrl(url)) {
      whatsappView.webContents.loadURL(url);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  whatsappView.webContents.on('will-navigate', (event, url) => {
    if (!isWhatsAppUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Monitoreo de título y contador de mensajes no leídos
  whatsappView.webContents.on('page-title-updated', (_event, title) => {
    mainWindow.setTitle(title || 'WhatsApp');

    const match = title.match(/\(([\d\+]+)\)/);
    const count = match ? match[1] : 0;
    const numericCount = parseInt(count, 10) || 0;

    mainWindow.webContents.send('update-unread', count);
    mainWindow.webContents.send('update-title', title);

    const now = Date.now();
    if (numericCount > lastUnreadCount && (now - lastNotificationTime) > 4000) {
      if (!mainWindow.isFocused() || !mainWindow.isVisible()) {
        if (Notification.isSupported()) {
          const diff = numericCount - lastUnreadCount;
          const msg = diff > 1 ? `Tienes ${diff} nuevos mensajes en WhatsApp` : 'Tienes un nuevo mensaje en WhatsApp';
          const notif = new Notification({
            title: 'WhatsApp',
            body: msg,
            icon: path.join(__dirname, '../assets/icon.png')
          });
          notif.on('click', () => {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          });
          notif.show();
          lastNotificationTime = now;
        }
      }
    }
    lastUnreadCount = numericCount;
  });

  mainWindow.on('close', (event) => {
    saveWindowState();
    // En modo desarrollo / pruebas, cerrar limpia el proceso en la terminal
    if (!app.isPackaged) {
      app.isQuitting = true;
    }
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// IPC Handlers de ventana
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    saveWindowState();
    if (!app.isPackaged) {
      app.isQuitting = true;
      app.quit();
    } else {
      mainWindow.hide();
    }
  }
});

ipcMain.on('window-reload', () => {
  if (whatsappView) whatsappView.webContents.reload();
});

ipcMain.on('window-resized', (_event, { width, height }) => {
  if (whatsappView) {
    whatsappView.setBounds({
      x: 0,
      y: TITLEBAR_HEIGHT,
      width: width,
      height: Math.max(0, height - TITLEBAR_HEIGHT)
    });
  }
});

// Despertar la ventana existente si el usuario intenta abrir otra instancia
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  saveWindowState();
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
