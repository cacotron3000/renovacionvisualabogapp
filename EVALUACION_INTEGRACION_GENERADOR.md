# Evaluación de funcionamiento e integración del Generador (sin iframe)

Fecha: 2026-04-20

## 1) Estado actual observado

- La vista `generador` se renderiza embebiendo `generador/Generador_Escritos.html` dentro de un `<iframe id="generadorFrame">` en `index.html`.
- El shell principal sincroniza tema con `postMessage` (`ABOGAPP_THEME_SYNC`) hacia el iframe.
- El shell principal también ajusta la altura del iframe por dos vías:
  - lectura de `contentDocument` al evento `load`;
  - escucha de mensajes `window.message` con `event.data.type === "generador-height"`.
- Al cambiar a la vista `generador`, se fuerza sincronización de tema con `setTimeout(enviarTemaAGenerador, 60)`.

## 2) Evaluación funcional (fortalezas y riesgos)

### Fortalezas

1. **Aislamiento de estilos y JS**: el iframe evita colisiones CSS/DOM con el panel.
2. **Despliegue simple**: el generador se mantiene como artefacto autocontenido (`Generador_Escritos.html`).
3. **Acoplamiento bajo inicial**: integración mínima en la app principal.

### Riesgos / fricciones actuales

1. **Comunicación indirecta y frágil**: el acoplamiento por `postMessage` para tema y altura agrega puntos de falla.
2. **UX discontinua**: navegación, foco, atajos y accesibilidad se sienten como “subaplicación dentro de otra”.
3. **Complejidad de mantenimiento**: duplicidad de layout/theming entre shell e iframe.
4. **Límites de interoperabilidad**: compartir estado (usuario, datos, permisos, filtros globales) requiere puentes extra.
5. **Costo de observabilidad**: logging y debugging cruzando boundary de iframe es menos directo.

## 3) Mejor alternativa recomendada (sin iframe)

## ✅ Opción recomendada: **Migrar a módulo embebido + Web Component**

Implementar el generador como componente nativo del panel (sin iframe), idealmente encapsulado como:

- `generador/GeneradorEscritos.js` exportando `mountGenerador(container, services)` y/o
- `<abogapp-generador></abogapp-generador>` (Web Component con Shadow DOM opcional).

### ¿Por qué esta opción es la mejor en este contexto?

1. **Mantiene encapsulación** (similar al iframe) pero sin boundary de navegación/estado.
2. **Permite integración profunda** con auth, sincronización y diseño del panel.
3. **Reduce complejidad** eliminando `postMessage` y ajuste de altura.
4. **Habilita evolución incremental**: se puede migrar por fases sin reescribir todo de golpe.

## 4) Diseño objetivo propuesto

### 4.1 Contrato del módulo

Definir una API interna estable:

```js
mountGenerador(container, {
  getTheme,         // lee tokens CSS actuales
  getSession,       // usuario/rol actual
  recordsApi,       // acceso a datos (plantillas, otrosíes)
  notify,           // sistema de notificaciones del panel
  onDirtyChange     // señal de cambios sin guardar
});
```

### 4.2 Estructura de archivos sugerida

- `generador/core/` lógica de negocio y plantillas.
- `generador/ui/` render y componentes UI.
- `generador/styles.css` tokens visuales compatibles con `:root` del panel.
- `generador/index.js` punto de entrada del módulo.

### 4.3 Integración en app principal

- Reemplazar el `<iframe>` de `index.html` por un contenedor `<div id="generadorRoot"></div>`.
- En `script.js`, al entrar a la vista `generador`, ejecutar `mountGenerador(...)` una vez.
- Eliminar sincronización `postMessage` y lógica de altura de iframe.

## 5) Plan de migración (bajo riesgo)

### Fase 0 — Preparación (1 día)

- Extraer funciones puras del HTML actual del generador (formateos, validaciones, render doc).
- Definir contrato `mountGenerador`.

### Fase 1 — Modo dual (2–3 días)

- Mantener iframe como fallback (`feature flag`: `window.ABOGAPP_USE_EMBEDDED_GENERADOR`).
- Montar versión embebida para pruebas internas.

### Fase 2 — Corte controlado (1–2 días)

- Cambiar vista por defecto al módulo embebido.
- Monitorear errores de producción (JS, performance, exportación DOC).

### Fase 3 — Limpieza (1 día)

- Retirar código legado de `postMessage` + autoaltura + listeners asociados.

## 6) Criterios de aceptación

1. Cambio de tema del panel impacta el generador sin `postMessage`.
2. Navegación por tabs sin saltos de foco ni reflow perceptible.
3. Exportación de documentos mantiene paridad funcional.
4. Reutiliza sesión/rol del usuario sin doble fuente de verdad.
5. Tiempo de carga de vista `generador` no peor que baseline actual.

## 7) Riesgos y mitigaciones

- **Riesgo:** colisión de estilos al salir del iframe.
  - **Mitigación:** BEM + prefijos + Shadow DOM (si aplica).
- **Riesgo:** regresiones en exportación.
  - **Mitigación:** set de fixtures y pruebas de snapshot del HTML generado.
- **Riesgo:** incremento inicial de bundle.
  - **Mitigación:** carga diferida (`import()` dinámico) al abrir la vista.

## 8) Conclusión ejecutiva

Para esta app, la mejor integración sin iframe es **módulo embebido encapsulado (Web Component o mount function)** con migración gradual y fallback temporal. Entrega mejor UX, menor complejidad operativa y un camino más mantenible que seguir ampliando puentes `postMessage`.
