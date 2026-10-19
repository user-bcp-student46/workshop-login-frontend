# Matriz de hallazgos

La matriz conserva los casos iniciales de `RETO.md` y registra su resolución.
La duplicación de lógica no se confirmó. Los avisos de dependencias y su
remediación se registran en `docs/TESTING.md`, sin presumir explotación.
El binding `[innerHTML]` original aplicaba sanitización de Angular; se eliminó
en H-04, sin afirmar que antes existiera una explotación demostrada.

| id | hallazgo | tipo | explicacion | evidencia (archivo:linea) | severidad | estado |
|---|---|---|---|---|---|---|
| H-01 | Token de autenticación guardado en `localStorage` | Vulnerabilidad | Resuelto mediante la alternativa acotada aprobada: token y usuario en `sessionStorage`, limpieza de credenciales heredadas y errores visibles de almacenamiento. Sigue existiendo acceso desde JavaScript y riesgo residual ante XSS; no se afirma protección equivalente a `HttpOnly`. | `src/app/services/session.service.ts:18`; `src/app/services/session.service.ts:37`; `src/app/services/session.service.ts:47`; `src/app/services/session.service.ts:68` | alta | Resuelto |
| H-02 | Componentes acoplan HTTP, sesión y navegación | Refactor | Resuelto con AuthService/TasksService para HTTP, SessionService como único acceso al almacenamiento, URLs/configuración centralizadas y mensajes de error seguros. Los componentes conservan presentación y navegación. | `src/app/services/auth.service.ts:11`; `src/app/services/tasks.service.ts:17`; `src/app/services/session.service.ts:14`; `src/environments/environment.ts:1`; `src/app/login/login.component.ts:49`; `src/app/dashboard/dashboard.component.ts:53` | media | Resuelto |
| H-03 | Uso de `any` y validación anidada; duplicación de lógica: No encontrado | Refactor | Resuelto con interfaces de request/response, guards sobre unknown, estado tipado, validaciones con retornos tempranos y utilidad pura para tareas. No se extrajo lógica por duplicación no demostrada. Comprobación TypeScript estricta aprobada sin cambiar opciones globales. | `src/app/models/auth.ts:1`; `src/app/models/task.ts:1`; `src/app/models/preferences.ts:1`; `src/app/login/login.component.ts:18`; `src/app/login/login.component.ts:39`; `src/app/utils/task-view.ts:4` | media | Resuelto |
| H-04 | Mensaje dinámico presentado mediante `[innerHTML]` | Vulnerabilidad | Interpolación de texto y negrita estática para validaciones. Diff local: login TS/HTML y prueba de plantilla; 4 pruebas DOM verdes, incluida representación literal de marcado, y 136 pruebas totales. | `src/app/login/login.component.html:39`; `src/app/login/login.component.ts:22`; `src/app/login/login-template.spec.ts:1` | baja | Resuelto |
| H-05 | Dependencias `axios` 0.31.0 y `lodash` 4.17.21 incluidas | Vulnerabilidad | Axios actualizado a 1.20.0 sin avisos en la consulta y Lodash/tipos eliminados con preferencias explícitas. Diff local: manifiesto/lockfile y SessionService; 43 caracterizaciones antes/después, 150 pruebas totales; auditoría residual documentada en docs/TESTING.md. | `package.json:19`; `src/app/services/session.service.ts:59`; `src/app/services/session.service.spec.ts:1`; `src/app/services/auth-transport.spec.ts:1` | baja | Resuelto |
| H-06 | Pruebas originalmente limitadas a una utilidad | Refactor | Diff local propio: login-template ampliado y dashboard-template nuevo, sin cambiar producción. 17 pruebas DOM verdes y 163 totales; flujo ejercitado al 100% de cobertura; comandos, antes/después y límites en docs/TESTING.md, sección H-06. | `src/app/login/login-template.spec.ts:61`; `src/app/dashboard/dashboard-template.spec.ts:86`; `src/app/auth-flow.spec.ts:1` | baja | Resuelto |

## Evidencia de validación de H-01, H-02 y H-03

Validación ejecutada el 19 de octubre de 2026:

- Antes de modificar producción: 19 pruebas aprobadas en 3 archivos. Se
  caracterizaron validaciones, request de login con timeout, persistencia,
  preferencias, errores, autorización, filtro/orden/etiqueta de tareas y logout.
- Después de separar responsabilidades y tipar (H-02/H-03), manteniendo aún
  `localStorage`: 19 pruebas aprobadas y build aprobado. Con las pruebas
  adicionales de servicios y guards: 73 pruebas aprobadas antes de cambiar la
  persistencia de H-01.
- Resultado final: `npm test` y `npm run test:coverage`, 82 pruebas aprobadas
  en 8 archivos. Los archivos de producción modificados/nuevos tienen 100% de
  líneas, sentencias, funciones y ramas. El total del proyecto es 91,81% de
  líneas/sentencias, 98,27% de ramas y 92,59% de funciones; entrada/rutas sin
  modificar no están cubiertas. No se relajaron gates ni se añadieron paquetes.
- `npx --no-install tsc --noEmit --strict -p tsconfig.app.json`: aprobado.
  `npm run build`: aprobado, con advertencias CommonJS de Axios/Lodash.
  `git diff --check`: aprobado.
