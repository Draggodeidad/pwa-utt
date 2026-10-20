# E2E del flujo crítico

Requiere Node 22.x y el lockfile del repositorio. En una instalación limpia:

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

`test:e2e` reemplaza las variables de Supabase por valores sintéticos durante la build y la ejecución, genera la build de producción, inicia Next y un backend Supabase sintético en puertos loopback asignados para esa ejecución, controla Chromium y espera el teardown de ambos servidores. No requiere `.env.local`, cuenta remota, datos reales ni hardware. Las cuentas `tech@example.invalid` y `coord@example.invalid` usan la contraseña de prueba `synthetic-password`; solo existen en el backend del harness.

En CI, `make verify` ya crea la build. Por eso el workflow ejecuta `E2E_SKIP_BUILD=1 npm run test:e2e`; el runner exige `.next/BUILD_ID` y después inicia los servidores y Chromium sin compilar otra vez. No uses esa variable si no ejecutaste `npm run build` primero.

El backend compartido con `tests/online-inspection-workflow.spec.ts` expone `GET /__test/state` únicamente en su puerto local efímero para que la prueba compruebe persistencia, cantidad de entidades y recibos de idempotencia. La interfaz y sus rutas de Next siguen siendo reales; el Service Worker del build y el IndexedDB nativo del navegador no se sustituyen.

La cobertura se limita a Chromium. El backend de test es un mock, así que el resultado no acredita RLS de Supabase productivo, hardware físico ni otros navegadores. Playwright conserva trace y screenshot cuando hay un fallo en `test-results/e2e/`.
