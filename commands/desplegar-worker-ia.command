#!/bin/bash
# Doble clic para desplegar/actualizar el Worker de Cloudflare de las recomendaciones con IA.
# Este archivo vive en commands/ — nos movemos a la carpeta del Worker.
cd "$(dirname "$0")/../cloudflare-worker-ia"

echo "==========================================="
echo "  Desplegando el Worker de IA (Cloudflare)"
echo "==========================================="
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

echo "Si es la primera vez, se va a abrir tu navegador para iniciar sesión en Cloudflare."
echo "Es normal. La GEMINI_API_KEY ya está guardada en Cloudflare, no hay que volver a ponerla."
echo ""

npx -y wrangler deploy
STATUS=$?

echo ""
if [ $STATUS -eq 0 ]; then
  echo "✅ Listo. El Worker ya tiene la versión nueva."
else
  echo "❌ Algo falló. Copia TODO el texto de arriba (incluye el error) y mándaselo a Claude."
fi
echo ""
echo "Presiona Enter para cerrar esta ventana."
read
