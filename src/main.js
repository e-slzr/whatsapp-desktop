const { app, BrowserWindow, WebContentsView, ipcMain, shell, nativeTheme, Notification, nativeImage } = require('electron');
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
let pendingTitleNotification = null;

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

function getNotificationIcon() {
  // 1. Ruta instalada en el sistema de iconos hicolor de Linux
  const systemIcon = path.join(app.getPath('home'), '.local/share/icons/hicolor/512x512/apps/whatsapp-desktop.png');
  if (fs.existsSync(systemIcon)) {
    return systemIcon;
  }
  // 2. Ruta física desempaquetada fuera del asar (producción)
  if (process.resourcesPath) {
    const unpackedIcon = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.png');
    if (fs.existsSync(unpackedIcon)) {
      return unpackedIcon;
    }
  }
  // 3. Ruta en desarrollo local (no empaquetada en asar)
  const devIcon = path.join(__dirname, '../assets/icon.png');
  if (fs.existsSync(devIcon) && !devIcon.includes('app.asar')) {
    return devIcon;
  }
  // 4. Fallback estándar al icono de assets
  return path.join(__dirname, '../assets/icon.png');
}

function triggerDesktopNotification(title, body) {
  const notifTitle = title || 'WhatsApp';
  const notifBody = body || 'Nuevo mensaje';
  const iconPath = getNotificationIcon();

  console.log('[NOTIF DISPARADA]:', notifTitle, notifBody, 'Icono:', iconPath);

  // 1. Notificación nativa de Electron (utiliza DBus / org.freedesktop.Notifications con soporte completo de icono y clic)
  if (Notification.isSupported()) {
    try {
      // En Linux, al pasar el nombre de tema 'whatsapp-desktop', elementary OS y GNOME
      // asocian el icono oficial del tema sin tratarlo como imagen externa (evitando el badge de información [i]).
      // En Windows y macOS se pasa la imagen física cargada.
      let iconOption;
      if (process.platform === 'linux') {
        iconOption = 'whatsapp-desktop';
      } else if (fs.existsSync(iconPath)) {
        const img = nativeImage.createFromPath(iconPath);
        iconOption = img.isEmpty() ? iconPath : img;
      } else {
        iconOption = iconPath;
      }

      const notif = new Notification({
        title: notifTitle,
        body: notifBody,
        icon: iconOption,
        silent: false
      });

      notif.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });

      notif.show();
      return;
    } catch (err) {
      console.error('Error al mostrar notificación nativa:', err);
    }
  }

  // 2. Fallback con notify-send para entornos Linux donde Notification.isSupported() falle
  if (process.platform === 'linux') {
    const { execFile } = require('child_process');
    execFile('notify-send', [
      '-a', 'whatsapp-desktop',
      '-i', 'whatsapp-desktop',
      '-h', 'string:desktop-entry:whatsapp-desktop',
      '-u', 'normal',
      notifTitle,
      notifBody
    ], (err) => {
      if (err) console.error('Error en notify-send fallback:', err);
    });
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

  // Crear vista web con sesión persistente y preload de notificaciones
  whatsappView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'whatsapp-preload.js'),
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

  // Configuración de User-Agent y Client Hints para compatibilidad total con WhatsApp Web
  const CHROME_VERSION = '131.0.0.0';
  const CHROME_MAJOR = '131';
  const CHROME_UA = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

  whatsappView.webContents.setUserAgent(CHROME_UA);
  session.setUserAgent(CHROME_UA);

  // Asegurar que las cabeceras sec-ch-ua reflejen Chrome moderno en todas las peticiones
  session.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = CHROME_UA;
    details.requestHeaders['sec-ch-ua'] = `"Google Chrome";v="${CHROME_MAJOR}", "Chromium";v="${CHROME_MAJOR}", "Not_A Brand";v="24"`;
    details.requestHeaders['sec-ch-ua-mobile'] = '?0';
    details.requestHeaders['sec-ch-ua-platform'] = '"Linux"';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

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
    if (numericCount > lastUnreadCount) {
      if (pendingTitleNotification) {
        clearTimeout(pendingTitleNotification);
        pendingTitleNotification = null;
      }

      // Si la ventana no está enfocada ni visible y no ha habido una notificación reciente
      if ((now - lastNotificationTime) > 4000 && (!mainWindow.isFocused() || !mainWindow.isVisible())) {
        const diff = numericCount - lastUnreadCount;
        // Esperar 1.5 segundos para dar prioridad a la notificación rica (con remitente y texto) de WhatsApp Web
        pendingTitleNotification = setTimeout(() => {
          pendingTitleNotification = null;
          if (Date.now() - lastNotificationTime > 4000) {
            const msg = diff > 1 ? `Tienes ${diff} nuevos mensajes en WhatsApp` : 'Tienes un nuevo mensaje en WhatsApp';
            lastNotificationTime = Date.now();
            triggerDesktopNotification('WhatsApp', msg);
          }
        }, 1500);
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

// Manejador de notificaciones nativas enviadas por WhatsApp Web
ipcMain.on('whatsapp-notification', (_event, { title, options }) => {
  lastNotificationTime = Date.now();
  if (pendingTitleNotification) {
    clearTimeout(pendingTitleNotification);
    pendingTitleNotification = null;
  }
  const notifTitle = title || 'WhatsApp';
  const notifBody = (options && options.body) ? options.body : '';
  triggerDesktopNotification(notifTitle, notifBody);
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
