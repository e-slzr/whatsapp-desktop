#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/.local/lib/whatsapp-desktop"
BIN_DIR="$HOME/.local/bin"
APP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor"

# Limpiar instalaciones previas para evitar sobrescribir con enlaces recursivos
rm -rf "$INSTALL_DIR"
rm -f "$BIN_DIR/whatsapp-desktop"

mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
mkdir -p "$APP_DIR"
mkdir -p "$ICON_DIR/scalable/apps"

# Copiar el binario compilado listo para producción
cp -r "$SCRIPT_DIR/dist/linux-unpacked/"* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/whatsapp-desktop"

# Crear script ejecutable seguro en PATH
cat << 'EOF' > "$BIN_DIR/whatsapp-desktop"
#!/bin/sh
exec "$HOME/.local/lib/whatsapp-desktop/whatsapp-desktop" --no-sandbox "$@"
EOF
chmod +x "$BIN_DIR/whatsapp-desktop"

# Instalar iconos en todas las resoluciones estándar para Ulauncher, Plank y Dash to Dock
cp "$SCRIPT_DIR/assets/icon.svg" "$ICON_DIR/scalable/apps/whatsapp-desktop.svg"
for size in 16 24 32 48 64 128 256 512; do
  mkdir -p "$ICON_DIR/${size}x${size}/apps"
  if [ -f "$SCRIPT_DIR/assets/icons/${size}x${size}/whatsapp-desktop.png" ]; then
    cp "$SCRIPT_DIR/assets/icons/${size}x${size}/whatsapp-desktop.png" "$ICON_DIR/${size}x${size}/apps/whatsapp-desktop.png"
  fi
done

# Crear archivo .desktop oficial del sistema con ruta absoluta de icono y WM_CLASS sincronizada
cat <<EOF > "$APP_DIR/whatsapp-desktop.desktop"
[Desktop Entry]
Name=WhatsApp
Comment=Cliente de escritorio para WhatsApp Web
GenericName=Mensajería instantánea
Exec=$BIN_DIR/whatsapp-desktop %u
Icon=whatsapp-desktop
Terminal=false
Type=Application
Categories=Network;InstantMessaging;Chat;
StartupWMClass=whatsapp-desktop
Keywords=whatsapp;chat;messaging;mensajeria;
MimeType=x-scheme-handler/whatsapp;
EOF

chmod +x "$APP_DIR/whatsapp-desktop.desktop"

# Actualizar base de datos de escritorio e iconos de GTK
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$APP_DIR"
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$ICON_DIR" 2>/dev/null || true
fi

echo "¡WhatsApp Desktop v1.0.0 instalado con iconos sincronizados para Plank, GNOME y Ulauncher!"
