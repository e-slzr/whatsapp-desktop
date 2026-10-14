const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Exponer puente seguro de notificaciones al contexto principal
contextBridge.exposeInMainWorld('__electronNotificationBridge', {
  send: (title, options) => {
    ipcRenderer.send('whatsapp-notification', { title, options });
  }
});

// Inyectar implementación completa de W3C Notification en el Main World
webFrame.executeJavaScript(`
  (function() {
    class MockNotification extends EventTarget {
      constructor(title, options = {}) {
        super();
        this.title = title || 'WhatsApp';
        this.body = options.body || '';
        this.icon = options.icon || '';
        this.tag = options.tag || '';
        this.data = options.data || null;
        this.onclick = null;
        this.onshow = null;
        this.onerror = null;
        this.onclose = null;

        if (window.__electronNotificationBridge && typeof window.__electronNotificationBridge.send === 'function') {
          window.__electronNotificationBridge.send(this.title, {
            body: this.body,
            icon: this.icon,
            tag: this.tag
          });
        }

        setTimeout(() => {
          if (typeof this.onshow === 'function') this.onshow();
          this.dispatchEvent(new Event('show'));
        }, 50);
      }

      close() {
        if (typeof this.onclose === 'function') this.onclose();
        this.dispatchEvent(new Event('close'));
      }
    }

    Object.defineProperty(MockNotification, 'permission', {
      get: () => 'granted',
      set: () => {}
    });

    MockNotification.requestPermission = async () => 'granted';
    MockNotification.maxActions = 2;

    window.Notification = MockNotification;

    // Interceptar Service Worker showNotification si aplica
    if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype) {
      ServiceWorkerRegistration.prototype.showNotification = function(title, options = {}) {
        if (window.__electronNotificationBridge && typeof window.__electronNotificationBridge.send === 'function') {
          window.__electronNotificationBridge.send(title, options);
        }
        return Promise.resolve();
      };
    }

    // Interceptar navigator.permissions.query para reportar granted
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = async function(parameters) {
        if (parameters && parameters.name === 'notifications') {
          return { state: 'granted', onchange: null };
        }
        return originalQuery(parameters);
      };
    }
  })();
`);
