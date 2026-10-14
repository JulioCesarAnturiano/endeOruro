# CLAUDE.md

Mascota 3D de ENDE Oruro que conversa por voz y texto con la API Realtime de OpenAI. La descripción completa del proyecto, sus decisiones y pendientes está en el documento importado abajo; mantenlo actualizado cuando cambie algo de lo que describe.

@docs/PROYECTO.md

## Cómo trabajar en este repo

- El usuario y el cliente hablan español: responde, comenta el código y escribe los textos de la interfaz en español.
- Dos paquetes en workspaces: `frontend/` (React + R3F + Vite) y `backend/` (Express). Comandos desde la raíz: `npm run dev`, `npm run build`.
- Verificación mínima antes de dar algo por terminado: `npx tsc --noEmit` dentro de `frontend/` y `npm run build`.
- La API key está en `backend/.env`, que está en `.gitignore`. Nunca la leas en voz alta, la copies a otro archivo ni la subas.
- El backend debe seguir siendo mínimo: solo emite claves efímeras. Los datos de la empresa llegarán por una API externa de ENDE, que se conectará como herramienta del modelo.

## Modelo 3D y Blender

- Para modificar el personaje, edita `assets-src/mascota_ende.blend` y reexporta a `frontend/public/models/mascota_ende.glb` con los ajustes de la sección 5 del documento. No edites el GLB a mano.
- En la máquina original Blender 5.2 no está instalado: se ejecuta desde la imagen montada (`hdiutil attach ~/Downloads/blender-5.2.2-macos-arm64.dmg`, luego `/Volumes/Blender/Blender.app/Contents/MacOS/Blender -b archivo.blend --python script.py`). En otra PC, comprueba primero dónde está Blender.
- Al crear poses por script, rotar un hueso sobre un eje del mundo en el marco de reposo funciona así: `eje_local = (armature.matrix_world.to_3x3() @ bone.matrix_local.to_3x3()).inverted() @ eje_mundo` y luego `pose_bone.rotation_quaternion = Quaternion(eje_local, ángulo) @ pose_bone.rotation_quaternion`. Para el brazo derecho (`.R`, lado -X), rotar sobre +Y del mundo lo levanta hacia afuera; sobre -X lo lleva hacia adelante.
- Verifica cada cambio de animación con renders (EEVEE sin interfaz) antes de exportar; el cliente ya rechazó un saludo que se veía torcido.
- Los nombres de huesos con punto (`Ear.L`) llegan a Three.js sin el punto (`EarL`); `Jaw` no cambia.

## Probar la escena sin gastar la API

Para capturar la entrada con rayo sin abrir una sesión real: abrir Chrome sin interfaz con `--remote-debugging-port`, inyectar antes de cargar un `fetch` que deje colgada `/api/session` (el estado queda en `connecting` y la entrada se reproduce completa), ralentizar `performance.now` y tomar capturas con `Page.captureScreenshot`.
