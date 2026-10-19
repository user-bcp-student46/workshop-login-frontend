# Endpoints externos y flujo actual del frontend

Este documento describe el comportamiento implementado, no un contrato de backend
obtenido por integración. Las URLs proceden de
[environment.ts](../src/environments/environment.ts). Los ejemplos de respuestas
son fixtures verificables en las pruebas, **no respuestas capturadas de un
backend real**; los tokens de ejemplo no son credenciales utilizables.

El flujo es login → guardar sesión de pestaña → consultar tareas → logout
local. Solo se consumen los dos endpoints siguientes. El logout no llama a una
API, no revoca tokens y conserva las preferencias.

## Login — POST `http://localhost:8080/auth/login`

### 1. Quién lo llama

[LoginComponent.login()](../src/app/login/login.component.ts) llama a
[AuthService.login()](../src/app/services/auth.service.ts), que ejecuta
`axios.post`. Antes de enviar, el componente rechaza usuario o contraseña
nulos, indefinidos, vacíos o compuestos solo por espacios. Usa `trim()` para
comprobarlos, pero **envía las cadenas originales, sin recortarlas**.

Mientras espera, `busy = true`: el botón queda deshabilitado y muestra
«Ingresando…». Al finalizar, incluso ante error, restablece `busy` y notifica
el cambio a Angular.

### 2. Qué envía

| Ubicación | Campo | Tipo / valor enviado | Procedencia |
|---|---|---|---|
| Header | `Accept` | `application/json, text/plain, */*` | Valor predeterminado de Axios. |
| Header | `Content-Type` | `application/json` | Axios serializa el objeto del body a JSON. |
| Body | `username` | `string`, no vacío tras comprobar espacios | Campo Usuario del formulario. |
| Body | `password` | `string`, no vacío tras comprobar espacios | Campo Contraseña del formulario. |
| Body | `client` | `string`: `angular-workshop` | Configuración del frontend. |
| Query | Ninguno | No se añaden parámetros | URL de configuración. |

El servicio no añade `Authorization` ni configura `withCredentials`. La tabla
describe los headers de aplicación y de Axios, no todos los headers que pueda
añadir el navegador. No hay autenticación basada en cookies implementada por
este servicio.

Ejemplo con las credenciales **de laboratorio** de [README.md](../README.md):

```http
POST http://localhost:8080/auth/login
Accept: application/json, text/plain, */*
Content-Type: application/json

{"username":"student","password":"Workshop123!","client":"angular-workshop"}
```

El timeout configurado es **5000 ms**. Campos, URL y timeout se verifican en
[auth.service.spec.ts](../src/app/services/auth.service.spec.ts) y
[login.component.spec.ts](../src/app/login/login.component.spec.ts). Los headers
predeterminados y la serialización corresponden a Axios 1.20.0 declarado en
[package.json](../package.json).

### 3. Qué espera recibir en éxito

**Estado HTTP:** el servicio no exige un código particular: conserva la
aceptación predeterminada de Axios de **200 a 299** y valida después el body.
Un 2xx sin un body válido no completa el login. **Pregunta abierta:** ¿qué
código exacto devuelve el backend en éxito? El frontend y sus fixtures no lo
establecen.

El body es directamente el objeto siguiente: `response.data` es la propiedad
de Axios que contiene ese body, **no un campo `data` dentro del JSON**.
Las reglas están en [auth.ts](../src/app/models/auth.ts).

| Campo del body | Obligatorio | Tipo / validación efectiva | Uso |
|---|---|---|---|
| `token` | Sí | `string`, con `trim()` no vacío | Se guarda sin modificar y se usa en tareas. No se valida formato JWT ni expiración. |
| `user` | Sí | Objeto, no `null` ni array | Se serializa como usuario de sesión. |
| `user.username` | Sí | `string`, con `trim()` no vacío | Parámetro `owner` de tareas y saludo alternativo. |
| `user.displayName` | No | Si está presente, `string`; `null` no es válido | Saludo, con fallback a `username` cuando el valor es vacío o no existe. |

No se rechazan propiedades adicionales, pero el frontend no define su
significado. No se debe inferir un campo de expiración, roles o refresh token.

Body de éxito usado en [login.component.spec.ts](../src/app/login/login.component.spec.ts):

```json
{
  "token": "test-token",
  "user": {
    "username": "student",
    "displayName": "Student"
  }
}
```

Tras validarlo, `SessionService.save()` guarda token y usuario, y persiste
preferencias; solo después se solicita navegación a `/dashboard`. La lectura
de tareas se dispara al inicializar ese componente.

### 4. Cómo reacciona ante errores

