#!/bin/bash
# Doble clic para traer la última versión de index.html desde GitHub.
cd "$(dirname "$0")"

echo "======================================"
echo "  Actualizando GymTrack desde GitHub"
echo "======================================"
echo ""

if [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  echo "⚠️  Tienes cambios locales sin guardar en un archivo de GymTrack (por ejemplo"
  echo "   firebase.json después de un despliegue)."
  echo "   Este script NO los va a borrar. Avísale a Claude antes de continuar."
  echo ""
  git status --porcelain --untracked-files=no
  echo ""
  echo "Presiona Enter para cerrar esta ventana."
  read
  exit 1
fi
# Archivos sueltos que guardaste en esta misma carpeta (Excels, PDFs, etc.) NO son parte de
# GymTrack (git nunca los rastrea) y no le estorban al pull — no hace falta avisar por esos.

git pull origin main
PULL_STATUS=$?

echo ""
if [ $PULL_STATUS -eq 0 ]; then
  echo "✅ Listo. Abre index.html en tu navegador y haz Cmd+Shift+R para ver los cambios."
else
  echo "❌ Algo falló. Copia TODO el texto de arriba (incluye el error) y mándaselo a Claude."
fi
echo ""
echo "Presiona Enter para cerrar esta ventana."
read
