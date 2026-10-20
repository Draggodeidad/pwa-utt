# Estrategia de pruebas W08

## Propósito y criterio de selección

La pirámide separa reglas de dominio, integración HTTP de la aplicación y el recorrido crítico del usuario en un navegador. Cada nivel usa datos sintéticos. Se reutilizan suites acumulativas que ya ejecuta `npm test`; las entradas por nivel las invocan sin mover, duplicar ni reemplazar sus assertions.

| Nivel y ruta registrada | Propósito y caso crítico | Comando confirmado | Límite del test |
| --- | --- | --- | --- |
| Unitario: `tests/unit/domain-contracts.spec.ts` → `tests/domain-contracts.spec.ts` | Validar borradores incompletos, reglas de finalización, estructura/versiones de operaciones, DTOs y adaptadores de dominio. | `npm run test:unit` | Ejecuta lógica y adaptadores en Node; no arranca Next ni navegador. |
| Integración: `tests/integration/online-workflow.spec.ts` → `tests/online-inspection-workflow.spec.ts` | Recorrer login, creación, persistencia y finalización a través de las rutas HTTP reales de Next y verificar autorización/visibilidad e idempotencia. | `npm run test:integration` | Next es real, pero Supabase se sustituye por un backend HTTP sintético. No acredita RLS remota. El test declara que corre sin navegador. |
| E2E: `tests/e2e/critical-flow.spec.ts` | En Chromium, guardar una inspección y un hallazgo offline, recuperar desde IndexedDB tras recargar, sincronizar una vez, finalizar y verificar la visibilidad de coordinación. | `npm run test:e2e` | Usa backend sintético; no acredita RLS remota, hardware físico ni Firefox, WebKit o Safari. |

No se define umbral de cobertura. Las suites de `tests/` originales permanecen en `npm test`; los wrappers por nivel sólo clasifican y lanzan las suites existentes como procesos Node independientes, conservando stdout, assertions y exitCode.

## Descubrimiento y comportamiento del runner

`scripts/run-test-level.mjs` descubre archivos directos `tests/unit/*.spec.ts` y `tests/integration/*.spec.ts`, en orden alfabético. No requiere editar `package.json` cuando se agreguen más suites, incluidas `tests/unit/photo-validation.spec.ts` y `tests/integration/queue-recovery.spec.ts` reservadas al equipo. Cada entrada de nivel se ejecuta en un proceso Node; un error de arranque o una assertion no satisfecha propaga un código distinto de cero. Un directorio ausente o sin archivos `.spec.ts` también falla para que CI no acepte un nivel vacío.

Los wrappers actuales reutilizan `tests/domain-contracts.spec.ts` y `tests/online-inspection-workflow.spec.ts`. La suite HTTP comparte su backend sintético con E2E; no se trata de un backend productivo reconstruido ni de una prueba remota de políticas RLS.

## Orden de verificación

En local, con Node 22.x:

```bash
npm ci
npm run typecheck
npm test
npm run test:unit
npm run test:integration
npm run build
npm run measure:rendering
npx playwright install chromium
npm run test:e2e
```

El workflow `.github/workflows/academic-evaluation.yml` usa Node 22.22.3 y ejecuta `npm ci`, checks públicos W02/W05/W06, suites unitarias e integración, `make verify` (typecheck, suite acumulativa, build, métricas y gate W06), e instalación reproducible de Chromium con `npx playwright install --with-deps chromium`. La integración usa `next dev`, que puede sustituir `.next`; por eso `make verify` queda después de integración y crea la build de producción que usará E2E. Finalmente invoca `E2E_SKIP_BUILD=1 npm run test:e2e`: Playwright inicia Next en modo producción y el backend sintético en puertos loopback antes de iniciar el navegador. `test:e2e` conserva su build automática cuando se ejecuta sin esa variable.

`npm test` no llama a `test:unit`, `test:integration`, `test:e2e` ni al verificador. `make verify` sólo llama a `npm run verify`; el verificador ejecuta los comandos acumulativos existentes, sin invocarse a sí mismo. El workflow reúne ambos caminos sin ciclos de scripts.

## Registro de resultados y límites académicos

Por cada comprobación se registran la fecha, el SHA completo de código, comando, exitCode, caso, resultado esperado, resultado observado y límite del entorno. `reports/verification.json` y `reports/rendering-metrics.json` siguen siendo los reportes existentes. El workflow agrega `reports/academic-evaluation.json`, que liga sus resultados a `git rev-parse HEAD` y a la URL del run; Actions publica los tres archivos con el SHA evaluado incluso si un check falla. No se publican trazas del navegador, estado de sesión, cookies, credenciales ni tokens.

La tabla de niveles documenta contratos verificables y límites; puede ampliarse con los aportes independientes del equipo. La evidencia personal y la revisión humana se mantienen separadas. Un resultado técnico verde no asigna calificación.

## Plantilla para ampliar la estrategia

Cada nueva suite puede documentarse con estos campos:

- **Propósito:** riesgo o comportamiento que protege.
- **Nivel y ruta:** archivo `*.spec.ts` descubierto por el runner.
- **Caso esperado:** entrada sintética, resultado observable y assertion que lo demuestra.
- **Comando confirmado:** script de nivel que la ejecuta.
- **Límite o mock:** dependencia real o sustituida y qué no prueba.
- **Evidencia:** SHA, fecha, exitCode y URL del run correspondiente, cuando exista.
