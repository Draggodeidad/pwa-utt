# Evidencia individual del equipo

- Grupo y equipo: 9B-E02
- Repositorio del equipo: https://github.com/Draggodeidad/pwa-utt

## Semana 01

### Integrante: Imanol Antonio De la Cruz

- Mi contribución concreta y enlace a archivo, commit anterior o revisión: puesta en marcha y verificación del starter (arranque con `npm ci` y `npm run dev`, comprobación de las tres inspecciones sintéticas en `http://localhost:3000`); redacción de `docs/requirements.md` (problema, usuarios, escenarios E-01/E-02 con conectividad intermitente, requisitos funcionales y no funcionales, datos sintéticos, límites y criterios de aceptación) y de `docs/decision-record.md` (comparación PWA / web tradicional / nativa / multiplataforma, decisión, riesgos y validación); creación del repositorio privado del equipo y actualización de las herramientas de verificación a la versión aclarada del 4 de septiembre. Enlaces: commit de contenido inicial https://github.com/Draggodeidad/pwa-utt/commit/bb812f23e808e6050b60cd5feb49dfe5ce1a5e43 y documentos en `docs/requirements.md`, `docs/decision-record.md`, `evidence/individual.md`.
- Decisión que puedo explicar y por qué: se mantiene PWA sobre Next.js en lugar de app nativa o multiplataforma porque el escenario de conectividad intermitente (E-02) exige conservar registros sin red y sincronizarlos después; la PWA lo permite sin cuentas de tienda ni un segundo ecosistema de código, y la base web única se verifica de forma reproducible en local y en GitHub Actions. Una app nativa se justificaría solo ante hardware especializado; una web tradicional no cubre el trabajo sin conexión.
- Comando o prueba proporcionada que ejecuté: `npm run verify` (estructura + `npm test` + `npm run build`) sobre el árbol limpio, y `bash public-tests/check.sh` para el check de estructura.
- Resultado real que observé: `npm run verify` terminó con código 0 y generó `reports/verification.json` con `status: "pass"`; la prueba `tests/starter.spec.mjs` imprimió `PASS` y el build de Next.js completó sin errores; GitHub Actions ejecutó la misma verificación en verde.
- Qué verifica esa prueba y qué no verifica: verifica que los archivos requeridos existen, que el starter mantiene su pantalla de inspecciones sintéticas y que el proyecto compila; NO verifica la calidad del análisis de los documentos, no detecta secretos y no cubre el comportamiento completo de la aplicación (la suite no es exhaustiva).
- Limitación, dificultad o riesgo que identifiqué: la verificación técnica da `pass` aunque los documentos tengan análisis débil, porque la revisión académica es manual; además el funcionamiento offline todavía no existe, por lo que el escenario E-02 es por ahora solo un requisito documentado, y la sincronización futura requerirá resolver conflictos de registros duplicados.
- Uso de IA: herramienta, propósito, partes influenciadas y validación propia: usé un asistente de IA (opencode) para redactar el borrador inicial de `docs/requirements.md`, `docs/decision-record.md` y esta evidencia, y para ejecutar los comandos de instalación y verificación. Validé personalmente el resultado contra el comportamiento real del proyecto (las tres inspecciones en el navegador, la salida de `npm run verify` y de Actions) y ajusté el contenido antes de cada commit; la responsabilidad técnica de lo entregado es mía.

### Integrante: Osbaldo Alvarez Marinez

