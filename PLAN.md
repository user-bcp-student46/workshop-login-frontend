# Plan de corrección — H-06

## Alcance y autorización

El usuario confirmó **solo H-06** para esta propuesta el 19 de octubre de 2026.
Es el único item Pendiente de [HALLAZGOS.md](./HALLAZGOS.md); H-01 a H-05
están Resueltos. Este documento sustituye el plan implementado de H-04/H-05.
Sus aprobaciones anteriores no autorizan implementar este nuevo alcance.
**Esta entrega es solo planificación; requiere aprobación antes de editar tests.**

Solo se trabaja dentro de `workshop-login-frontend`. El seguimiento permanece
exclusivamente en [HALLAZGOS.md](./HALLAZGOS.md); no se cambia su estado ahora.
No se propone modificar código de producción, endpoints, dependencias,
lockfile, configuración de tests, cobertura ni scanners.

Referencias: [ENDPOINTS.md](./docs/ENDPOINTS.md),
[GOOD_PRACTICES.md](./docs/GOOD_PRACTICES.md),
[REGLAS.md](./REGLAS.md) y evidencia histórica en
[TESTING.md](./docs/TESTING.md).

## Item: H-06 — Pruebas originalmente limitadas a una utilidad

### Hallazgo, problema y alcance propio

H-06, tipo Refactor, severidad baja, sigue Pendiente. La limitación original
ya no describe toda la suite: las implementaciones anteriores incorporaron
pruebas de clases, servicios, almacenamiento, guards, transporte HTTP loopback
y flujo login → tareas → logout.

Evidencia inspeccionada:

- [auth-flow.spec.ts](./src/app/auth-flow.spec.ts) cubre el flujo completo con
  HTTP simulado y token rechazado por tareas, pero instancia clases directamente;
  no prueba eventos de plantilla ni navegación real.
- [login-template.spec.ts](./src/app/login/login-template.spec.ts) monta la
  plantilla real y verifica cuatro casos de mensajes/formato, pero ejecuta
  `login()` directamente; no cubre entrada mediante `ngModel` y clic del usuario.
- [dashboard.component.html](./src/app/dashboard/dashboard.component.html)
  condiciona carga, error, tarjetas, vacío y logout. Las pruebas de clase del
  [dashboard](./src/app/dashboard/dashboard.component.spec.ts) no montan esa
  plantilla. Falta comprobación automatizada de esos bindings.
- El resultado histórico más reciente documentado es 150 pruebas verdes y
  100% de cobertura del código refactorizado. No se ejecutó de nuevo en esta
  entrega y no se presume que ese resultado siga vigente.

El alcance es revisar la cobertura existente, completar esas brechas DOM y
definir un cierre verificable de H-06. No duplicar todos los casos unitarios
en DOM ni equiparar porcentaje de cobertura con validación de la interfaz.

### Cambio propuesto

1. Ejecutar la suite actual con cobertura como línea base, antes de editar
   cualquier prueba. Relacionar los casos documentados de login/tareas/logout
   con las pruebas existentes; reutilizar las caracterizaciones válidas.
2. Ampliar la prueba de plantilla de login con interacción real de inputs y
   clic, conservando la plantilla de producción. Verificar credenciales
   originales, estado ocupado pendiente y recuperación ante éxito/error.
3. Crear una prueba de plantilla del dashboard con métodos heredados reales,
   siguiendo el harness existente de Angular TestBed/jsdom. Simular únicamente
   los servicios y Router; usar el NgZone del entorno de pruebas. No reemplazar
   la transformación de tareas ni sus métodos por implementaciones de prueba.
4. Usar promesas controladas para observar estado pendiente y completado,
   eventos DOM y estabilización explícita, sin sleeps arbitrarios. Resolver o
   rechazar todas las promesas, resetear TestBed y restaurar mocks/almacenamiento.
   No crear un framework de helpers para dos archivos.
5. Actualizar [TESTING.md](./docs/TESTING.md) con matriz de casos, alcance de
   mocks, comandos, directorio, salidas, cobertura y límites de cada nivel.
   Conservar resultados históricos como tales; aclarar las brechas DOM ya
   cubiertas frente a propuestas todavía pendientes.
6. Solo después de obtener las pruebas verdes y cumplir los criterios de cierre,
   actualizar la fila H-06 en [HALLAZGOS.md](./HALLAZGOS.md) a Resuelto, con nota
   corta de test y diff local. No cambiar estados de otros items.

No se requieren paquetes nuevos: jsdom, Angular TestBed, Vitest y cobertura V8
ya existen. El harness de login usa resolución JIT interna de Angular; revisar
su compatibilidad al reutilizar el patrón, sin modificar DI de producción para
acomodar el runner. Mantener tests tipados, sin `any`.

### Pruebas que escribir antes de otros cambios

Escribir estas caracterizaciones primero, contra producción sin modificar:

