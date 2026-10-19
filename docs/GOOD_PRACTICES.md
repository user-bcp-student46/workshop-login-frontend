# Buenas prácticas — Frontend Angular

> Convenciones a las que debe converger el refactor. Se
> consultan durante el refactor, no después.

- **Tipado estricto**: sin `any`. Interfaces propias para el request y la
  response de cada endpoint consumido (login, tareas).
- **Componentes no llaman HTTP directo**: la llamada a `axios`/`HttpClient` vive
  en un servicio (`AuthService`, `TasksService`); el componente solo lo consume.
- **Nunca `[innerHTML]` con datos dinámicos sin sanitizar**: usar interpolación
  de texto, o `DomSanitizer` explícito si de verdad hace falta HTML.
- **Configuración por ambiente**: las URLs de los backends van en
  `environment.ts`, nunca hardcodeadas dentro de un componente.
- **Sesión centralizada**: un único servicio lee/escribe el token y los datos
  de sesión; ningún componente toca `localStorage` por su cuenta.
- **Dependencias**: versiones sin CVEs conocidos (`lodash`, `axios`); preferir
  utilidades nativas del lenguaje o de Angular cuando alcancen.
- **Errores**: manejo consistente, mensajes al usuario sin exponer detalles
  internos del backend.
