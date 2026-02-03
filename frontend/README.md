# Frontend - Sistema de Inventario

Dashboard web para gestión de inventario con IA integrada (Gemini 3 Flash).

## Stack Tecnológico

- **React 19** + **TypeScript**
- **Vite** - Build tool ultra-rápido
- **Tailwind CSS 4** - Estilos utility-first
- **TanStack Query** - Gestión de estado del servidor
- **React Router** - Navegación SPA
- **Recharts** - Visualización de datos
- **Lucide React** - Iconos

## Características

### 📊 Dashboard
- Métricas principales de inventario en tiempo real
- Análisis IA con Gemini 3 Flash
- Gráficos interactivos (quiebres, prioridades, rotación)
- Listas rápidas (quiebres inminentes, exceso, productos críticos)
- Recomendaciones accionables con sistema de prioridad

### 💬 Chat IA
- Chat conversacional con Gemini 3 Flash
- Contexto completo del inventario
- Preguntas sugeridas
- Costo por consulta visible

### 📈 Reportes
- Resumen de ventas por período
- Top 10 productos más vendidos
- Gráficos de barras y tablas detalladas
- Exportación de datos

## Configuración

### 1. Variables de Entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
cp .env.example .env
```

Edita `.env`:

```bash
# URL del backend (Firebase Functions)
VITE_API_URL=https://us-central1-inventario-is.cloudfunctions.net/api

# API Key del middleware
VITE_API_KEY=tu-bridge-api-key
```

### 2. Instalación

```bash
npm install
```

### 3. Desarrollo

```bash
npm run dev
```

El servidor de desarrollo estará en `http://localhost:5173`

### 4. Build para Producción

```bash
npm run build
```

Esto generará los archivos en `../public/` listos para Firebase Hosting.

### 5. Preview del Build

```bash
npm run preview
```

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/        # Componentes reutilizables
│   │   └── Layout.tsx     # Layout principal con sidebar
│   ├── pages/             # Páginas de la aplicación
│   │   ├── Dashboard.tsx  # Dashboard principal
│   │   ├── Chat.tsx       # Interfaz de chat IA
│   │   └── Reports.tsx    # Reportes de ventas
│   ├── lib/               # Utilidades
│   │   ├── api.ts         # Cliente API
│   │   └── utils.ts       # Funciones helper
│   ├── types/             # Definiciones TypeScript
│   │   └── inventory.ts   # Tipos del sistema
│   ├── App.tsx            # Componente raíz
│   ├── main.tsx           # Entry point
│   └── index.css          # Estilos globales
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Integración con Backend

El frontend se conecta al backend de Firebase Functions a través del cliente API en `src/lib/api.ts`:

```typescript
const apiClient = new ApiClient(API_BASE_URL, API_KEY);

// Endpoints disponibles:
apiClient.getInventoryStatus()           // Dashboard
apiClient.refreshInventoryAnalysis()     // Forzar actualización
apiClient.chat(question)                 // Chat IA
apiClient.getSalesSummary(params)        // Reportes
apiClient.getTopSellingProducts(params)  // Top productos
```

## Deployment

El build se genera automáticamente en `../public/` para ser servido por Firebase Hosting junto con las Functions.

Para desplegar:

```bash
cd ..
firebase deploy
```

Esto desplegará tanto el backend (Functions) como el frontend (Hosting).

## Personalización

### Modificar el tema de colores

Edita [tailwind.config.js](tailwind.config.js) y [src/index.css](src/index.css).

### Agregar nuevas páginas

1. Crea el componente en `src/pages/`
2. Agrega la ruta en [src/App.tsx](src/App.tsx)
3. Añade el link en [src/components/Layout.tsx](src/components/Layout.tsx)

### Optimización de Bundle

El build actual es de ~680 KB. Para optimizar:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'query': ['@tanstack/react-query'],
        },
      },
    },
  },
});
```

## Solución de Problemas

### Error: Cannot find module '@/lib/...'

Verifica que el alias '@' esté configurado en [tsconfig.app.json](tsconfig.app.json):

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Error 401 Unauthorized

Verifica que `VITE_API_KEY` en `.env` coincida con `BRIDGE_API_KEY` en las secrets de Firebase Functions.

### Datos no se cargan

1. Verifica que el backend esté desplegado
2. Revisa la URL en `VITE_API_URL`
3. Abre DevTools Console para ver errores de red

## Licencia

Propietario - Iván Guaderrama Art