Los mensajes controlados provienen de
[error-message.ts](../src/app/utils/error-message.ts). No se muestran
`response.data.message`, trazas ni textos internos del error HTTP.

| Situación | Comportamiento real de la UI / sesión |
|---|---|
| Usuario vacío | No envía HTTP. Muestra «Ingrese un usuario.» en negrita. |
| Contraseña vacía con usuario válido | No envía HTTP. Muestra «Ingrese una contraseña.» en negrita. |
| Credenciales rechazadas (p. ej. 401/403), otro rechazo HTTP, error de red o CORS | Muestra «No se pudo autenticar. Verifique sus credenciales e intente de nuevo.». No navega ni guarda una nueva sesión. No diferencia estos casos por código HTTP ni borra una sesión anterior por un fallo HTTP. |
| Timeout de 5000 ms | Mismo mensaje genérico anterior, restablece el botón; no hay reintento automático. |
| Body objeto con `token` ausente o falsy (`""`, `null`, `false`, `0`) | Muestra «El backend respondió sin token.». No guarda sesión ni navega. |
| Otro body inesperado: `null`, array, texto/JSON inválido, token truthy no string, token de espacios, usuario ausente/inválido | Muestra «El servicio devolvió una respuesta inválida.». No guarda sesión ni navega. |
| Token de texto no vacío pero inválido para el backend | El login no detecta su invalidez criptográfica: lo guarda y navega si el usuario también es válido. El rechazo posterior de tareas se describe en ese endpoint. |
| Fallo de almacenamiento al guardar sesión o eliminar credenciales heredadas | Muestra «No se pudo acceder a la sesión. Inicie sesión de nuevo.». Intenta limpiar credenciales tras fallar el guardado; no navega. Si el almacenamiento también impide limpiar, no se garantiza eliminación completa. |
| Preferencias guardadas corruptas, de tipo inválido o inaccesibles al abrir login | Muestra «No se pudieron cargar las preferencias guardadas.» y mantiene los valores iniciales de preferencias. El formulario sigue disponible; al iniciar otro intento se limpia el mensaje. |
| La promesa de navegación rechaza | Se captura como error de login y se muestra el mensaje genérico. Una sesión ya guardada no se revierte. Si el router resuelve `false`, el código no lo comprueba ni muestra un error específico. |

**Preguntas abiertas:** códigos y body de error exactos del backend; semántica,
validez y duración del token. El frontend no exige un esquema de errores remoto
ni implementa refresh o reintentos.

### 5. Notas de seguridad

- [SessionService](../src/app/services/session.service.ts) es el único acceso al
  almacenamiento. `workshop_token` y `workshop_user` viven en `sessionStorage`;
  `workshop_preferences` permanece en `localStorage`. Al leer, guardar o cerrar
  sesión se eliminan token/usuario heredados de `localStorage`, sin migrarlos.
- La sesión sobrevive a una recarga de la misma pestaña. `sessionStorage` no es
  una cookie `HttpOnly`: sigue accesible a scripts del origen y no protege
  frente a XSS. No se guarda la contraseña en el almacenamiento de sesión.
- [login.component.html](../src/app/login/login.component.html) presenta mensajes
  mediante interpolación de texto, sin `[innerHTML]` ni bypass. El formato en
  negrita de validaciones usa marcado estático y un estado de presentación; las
  cadenas no contienen etiquetas. Los errores siguen siendo mensajes controlados.
- Las URLs HTTP son para el laboratorio local; no implican cifrado del
  transporte. [README.md](../README.md) prohíbe publicación en Internet o
  despliegue productivo y pide no usar credenciales reales.

## Tareas — GET `http://localhost:8000/api/tasks?owner=<username>`

### 1. Quién lo llama

[DashboardComponent.ngOnInit()](../src/app/dashboard/dashboard.component.ts)
lee la sesión mediante `SessionService`. Si no hay token, solicita navegación
a `/login` y no consulta tareas. Con sesión válida llama a
[TasksService.list({ owner })](../src/app/services/tasks.service.ts); el servicio
vuelve a leer la sesión para obtener el token y ejecuta `axios.get`.

Inicialmente `loading = true` y la UI muestra indicadores de carga. Al resolver
la petición con éxito o error, cambia el estado dentro de `NgZone` y ejecuta
`detectChanges`. No hay botón de reintento ni polling automático.

### 2. Qué envía

