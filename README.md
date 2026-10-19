# Workshop Login Frontend — Angular

> **Laboratorio intencionalmente vulnerable.** Ejecutar únicamente en equipos de capacitación, repositorios privados y puertos locales. No publicar en Internet ni desplegar en CERT/PROD.

Aplicación web Angular para autenticar a un estudiante mediante el backend Quarkus y consultar tareas desde la API Python.

## Rama del laboratorio

La rama `main` contiene deuda técnica deliberada para practicar:

- refactorización asistida por prompts y agentes;
- clean code y reducción de complejidad;
- análisis de dependencias con CVEs;
- revisión de seguridad del frontend;
- pruebas unitarias y cobertura.

## Ejecución

Requisitos: Node.js 22.12 o superior y npm.

```bash
npm install
npm start
```

Abrir `http://localhost:4200`.

Credenciales de laboratorio:

- `student` / `Workshop123!`
- `trainer` / `Trainer123!`

## Servicios esperados

- Backend de autenticación: `http://localhost:8080`
- API de tareas: `http://localhost:8000`

## Hallazgos sembrados

Consulta `RETO.md`. El código contiene dependencias vulnerables, token en `localStorage`, URLs hardcodeadas, uso de `innerHTML`, tipos `any`, lógica duplicada y componentes con demasiadas responsabilidades.