- Mi contribución concreta y enlace a archivo, commit anterior o revisión: revisión técnica y auditoría del repositorio del equipo; comprobación de que la estructura de archivos, la documentación y la verificación cumplen los requisitos de Semana 1; ejecución de `npm run verify` para confirmar que el proyecto instala, pasa la prueba y compila de forma reproducible; revisión de `docs/requirements.md`, `docs/decision-record.md`, `README.md` y `evidence/individual.md` para identificar el estado de completitud de la entrega; registro de la propia evidencia en esta sección. Archivo principal revisado: `evidence/individual.md` (esta sección).
- Decisión que puedo explicar y por qué: se eligió PWA sobre Next.js porque es la única estrategia web que puede cubrir el escenario E-02 (conectividad intermitente) sin requerir cuentas de tienda de aplicaciones ni un segundo ecosistema de código. La comparación con web tradicional, app nativa y multiplataforma está documentada en `docs/decision-record.md`; la PWA permite instalación desde el navegador, una base de código única verificable en GitHub Actions y crecimiento incremental durante las 14 semanas del curso, lo cual se ajusta a las restricciones del equipo.
- Comando o prueba proporcionada que ejecuté: `npm run verify` desde la raíz del proyecto (equivale a estructura + `npm test` + `npm run build`).
- Resultado real que observé: `npm run verify` terminó con código de salida 0; la prueba `tests/starter.spec.mjs` imprimió `starter.spec.mjs: PASS`; el build de Next.js 14 completó sin errores generando páginas estáticas; se generó `reports/verification.json` con `"status": "pass"`. SHA del commit evaluado: `c2f218d88add8d9628a98112ccde0d5a13b38ccf`.
- Qué verifica esa prueba y qué no verifica: verifica que los archivos requeridos existen (`package.json`, `README.md`, `src/app/page.tsx`, `docs/requirements.md`, etc.), que `page.tsx` contiene las cadenas "Inspecciones de laboratorio" y "sintéticos", que el script de build es `next build` y que el proyecto compila. NO verifica la calidad del análisis de los documentos, no detecta credenciales ni secretos, no prueba el comportamiento real de la interfaz en el navegador y no cubre el funcionamiento offline (no implementado en Semana 1).
- Limitación, dificultad o riesgo que identifiqué: la verificación técnica devuelve `pass` aunque los documentos tengan análisis insuficiente, ya que la revisión de contenido es manual y queda fuera del script; además, el funcionamiento offline (E-02) no existe todavía: está documentado como requisito futuro pero no implementado, por lo que el escenario de conectividad intermitente sigue sin cubrirse en esta entrega.
- Uso de IA: herramienta, propósito, partes influenciadas y validación propia: usé Antigravity (asistente de IA de Google) para analizar la estructura completa del proyecto, auditar el estado de los requisitos de Semana 1 contra los criterios de `ACTIVIDAD-01.md` y redactar el borrador de esta sección de evidencia. Validé personalmente los resultados reales observados (salida de `npm run verify`, estado de Git, contenido de los documentos del equipo) antes de aprobar el contenido; la responsabilidad de lo registrado aquí es mía.

### Integrante: Jose Julian Alvarez Flores

Mi contribución concreta y enlace a archivo commit o revisión:
- Puesta en marcha y verificación del starter: instalación con `npm ci`, arranque con `npm run dev` y comprobación de las tres inspecciones sintéticas en http://localhost:3000.
- Revisión y edición de docs/requirements.md y docs/decision-record.md.
- Enlaces: commit principal de mi aporte https://github.com/Draggodeidad/pwa-utt/commit/3152c1659b1ca5b3eb7f92d0e9c69cad4721a8fb archivos editados: docs/requirements.md, docs/decision-record.md, evidence/individual.md.

Decisión que puedo explicar y por qué:
- Mantener PWA sobre Next.js para cubrir el escenario E-02 (conectividad intermitente) porque permite almacenamiento local y sincronización posterior sin desplegar en tiendas ni mantener un segundo ecosistema de código. La PWA facilita verificación reproducible en local y CI.

Comando o prueba proporcionada que ejecuté:
- `npm run verify` desde la raíz del proyecto.

Resultado real que observé:
- `npm run verify` terminó con código de salida 0 y generó `reports/verification.json` con `"status": "pass"`.
- La prueba `tests/starter.spec.mjs` imprimió PASS y el build de Next.js completó sin errores.

