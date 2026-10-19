# Contrato para agentes de desarrollo

1. Analiza antes de modificar y enumera los riesgos funcionales.
2. Conserva los endpoints `/auth/login` y `/api/tasks`.
3. Agrega o mejora pruebas antes de una refactorización amplia.
4. No ocultes alertas de seguridad ni reduzcas los quality gates.
5. No introduzcas secretos reales ni dependencias nuevas sin justificar.
6. Propón cambios incrementales que puedan revisarse mediante PR.
7. Meta de cobertura del código modificado: 85% o superior.

## Clean code

8. Cada componente hace una sola cosa; si un componente llama HTTP, maneja
   sesión y navega a la vez (como `LoginComponent`/`DashboardComponent` hoy),
   separa la llamada HTTP a un servicio.
9. Nombres que expliquen el propósito, no el tipo (evitar `data`, `temp`,
   tipar todo como `any`).
10. Sin duplicación: un bloque de código repetido en dos componentes se
    extrae a un servicio o función reutilizable.
11. Evitar anidamiento profundo (`if` dentro de `if` dentro de `if`, como en
    `login()` hoy); usar retorno anticipado o condiciones combinadas.
12. Sin valores "mágicos" sueltos en el código (URLs, claves de
    `localStorage`); centralizarlos en un solo lugar.
