# Pruebas de firestore.rules (emulador local)

Corre las reglas de `firestore.rules` contra un emulador local de Firestore
(sin tocar tu proyecto real ni tus datos) y verifica automáticamente:

- Que un gimnasio no pueda leer/escribir datos de otro gimnasio (docs de
  cuenta y subcolecciones: miembros, pagos, etc.).
- Que el admin (`luismolinac06@gmail.com`) sí tenga acceso total.
- Que un usuario no autenticado no pueda leer nada.
- Que el flujo de migración `pending_<email>` → uid real siga funcionando.
- Deja documentado (sin fallar la prueba) el límite conocido: un gimnasio
  puede reescribir su propio `plan`/`funciones` — cerrar esto requiere una
  Cloud Function.

## Requisitos

- Node.js 18+
- Java 21+ (lo pide `firebase-tools` recientes; aquí quedó fijado en
  `firebase-tools@13.15.4`, que corre con Java 11+, por si no quieres
  instalar Java 21)

## Cómo correrlo

```bash
cd rules-test
npm install
npm test
```

Vas a ver algo así:

```
--- Aislamiento entre gimnasios (lo más importante) ---
OK   Gym A puede leer su propio doc
OK   Gym A NO puede leer el doc de Gym B
...
=== N OK / 0 FAIL ===
```

Si algo dice `FAIL`, el mensaje explica qué se esperaba vs. qué pasó.

## Si prefieres no instalar nada

Pega el contenido de `firestore.rules` en Firebase Console → tu proyecto →
Firestore Database → pestaña **Reglas** → **Simulador de reglas**, y
simula un `get`/`list` autenticado como un uid que no sea el dueño del doc
que estás probando. Debería negarlo.

## Antes de publicar en producción

1. Corre `npm test` y confirma `0 FAIL`.
2. Copia el contenido de `firestore.rules` a Firebase Console → Firestore →
   Reglas → Publicar (o `firebase deploy --only firestore:rules` si usas
   la CLI en tu proyecto real).