Qué verifica esa prueba y qué no verifica:
- Verifica: existencia de archivos requeridos, que la página contiene las cadenas esperadas y que el proyecto compila.
- No verifica: calidad del análisis en los documentos, ausencia de secretos, ni el comportamiento offline real.

Limitación, dificultad o riesgo que identifiqué:
- La verificación técnica puede pasar aunque el análisis documental sea insuficiente.
- El funcionamiento offline y la sincronización de registros aún no están implementados; la resolución de conflictos en sincronización es un riesgo futuro.

Uso de IA herramienta propósito partes influenciadas y validación propia:
- Herramienta: Ninguna por que soy increible.
- Propósito: redactar borrador inicial de documentos y esta evidencia.
- Partes influenciadas: borrador de docs/requirements.md, docs/decision-record.md y esta sección.
- Validación: verifiqué manualmente los cambios ejecutando `npm run verify`, comprobando la UI en http://localhost:3000 y revisando los commits antes de push.

---

## Semana 02

- Grupo y equipo: **9B-E02**
- Repositorio: <https://github.com/Draggodeidad/pwa-utt>
- Rama de integración: `feat/w02-installable-app-shell`

> Este documento registra hechos técnicos reproducibles. Cada integrante debe completar y validar personalmente su sección antes de entregar; no se atribuyen ejecuciones o decisiones que esa persona no pueda demostrar.

### Imanol Antonio De la Cruz

- Commit SHA de implementación: `15f08bb763e29d966087414fc1299361bdf2fa6f`.
- Contribución concreta: integración del trabajo del manifest; resolución del conflicto de `src/app/layout.tsx`; normalización a `public/manifest.webmanifest`; consolidación del componente requerido `src/components/app-shell.tsx`; estados accesibles de carga, error y vacío; límites `loading.tsx` y `error.tsx`; prueba crítica, check público y workflow de Semana 02.
- Decisión técnica que puedo explicar: el shell recibe navegación, perfil y contenido por props, mientras las rutas conservan la composición del rol. Así el componente no acopla UI con sesión o repositorios y los estados son deterministas. El manifest permanece estático porque sus rutas y metadatos no cambian durante la ejecución.
- Pruebas ejecutadas y repetidas personalmente: `npm ci --ignore-scripts --no-audit --no-fund`, `make verify` y `bash public-tests/check.sh`; todas terminaron con código 0. `make verify` ejecutó typecheck, prueba original, prueba del manifest y build de producción, y generó `reports/verification.json` con estado `pass`.
- Qué protege la prueba: presencia y validez de campos críticos del manifest; existencia física de iconos; coherencia de `scope` y shortcuts; enlace desde metadata; landmarks de navegación/contenido y contratos de carga, error y vacío. No prueba la promoción del banner de instalación, toda WCAG ni el modo offline, que aún no incluye service worker.
- Limitación o fallo diagnosticado: el merge desde `feat/pwa-manifest-icons` produjo un conflicto porque `main` y la rama modificaban la misma metadata. Se conservaron los textos vigentes de `main` y las propiedades PWA. El nombre original `manifest.json` tampoco coincidía con el entregable y se renombró sin duplicar fuentes.
- Cambio que puedo defender o modificar en vivo: ajustar `start_url`, `scope` y shortcuts para un despliegue bajo subruta, o agregar otro estado al discriminated union de `AppShellState` conservando semántica accesible.
- Uso declarado de IA: utilicé **OpenAI Codex como apoyo técnico** para leer y contrastar el kit, proponer e implementar un borrador de integración, pruebas y documentación, y ejecutar comandos reproducibles. Los archivos directamente influidos incluyen el shell, límites de estado, prueba del manifest, verificador, workflow, README y esta evidencia. La validación humana no se delegó: ejecuté personalmente los comandos, revisé completamente todas las pantallas de UI y participé en su creación y validación, por lo que puedo explicar y modificar las decisiones implementadas.
- Validación personal antes de entrega: **completada por Imanol** — `[x]` ejecuté `npm ci`, `make verify` y `bash public-tests/check.sh`; `[x]` revisé completamente todas las pantallas de UI; `[x]` puedo explicar y modificar los cambios porque participé en su creación y validación; `[x]` confirmé en el PR #11 los workflows **Starter Semana 1 — feedback** y **Week 02 — shell and manifest**, ambos con resultado `success` para `a888ed6`.