| Ubicación | Campo | Tipo / valor enviado | Procedencia |
|---|---|---|---|
| Query | `owner` | `string`: `session.user.username` | Usuario validado y guardado tras login. Se concatena directamente tras `?owner=`. |
| Header | `Authorization` | Esquema `Bearer`, un espacio y el token sin modificar | `sessionStorage`, leído por `SessionService`. |
| Header | `Accept` | `application/json, text/plain, */*` | Valor predeterminado de Axios. |
| Body | Ninguno | GET sin cuerpo | No se pasa un body a Axios. |

No se configura un `Content-Type` de aplicación para este GET ni se activa
`withCredentials`. No hay timeout explícito en `TasksService`; el valor
predeterminado de Axios es **0 (sin timeout propio)**.

Ejemplo usando el usuario/token de prueba del login:

```http
GET http://localhost:8000/api/tasks?owner=student
Accept: application/json, text/plain, */*
```

Además, se envía el header `Authorization`: su valor se construye concatenando
el literal `Bearer`, un espacio y `test-token` en este ejemplo. No se muestran
tokens reales. La composición se verifica en
[tasks.service.ts](../src/app/services/tasks.service.ts) y
[dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts).

El código **no codifica** `owner` con `encodeURIComponent` ni usa `params`.
**Pregunta abierta:** ¿qué caracteres admite el backend en `username`? No se
puede garantizar el significado de nombres con `&`, `#` u otros caracteres de
URL a partir del contrato actual.

### 3. Qué espera recibir en éxito

**Estado HTTP:** acepta los **2xx** predeterminados de Axios y después exige
una lista válida. Un 204 sin lista no se convierte en una lista vacía.
**Pregunta abierta:** ¿el backend devuelve siempre 200 con JSON? Ni el servicio
ni las pruebas fijan el estado exacto.

El body es **un array JSON en la raíz**, no `{ "tasks": [...] }` ni una
respuesta paginada. Cada elemento debe satisfacer
[isTask](../src/app/models/task.ts); si uno falla se rechaza la respuesta entera.

| Campo del body | Obligatorio | Tipo / validación efectiva | Uso |
|---|---|---|---|
| Raíz | Sí | Array; `[]` es válido | Lista de tareas. |
| `[].title` | Sí | `string`; se permite cadena vacía | Título de la tarjeta. |
| `[].status` | Sí | `string`; no se exige enum ni valor no vacío | Filtro, texto de estado y clase CSS. |
| `[].description` | No | Si está presente, `string`; `null` no es válido | Descripción de la tarjeta. |
| `[].priority` | No | `string`, `number` o `null` | Orden y etiqueta. No se valida un rango ni enum de prioridades. |
| `[].owner` | No | `string` o `null` | Etiqueta de propietario; no determina el query enviado. |

Se permiten propiedades adicionales sin definirles significado. No se exige
`id`, total, página ni metadatos de paginación. No se envían modificaciones de
tareas al backend.

Ejemplo de respuesta usada en
[dashboard.component.spec.ts](../src/app/dashboard/dashboard.component.spec.ts):

```json
[
  {"title":"low","status":"TODO","priority":1,"owner":"student"},
  {"title":"hidden","status":"ARCHIVED","priority":3,"owner":"student"},
  {"title":"high","status":"DONE","priority":2,"owner":"student"}
]
```

Un ejemplo con descripción opcional, procedente de
[tasks.service.spec.ts](../src/app/services/tasks.service.spec.ts), es:

```json
[{"title":"task","status":"TODO","priority":2,"owner":"student","description":"description"}]
```

Tras recibir una lista válida:

- [visibleTasks](../src/app/utils/task-view.ts) excluye únicamente el estado
  exacto `ARCHIVED` (comparación sensible a mayúsculas), crea copias con `label`
  y ordena con la comparación relacional original. No muta los objetos recibidos.
- La prioridad se compara de forma descendente con `>`: cadenas se comparan
  como cadenas, no por una jerarquía de negocio; `null` se trata como cero para
  la comparación y, si alguna prioridad es `undefined`, el comparador devuelve
  `1`. Para valores iguales también devuelve `1`, no `0`; no se debe prometer
  un desempate consistente como regla de negocio.
- [formatTaskLabel](../src/app/utils/legacy-format.ts) crea
  `PRIORIDAD · PROPIETARIO` en mayúsculas. Usa `NORMAL` y `SIN-ASIGNAR` cuando
  el valor es falsy, incluidos prioridad `0` y propietario vacío.
- En el primer ejemplo se ven `high` y `low`, en ese orden, con etiquetas
  `2 · STUDENT` y `1 · STUDENT`; `hidden` no se muestra.
- Los estados conocidos se presentan como `TODO` → «Por hacer»,
  `IN_PROGRESS` → «En progreso», `DONE`/`COMPLETED` → «Completado» y
  `RESUELTO` → «Resuelto», sin distinguir mayúsculas para el texto. Un estado
  desconocido conserva su texto original.