| Prueba / archivo | Caso y resultado esperado |
|---|---|
| Login DOM existente, ampliado | Disparar `input` en usuario/contraseña y clic en Ingresar; el servicio recibe las cadenas originales. Mientras la promesa está pendiente, botón deshabilitado e indicador de carga; al completarse, se restaura. |
| Login DOM existente, ampliado | Inputs vacíos: mensaje de validación y ninguna llamada HTTP. Reutilizar las comprobaciones de texto literal/negrita existentes, sin duplicarlas. |
| Login DOM existente, ampliado | Éxito simulado: guarda la sesión y solicita `/dashboard`. Error simulado: mensaje controlado, botón habilitado, sin guardar sesión ni solicitar navegación. No afirmar que un spy de Router prueba un cambio de ruta real. |
| Nuevo dashboard DOM | Antes de resolver tareas: muestra `.state-row` y no tarjetas. Tras resolver la fixture documentada `low/hidden/high`: saludo, dos tarjetas en orden `high/low`, etiquetas y texto de estado; oculta `ARCHIVED` y la carga. |
| Nuevo dashboard DOM | Lista vacía y lista solo archivada: mensaje de vacío, sin tarjetas ni error. |
| Nuevo dashboard DOM | Rechazo de tareas 401/403, error de red o timeout recibido del transporte: mensaje genérico, sin tarjetas/carga ni logout o redirección automáticos. Respuesta inválida controlada: mensaje específico documentado. Parametrizar sin repetir harness. |
| Nuevo dashboard DOM | Clic en Cerrar sesión: limpieza antes de solicitar `/login`. Si falla almacenamiento: error visible y sin navegación; si rechaza navegación: mensaje de logout. La persistencia efectiva permanece cubierta por SessionService y auth-flow. |

Si una caracterización del comportamiento exigido por ENDPOINTS falla,
registrar el fallo y su evidencia sin cambiar la expectativa para ocultarlo.
No corregir producción dentro de este item: detener el cierre y solicitar un
alcance separado. Un fallo del harness debe distinguirse de un defecto de la UI.
No se exige inventar un test rojo de producto cuando la funcionalidad ya existe:
la ampliación busca protección frente a regresiones.

### Archivos a tocar después de aprobación

- [src/app/login/login-template.spec.ts](./src/app/login/login-template.spec.ts):
  ampliar eventos DOM, carga y resultados con el harness existente.
- `src/app/dashboard/dashboard-template.spec.ts` (nuevo):
  caracterizaciones DOM del dashboard, dentro del patrón `src/**/*.spec.ts`.
- [docs/TESTING.md](./docs/TESTING.md): evidencia reproducible y matriz actualizada.
- [HALLAZGOS.md](./HALLAZGOS.md): únicamente fila H-06 al verificar su cierre.

Los archivos de producción se consultan como evidencia, no se editan.
Las pruebas existentes de servicios, clases y auth-flow se ejecutan sin
reescribirlas si ya cubren los casos del contrato.

### Contrato y riesgos que no se alteran

Conservar URLs, POST/GET, body, headers, credenciales sin recorte, timeout
de login de 5000 ms, ausencia de timeout propio de tareas, errores controlados,
sesión de pestaña y logout local que conserva preferencias. Mantener filtros,
comparador y etiquetas actuales, sin corregirlos dentro de tests.

Quedan fuera: solucionar navegación que resuelve `false`, definir timeout para
tareas, renovar/revocar tokens, codificar `owner`, añadir regiones accesibles,
actualizar dependencias o resolver auditoría residual. Tampoco se promete
integración con backends reales, CORS/XHR de navegador ni anuncio de lectores
de pantalla a partir de jsdom. Estos límites deben seguir explícitos al cerrar
H-06; no convertirlos en tests que declaren deseable un defecto conocido.

### Validación y criterios de cierre

Ejecutar desde la raíz del repositorio del componente:

```powershell
# Antes de editar tests: línea base real.
npm run test:coverage

# Después de escribir las caracterizaciones DOM.
npm test -- src/app/login/login-template.spec.ts src/app/dashboard/dashboard-template.spec.ts

# Regresión y cobertura finales.
npm run test:coverage
npm run build
npx --no-install tsc --noEmit --strict -p tsconfig.app.json
npx --no-install tsc --noEmit --strict --experimentalDecorators --skipLibCheck --moduleResolution bundler --module es2022 --target es2022 --types vite/client src\app\login\login-template.spec.ts src\app\dashboard\dashboard-template.spec.ts
git diff --check
git status --short
```

Exigir salida 0 de pruebas, build y chequeos; al menos 85% de cobertura del
código de producción ejercitado por el cambio, informando líneas, sentencias,
ramas y funciones por archivo relevante y total, sin excluir archivos ni rebajar
gates. No medir cobertura de specs como sustituto de cobertura de producción.

Cada caso nuevo debe probar una interacción o salida DOM concreta y pasar
junto con la suite anterior. Documentar antes/después reales y revisar archivos
nuevos además del diff tracked. No declarar una auditoría global verde por el
éxito de estas pruebas. Si la línea base falla o quedan casos obligatorios sin
verificar, H-06 permanece Pendiente con motivo explícito.

## Documentos consultados y estado de esta entrega

[HALLAZGOS.md](./HALLAZGOS.md), [ENDPOINTS.md](./docs/ENDPOINTS.md),
[GOOD_PRACTICES.md](./docs/GOOD_PRACTICES.md), [REGLAS.md](./REGLAS.md),
[TESTING.md](./docs/TESTING.md), el plan anterior y código/pruebas citados;
también [package.json](./package.json) y
[vitest.config.ts](./vitest.config.ts) para comprobar herramientas disponibles.
Solo se reemplaza PLAN.md. No se ejecutaron tests ni se modificó código en esta
fase de propuesta.