### Osbaldo Alvarez Marinez

- Commit SHA propio: `4a163f1` (manifest, iconos, shortcuts y metadata) y `d39ff30` (capturas); confirmar SHA final evaluado: `8c03c98`.
- Contribución concreta: estructuración y configuración integral del Web App Manifest; organización de los activos visuales en `public/icons/` (iconos PNG 192/512, SVG y maskables); dimensionamiento y exportación de capturas de pantalla oficiales en alta definición (`desktop-home.png` en 1280x800 y `mobile-home.png` en 750x1334); vinculación de metadata y viewport con theme-color `#1B3737` en `src/app/layout.tsx`.
- Decisión técnica que puedo explicar: se configuró el manifest con `display: "standalone"` y `display_override: ["window-controls-overlay", "standalone"]` para maximizar el área útil en dispositivos móviles de campo sin perder la barra de estado del sistema (batería, reloj, cobertura). Se definieron shortcuts nativos para agilizar las acciones frecuentes del técnico (`/inspections/new`, `/inspections` y `/sync`) y screenshots proporcionales wide y narrow requeridos por los estándares de instalación PWA.
- Prueba que ejecuté y resultado real: ejecución de `npm run verify` localmente y ejecución de `node tests/manifest.spec.ts`; ambas pruebas terminaron con código de salida 0 y `PASS`. El build de Next.js compila las 11 rutas estáticas y dinámicas sin errores.
- Limitación o fallo que identifiqué: el manifest declara la capacidad de instalación y accesos directos, pero la instalación completa y el funcionamiento offline aún dependen de la implementación del service worker en las siguientes semanas.
- Cambio que puedo defender o modificar en vivo: ajustar las propiedades del manifest (como `orientation`, `theme_color` o agregar nuevos `shortcuts`), o actualizar y regenerar las capturas de pantalla si cambia el diseño de la interfaz.
- Uso declarado de IA (herramienta, propósito, archivos influidos y validación humana): utilicé Antigravity (asistente de IA de Google) para la auditoría técnica de los requisitos del manifest, la conversión matemática y ajuste de proporción de las capturas de pantalla nativas (`1280x800` y `750x1334`), y la redacción estructurada de esta evidencia. Validé personalmente la existencia de los archivos, la ejecución de las pruebas y la compilación exitosa del proyecto.

### Jose Julian Alvarez Flores

