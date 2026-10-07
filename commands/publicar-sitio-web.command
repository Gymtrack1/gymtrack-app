#!/bin/bash
# Doble clic para publicar la última versión de GymTrack en mi-gimnasio-8d528.web.app (Firebase Hosting).
# Este archivo vive en commands/ — nos movemos a la raíz del proyecto (un nivel arriba) porque
# ahí es donde vive index.html, firebase.json, etc.
cd "$(dirname "$0")/.."

echo "======================================"
echo "  Publicando GymTrack en Firebase"
echo "======================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "⚠️  No encuentro Node.js instalado en esta Mac."
  echo "   Instálalo desde https://nodejs.org (botón grande, versión LTS)"
  echo "   y vuelve a hacer doble clic en este archivo cuando termine."
  echo ""
  echo "Presiona Enter para cerrar esta ventana."
  read
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  echo "⚠️  Tienes cambios locales sin guardar en un archivo de GymTrack."
  echo "   Este script NO los va a borrar. Avísale a Claude antes de continuar."
  echo ""
  git status --porcelain --untracked-files=no
  echo ""
  echo "Presiona Enter para cerrar esta ventana."
  read
  exit 1
fi

echo "1/2 — Trayendo la última versión desde GitHub..."
git pull origin main
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Algo falló trayendo la última versión. Copia TODO el texto de arriba"
  echo "   (incluye el error) y mándaselo a Claude."
  echo ""
  echo "Presiona Enter para cerrar esta ventana."
  read
  exit 1
fi

echo ""
echo "2/2 — Publicando en Firebase Hosting (puede tardar uno o dos minutos)..."
echo "Este paso puede abrir tu navegador para que inicies sesión con la cuenta"
echo "de Google/Firebase de GymTrack — es normal, solo la primera vez."
echo ""
npx firebase-tools deploy --only hosting

echo ""
if [ $? -eq 0 ]; then
  echo "✅ Listo. Entra a https://mi-gimnasio-8d528.web.app y haz Cmd+Shift+R para"
  echo "   confirmar que ya se ve el cambio."
else
  echo "❌ Algo falló en el despliegue. Copia TODO el texto de arriba (incluye el"
  echo "   error) y mándaselo a Claude."
fi
echo ""
echo "Presiona Enter para cerrar esta ventana."
read
