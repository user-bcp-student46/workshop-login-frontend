# Pruebas del flujo login y tareas

Contrato de referencia: [ENDPOINTS.md](./ENDPOINTS.md). Meta de
[REGLAS.md](../REGLAS.md): cobertura de código modificado de al menos 85%.
Este documento conserva ejecuciones históricas y las ampliaciones H-04/H-05/H-06.
La última ejecución, H-06, tiene **163 pruebas verdes en 12 archivos**, incluidas
17 pruebas DOM. En H-06 solo se modificaron dos especificaciones, este documento
y la fila H-06 de la matriz; producción, contratos, dependencias y gates no cambiaron.

## Matriz de casos

Los casos siguientes tienen pruebas ejecutadas. Salvo los tests de transporte,
HTTP está simulado. La matriz inicial describe estados de clase; la matriz DOM
de H-06, al final, identifica las interacciones y salidas de plantilla comprobadas.
Ninguna de ellas equivale a integración con backends externos reales.

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login → tareas → logout | Login válido, sesión compartida, GET con token obtenido, tarea archivada y logout | Camino feliz | Navega a dashboard, carga solo tareas visibles, termina carga; salir borra usuario/token y conserva preferencias. |
| Login | Usuario `null`, `undefined`, vacío o con espacios | Caso borde | Sin POST; mensaje de usuario requerido. |
| Login | Contraseña `null`, `undefined`, vacía o con espacios | Caso borde | Sin POST; mensaje de contraseña requerida. |
| Login | Campos no vacíos con espacios externos | Caso borde | Se envían las cadenas originales, sin recortarlas. |
| Login | Token ausente, vacío, `null`, `false` o `0` | Caso borde | Mensaje «El backend respondió sin token.»; sin sesión nueva ni navegación. |
| Login | Backend caído, red/CORS, 401, 403 o 500 | Error | Mensaje seguro de login, fin de busy, una petición sin reintento; sesión anterior conservada. |
| Login | Timeout configurado de 5000 ms | Error | Axios real aborta con `ECONNABORTED`; prueba de componente separada verifica mensaje seguro y fin de busy. |
| Login | Body `null`, array, texto no JSON, token de tipo inválido/espacios, usuario inválido | Error | Mensaje de respuesta inválida; sin sesión nueva ni navegación. |
| Login → tareas | Token no vacío pero rechazado por tareas | Error | Login acepta la forma; GET 401 produce error seguro, conserva sesión y no redirige automáticamente. |
| Login | Error escribiendo sesión o eliminando credenciales heredadas | Error | Error visible de sesión, sin navegación de éxito. |
| Sesión | Primera escritura de usuario real; falla escritura de token | Error | Se observa el usuario antes del fallo y luego se comprueba que faltan ambas claves. |
| Login | Preferencias corruptas, de tipo inválido o inaccesibles | Error | Mensaje de preferencias, valores iniciales conservados; el siguiente intento limpia el mensaje anterior. |
| Login | Navegación rechaza tras guardar sesión | Error | Mensaje seguro, fin de busy; sesión ya guardada permanece. |
| Tareas | Lista vacía o solo archivadas | Caso borde | Carga terminada, lista visible vacía y sin error; H-06 también verifica el texto de vacío en DOM. |
| Tareas | Sin token | Caso borde | Sin GET y solicitud de navegación al login. |
| Tareas | Usuario corrupto, token de espacios, lectura de sesión o limpieza heredada falla | Error | Sin GET, mensaje de sesión y fin de carga; sin redirección automática por la excepción. |
| Tareas | Sesión desaparece entre las dos lecturas | Error | Sin GET, error de sesión y fin de carga. |
| Tareas | Token inválido/expirado, 401/403 | Error | Mensaje seguro de dashboard, fin de carga, sin tareas, sin reintento ni redirección; logout manual disponible. |
| Tareas | Backend caído, red/CORS, 500 | Error | Mismo mensaje seguro, conserva sesión y permite logout. |
| Tareas | Transporte rechaza por timeout | Error | Mensaje seguro de dashboard y fin de carga. Es una excepción simulada, no un timeout configurado de tareas. |
| Tareas | Transporte todavía pendiente | Caso borde | No se configura timeout de GET; carga continúa hasta que se resuelve. La promesa se resuelve al terminar el test. |
| Tareas | Objeto/texto en lugar de array o elemento inválido | Error | Error de respuesta inválida, no éxito con lista vacía. |
| Logout | Almacenamiento falla | Error | Mensaje de sesión y no solicita navegación. |
| Logout | Navegación rechaza tras limpiar sesión | Error | Mensaje de logout; las credenciales ya eliminadas no se restauran. |
| Dashboard sin sesión | Navegación al login rechaza | Error | Error de dashboard, sin GET y fin de carga. |

## Código de los tests ejecutados

El código completo, incluidos imports, fixtures y limpieza, está en:

- [auth-flow.spec.ts](../src/app/auth-flow.spec.ts): integración entre componentes
  y servicios reales con HTTP y almacenamiento simulados, 2 casos.
- [login.component.spec.ts](../src/app/login/login.component.spec.ts): 37 casos.
- [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts):
  27 casos.
- [session.service.spec.ts](../src/app/services/session.service.spec.ts): 28 casos.
- [auth-transport.spec.ts](../src/app/services/auth-transport.spec.ts): 15 casos con
  Axios real y HTTP temporal en loopback.
