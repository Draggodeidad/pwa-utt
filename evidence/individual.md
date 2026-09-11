# Evidencia individual — Semana 02

- Grupo y equipo: **9B-E02**
- Repositorio: <https://github.com/Draggodeidad/pwa-utt>
- Rama de integración: `feat/w02-installable-app-shell`

> Este documento registra hechos técnicos reproducibles. Cada integrante debe completar y validar personalmente su sección antes de entregar; no se atribuyen ejecuciones o decisiones que esa persona no pueda demostrar.

## Imanol Antonio De la Cruz

- Commit SHA de implementación: `15f08bb763e29d966087414fc1299361bdf2fa6f`.
- Contribución concreta: integración del trabajo del manifest; resolución del conflicto de `src/app/layout.tsx`; normalización a `public/manifest.webmanifest`; consolidación del componente requerido `src/components/app-shell.tsx`; estados accesibles de carga, error y vacío; límites `loading.tsx` y `error.tsx`; prueba crítica, check público y workflow de Semana 02.
- Decisión técnica que puedo explicar: el shell recibe navegación, perfil y contenido por props, mientras las rutas conservan la composición del rol. Así el componente no acopla UI con sesión o repositorios y los estados son deterministas. El manifest permanece estático porque sus rutas y metadatos no cambian durante la ejecución.
- Pruebas ejecutadas por el asistente en el entorno local: `npm ci --ignore-scripts --no-audit --no-fund`, `make verify` y `bash public-tests/check.sh`; todas terminaron con código 0. `make verify` ejecutó typecheck, prueba original, prueba del manifest y build de producción, y generó `reports/verification.json` con estado `pass`. La ejecución remota queda asociada al SHA de cierre en GitHub Actions.
- Qué protege la prueba: presencia y validez de campos críticos del manifest; existencia física de iconos; coherencia de `scope` y shortcuts; enlace desde metadata; landmarks de navegación/contenido y contratos de carga, error y vacío. No prueba la promoción del banner de instalación, toda WCAG ni el modo offline, que aún no incluye service worker.
- Limitación o fallo diagnosticado: el merge desde `feat/pwa-manifest-icons` produjo un conflicto porque `main` y la rama modificaban la misma metadata. Se conservaron los textos vigentes de `main` y las propiedades PWA. El nombre original `manifest.json` tampoco coincidía con el entregable y se renombró sin duplicar fuentes.
- Cambio que puedo defender o modificar en vivo: ajustar `start_url`, `scope` y shortcuts para un despliegue bajo subruta, o agregar otro estado al discriminated union de `AppShellState` conservando semántica accesible.
- Uso declarado de IA: utilicé **OpenAI Codex como apoyo técnico** para leer y contrastar el kit, proponer e implementar un borrador de integración, pruebas y documentación, y ejecutar comandos reproducibles. Los archivos directamente influidos incluyen el shell, límites de estado, prueba del manifest, verificador, workflow, README y esta evidencia. La validación humana no se delega: antes de entregar debo repetir `npm ci` y `make verify`, revisar el diff, comprobar navegación por teclado e instalación en el navegador, y poder explicar o modificar cada decisión.
- Validación personal antes de entrega: **pendiente de marcar por Imanol** — `[ ]` repetí los comandos; `[ ]` revisé la UI; `[ ]` puedo defender el cambio; `[ ]` confirmé el check de Actions del SHA final.

## Osbaldo Alvarez Marinez — completar personalmente

- Commit SHA propio: `4a163f1` (manifest, iconos, shortcuts y metadata) y `d39ff30` (capturas); confirmar SHA final evaluado: ____________________.
- Decisión técnica que puedo explicar: ________________________________________________________________.
- Prueba que ejecuté y resultado real: ________________________________________________________________.
- Limitación o fallo que identifiqué: _________________________________________________________________
- Cambio que puedo defender o modificar en vivo: ______________________________________________________.
- Uso declarado de IA (herramienta, propósito, archivos influidos y validación humana): _________________
  ____________________________________________________________________________________________________.

## Jose Julian Alvarez Flores — completar personalmente

- Commit SHA propio o revisión trazable: ______________________________________________________________.
- Contribución concreta: _____________________________________________________________________________.
- Decisión técnica que puedo explicar: ________________________________________________________________.
- Prueba que ejecuté y resultado real: ________________________________________________________________.
- Limitación o fallo que identifiqué: _________________________________________________________________
- Cambio que puedo defender o modificar en vivo: ______________________________________________________.
- Uso declarado de IA (herramienta, propósito, archivos influidos y validación humana): _________________
  ____________________________________________________________________________________________________.
