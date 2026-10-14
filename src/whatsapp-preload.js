const { webFrame, ipcRenderer } = require('electron');

// Inyectar en el contexto principal de la página (Main World) antes de los scripts de WhatsApp
webFrame.executeJavaScript(`
  (function() {
    const OriginalNotification = window.Notification;

    window.Notification = function(title, options) {
      window.postMessage({
        type: 'WA_NOTIFICATION',
        title: title || 'WhatsApp',
        options: options || {}
      }, '*');

      try {
        if (OriginalNotification) {
          return new OriginalNotification(title, options);
        }
      } catch (e) {}
      return {};
    };

    if (OriginalNotification) {
      Object.assign(window.Notification, OriginalNotification);
    }

    // Asegurar que WhatsApp reconozca que las notificaciones están permitidas
    Object.defineProperty(window.Notification, 'permission', {
      get: () => 'granted',
      set: () => {}
    });

    window.Notification.requestPermission = async () => 'granted';

    // Interceptar Service Worker showNotification si WhatsApp lo utiliza
    if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype) {
      const origShowNotification = ServiceWorkerRegistration.prototype.showNotification;
      ServiceWorkerRegistration.prototype.showNotification = function(title, options) {
        window.postMessage({
          type: 'WA_NOTIFICATION',
          title: title || 'WhatsApp',
          options: options || {}
        }, '*');
        if (origShowNotification) {
          return origShowNotification.call(this, title, options);
        }
        return Promise.resolve();
      };
    }
  })();
`);

// Escuchar las notificaciones interceptadas y enviarlas por IPC al proceso principal de Electron
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'WA_NOTIFICATION') {
    ipcRenderer.send('whatsapp-notification', {
      title: event.data.title,
      options: event.data.options
    });
  }
});