- [login-template.spec.ts](../src/app/login/login-template.spec.ts): 6 casos DOM.
- [dashboard-template.spec.ts](../src/app/dashboard/dashboard-template.spec.ts):
  11 casos DOM.

También se ejecutaron los tests existentes de
[AuthService](../src/app/services/auth.service.spec.ts) (15),
[TasksService](../src/app/services/tasks.service.spec.ts) (11),
[mensajes](../src/app/utils/error-message.spec.ts) (4),
[formato](../src/app/utils/legacy-format.spec.ts) (4) y
[tareas visibles](../src/app/utils/task-view.spec.ts) (3).
Estos archivos son la fuente ejecutable; los extractos siguientes no sustituyen
el setup de cada archivo.

### Camino feliz integrado

Extracto de [auth-flow.spec.ts](../src/app/auth-flow.spec.ts):

```ts
vi.mocked(axios.post).mockResolvedValue({
  data: { token: 'flow-token', user: { username: 'student', displayName: 'Student' } }
});
vi.mocked(axios.get).mockResolvedValue({ data: [
  { title: 'Visible', status: 'TODO', priority: 2, owner: 'student' },
  { title: 'Hidden', status: 'ARCHIVED', priority: 3 }
] });
await login.login();
expect(navigate).toHaveBeenCalledWith(['/dashboard']);
expect(tab.get('workshop_token')).toBe('flow-token');
await dashboard.ngOnInit();
expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student',
  { headers: { Authorization: 'Bearer ' + 'flow-token' } });
expect(dashboard.visibleTasks.map((task) => task.title)).toEqual(['Visible']);
expect(dashboard.loading).toBe(false);
await dashboard.logout();
expect(tab.has('workshop_token')).toBe(false);
expect(tab.has('workshop_user')).toBe(false);
expect(local.has('workshop_preferences')).toBe(true);
expect(navigate).toHaveBeenLastCalledWith(['/login']);
```

### Token inválido en la consulta

Extracto del segundo test integrado:

```ts
vi.mocked(axios.post).mockResolvedValue({
  data: { token: 'invalid-for-backend', user: { username: 'student' } }
});
vi.mocked(axios.get).mockRejectedValue({ response: { status: 401 } });
await login.login();
await dashboard.ngOnInit();
expect(dashboard.error).toBe('No se pudo cargar el dashboard. Intente de nuevo.');
expect(dashboard.loading).toBe(false);
expect(tab.get('workshop_token')).toBe('invalid-for-backend');
expect(navigate).toHaveBeenCalledTimes(1);
expect(navigate).toHaveBeenLastCalledWith(['/dashboard']);
```

No se verifica firma ni expiración de un token real: el contrato no incluye esa
validación en el frontend. El rechazo de la API se simula.

### Casos borde y respuestas inválidas

Extracto de [login.component.spec.ts](../src/app/login/login.component.spec.ts):

```ts
it.each([{}, { token: '' }, { token: null }, { token: false }, { token: 0 }])(
  'rejects missing/falsy token %j at the presentation boundary', async (data) => {
    vi.mocked(axios.post).mockResolvedValue({ data });
    component.username = 'student';
    component.password = 'password';
    await component.login();
    expect(component.message).toBe('El backend respondió sin token.');
    expect(component.busy).toBe(false);
    expect(tab.size).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
  }
);
```

### Timeout real, sin backend externo

[auth-transport.spec.ts](../src/app/services/auth-transport.spec.ts) abre un
servidor Node en `127.0.0.1` con puerto efímero y ruta `/auth/login`. Cambia
temporalmente la URL **solo en el test**; conserva los 5000 ms de configuración.
El servidor recibe el request y no responde:

```ts
it('aborts a nonresponding login with the configured real 5000ms timeout', async () => {
  let receivedRequest = false;
  server = createServer((request) => {
    receivedRequest = request.method === 'POST' && request.url === '/auth/login';
    request.resume();
  });
  await listen();
  expect(environment.loginTimeout).toBe(5000);
  const started = Date.now();
  await expect(new AuthService().login('student', 'password')).rejects.toMatchObject({
    code: 'ECONNABORTED',
    config: { timeout: 5000 }
  });
  expect(receivedRequest).toBe(true);
  expect(Date.now() - started).toBeGreaterThanOrEqual(4900);
}, 15000);
```

El límite de 15 segundos es del runner para detectar un bloqueo; no altera el
timeout del producto. `afterEach` restaura la URL, cierra conexiones y servidor.
Se verifican además conexión rechazada con el puerto cerrado y respuestas HTTP
reales 401, 403 y 500. No se llaman los puertos de backend del workspace.

### UI ante backend caído, timeout y rechazos HTTP

Los tests parametrizados de login y dashboard inyectan `ECONNREFUSED`,
`ERR_NETWORK`, `ECONNABORTED` y respuestas 401/403/500. Comprueban mensajes
exactos, fin de carga, número de peticiones y estado de sesión. Por ejemplo,
en [dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts):

```ts
vi.mocked(axios.get).mockRejectedValue(error);
await component.ngOnInit();
expect(component.error).toBe('No se pudo cargar el dashboard. Intente de nuevo.');
expect(component.loading).toBe(false);
expect(component.visibleTasks).toEqual([]);
expect(detectChanges).toHaveBeenCalled();
expect(storage.get('workshop_token')).toBe('test-token');
expect(navigate).not.toHaveBeenCalled();
expect(axios.get).toHaveBeenCalledTimes(1);
await component.logout();
expect(navigate).toHaveBeenCalledWith(['/login']);
```

