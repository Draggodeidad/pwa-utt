# Estrategia de pruebas W08

## Propósito y criterio de selección

La pirámide separa reglas de dominio, integración HTTP de la aplicación y el recorrido crítico del usuario en un navegador. Cada nivel usa datos sintéticos. Los wrappers de dominio, HTTP y cola reutilizan suites acumulativas de `npm test` sin mover ni reemplazar sus assertions; la suite pura de fotos aportada en #88 ejercita directamente el módulo real. El [baseline](w08-baseline.md) conserva el contrato oficial y el historial de implementación.

| Nivel y ruta registrada | Riesgo y casos relevantes | Comando | Dependencias sintéticas | Límite | Evidencia verificable |
| --- | --- | --- | --- | --- | --- |
| Unitario — [dominio](../tests/unit/domain-contracts.spec.ts), wrapper de [domain-contracts](../tests/domain-contracts.spec.ts) | Borradores incompletos frente a finalización; estructura/versiones de ocho operaciones; DTOs, conteos y adaptadores snake_case/camelCase. | `npm run test:unit` | Entidades, IDs, fechas y operaciones construidos en memoria. | Lógica/adaptadores en Node; sin Next, persistencia remota ni navegador. | [CI histórico de #88](https://github.com/Draggodeidad/pwa-utt/actions/runs/40020745057), `Run unit suites`; commit original del owner `ec587fe`. |
| Unitario — [fotos](../tests/unit/photo-validation.spec.ts) | Rechazo de 0 bytes, MIME inválido y 5 MiB + 1; aceptación de JPEG/PNG/WebP y 5 MiB exactos; hash SHA-256 determinista, formato hexadecimal y diferencia de contenidos (14 casos). | `npm run test:unit` | `Blob` y buffers sintéticos; funciones reales `validatePhotoFile` y `photoSourceHash`. | No cámara, Sharp, decodificación real, red ni base de datos. | [PR #88](https://github.com/Draggodeidad/pwa-utt/pull/88), aporte de Osbaldo `7a958749c00491eda172dbf5cc1563dad18fe8e9`; mismo CI, `Run unit suites`. |
| Integración — [HTTP](../tests/integration/online-workflow.spec.ts), wrapper de [online-inspection-workflow](../tests/online-inspection-workflow.spec.ts) | Login técnico, creación, guardado y recarga, hallazgos y finalización con ACK; versiones; lectura por coordinación; rechazo de edición posterior y descarte sin resurrección. | `npm run test:integration` | Next real en loopback y [backend HTTP sintético](../tests/e2e/fixtures/backend.cjs), cuentas y entidades sintéticas. | Sin navegador. Supabase simulado; no acredita RLS remota. Usa `next dev` y puede sustituir `.next`. | CI histórico de #88, `Run integration suites`; wrapper original del owner en `ec587fe`. |
| Integración — [recuperación de cola](../tests/integration/queue-recovery.spec.ts), wrapper de [queue-recovery](../tests/queue-recovery.spec.ts) | Reapertura offline; Retry-After y agotamiento de cinco intentos; 401/403/409/422; leases entre pestañas y ACK obsoleto; ACK perdido con reenvío idempotente; dependencias, finalización y vaciado sólo tras ACK; timeout HTTP. | `npm run test:integration` | [Harness IndexedDB](../tests/helpers/indexed-db-harness.ts), reloj controlado, transporte y respuestas HTTP sintéticas; almacenamiento y runner reales. | No IndexedDB de navegador, pestañas físicas, red real ni RLS. | PR #88, aporte de Osbaldo `e7379f65caddb79f437ded61841c8648fbf63084`; mismo CI, `Run integration suites`. |
| E2E — [flujo crítico](../tests/e2e/critical-flow.spec.ts) | Login; campos requeridos; captura offline con hallazgo; recuperación IndexedDB/SW tras recarga; sincronización sin duplicados; coordinación no ve el borrador y sí la inspección finalizada. | `npm run test:e2e` | Chromium y Next de producción reales; backend HTTP, usuarios y datos sintéticos; puertos loopback efímeros. | Un recorrido en Chromium; sin RLS remota, hardware físico, Firefox/WebKit/Safari. | Mismo CI histórico de #88, `Run browser E2E suite`: `1 passed`; [configuración](../playwright.config.mjs). |

El CI histórico citado evalúa exactamente `9ccda90a8b5b5888a49dd9156b1f8efab1e90c0e` con Node 22.22.3; el [artefacto 12529754946](https://github.com/Draggodeidad/pwa-utt/actions/runs/40020745057/artifacts/12529754946) contiene los tres reportes comprobados. No acredita el lint incorporado después. La validación local de consolidación y el enlace al CI del SHA final se registran en [la entrega W08](w08-delivery.md) y [PR #89](https://github.com/Draggodeidad/pwa-utt/pull/89).

No se define umbral de cobertura. Las suites de `tests/` originales permanecen en `npm test`; los wrappers por nivel sólo clasifican y lanzan las suites existentes como procesos Node independientes, conservando stdout, assertions y exitCode.

## Descubrimiento y comportamiento del runner

`scripts/run-test-level.mjs` descubre archivos directos `tests/unit/*.spec.ts` y `tests/integration/*.spec.ts`, en orden alfabético. Actualmente descubre dos entradas unitarias (dominio y fotos) y dos de integración (HTTP y cola); no requiere editar `package.json` para descubrir otra entrada directa válida. Cada entrada de nivel se ejecuta en un proceso Node; un error de arranque o una assertion no satisfecha propaga un código distinto de cero. Un directorio ausente o sin archivos `.spec.ts` también falla para que CI no acepte un nivel vacío.

Los wrappers actuales reutilizan `tests/domain-contracts.spec.ts`, `tests/online-inspection-workflow.spec.ts` y `tests/queue-recovery.spec.ts`. La suite HTTP comparte su backend sintético con E2E; no se trata de un backend productivo reconstruido ni de una prueba remota de políticas RLS.

## Orden de verificación

En local, con Node **22.22.3**, ejecutar secuencialmente:

```bash
npm ci --no-audit --no-fund
npx playwright install chromium
bash public-tests/check.sh
bash public-tests/check-w05.sh
bash public-tests/check-w06.sh
npm run lint
npm run test:unit
npm run test:integration
make verify
E2E_SKIP_BUILD=1 npm run test:e2e
```

El workflow `.github/workflows/academic-evaluation.yml` usa Node 22.22.3 y ejecuta `npm ci`, checks públicos W02/W05/W06, lint, suites unitarias e integración, `make verify` (typecheck, suite acumulativa, build, métricas y gate W06), e instalación reproducible de Chromium con `npx playwright install --with-deps chromium`. La integración usa `next dev`, que puede sustituir `.next`; por eso `make verify` queda después de integración y crea la build de producción que usará E2E. Finalmente invoca `E2E_SKIP_BUILD=1 npm run test:e2e`: Playwright inicia Next en modo producción y el backend sintético en puertos loopback antes de iniciar el navegador. `test:e2e` conserva su build automática cuando se ejecuta sin esa variable.

`npm test` no llama a `test:unit`, `test:integration`, `test:e2e` ni al verificador. `make verify` sólo llama a `npm run verify`; el verificador ejecuta los comandos acumulativos existentes, sin invocarse a sí mismo. El workflow reúne ambos caminos sin ciclos de scripts.

## Registro de resultados y límites académicos

Por cada comprobación se registran la fecha, el SHA completo de código, comando, exitCode, caso, resultado esperado, resultado observado y límite del entorno. `reports/verification.json` y `reports/rendering-metrics.json` siguen siendo los reportes existentes. El workflow agrega `reports/academic-evaluation.json`, que liga sus resultados a `git rev-parse HEAD` y a la URL del run; Actions publica los tres archivos con el SHA evaluado incluso si un check falla. No se publican trazas del navegador, estado de sesión, cookies, credenciales ni tokens.

La tabla de niveles documenta contratos verificables y límites; puede ampliarse con los aportes independientes del equipo. La evidencia personal y la revisión humana se mantienen separadas. Un resultado técnico verde no asigna calificación.

## Lint y caso de fallo corregido

`npm run lint` ejecuta `eslint . --max-warnings=0` con ESLint 9.39.5 y parser TypeScript 8.72.0. La configuración plana comprueba sintaxis y errores de flujo (incluidas claves/casos duplicados, código inalcanzable y expresiones constantes incorrectas), sin reglas de formato. Incluye código, scripts y pruebas; sólo omite dependencias, salidas de build/cobertura/pruebas y `public/sw-build.js`, que es generado. Typecheck continúa siendo una comprobación separada dentro de `make verify`; este lint mínimo no acredita una auditoría completa de seguridad o accesibilidad. CI incluye el resultado `lint` en `academic-evaluation.json` y falla ante errores.

El [caso de fallo de sesión/fotos](w08-delivery.md#fallo-real-corregido-en-w06-y-revalidado-en-w08) conserva el arreglo histórico `57ee3ea` y compara una misma suite existente con el código anterior, corregido y actual. No se crean suites duplicadas ni bugs deliberados. Una sonda `assert.fail` sólo acredita propagación del runner.

## Autoría y trade-offs

Draggodeidad asume la ampliación documental de #81 con asistencia de Codex; se mantiene el documento inicial del owner. W08 consolida las contribuciones verificables de Draggodeidad y Osbaldo. #83 fue retirada como `not_planned`; no existe sección ni plantilla W08 pendiente a nombre de Julián. El historial legítimo anterior permanece intacto.

Se priorizan reglas rápidas de dominio y fotos, integración controlada para HTTP/persistencia/reintentos y un recorrido crítico de navegador. Reutilizar suites evita divergencia de assertions; el backend sintético hace reproducible CI sin servicios privados, con el límite explícito de no acreditar RLS remota. No se publica cobertura inexistente ni una nota académica. La revisión/defensa humana del owner sigue pendiente.