- Navegador con servidor temporal local y respuestas HTTP simuladas: login →
  tareas → recarga → logout aprobado; tarea archivada excluida, token solo en
  `sessionStorage`, usuario/token eliminados al salir y preferencias conservadas.
  También se comprobaron redirección sin sesión, limpieza de token heredado,
  errores 401/500 sin detalles internos y fin de los indicadores de carga.
  No se ejecutó una integración con backends reales.
- La primera comprobación visual de error de login detectó la vista bloqueada
  en «Ingresando…». Se añadió `markForCheck` al finalizar y se repitió con éxito
  la comprobación. Es un ajuste necesario para preservar presentación de
  carga/error, no una ampliación del alcance.

El cambio de persistencia y los mensajes seguros son cambios deliberados
aprobados en el plan; no cambian método, URL, payload ni autorización HTTP.
H-04/H-05/H-06 no se declaran resueltos. La mitigación de H-01 no protege el
token frente a scripts del mismo origen ni revoca tokens en el backend.

## Revisión técnica del diff local — 19 de octubre de 2026

- Rama inspeccionada: `day1/prompting`. `git diff main` no pudo ejecutarse
  porque no existe la referencia local `main`. Se usó explícitamente
  `git diff origin/main` como base alternativa, sin crear ramas ni hacer fetch.
  `origin/main` y `HEAD` apuntaban a
  `be06031a94d9d197622b05bcc333659aa04a2e33`. Se revisaron también
  `git status --short` y los archivos nuevos sin seguimiento, incluido el
  lockfile. La comparación literal contra `main` queda sin realizar.
- H-01 se mantiene **Resuelto** dentro de la mitigación aprobada: almacenamiento
  en pestaña, limpieza de credenciales anteriores y errores visibles
  (`src/app/services/session.service.ts:18`, `:37`, `:47`, `:68`). No se
  considera eliminado el riesgo de acceso por JavaScript.
- H-02 se mantiene **Resuelto**: los componentes delegan HTTP y persistencia
  (`src/app/login/login.component.ts:49`,
  `src/app/dashboard/dashboard.component.ts:53`); peticiones en servicios y
  configuración centralizada (`src/app/services/auth.service.ts:11`,
  `src/app/services/tasks.service.ts:17`,
  `src/environments/environment.ts:1`).
- H-03 se mantiene **Resuelto**: interfaces, guards y retornos tempranos
  (`src/app/models/auth.ts:17`, `src/app/models/task.ts:21`,
  `src/app/login/login.component.ts:39`). No se encontró `any` explícito en los
  archivos TypeScript de `src`, incluidos los modificados y nuevos.
- El binding `[innerHTML]` permanece en
  `src/app/login/login.component.html:39`. Es un binding Angular de una cadena
  normal, sin bypass de sanitización; sus mensajes actuales proceden de textos
  controlados (`src/app/login/login.component.ts:40`, `:44`, `:53`;
  `src/app/utils/error-message.ts:3`). No se encontró un camino de HTML dinámico
  sin sanitizar. Esto no equivale a eliminar el binding ni cerrar H-04.
- Validación repetida durante la revisión: 82 pruebas aprobadas en 8 archivos;
  código de producción modificado/nuevo con 100% en las cuatro métricas.
  Cobertura total: 91,81% líneas/sentencias, 98,26% ramas, 92,59% funciones.
  TypeScript con `--strict`, build y comprobación de whitespace aprobados.
  Permanecen las advertencias CommonJS de Axios y Lodash.
- No hay cambios respecto de `origin/main` en manifiesto, configuración de
  pruebas/build/TypeScript ni workflows de CI, CodeQL o revisión de dependencias.
  El lockfile nuevo coincide con las dependencias directas y de desarrollo
  declaradas; no se ejecutó auditoría de CVEs ni scanners remotos en esta
  revisión. No se identificó traslado de secretos reales al frontend.

Observaciones de revisión sin reabrir los cierres anteriores:

1. **Importante — prueba de rollback incompleta:**
   `src/app/services/session.service.spec.ts:117` reemplaza la primera escritura
   por una función vacía; no llega a guardar el usuario. Por tanto, el caso no
   comprueba que se elimine un usuario realmente escrito cuando falla el token.
   Conservar la primera escritura real y fallar solo la segunda; comprobar
   directamente que faltan ambas claves. El código de limpieza sí existe en
   `src/app/services/session.service.ts:40` y `:47`.
2. **Importante — cobertura de clase no equivale a cobertura de interfaz:**
   `src/app/login/login.component.spec.ts:33` y
   `src/app/dashboard/dashboard.component.spec.ts:35` construyen instancias con
   dobles de Angular; no montan las plantillas. El 100% no garantiza detección
   de cambios ni accesibilidad. Las pruebas visuales previas son evidencia
   separada; no se repitieron contra backends reales en esta revisión.
3. **Sugerencia de accesibilidad preexistente:** los mensajes de
   `src/app/login/login.component.html:39` y
   `src/app/dashboard/dashboard.component.html:18` no declaran una región viva
   ni `role="alert"`. Añadir anuncio accesible en una mejora acotada y probarlo
   con plantilla renderizada; no se atribuye esta omisión al diff actual.

No se regresó ningún hallazgo a **Pendiente**. H-04, H-05 y H-06 conservan su
estado pendiente y sus límites de alcance.