### Rollback con escritura parcial efectiva

La prueba anterior sustituía la primera escritura por una función vacía. Ahora
se escribe el usuario y se falla solo cuando se intenta escribir el token:

```ts
const write = vi.mocked(tab.setItem).getMockImplementation()!;
vi.spyOn(tab, 'setItem').mockImplementation((key, value) => {
  if (key === 'workshop_token') {
    expect(tab.getItem('workshop_user')).toBe(JSON.stringify(session.user));
    throw new Error('quota');
  }
  write(key, value);
});
expect(() => service.save(session, DEFAULT_PREFERENCES)).toThrow('No se pudo acceder a la sesión');
expect(tab.getItem('workshop_user')).toBeNull();
expect(tab.getItem('workshop_token')).toBeNull();
```

## Comandos y resultados realmente ejecutados — entrega inicial de 132 tests

Fecha: 19 de octubre de 2026. PowerShell, directorio:

```text
C:\Users\Usuario\Documents\T36962-lisbeth-acuna\reqflow-workspace\workshop-login-frontend
```

Para ubicarse y ejecutar la suite completa:

```powershell
Set-Location 'C:\Users\Usuario\Documents\T36962-lisbeth-acuna\reqflow-workspace\workshop-login-frontend'
npm run test:coverage
```

| Ejecución | Código de salida | Resultado observado |
|---|---|---|
| Primera selección: `npm test -- src/app/auth-flow.spec.ts src/app/login/login.component.spec.ts src/app/dashboard/dashboard.component.spec.ts src/app/services/session.service.spec.ts` | 1 | 87 aprobadas, 2 fallidas; error de parametrización del test de listas vacías/archivadas. |
| Primera suite completa con transporte: `npm run test:coverage` | 0 | 131 aprobadas en 10 archivos; timeout real 5095 ms. |
| Primera comprobación estricta de los tests con `tsc` (comando abajo) | 2 | Casts de dobles parciales a Router/ChangeDetectorRef incompatibles; incluidos en pruebas anteriores. |
| Comprobación estricta tras corregir dobles + suite de cobertura | 0 | Type-check aprobado; 131 aprobadas. |
| Suite final: `npm run test:coverage` | 0 | **132 aprobadas en 10 archivos**, duración total 6,91 s; test de timeout real 5083 ms. |

Comando TypeScript ejecutado, sin instalar herramientas ni modificar tsconfig:

```powershell
npx --no-install tsc --noEmit --strict --experimentalDecorators --skipLibCheck --moduleResolution bundler --module es2022 --target es2022 src\app\auth-flow.spec.ts src\app\login\login.component.spec.ts src\app\dashboard\dashboard.component.spec.ts src\app\services\session.service.spec.ts src\app\services\auth-transport.spec.ts
```

`skipLibCheck` limita este chequeo a no revisar declaraciones de dependencias;
no se cambió la configuración ni los gates del repositorio. Los tests nuevos
usan métodos públicos con espías de Router, un doble completo de
ChangeDetectorRef y restauración de mocks/globals después de cada caso.

Cobertura final de producción:

| Ámbito | Líneas | Sentencias | Funciones | Ramas |
|---|---|---|---|---|
| Login, dashboard, modelos, servicios, utilidades y configuración refactorizados | 100% | 100% | 100% | 100% |
| Proyecto completo | 91,81% | 91,81% | 92,59% | 98,36% |

En esta tarea no se modificó producción. La cobertura corresponde al código
del flujo ejercitado, no a las propias especificaciones. Entrada y rutas sin
modificar permanecen fuera de la cobertura. Reporte generado en
`coverage/index.html` y resumen en `coverage/coverage-summary.json`.
No se instaló ninguna dependencia. No se ejecutó build en esta tarea de tests.

## Fallos encontrados y corregidos en las pruebas

- Vitest expande arrays en `it.each` como argumentos: los nuevos casos de lista
  vacía recibían `undefined` y los de una tarea recibían un objeto, no el array.
  Se envolvió cada fixture como `{ data }`; se mantuvo la expectativa de éxito,
  sin adaptar la prueba a un defecto de producción.
- La comprobación estricta detectó casts de dobles parciales incompatibles.
  Se corrigió el setup sin cambiar producción ni rebajar el chequeo.
- La prueba de rollback anterior no persistía al usuario; se reemplazó por la
  escritura real del doble de almacenamiento antes del error.

No quedan tests fallidos en la última ejecución.

## Defectos y limitaciones del producto, separados de los tests aprobados

- **Resultado `false` de navegación ignorado:** el login y el logout esperan
  la promesa, pero no comprueban el booleano en
  [login.component.ts](../src/app/login/login.component.ts) y
  [dashboard.component.ts](../src/app/dashboard/dashboard.component.ts).
  Si la navegación se cancela, no hay mensaje específico y la sesión puede
  haber cambiado. El contrato ya lo documenta. No se añadió un test que declare
  este silencio correcto ni se corrigió código fuera del objetivo de pruebas.
- **Tareas sin timeout propio:** el GET puede permanecer pendiente. El test
  verifica el estado pendiente y luego resuelve su promesa para no dejar trabajo
  abierto; no afirma que exista un timeout ni que una espera ilimitada sea
  deseable. Cambiar este comportamiento requiere acordar el contrato.
