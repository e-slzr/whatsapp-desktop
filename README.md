# WhatsApp Desktop

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Release-v1.0.0-green.svg)](https://github.com/e-slzr/whatsapp-desktop/releases)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey.svg)](https://github.com/e-slzr/whatsapp-desktop)

Cliente de escritorio independiente, ligero, rápido y moderno para WhatsApp Web, especialmente optimizado para Linux (Wayland y X11), Windows y macOS. Diseñado para ofrecer una experiencia nativa, fluida y con bajo consumo de memoria.

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
- **Notificaciones de escritorio nativas:** Alertas del sistema cuando entran nuevos mensajes con la app minimizada o en segundo plano, con soporte para enfocar la app al hacer clic.
- **Navegación externa protegida:** Enlaces externos compartidos en chats se abren de inmediato en tu navegador predeterminado para proteger tu seguridad y privacidad.
- **Instancia única:** Bloqueo de instancias múltiples para traer la ventana existente al frente si intentas abrirla de nuevo.

---

## Descargas (v1.0.0)

Los paquetes compilados listos para usar se encuentran en la sección de [Releases](https://github.com/e-slzr/whatsapp-desktop/releases) o en la carpeta `dist/`:

| Plataforma | Formato | Descripción |
|---|---|---|
| **Linux** | `.AppImage` | Ejecutable portable universal para cualquier distribución Linux. |
| **Linux** | `.deb` | Paquete nativo para Debian, Ubuntu, elementary OS, Linux Mint. |
| **Windows** | `.exe` / `.zip` | Instalador estándar (NSIS) y versión portable zip. |
| **macOS** | `.dmg` / `.zip` | Imagen de disco montable e instalador zip para Apple Silicon e Intel. |

---

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl + Q` / `Cmd + Q` | Cerrar completamente la aplicación |
| `Ctrl + R` / `F5` | Recargar WhatsApp Web |
| Doble clic en la barra | Alternar entre maximizar y restaurar |

---

## Instalación en Linux (Ubuntu, Debian, elementary OS)

Para compilar e instalar WhatsApp Desktop en el menú de aplicaciones y en el Dock del sistema (Plank, GNOME Dash, Ulauncher):

```bash
# 1. Compilar los paquetes de Linux
npm run dist:linux

# 2. Instalar binario, iconos hicolor y lanzador .desktop
./install-app.sh
```

---

## Desarrollo y Pruebas locales

### Requisitos previos
- [Node.js](https://nodejs.org/) (versión 20 o 22 LTS)
- npm

### Ejecución
```bash
# Clonar el repositorio
git clone https://github.com/e-slzr/whatsapp-desktop.git
cd whatsapp-desktop

# Instalar dependencias
npm install

# Ejecutar para pruebas locales
npm start
```

### Compilación multiplataforma
```bash
npm run dist:linux    # Genera AppImage y paquete .deb
npm run dist:win      # Genera instalador para Windows (.exe)
npm run dist:mac      # Genera paquete para macOS (.dmg)
npm run dist:all      # Compila para todas las plataformas
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