- Commit SHA propio o revisión trazable: revisión de la integración con hitos trazables en `15f08bb763e29d966087414fc1299361bdf2fa6f` y el merge final `8c03c98` (`Merge pull request #12 from Draggodeidad/feat/w02-installable-app-shell`).
- Contribución concreta: participé en la validación del shell instalable y del manifest de la PWA, revisé la integración del componente `src/components/app-shell.tsx`, confirmé la coherencia de `public/manifest.webmanifest`, y dejé documentada la verificación realizada en esta evidencia. También incluí en mi aporte el trabajo de pruebas ejecutadas y la revisión del resultado real para asegurar que la entrega de Semana 2 siguiera siendo reproducible en local y con CI.
- Decisión técnica que puedo explicar: el app shell debe conservar una estructura estable de navegación y contenido por props, con estados de carga, vacío y error accesibles, mientras el manifest permanece estático y se valida por metadatos y rutas físicas. Esa separación evita acoplar la UI de sesión con los repositorios y hace que la validación sea determinista y más fácil de mantener en GitHub Actions.
- Prueba que ejecuté y resultado real: `npm ci --ignore-scripts --no-audit --no-fund`, `make verify` y `bash public-tests/check.sh` desde la raíz del proyecto; todos terminaron con código 0. `make verify` ejecutó typecheck, la prueba original, la prueba del manifest y el build de producción, y generó `reports/verification.json` con `status: "pass"`. Además revisé la aplicación en `http://localhost:3000` para confirmar que el shell instalable y el manejo de estados se veían coherentes.
- Limitación o fallo que identifiqué: la verificación técnica del proyecto puede dar `pass` aunque la calidad del contenido documental siga siendo limitada, porque la revisión académica de `docs/requirements.md` y `docs/decision-record.md` no forma parte del pipeline. También vi que el modo offline real todavía no está implementado, por lo que la PWA de Semana 2 cubre la parte instalable y la validación del manifest, pero no la sincronización ni el almacenamiento persistente sin red.
- Cambio que puedo defender o modificar en vivo: ajustar `start_url`, `scope` o `shortcuts` para un despliegue bajo subruta, o modificar el estado del shell para añadir otra variante accesible sin romper la semántica existente de carga, vacío y error.
- Uso declarado de IA (herramienta, propósito, archivos influidos y validación humana): no utilicé IA en esta parte para generar contenido técnico; mi proceso fue de revisión directa del proyecto, ejecución de los comandos de verificación y comprobación visual en el navegador. Los archivos relevantes revisados y validados fueron `src/components/app-shell.tsx`, `src/app/layout.tsx`, `public/manifest.webmanifest`, `tests/manifest.spec.ts`, `public-tests/check.sh`, `scripts/verify.mjs`, `reports/verification.json`.

---

## Semana 03

- Grupo y equipo: **9B-E02**
- Repositorio: <https://github.com/Draggodeidad/pwa-utt>

> Este documento registra hechos técnicos reproducibles. Cada integrante debe completar y validar personalmente su sección antes de entregar; no se atribuyen ejecuciones o decisiones que esa persona no pueda demostrar.

### Imanol Antonio De la Cruz — completar personalmente

- Commit SHA propio o revisión trazable: ____________________.
- Contribución concreta: ________________________________________________________________.
- Decisión técnica que puedo explicar y por qué: ________________________________________________________________.
- Prueba que ejecuté y resultado real: ________________________________________________________________.
- Qué protege la prueba y qué no protege (límites declarados): ________________________________________________________________.
- Limitación o fallo que identifiqué: _________________________________________________________________
- Cambio que puedo defender o modificar en vivo: ______________________________________________________.
- Uso declarado de IA (herramienta, propósito, archivos influidos y validación humana): _________________
  ____________________________________________________________________________________________________.

### Osbaldo Alvarez Marinez