- Los tests de clase no montan plantillas. H-04/H-06 agregaron especificaciones
  DOM separadas para mensajes, carga e interacciones; no verifican anuncios de
  lectores de pantalla.

## Pendientes de verificación y pruebas propuestas

**Pendientes de verificación (no ejecutados ni declarados aprobados):**

- Integración con backends reales: códigos de respuesta, validez/expiración de
  token y permisos de `owner`.
- CORS real de navegador; `ERR_NETWORK` está simulado en los tests de UI.
- Anuncios accesibles, layout visual y cambios de ruta reales en navegador.
  El texto literal de marcado está cubierto por H-04 y las interacciones/estados
  de plantilla por H-06 en jsdom; no se usó navegador en esas ejecuciones.

**Pruebas propuestas (sin código ejecutado en esta entrega):**

- Test de navegación cancelada que exija un error explícito; añadirlo junto a
  una corrección aprobada, no para aprobar el silencio actual.
- Tests de región accesible y lectores de pantalla, junto a una mejora aprobada.
  Los tests DOM de mensajes/carga ya se ejecutaron en H-04/H-06.
- Integración del GET con política de timeout, si se aprueba definirla.

Este documento no cambia estados de hallazgos: el seguimiento sigue en
[HALLAZGOS.md](../HALLAZGOS.md).

## Documentos consultados

[ENDPOINTS.md](./ENDPOINTS.md) y [REGLAS.md](../REGLAS.md), además de las
especificaciones y el código de componentes/servicios enlazados. No se
inspeccionaron ni modificaron otros componentes del workspace.

## Implementación H-04 — 19 de octubre de 2026

Se agregó [login-template.spec.ts](../src/app/login/login-template.spec.ts),
con 4 pruebas de plantilla real: negrita de validaciones, error normal/busy,
marcado literal sin elemento `em`, y reset del formato tras validación.
Se aprobó explícitamente jsdom como dependencia exclusiva de desarrollo;
solo esta especificación usa DOM y las demás mantienen entorno Node.
Vitest no genera metadatos DI de Angular: un componente de prueba hereda los
métodos reales y usa la plantilla importada sin alterarla, con inyección explícita.
La resolución JIT de recursos usa una API interna de Angular exclusivamente en
el test; habrá que revisarla al actualizar Angular. No se modificó DI de producción.

Comandos desde la raíz de `workshop-login-frontend`, no desde `docs`:

| Fase | Comando | Salida | Resultado |
|---|---|---|---|
| Setup inicial del harness | `npm test -- src/app/login/login-template.spec.ts src/app/login/login.component.spec.ts` | 1 | Fallos de recursos JIT, resolución de URL y metadatos DI; se corrigió el harness, no producción. |
| Antes del cambio | mismo comando | 1 | 39 verdes, 1 rojo esperado: `<em>` se interpretaba, no era texto literal; las 2 caracterizaciones DOM pasaron. |
| Después | `npm run test:coverage` | 0 | 136 verdes en 11 archivos, incluidos los 4 casos DOM. Login y demás código refactorizado: 100% en cuatro métricas; total 91,90% líneas/sentencias, 98,40% ramas, 92,59% funciones. |
| Build | `npm run build` | 0 | Aprobado; advertencias CommonJS de Axios/Lodash todavía presentes en esta fase. |

Diff propio H-04: login TS/HTML, test DOM nuevo, jsdom aprobado en manifiesto y
lockfile, nota de renderizado en ENDPOINTS y fila H-04. No se cambió HTTP.

## Implementación H-05 — 19 de octubre de 2026

H-04 quedó verde y su fila se actualizó antes de comenzar H-05. La suite de
136 pruebas de esa fase es la línea base completa previa a H-05.

### Diff propio y caracterización

- [package.json](../package.json): Axios `0.31.0` → `1.20.0`; eliminación
  de Lodash `4.17.21` y `@types/lodash` `4.17.20`.
- [SessionService](../src/app/services/session.service.ts): único consumidor de
  `lodash/merge` sustituido por asignación explícita de las tres preferencias
  con `??` y el guard existente. Conserva `false`, tema vacío y defaults, sin
  mutar estos últimos. No se cambió persistencia ni manejo de errores.
- [session.service.spec.ts](../src/app/services/session.service.spec.ts):
  cuatro caracterizaciones adicionales de preferencias parciales, falsy,
  defaults inmutables y guardar/recargar.
- [auth-transport.spec.ts](../src/app/services/auth-transport.spec.ts):
  diez casos adicionales con HTTP loopback real: serialización JSON, campos
  originales, headers, login 200/201/299, 204 inválido, tareas 200/299,
  401/403/500 y 204. Se mantienen backend caído y timeout real de 5000 ms.
  Estas mismas expectativas pasaron con ambas versiones; no hubo que adaptar
  los servicios HTTP ni cambiar el contrato para obtener verde.
- [ENDPOINTS.md](./ENDPOINTS.md): solo referencia de versión de Axios.
  [HALLAZGOS.md](../HALLAZGOS.md): H-05 resuelto; H-06 sigue pendiente.

Directorio de todos los comandos:
`C:\Users\Usuario\Documents\T36962-lisbeth-acuna\reqflow-workspace\workshop-login-frontend`.

