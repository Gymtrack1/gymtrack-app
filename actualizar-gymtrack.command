#!/bin/bash
# Doble clic para traer la última versión de index.html desde GitHub.
cd "$(dirname "$0")"

echo "======================================"
echo "  Actualizando GymTrack desde GitHub"
echo "======================================"
echo ""

if [ -n "$(git status --porcelain index.html 2>/dev/null)" ]; then
  echo "⚠️  Tienes cambios locales sin guardar en index.html."
  echo "   Este script NO los va a borrar. Avísale a Claude antes de continuar."
  echo ""
  echo "Presiona Enter para cerrar esta ventana."
  read
  exit 1
fi

git pull origin main

echo ""
if [ $? -eq 0 ]; then
  echo "✅ Listo. Abre index.html en tu navegador y haz Cmd+Shift+R para ver los cambios."
else
  echo "❌ Algo falló. Copia este mensaje y mándaselo a Claude."
fi
echo ""
echo "Presiona Enter para cerrar esta ventana."
read
