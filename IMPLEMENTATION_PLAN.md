# Plan de Implementación: Sistema de Gestión de Mantenimiento (SGM)

## Resumen Ejecutivo
Este documento describe el plan de desarrollo para el SGM, una aplicación web moderna diseñada para la gestión de mantenimiento, integrando operaciones de campo y análisis ejecutivo. La arquitectura consistirá en un backend en Python (FastAPI) y un frontend en React (Vite), conectados a servicios de Azure (Table Storage y Blob Storage) y Microsoft Entra ID.

## Tecnologías
- **Frontend**: React (Vite), Vanilla CSS (Diseño Premium/Glassmorphism).
- **Backend**: Python (FastAPI).
- **Base de Datos**: Azure Table Storage (NoSQL).
- **Almacenamiento**: Azure Blob Storage (Multimedia).
- **Autenticación**: Microsoft Entra ID (Integración Frontend/Backend).

## Estructura del Proyecto
```text
/SGM
  /backend       # API Python (FastAPI)
  /frontend      # Aplicación React (Vite)
  /docs          # Documentación y guías
```

## Fases de Desarrollo

### Fase 1: Configuración del Entorno y Arquitectura Base
- Inicialización del repositorio y estructura de carpetas.
- Configuración del Backend (FastAPI).
- Configuración del Frontend (Vite + React).
- Definición de variables de entorno (Azure, Entra ID).

### Fase 2: Diseño y Frontend (UI/UX)
- Implementación de `index.css` con sistema de diseño (tokens de colores, fuentes, glassmorphism).
- Desarrollo de la Pantalla de Login (Glassmorphism, integración visual Entra ID).
- Layout Principal (Sidebar/Header responsivo).

### Fase 3: Desarrollo del Backend y Conexión a Azure
- Implementación de servicios para Azure Table Storage (Usuarios, Pedidos, Avisos).
- Implementación de servicios para Azure Blob Storage (Imágenes).
- Endpoints de API para gestión de datos.

### Fase 4: Módulos Funcionales
1.  **Módulo A (Usuarios)**: ABM de usuarios y roles.
2.  **Módulo B (Pedidos)**: Carga masiva (Excel/CSV) y listado maestro.
3.  **Módulo C (Operaciones)**: Vista móvil para técnicos, subida de fotos, cierre de órdenes.
4.  **Módulo D (Dashboard)**: Gráficos de avance y productividad.

### Fase 5: Pulido y Optimización
- Pruebas de usabilidad (Mobile vs PC).
- Optimización de carga de imágenes.
- Revisiones de seguridad (RBAC).

## Siguientes Pasos Inmediatos
1. Crear estructura de carpetas.
2. Inicializar proyectos (Python y Node).
3. Establecer el sistema de diseño base en CSS.