| Fase | Comando | Código de salida | Resultado real |
|---|---|---|---|
| Auditoría previa | `npm run audit:workshop` y `npm audit --json` | 1 | 27 avisos: 9 moderados, 12 altos, 6 críticos. Axios y Lodash incluidos. |
| Selección | `npm view axios version` | 0 | Candidata 1.20.0; validada posteriormente contra auditoría y compatibilidad. |
| Antes de cambiar dependencias/producción | `npm test -- src/app/services/auth-transport.spec.ts src/app/services/session.service.spec.ts` | 0 | 43/43: 15 de transporte y 28 de sesión con Axios 0.31.0/Lodash. Timeout observado 5055 ms. |
| Resolución inicial | `npm install`; `npm install --package-lock-only --ignore-scripts` | 1 | Error interno Arborist: lectura de `children` sobre null. |
| Alternativas de resolución | `npx --yes npm@10 install`; npm 9 sobre copia temporal del lockfile | 1 | Error interno `edgesOut`. No se forzó la auditoría ni se ignoraron peers. |
| Regeneración aislada | `npm install --package-lock-only --ignore-scripts` sin el lockfile defectuoso, en copia temporal dentro del componente | 0 | Lockfile generado por npm, no editado manualmente. |
| Primera instalación limpia | `npm ci` | -4048 | EPERM: dos servidores Angular del mismo componente retenían esbuild.exe. |
| Instalación limpia tras autorización humana para detener esos procesos | `npm ci` | 0 | 971 paquetes instalados. Los servidores de desarrollo del puerto 4200 quedaron detenidos. |
| Después: suite y cobertura | `npm run test:coverage` | 0 | 150/150 en 11 archivos, incluidas las mismas 43 caracterizaciones. Timeout observado 5097 ms. |
| Build | `npm run build` | 0 | Aprobado, ya sin las advertencias CommonJS de Axios/Lodash. |
| Tipado producción | `npx --no-install tsc --noEmit --strict -p tsconfig.app.json` | 0 | Aprobado. |
| Auditoría final | `npm run audit:workshop`; `npm audit --json` | 1 | 25 avisos: 9 moderados, 10 altos, 6 críticos; ninguno de Axios/Lodash. El gate sigue fallando y no se silenció. |
| Resolución instalada | `npm ls axios lodash @types/lodash --all` | 0 | Solo Axios 1.20.0; sin Lodash ni sus tipos, tampoco transitivos. |
| Verificación final de ambos items | `npm test -- src/app/services/auth-transport.spec.ts src/app/services/session.service.spec.ts src/app/login/login-template.spec.ts` | 0 | 47/47; incluye los 4 casos DOM y las 43 caracterizaciones de H-05. Timeout observado 5078 ms. |
| Higiene del diff tracked | `git diff --check` | 0 | Sin errores de whitespace en el diff tracked; los archivos nuevos se inspeccionaron también mediante status y pruebas. |

Chequeo estricto adicional de las pruebas, salida **0**:

```powershell
npx --no-install tsc --noEmit --strict --experimentalDecorators --skipLibCheck --moduleResolution bundler --module es2022 --target es2022 --types vite/client src\app\auth-flow.spec.ts src\app\login\login.component.spec.ts src\app\login\login-template.spec.ts src\app\dashboard\dashboard.component.spec.ts src\app\services\session.service.spec.ts src\app\services\auth-transport.spec.ts
```

Cobertura final: código de producción modificado en H-04/H-05, **100%** de
líneas, sentencias, ramas y funciones, superior al 85% requerido.
Total del proyecto: **91,97%** líneas/sentencias, **98,42%** ramas,
**92,59%** funciones. Entrada/rutas sin modificar explican la diferencia.

### Evidencia de avisos y aplicabilidad

Consulta del registro npm mediante `npm audit --json`; no se enviaron fuentes
ni credenciales. La tabla registra todos los identificadores devueltos para las
dos versiones originales. Las rutas son `node_modules/axios` (0.31.0) y
`node_modules/lodash` (4.17.21). Los rangos son los informados por el registro,
no una deducción de antigüedad. Para cada aviso de Axios, la resolución final
verificada es **1.20.0**, sin aviso devuelto para ese paquete; para cada aviso
de Lodash, la corrección es **eliminación completa**, no otra versión.
Esto no demuestra ausencia absoluta de vulnerabilidades.

