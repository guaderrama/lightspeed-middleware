# Setup Instructions - Lightspeed Middleware v2.0

## Instalacion de Dependencias

```bash
cd lightspeed-middleware/functions
npm install
```

Esto instalara:
- `@google/generative-ai` - Gemini API client
- `zod` - Validacion de schemas
- `firebase-admin` - Firebase SDK
- `firebase-functions` - Cloud Functions
- `express` - Framework web
- `cors` - CORS middleware

## Configurar Secrets en Firebase

### 1. GEMINI_API_KEY

Obten tu API key de Gemini (gratis) en: https://aistudio.google.com/apikey

```bash
firebase functions:secrets:set GEMINI_API_KEY
# Pega tu API key cuando se solicite
```

### 2. LIGHTSPEED_PERSONAL_TOKEN

```bash
firebase functions:secrets:set LIGHTSPEED_PERSONAL_TOKEN
```

### 3. BRIDGE_API_KEY

```bash
firebase functions:secrets:set BRIDGE_API_KEY
```

Ver [SETUP-SECRETS.md](./SETUP-SECRETS.md) para instrucciones detalladas sobre cada secret.

## Build del Proyecto

```bash
cd functions
npm run build
```

## Testing Local (Emulators)

```bash
# Desde la raiz de lightspeed-middleware/
firebase emulators:start
```

Esto iniciara:
- Functions: http://localhost:5002
- Hosting: http://localhost:5000
- Firebase UI: http://localhost:4000
- Firestore: puerto por defecto

## Endpoints

### GET /health
Health check (publico, no requiere autenticacion)

```bash
curl http://localhost:5002/YOUR_PROJECT/us-central1/api/health
```

### GET /analytics/inventory-status
Retorna analisis completo del inventario (con cache de 6h)

```bash
curl -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/analytics/inventory-status
```

### POST /analytics/refresh
Fuerza recalcular el analisis (invalida cache)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/analytics/refresh
```

### GET /analytics/low-stock
Retorna productos con stock bajo

```bash
curl -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/analytics/low-stock
```

### POST /chat
Chat conversacional con IA (Gemini 2.0 Flash)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "Que productos necesito reabastecer?"}' \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/chat
```

### GET /reports/sales-summary
Resumen de ventas por periodo y outlet

```bash
curl -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  "http://localhost:5002/YOUR_PROJECT/us-central1/api/reports/sales-summary?date_from=2025-10-01&date_to=2025-10-27&outlet_id=YOUR_OUTLET_ID"
```

### GET /reports/sales-top
Top N productos mas vendidos

```bash
curl -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  "http://localhost:5002/YOUR_PROJECT/us-central1/api/reports/sales-top?date_from=2025-10-01&date_to=2025-10-27&outlet_id=YOUR_OUTLET_ID&limit=10"
```

### GET /reports/outlets
Lista todos los outlets (tiendas)

```bash
curl -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/reports/outlets
```

## Deploy a Produccion

```bash
# Build
cd functions
npm run build

# Deploy Functions + Hosting
cd ..
firebase deploy
```

O deploy selectivo:

```bash
# Solo Functions
firebase deploy --only functions

# Solo Hosting
firebase deploy --only hosting

# Solo Firestore rules
firebase deploy --only firestore:rules
```

## Background Job

El job `analyzeInventoryJob` se ejecuta automaticamente cada 6 horas:
- 00:00
- 06:00
- 12:00
- 18:00

Zona horaria: America/Mazatlan

Si detecta problemas criticos, llama a Gemini 2.0 Flash para analisis profundo.

## Ver Logs

```bash
# Logs en tiempo real
firebase functions:log

# Logs de una funcion especifica
firebase functions:log --only api

# Logs del background job
firebase functions:log --only analyzeInventoryJob
```

## Costos Estimados

### Gemini 2.0 Flash
- Free tier: 1,500 requests/dia GRATIS
- Paid tier: $0.50 per 1M input tokens, $3.00 per 1M output tokens
- **Costo estimado mensual:** $0.00 (uso dentro del tier gratuito)

### Firebase
- Functions: 2M invocations/mes gratis
- Firestore: 1GB storage gratis
- Hosting: 10GB storage + 360MB/day gratis

**Total mensual estimado:** $0-5

## Troubleshooting

### Error: "GEMINI_API_KEY not configured"
```bash
firebase functions:secrets:set GEMINI_API_KEY
```

### Error: Build falla
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Error: Firestore permission denied
Verifica que `firestore.rules` este desplegado:
```bash
firebase deploy --only firestore:rules
```

## Estructura de Archivos

```
lightspeed-middleware/
├── firebase.json                 # Config Firebase
├── firestore.rules              # Reglas Firestore
├── firestore.indexes.json       # Indices Firestore
├── public/
│   └── index.html               # Landing page
└── functions/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts             # Main entry point
        ├── services/
        │   ├── gemini.ts        # Gemini AI integration
        │   ├── analytics.ts     # Inventory calculations
        │   ├── cache.ts         # Firestore cache
        │   └── lightspeed.ts    # Lightspeed API client
        ├── routes/
        │   ├── analytics.ts     # /analytics/* endpoints
        │   ├── chat.ts          # /chat endpoint
        │   └── reports.ts       # /reports/* endpoints
        ├── jobs/
        │   └── analyze-inventory.ts  # Scheduled job
        └── types/
            ├── analytics.ts     # TypeScript types
            └── express.ts       # Express type extensions
```

## Verificacion Post-Deploy

1. Health check:
```bash
curl https://YOUR_PROJECT.web.app/health
```

2. Analytics endpoint:
```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  https://YOUR_PROJECT.web.app/analytics/inventory-status
```

3. Verificar que el job esta programado:
Ve a Firebase Console -> Functions -> Scheduled functions
