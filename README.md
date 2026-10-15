# WhatsApp Desktop

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Release-v1.0.0-green.svg)](https://github.com/e-slzr/whatsapp-desktop/releases)
[![Platform](https://img.shields.io/badge/Platform-Linux%20(Wayland%20%2F%20X11)-lightgrey.svg)](https://github.com/e-slzr/whatsapp-desktop)

Cliente de escritorio independiente, ligero, rápido y moderno para WhatsApp Web en Linux (Wayland y X11). Diseñado para ofrecer una experiencia nativa, fluida y con bajo consumo de memoria en distribuciones como elementary OS, Ubuntu, Debian, Fedora y Arch Linux.

<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="WhatsApp Desktop Icon" />
</p>

---

## Características destacadas

- **Diseño nativo frameless (WhatsApp Teal):** Barra de título personalizada adaptada a la estética oficial (modo oscuro `#202c33` / `#111b21` y modo claro `#f0f2f5`).
- **Soporte completo para WebRTC y Llamadas:** Permisos optimizados para notas de voz (`audio-capture`), videollamadas (`video-capture`, `media`) y compartir pantalla (`display-capture`).
- **Reproducción de audio sin restricciones:** Flag `--autoplay-policy=no-user-gesture-required` para garantizar que los timbres de mensajes entrantes suenen siempre sin requerir interacción manual previa.
- **Corrección de redimensionamiento en Wayland:** Sincronización continua de dimensiones entre el DOM y el compositor para evitar el bug de superficies congeladas o subdimensionadas en Linux / NVIDIA.
- **Sesión persistente segura:** Partición `persist:whatsapp` para mantener activa la sesión del código QR de manera indefinida entre reinicios.
- **Insignia dinámica de mensajes no leídos:** Contador numérico en tiempo real en la barra de título extraído del estado de la aplicación.
- **Notificaciones de escritorio nativas:** Alertas del sistema integradas vía D-Bus con el nombre del remitente y contenido del mensaje, enfocando la app al hacer clic.
- **Navegación externa protegida:** Enlaces externos compartidos en chats se abren de inmediato en tu navegador predeterminado para proteger tu seguridad y privacidad.
- **Instancia única:** Bloqueo de instancias múltiples para traer la ventana existente al frente si intentas abrirla de nuevo.

---

## Descargas (v1.0.0)

Los paquetes compilados listos para usar se encuentran en la sección de [Releases](https://github.com/e-slzr/whatsapp-desktop/releases):

| Plataforma | Formato | Descripción |
|---|---|---|
| **Linux** | `.AppImage` | Ejecutable portable universal para cualquier distribución Linux. |
| **Linux** | `.deb` | Paquete nativo para Debian, Ubuntu, elementary OS, Linux Mint. |

---

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl + Q` | Cerrar completamente la aplicación |
| `Ctrl + R` / `F5` | Recargar WhatsApp Web |
| Doble clic en la barra | Alternar entre maximizar y restaurar |

---

## Instalación y Configuración en Linux

Para compilar e instalar WhatsApp Desktop en el menú de aplicaciones y en el Dock del sistema (Plank, GNOME Dash, Ulauncher):

```bash
# 1. Compilar los paquetes de Linux
npm run dist:linux

# 2. Instalar binario, iconos hicolor y lanzador .desktop
./install-app.sh
```

---

## Desarrollo y Compilación

### Requisitos previos

- [Node.js](https://nodejs.org/) (versión 20 o 22 LTS)
- npm

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/e-slzr/whatsapp-desktop.git
cd whatsapp-desktop

# 2. Instalar dependencias
npm install

# 3. Ejecutar para pruebas locales
npm start

# 4. Compilar paquetes para Linux (AppImage y deb)
npm run dist:linux
```

---

## Estructura del proyecto

```text
whatsapp-desktop/
├── .github/
│   └── workflows/
│       └── release.yml          # CI/CD automático para paquetes Linux en GitHub Releases
├── assets/
│   ├── icon.png                 # Icono principal de la aplicación (512x512)
│   ├── icon.svg                 # Gráfico vectorial escalable
│   └── icons/                   # Jerarquía hicolor (16x16 a 512x512)
├── src/
│   ├── main.js                  # Proceso principal de Electron, WebContentsView e IPC
│   ├── preload.js               # Puente IPC seguro para la barra de título
│   ├── titlebar.css             # Estilos de la barra de título personalizada
│   ├── titlebar.html            # Estructura DOM de la barra de título
│   ├── titlebar.js              # Lógica de ventana, arrastre, controles y contador
│   └── whatsapp-preload.js      # Puente de notificaciones nativas y spoofing de User-Agent
├── install-app.sh               # Script de instalación e integración en el sistema Linux
├── LICENSE                      # Licencia MIT
├── package.json                 # Metadatos del proyecto y configuración de electron-builder
└── README.md                    # Documentación técnica del proyecto
```

---

## Autor

**Eliu Salazar**  
- GitHub: [@e-slzr](https://github.com/e-slzr)  
- Contacto: [eliu.asalazar@gmail.com](mailto:eliu.asalazar@gmail.com)

---

## Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más información.

---

## Aviso de Marcas y Exención de Responsabilidad (Disclaimer)

**WhatsApp®** y el logotipo de WhatsApp son marcas registradas de **WhatsApp LLC** / **Meta Platforms, Inc.**

Este proyecto es un cliente de escritorio de código abierto independiente desarrollado por la comunidad y **no está afiliado, respaldado, patrocinado ni autorizado por WhatsApp LLC, Meta Platforms, Inc.** ni por ninguna de sus subsidiarias. Todos los nombres comerciales, logotipos y marcas son propiedad exclusiva de sus respectivos dueños y se utilizan aquí exclusivamente con fines de identificación y compatibilidad.