| Paquete | Aviso (GitHub Advisory) | Rango afectado informado |
|---|---|---|
| Axios | [GHSA-w9j2-pvgh-6h63](https://github.com/advisories/GHSA-w9j2-pvgh-6h63) | <=0.31.0 |
| Axios | [GHSA-pmwg-cvhr-8vh7](https://github.com/advisories/GHSA-pmwg-cvhr-8vh7) | <=0.31.0 |
| Axios | [GHSA-xhjh-pmcv-23jw](https://github.com/advisories/GHSA-xhjh-pmcv-23jw) | <=0.31.0 |
| Axios | [GHSA-m7pr-hjqh-92cm](https://github.com/advisories/GHSA-m7pr-hjqh-92cm) | <=0.31.0 |
| Axios | [GHSA-5c9x-8gcm-mpgx](https://github.com/advisories/GHSA-5c9x-8gcm-mpgx) | <=0.31.0 |
| Axios | [GHSA-vf2m-468p-8v99](https://github.com/advisories/GHSA-vf2m-468p-8v99) | <=0.31.0 |
| Axios | [GHSA-pf86-5x62-jrwf](https://github.com/advisories/GHSA-pf86-5x62-jrwf) | <=0.31.0 |
| Axios | [GHSA-6chq-wfr3-2hj9](https://github.com/advisories/GHSA-6chq-wfr3-2hj9) | <=0.31.0 |
| Axios | [GHSA-xx6v-rp6x-q39c](https://github.com/advisories/GHSA-xx6v-rp6x-q39c) | <=0.31.0 |
| Axios | [GHSA-62hf-57xw-28j9](https://github.com/advisories/GHSA-62hf-57xw-28j9) | <=0.31.0 |
| Axios | [GHSA-hfxv-24rg-xrqf](https://github.com/advisories/GHSA-hfxv-24rg-xrqf) | <=0.31.1 |
| Axios | [GHSA-p92q-9vqr-4j8v](https://github.com/advisories/GHSA-p92q-9vqr-4j8v) | <=0.31.1 |
| Axios | [GHSA-j5f8-grm9-p9fc](https://github.com/advisories/GHSA-j5f8-grm9-p9fc) | <=0.31.1 |
| Axios | [GHSA-3g43-6gmg-66jw](https://github.com/advisories/GHSA-3g43-6gmg-66jw) | >=0.19.0 <0.31.1 |
| Axios | [GHSA-898c-q2cr-xwhg](https://github.com/advisories/GHSA-898c-q2cr-xwhg) | <=0.31.1 |
| Axios | [GHSA-pjwm-pj3p-43mv](https://github.com/advisories/GHSA-pjwm-pj3p-43mv) | <=0.31.1 |
| Axios | [GHSA-mmx7-hfxf-jppx](https://github.com/advisories/GHSA-mmx7-hfxf-jppx) | <0.33.0 |
| Axios | [GHSA-pmv8-rq9r-6j72](https://github.com/advisories/GHSA-pmv8-rq9r-6j72) | >=0.28.0 <0.33.0 |
| Axios | [GHSA-7q8q-rj6j-mhjq](https://github.com/advisories/GHSA-7q8q-rj6j-mhjq) | >=0.8.0 <0.33.0 |
| Axios | [GHSA-f4gw-2p7v-4548](https://github.com/advisories/GHSA-f4gw-2p7v-4548) | >=0.31.0 <0.33.0 |
| Axios | [GHSA-42h9-826w-cgv3](https://github.com/advisories/GHSA-42h9-826w-cgv3) | >=0.28.0 <0.33.0 |
| Axios | [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g) | >=0.27.2 <0.34.0 |
| Axios | [GHSA-x97p-jq2g-jp4f](https://github.com/advisories/GHSA-x97p-jq2g-jp4f) | >=0.28.0 <0.34.0 |
| Lodash | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) | >=4.0.0 <=4.17.23 |
| Lodash | [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) | <=4.17.23 |
| Lodash | [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) | >=4.0.0 <=4.17.22 |

Contexto observado: producción usa Axios en navegador, JSON plano de login y
GET de tareas, no uploads ni formularios profundos. Los avisos de proxy,
redirección y streams del adaptador Node afectan otro contexto que el de
producción; ese adaptador sí se usa en las pruebas loopback. Los avisos de
prototype pollution, headers, método y XSRF requieren condiciones previas que
no se demostraron aquí; actualizar reduce la exposición sin afirmar un exploit
observado. Lodash solo se usaba mediante `merge`, no `template`, `unset` u
`omit`; tampoco se demostró explotación de esos avisos en este flujo.

El registro proponía Axios 0.31.1 como fixAvailable, pero otros rangos del mismo
resultado todavía incluyen esa versión. Por eso se eligió la versión mantenida
consultada 1.20.0 y se comprobó de nuevo la resolución final, no se aplicó a
ciegas la recomendación. El registro proponía Lodash 4.18.1; eliminar el único
uso plano evitó conservar una dependencia innecesaria.

### Desviaciones aprobadas y riesgos residuales

El lockfile anterior fallaba en el resolvedor incluso en una copia aislada,
con npm 11 y alternativas npm 10/9. La regeneración limpia por npm cambió
también tres patches transitivos ajenos: `@harperfast/extended-iterable`
1.0.3 → 1.0.4, `baseline-browser-mapping` 2.11.29 → 2.11.30 y
`ordered-binary` 1.6.2 → 1.6.3. **El usuario autorizó explícitamente conservar
esas tres variaciones** tras conocer los resultados. No se cambiaron versiones
directas de Angular/Vitest ni gates. `agent-base`, `https-proxy-agent` y
`entities` cambian de ubicación/hoisting en el árbol regenerado;
`proxy-from-env` pasa 1.1.0 → 2.1.0 en la resolución nueva de Axios.
No se usó `audit fix --force`, exclusiones, `overrides` ni omisión de peers.
Las copias temporales de resolución se eliminaron al terminar.

Los 25 avisos restantes pertenecen a Angular/build/CLI/router/compiler,
Vitest/coverage y dependencias como webpack-dev-server, piscina, tinypool,
undici y otras. Permanecen **fuera de H-05**, incluidos los seis críticos
informados por npm; requieren otro alcance aprobado. El proyecto **no tiene
auditoría global verde**. Los contadores de npm son entradas por paquete, no
un número de exploits confirmados.

No se ejecutó integración con los backends externos reales. Las pruebas
loopback usan el adaptador Node y las DOM no sustituyen una comprobación del
adaptador XHR en navegador. Se mantiene el riesgo de sesión accesible desde
JavaScript y la falta de timeout de tareas documentados, sin cambios de contrato.

Documentos consultados para H-04/H-05: [PLAN.md](../PLAN.md),
[HALLAZGOS.md](../HALLAZGOS.md), [ENDPOINTS.md](./ENDPOINTS.md),
[GOOD_PRACTICES.md](./GOOD_PRACTICES.md) y [REGLAS.md](../REGLAS.md).

## Implementación H-06 — 19 de octubre de 2026

El usuario aprobó implementar el plan de **solo H-06** antes de esta ejecución.
El objetivo es cerrar la brecha de interacciones y estados DOM, no reimplementar
los casos de servicios que ya están cubiertos. No hubo cambios de producción.

### Diff local propio

- [login-template.spec.ts](../src/app/login/login-template.spec.ts): de 4 a
  6 casos. Se amplió la caracterización de validaciones para usar inputs/clics
  y se añadieron éxito/error con promesa pendiente, ngModel, botón/spinner,
  preservación de credenciales originales, guardado y solicitud de navegación.
  Las otras tres comprobaciones DOM de H-04 se conservaron.
- [dashboard-template.spec.ts](../src/app/dashboard/dashboard-template.spec.ts):
  archivo nuevo con 11 casos de carga, tarjetas, vacío, errores y clic de logout.
- Este documento: inventario/matriz actualizados y evidencia antes/después.
- [HALLAZGOS.md](../HALLAZGOS.md): solo la fila H-06 pasa a Resuelto después
  de obtener todas las validaciones en verde.

La comparación SHA-256 antes/después de los archivos no-spec de `src`, manifiesto,
lockfile, configuración Vitest y ENDPOINTS dio los mismos valores. No se cambió
el contrato ni se instalaron paquetes. El worktree ya contenía cambios de
H-01 a H-05 y archivos sin seguimiento; se conservaron. No se hizo commit ni
staging. Estos cuatro archivos delimitan el cambio de H-06, no todo el diff
acumulado contra la rama base.

### Matriz DOM y pruebas previas reutilizadas

| flujo | caso | tipo | resultado esperado |
|---|---|---|---|
| Login DOM | Usuario vacío y luego contraseña vacía, mediante clics | Caso borde | Mensajes en negrita, botón habilitado, sin autenticar, guardar ni navegar. |
| Login DOM | Inputs con espacios externos, clic y respuesta todavía pendiente | Caso borde | ngModel transmite las cadenas originales; botón deshabilitado, texto «Ingresando...», spinner y sin guardar/navegar todavía. |
| Login DOM | Resolución exitosa de esa promesa | Camino feliz | Fin de busy, botón «Ingresar», sin spinner/mensaje; guarda la sesión antes de solicitar `/dashboard`. |
| Login DOM | Rechazo de esa promesa | Error | Mensaje genérico exacto, sin diagnóstico interno; botón restablecido, sin guardar/navegar. |
| Dashboard DOM | Promesa de tareas pendiente, luego fixture low/hidden/high | Camino feliz | Carga sin tarjetas antes; después saludo Student, tarjetas high/low, etiquetas y estados correctos, descripción y sin tarea archivada/carga/error/vacío. |
| Dashboard DOM | Lista vacía / solo archivadas (2 casos) | Caso borde | Texto de vacío exacto, sin tarjetas, error ni carga. |
| Dashboard DOM | 401 / 403 / red / timeout recibido (4 casos) | Error | Error genérico exacto, sin grid/tarjetas/carga, sin logout ni redirección, una llamada sin reintento. |
| Dashboard DOM | ApplicationError de respuesta inválida | Error | Mensaje específico de respuesta inválida, sin tarjetas/carga ni logout/redirección. |
| Logout DOM | Clic exitoso | Camino feliz | Una limpieza antes de solicitar `/login`, sin error. |
| Logout DOM | Falla almacenamiento | Error | Mensaje de sesión exacto y ninguna navegación. |
| Logout DOM | Rechaza navegación tras limpiar | Error | Limpieza antes de solicitar ruta y mensaje de logout exacto. |

Las 17 pruebas DOM incluyen 6 de login (tres comprobaciones previas de H-04
sin cambios, una ampliada y dos nuevas) y 11 nuevas de dashboard: incremento
neto de **13 tests**.

Se reutilizaron sin editar:

- Las dos pruebas de [auth-flow](../src/app/auth-flow.spec.ts) para el flujo
  con servicios y almacenamiento compartidos simulados, y token rechazado.
- [SessionService](../src/app/services/session.service.spec.ts) para persistencia
  efectiva en los dobles de almacenamiento, limpieza, preferencias y rollback.
- Servicios/modelos, clases de componentes y
  [transporte real](../src/app/services/auth-transport.spec.ts) para ausencia de
  token, respuestas inesperadas, códigos HTTP, JSON/headers/query y timeout
  de login real. No se repitieron todos estos casos en la capa DOM.

### Qué ejecuta el harness y qué simula

Ambos tests DOM usan Angular TestBed y jsdom, plantillas reales importadas
mediante `?raw`, y subclases de prueba que heredan los métodos de producción.
La inyección explícita y resolución JIT de recursos siguen el patrón de H-04
para Vitest; la API interna de resolución sigue siendo una dependencia del
harness a revisar al actualizar Angular.

Se simulan AuthService/SessionService/TasksService y Router, no la lógica del
componente, transformación de tareas ni el NgZone: este último se obtiene de
TestBed. Los espías de login/logout conservan la implementación real y sirven
para esperar la promesa disparada por el clic. Las promesas controladas permiten
observar carga antes de completar, sin sleeps. Se espera estabilización y se
ejecuta detección de cambios explícita.

Se limpian TestBed y espías por caso; las promesas pendientes se completan en
`finally`/teardown incluso si una aserción falla. No se escribe almacenamiento
real en estos dos archivos ni se abre HTTP; los servidores de transporte de la
suite se cierran en sus propios tests.

### Comandos, directorio y resultados reales

Directorio PowerShell:
`C:\Users\Usuario\Documents\T36962-lisbeth-acuna\reqflow-workspace\workshop-login-frontend`.

| Fase | Comando | Código de salida | Resultado observado |
|---|---|---|---|
| Antes de editar pruebas | `npm run test:coverage` | 0 | 150/150 en 11 archivos; 4 casos DOM de login y ninguno de dashboard. Timeout real 5096 ms. |
| Caracterización DOM ampliada, producción intacta | `npm test -- src/app/login/login-template.spec.ts src/app/dashboard/dashboard-template.spec.ts` | 0 | 17/17 en 2 archivos: 6 login y 11 dashboard. |
| Tipado de ambos specs | Comando estricto de abajo | 0 | Sin errores, sin casts de dobles parciales ni `any` nuevos. |
| Regresión después | `npm run test:coverage` | 0 | 163/163 en 12 archivos; timeout real 5132 ms. Sin pruebas fallidas ni omitidas. |
| Build | `npm run build` | 0 | Aprobado; mismos nombres/hashes de chunks que en H-05. |
| Tipado de producción | `npx --no-install tsc --noEmit --strict -p tsconfig.app.json` | 0 | Aprobado, sin editar tsconfig. |
| Higiene tracked | `git diff --check` | 0 | Sin errores; status y lectura directa también incluyeron specs/documentos nuevos que no figuran en el diff tracked. |

```powershell
npx --no-install tsc --noEmit --strict --experimentalDecorators --skipLibCheck --moduleResolution bundler --module es2022 --target es2022 --types vite/client src\app\login\login-template.spec.ts src\app\dashboard\dashboard-template.spec.ts
```

### Cobertura antes y después

No se modificó producción; la cobertura del código ejercitado, no de specs,
supera el 85% requerido. El porcentaje no demuestra por sí solo corrección DOM.

| Archivo / ámbito | Líneas antes → después | Sentencias antes → después | Ramas antes → después | Funciones antes → después |
|---|---|---|---|---|
| LoginComponent | 100% → 100% | 100% → 100% | 100% → 100% | 100% → 100% |
| DashboardComponent | 100% → 100% | 100% → 100% | 100% → 100% | 100% → 100% |
| AuthService, TasksService y SessionService, cada uno | 100% → 100% | 100% → 100% | 100% → 100% | 100% → 100% |
| Modelos, utilidades y environment, cada archivo | 100% → 100% | 100% → 100% | 100% → 100% | 100% → 100% |
| Total del proyecto | 91,97% → 91,97% | 91,97% → 91,97% | 98,43% → 98,42% | 92,59% → 92,59% |

Entrada, componente raíz y rutas siguen sin cobertura completa. Se registra
la variación observada de 0,01 puntos en ramas globales sin atribuirle una causa
no investigada; los archivos de flujo siguen al 100% y no se cambió ninguna
exclusión/gate.
Reportes generados por la configuración existente: `coverage/index.html` y
`coverage/coverage-summary.json`.

### Fallos, pendientes y cierre

- **Fallos en esta ejecución:** ninguno. Los tests nuevos pasaron contra el
  producto existente en su primera ejecución; no se inventó una fase roja ni
  se cambiaron expectativas para ocultar un bug.
- **Pendientes fuera de H-06:** backend real, CORS/XHR, rutas y layout en
  navegador, lectores de pantalla; no se declaran aprobados mediante jsdom.
- **Pruebas propuestas fuera del plan:** navegación cancelada con error
  explícito, regiones accesibles y nueva política de timeout de tareas, junto
  con su implementación aprobada. No se corrigieron esos comportamientos.
- **Auditoría:** no se repitió para este cambio de pruebas/documentación.
  Permanecen los 25 avisos de la última consulta de H-05, incluidos seis
  críticos; no se afirma auditoría global verde ni explotación confirmada.

H-06 queda Resuelto dentro del alcance aprobado de pruebas automatizadas del
flujo y brechas DOM identificadas. No significa que no existan mejoras de
pruebas futuras o que los defectos residuales estén resueltos. No hubo
desviaciones del plan, nuevos paquetes, cambios de contrato ni correcciones
de producción. La aprobación de implementación se recibió antes de editar
los specs; el texto de propuesta conservado en PLAN.md es histórico.

Documentos consultados: [PLAN.md](../PLAN.md), [HALLAZGOS.md](../HALLAZGOS.md),
[ENDPOINTS.md](./ENDPOINTS.md), [GOOD_PRACTICES.md](./GOOD_PRACTICES.md),
[REGLAS.md](../REGLAS.md) y versión previa de este documento; código, plantillas,
modelos y pruebas enlazados, además de manifiesto/configuración de Vitest.