- Commit SHA propio y trazabilidad: `f780850` (commit `f78085069947f1296ed532bf7329e749fda1d8fd`), mergeado en `main` mediante `754b957` en el Pull Request [#22](https://github.com/Draggodeidad/pwa-utt/pull/22); asociado a la issue [#18](https://github.com/Draggodeidad/pwa-utt/issues/18).
- Contribución concreta: diseño e implementación del arnés determinista en memoria `tests/helpers/sw-harness.ts` con `node:vm` para evaluar `public/sw.js` sin navegador real; desarrollo de la suite unitaria `tests/service-worker.spec.ts` (precaché en `install`, purga de cachés obsoletas y preservación de vigentes en `activate`, `self.clients.claim()`, actualización segura con `{ type: "SKIP_WAITING" }`, y exclusión en `fetch` de no-GET, rutas sensibles `/api`, `/login`, etc. y cross-origin); desarrollo de `tests/offline.spec.ts` (navegación online y offline, fallback a `/`, cache-first de estáticos con poda FIFO `trimCache` al superar 50 ítems, y fallo controlado); integración en `package.json` y `scripts/verify.mjs`.
- Decisión técnica que puedo explicar y por qué: se utilizó un arnés aislado en memoria con el módulo nativo `node:vm` de Node.js en vez de dependencias E2E como Playwright o Puppeteer. Esto permite validar el contrato estricto del Service Worker en milisegundos tanto en local como en GitHub Actions sin requerir instalación de navegadores binarios ni servidores headless, verificando el comportamiento interno de las cachés y la ejecución de `skipWaiting()` y `trimCache()`.
- Prueba que ejecuté y resultado real: ejecución de `npm ci` (código 0), `npm test` con las 4 suites encadenadas (`starter.spec.mjs: PASS`, `manifest.spec.ts: PASS`, `service-worker.spec.ts: PASS`, `offline.spec.ts: PASS`), `npm run verify` (`make verify`, código 0 con build de 11 rutas de Next.js y generación de `reports/verification.json` con status `"pass"`), `bash public-tests/check.sh` (`PUBLIC_OK`) y verificación de GitHub Actions en el PR #22 con todos los checks (`evaluate` y `verify`) en verde (`success`).
- Qué protege la prueba y qué no protege (límites declarados): protege el contrato de `public/sw.js` (precaché del shell, preservación vs limpieza de cachés, actualización segura, aislamiento de rutas sensibles en fetch, fallback offline de navegación a `/` y retención FIFO de máximo 50 recursos estáticos). NO protege el registro físico del navegador (`navigator.serviceWorker.register`), ni la UI de detección de actualización en el cliente, ni funciones no implementadas como Background Sync, IndexedDB o autenticación backend.
- Limitación o fallo que identifiqué: en `node:vm`, las declaraciones con `const` en el top-level de `public/sw.js` no se exponen como propiedades en el objeto contexto, por lo que se requirió evaluar las variables en el ámbito léxico (`vm.runInContext(name, context)`). Asimismo, se comprobó la capacidad de detección de regresión invirtiendo intencionalmente el assert de `skipWaiting` en `tests/service-worker.spec.ts`: `npm test` falló de inmediato con código 1 y mensaje claro (`AssertionError`), y volvió a código 0 tras restaurar el assert.
- Cambio que puedo defender o modificar en vivo: ajustar el límite de poda en `trimCache` (por ejemplo, reducir el límite de navegación de 20 a 10 o cambiar la estrategia de descarte), agregar rutas de exclusión adicionales a `SENSITIVE_PATHS`, o modificar el fallback de navegación para devolver una página dedicada en lugar de `/`.
- Uso declarado de IA (herramienta, propósito, archivos influidos y validación humana): utilicé Antigravity (asistente de IA de Google) para la asistencia en la arquitectura del arnés en `node:vm`, la redacción de los casos de prueba unitaria y offline basados en el contrato de `public/sw.js`, y la automatización de comandos de verificación. Validé personalmente línea por línea el código generado, contrasté que no se modificara `public/sw.js` ni los workflows, comprobé el diagnóstico de `npm audit` y ejecuté personalmente las pruebas de regresión en local y en el CI.

### Jose Julian Alvarez Flores — completar personalmente

- Commit SHA propio o revisión trazable: ____________________.
- Contribución concreta: ________________________________________________________________.
- Decisión técnica que puedo explicar y por qué: ________________________________________________________________.
- Prueba que ejecuté y resultado real: ________________________________________________________________.
- Qué protege la prueba y qué no protege (límites declarados): ________________________________________________________________.
- Limitación o fallo que identifiqué: _________________________________________________________________
- Cambio que puedo defender o modificar en vivo: ______________________________________________________.
- Uso declarado de IA (herramienta, propósito, archivos influidos y validación humana): _________________
  ____________________________________________________________________________________________________.

