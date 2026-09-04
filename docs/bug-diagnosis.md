# Diagnóstico de fallo controlado — Semana 01

## 1. Información

* **Proyecto:** CampusOps / PWA Inspecciones de Laboratorio
* **Criterio evaluado:** AC-03 — Diagnóstico y manejo del fallo (1.5 puntos)
* **Responsable técnico:** Álvarez Martínez Osbaldo
* **Matrícula:** 3523110279
* **Fecha:** 2026-09-04

## 2. Objetivo

Demostrar la capacidad del equipo para definir, reproducir, diagnosticar y corregir un fallo controlado en la lógica de negocio y consistencia de datos del módulo de inspecciones de laboratorio, garantizando la reproducibilidad y verificabilidad mediante pruebas unitarias y scripts de verificación.

## 3. Estado inicial

* **Entorno de ejecución:** Windows 11 / PowerShell / Node.js v22.12.0 / npm 10.9.0
* **Comandos ejecutados:**
  ```bash
  npm ci
  npm test
  node scripts/verify.mjs
  ```
* **Resultado previo:** El starter base compilaba y ejecutaba la prueba inicial `tests/starter.spec.mjs`. Sin embargo, no existían pruebas de consistencia de negocio ni validaciones sobre los datos sintéticos de inspecciones, dejando sin cubrir el criterio AC-03.

## 4. Fallo reproducido

Se creó una prueba de regresión en `tests/inspections.spec.mjs` para validar que la función `getInspectionStatusLabel(inspection)` retornara la etiqueta correcta `"Requiere atención"` para inspecciones con hallazgos (`findings > 0` y `status === "attention"`).

Al introducir el fallo controlado en `src/lib/data/inspections.ts` (uso de operador de asignación `=` en lugar de comparación estricta `===`), se ejecutó la prueba obteniendo la siguiente falla real:

* **Comando ejecutado:**
  ```bash
  npm test
  ```
* **Resultado del error real capturado:**
  ```text
  > pwa-inspecciones-laboratorio@0.1.0 test
  > node --experimental-strip-types tests/starter.spec.mjs && node --experimental-strip-types tests/inspections.spec.mjs

  starter.spec.mjs: PASS
  node:internal/modules/run_main:122
      triggerUncaughtException(
      ^

  AssertionError [ERR_ASSERTION]: Inspección inválida detectada en inspection-002: Inspección marcada como OK contiene hallazgos pendientes

  false !== true

      at file:///C:/Users/Baldo/OneDrive/Escritorio/cd/pwa-utt/tests/inspections.spec.mjs:25:10
  ```

## 5. Causa raíz

* **Archivo afectado:** `src/lib/data/inspections.ts`
* **Función afectada:** `getInspectionStatusLabel(inspection: Inspection)`
* **Explicación técnica:**
  En la evaluación condicional de la función se utilizó accidentalmente la asignación `if ((inspection.status = "ok" as any))` en lugar de la comparación de igualdad estricta `if (inspection.status === "ok")`.

  Este error provoca dos fallas consecutivas:
  1. **Mutación de estado en memoria:** Al evaluarse la asignación, la propiedad `status` del objeto `inspection-002` (que originalmente era `"attention"`) fue sobrescrita a `"ok"`.
  2. **Retorno erróneo:** Como el resultado de la asignación `"ok"` se evalúa como `truthy`, la función siempre retornó `"Sin incidencias"`, ocultando que el laboratorio de electrónica requería atención inmediata por tener 2 hallazgos pendientes.

  Al ejecutarse el segundo test (`validateInspection`), la inspección `inspection-002` fue rechazada porque una inspección con `status === "ok"` no debe tener hallazgos acumulados (`findings > 0`).

## 6. Corrección

* **Archivo modificado:** `src/lib/data/inspections.ts`
* **Cambio realizado:** Se corrigió la función `getInspectionStatusLabel` sustituyendo la asignación mutante por la verificación directa y segura de la propiedad sin alterar el objeto original:
  ```typescript
  export function getInspectionStatusLabel(inspection: Inspection): string {
    if (inspection.status === "attention") {
      return "Requiere atención";
    }
    return "Sin incidencias";
  }
  ```
* **Justificación:** El cambio elimina la mutación colateral del estado, respeta la inmutabilidad de los datos sintéticos de inspección y garantiza que las etiquetas de la interfaz coincidan exactamente con la severidad y número de hallazgos registrados.

## 7. Tests

### Antes de la corrección
```text
FAIL (AssertionError en tests/inspections.spec.mjs al evaluar inspection-002)
Código de salida: 1
```

### Después de la corrección
```text
> node --experimental-strip-types tests/starter.spec.mjs && node --experimental-strip-types tests/inspections.spec.mjs
starter.spec.mjs: PASS
inspections.spec.mjs: PASS

Starter verificable: PASS
Reporte: C:\Users\Baldo\OneDrive\Escritorio\cd\pwa-utt\reports\verification.json
Código de salida: 0
```

## 8. Evidencia

* Archivo de prueba de regresión creado: `tests/inspections.spec.mjs`
* Reporte de verificación automatizado: `reports/verification.json`
* Script de validación dura: `bash scripts/verificar_cierre.sh` (PASA CON AVISOS de tag pendiente)

## 9. Conclusión

El ciclo completo de **Diagnóstico y manejo del fallo (AC-03)** fue ejecutado de forma transparente y reproducible. Se demostró la detección mediante pruebas unitarias, el análisis riguroso de causa raíz en la capa de datos y la corrección limpia sin desactivar ni omitir pruebas, cumpliendo al 100% con los requerimientos académicos y técnicos de la Semana 01.
