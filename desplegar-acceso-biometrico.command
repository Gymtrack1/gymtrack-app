#!/bin/bash
# Doble clic para desplegar/actualizar la Cloud Function del control de acceso biométrico (ZKTeco).
cd "$(dirname "$0")"

echo "==========================================="
echo "  Desplegando función de acceso biométrico"
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

echo "Este paso puede abrir tu navegador para que inicies sesión con la cuenta"
echo "de Google/Firebase de GymTrack — es normal, solo la primera vez."
echo ""

echo "1/2 — Instalando dependencias de la función..."
cd functions
npm install
cd ..
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Algo falló instalando dependencias. Copia todo este mensaje y mándaselo a Claude."
  echo ""
  echo "Presiona Enter para cerrar esta ventana."
  read
  exit 1
fi

echo ""
echo "2/2 — Desplegando a Firebase (puede tardar uno o dos minutos)..."
npx firebase-tools deploy --only functions

echo ""
if [ $? -eq 0 ]; then
  echo "✅ Listo. Busca en el texto de arriba una línea con una URL que termina en /adms"
  echo "   (algo como https://us-central1-mi-gimnasio-8d528.cloudfunctions.net/adms)."
  echo "   Esa es la URL que tienes que poner en el equipo biométrico, SIN /iclock al final."
  echo ""
  echo "   Pasos que todavía faltan (manuales, ver CHANGELOG.md):"
  echo "   - Agregar el número de serie del equipo en Firestore, en tu documento de"
  echo "     usuarios/, campo equiposAutorizados (array)."
  echo "   - Configurar esa URL en el menú del equipo (Comm > Ajustes de Nube/ADMS)."
else
  echo "❌ Algo falló en el despliegue. Copia TODO el texto de arriba (incluye el error)"
  echo "   y mándaselo a Claude — normalmente es porque falta activar el plan Blaze"
  echo "   o iniciar sesión con la cuenta correcta de Firebase."
fi
echo ""
echo "Presiona Enter para cerrar esta ventana."
read
