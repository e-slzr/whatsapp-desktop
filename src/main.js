const { app, BrowserWindow, WebContentsView, ipcMain, shell, nativeTheme, Notification, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

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
let resolvedSystemIcon = undefined;

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

// Comprueba si alguno de los nombres de icono candidatos existe en el tema del sistema Linux
function checkSystemIconAvailable(candidateNames) {
  if (process.platform !== 'linux') return null;
  const names = Array.isArray(candidateNames) ? candidateNames : [candidateNames];

  const home = os.homedir();
  const baseDirs = [
    path.join(home, '.local/share/icons'),
    path.join(home, '.icons'),
    '/usr/local/share/icons',
    '/usr/share/icons',
    '/usr/share/pixmaps'
  ];

  const exts = ['.svg', '.png', '.xpm'];

  const themes = new Set();
  try {
    const stdout = execSync('gsettings get org.gnome.desktop.interface icon-theme', { encoding: 'utf8', timeout: 500 }).trim();
    const currentTheme = stdout.replace(/^['\"]|['\"]$/g, '');
    if (currentTheme) themes.add(currentTheme);
  } catch (e) {}
  themes.add('hicolor');

  for (const name of names) {
    // 1. Comprobar directamente en pixmaps
    for (const ext of exts) {
      if (fs.existsSync(path.join('/usr/share/pixmaps', name + ext))) {
        return name;
      }
    }

    // 2. Comprobar en tema activo y tema fallback hicolor
    for (const base of baseDirs) {
      if (!fs.existsSync(base)) continue;
      for (const theme of themes) {
        const themePath = path.join(base, theme);
        if (!fs.existsSync(themePath)) continue;
        const subdirs = [
          'apps/scalable', 'scalable/apps', 'apps',
          '512x512/apps', '256x256/apps', '128x128/apps',
          '64x64/apps', '48x48/apps', '32x32/apps', '24x24/apps', '16x16/apps'
        ];
        for (const sub of subdirs) {
          for (const ext of exts) {
            if (fs.existsSync(path.join(themePath, sub, name + ext))) {
              return name;
            }
          }
        }
      }
    }

    // 3. Comprobar en otros temas instalados en los directorios base
    for (const base of baseDirs) {
      if (!fs.existsSync(base)) continue;
      try {
        const entries = fs.readdirSync(base, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const themePath = path.join(base, entry.name);
          const subdirs = ['apps/scalable', 'scalable/apps', 'apps', '512x512/apps', '256x256/apps', '48x48/apps'];
          for (const sub of subdirs) {
            for (const ext of exts) {
              if (fs.existsSync(path.join(themePath, sub, name + ext))) {
                return name;
              }
            }
          }
        }
      } catch (e) {}
    }
  }

  return null;
}

function getSystemIconName(candidateNames) {
  if (resolvedSystemIcon !== undefined) return resolvedSystemIcon;
  resolvedSystemIcon = checkSystemIconAvailable(candidateNames);
  return resolvedSystemIcon;
}

// Ruta física al icono por defecto empaquetado con la aplicación
function getDefaultIconPath() {
  if (process.resourcesPath) {
    const unpackedIcon = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.png');
    if (fs.existsSync(unpackedIcon)) {
      return unpackedIcon;
    }
  }
  const devIcon = path.join(__dirname, '../assets/icon.png');
  if (fs.existsSync(devIcon) && !devIcon.includes('app.asar')) {
    return devIcon;
  }
  return path.join(__dirname, '../assets/icon.png');
}

function triggerDesktopNotification(title, body) {
  const notifTitle = title || 'WhatsApp';
  const notifBody = body || 'Nuevo mensaje';
  const defaultIconPath = getDefaultIconPath();

  console.log('[NOTIF DISPARADA]:', notifTitle, notifBody);

  // 1. Notificación nativa de Electron (utiliza DBus / org.freedesktop.Notifications con soporte completo de icono y clic)
  if (Notification.isSupported()) {
    try {
      let iconOption;
      if (process.platform === 'linux') {
        const systemIcon = getSystemIconName(['whatsapp-desktop', 'whatsapp']);
        if (systemIcon) {
          // Si el tema de iconos del sistema tiene el icono disponible, usamos su nombre de tema para evitar el badge [i]
          iconOption = systemIcon;
        } else if (fs.existsSync(defaultIconPath)) {
          // Si no está disponible en el tema del sistema, usamos el icono por defecto empaquetado
          const img = nativeImage.createFromPath(defaultIconPath);
          iconOption = img.isEmpty() ? defaultIconPath : img;
        } else {
          iconOption = defaultIconPath;
        }
      } else if (fs.existsSync(defaultIconPath)) {
        const img = nativeImage.createFromPath(defaultIconPath);
        iconOption = img.isEmpty() ? defaultIconPath : img;
      } else {
        iconOption = defaultIconPath;
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
        if (whatsappView) {
          whatsappView.webContents.focus();
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
    const systemIcon = getSystemIconName(['whatsapp-desktop', 'whatsapp']);
    const notifIcon = systemIcon || defaultIconPath;
    execFile('notify-send', [
      '-a', 'whatsapp-desktop',
      '-i', notifIcon,
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