- Al terminar, se oculta la carga. Si la lista visible queda vacía (por `[]` o
  por contener solo archivadas), muestra «No hay tareas para mostrar todavía.».
  El saludo usa `displayName` o, en su defecto, `username`.

### 4. Cómo reacciona ante errores

| Situación | Comportamiento real de la UI / sesión |
|---|---|
| No hay token al iniciar dashboard | No hace GET y solicita navegación a `/login`. No muestra un mensaje de token expirado. |
| Usuario almacenado corrupto, token de espacios o fallo leyendo/eliminando credenciales heredadas | No hace GET; muestra «No se pudo acceder a la sesión. Inicie sesión de nuevo.», pone `loading = false` y permanece en el dashboard. No limpia automáticamente una sesión inválida ni redirige por esta excepción. |
| La sesión desaparece entre las dos lecturas | `TasksService` lanza el error de sesión; mismo mensaje anterior, sin GET y sin redirección automática. |
| Token inválido/expirado rechazado con 401/403 | Muestra «No se pudo cargar el dashboard. Intente de nuevo.». Oculta carga y tarjetas, pero conserva la sesión; no redirige, no renueva token ni reintenta. El usuario puede usar «Cerrar sesión». |
| Otro rechazo HTTP, fallo de red o CORS | Mismo mensaje genérico de dashboard, sin mostrar `detail` ni el mensaje interno del backend. Oculta carga y tarjetas, conserva la sesión y no reintenta. |
| Servidor no responde | No hay timeout propio de Axios para tareas: los indicadores pueden permanecer hasta que la petición termine o el navegador/red la rechace. No existe un mensaje específico de timeout. |
| El transporte termina rechazando por timeout u otra causa | Se procesa como cualquier error de red: mensaje genérico de dashboard y fin de carga. |
| Body inesperado: objeto en vez de array, JSON inválido/texto, elemento o campo consumido de tipo inválido | Muestra «El servicio devolvió una respuesta inválida.», pone `loading = false` y no presenta tarjetas. No sustituye el fallo por `[]`. |
| Logout local exitoso | Elimina token y usuario de `sessionStorage` y credenciales heredadas de `localStorage`; conserva preferencias y navega a `/login`. No hace una petición de revocación. |
| Fallo de almacenamiento durante logout | Muestra «No se pudo acceder a la sesión. Inicie sesión de nuevo.» y no solicita la navegación. La limpieza puede haber sido parcial. |
| La navegación de logout rechaza | Muestra «No se pudo cerrar la sesión. Intente de nuevo.»; las credenciales ya se eliminaron si la limpieza terminó. Si el router resuelve `false`, no se comprueba el resultado. |

Los mensajes se interpolan como texto en
[dashboard.component.html](../src/app/dashboard/dashboard.component.html).
**Preguntas abiertas:** esquema/códigos de error del backend, duración del token,
garantías de autorización por propietario y tiempo máximo de respuesta de la
API. La UI no distingue estos contratos remotos a partir de la implementación.

### 5. Notas de seguridad

- La sesión está centralizada en `SessionService`; `TasksService` compone la
  autorización, no el componente. Validar el tipo de token no valida firma,
  expiración ni permisos. No hay refresh token ni revocación implementados.
- El query `owner` es un filtro enviado por el cliente, no prueba que el
  backend limite el acceso a ese propietario. **Pregunta abierta:** ¿la API
  verifica que el propietario consultado corresponde al token? No se puede
  confirmar desde este repositorio y no se afirma una vulnerabilidad del backend.
- Título, descripción, etiqueta, saludo y error se presentan con interpolación
  Angular; no se usa `[innerHTML]` para contenido de tareas. Los errores externos
  no se reflejan directamente en pantalla.
- El token es accesible a JavaScript del origen y el transporte configurado es
  HTTP local. No usar este contrato de laboratorio como garantía productiva.
- El filtrado de `ARCHIVED` es de presentación: esas tareas llegan al navegador
  y permanecen en la colección `tasks`; ocultarlas no constituye control de
  acceso.

---

Documentos consultados: [versión previa de este documento](./ENDPOINTS.md),
[README.md](../README.md) y [package.json](../package.json). La fuente de verdad
para esta actualización fueron los servicios, modelos, componentes, plantillas,
utilidades y pruebas enlazados en cada apartado; también se verificaron los
defaults de la dependencia Axios instalada. No se consultaron otros componentes
del workspace ni se ejecutaron peticiones a backends reales.
