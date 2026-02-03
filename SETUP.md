# Setup Instructions - Lightspeed Middleware v2.0

## 📦 Instalación de Dependencias

```bash
cd lightspeed-middleware/functions
npm install
```

Esto instalará:
- `@anthropic-ai/sdk` - Claude API client
- `zod` - Validación de schemas
- `firebase-admin` - Firebase SDK
- `firebase-functions` - Cloud Functions
- `express` - Framework web

## 🔐 Configurar Secrets en Firebase

### 1. CLAUDE_API_KEY (Nuevo)

Obtén tu API key de Claude en: https://console.anthropic.com

```bash
firebase functions:secrets:set CLAUDE_API_KEY
# Pega tu API key cuando se solicite
```

### 2. LIGHTSPEED_PERSONAL_TOKEN (Ya configurado)

```bash
firebase functions:secrets:set LIGHTSPEED_PERSONAL_TOKEN
```

### 3. BRIDGE_API_KEY (Ya configurado)

```bash
firebase functions:secrets:set BRIDGE_API_KEY
```

## 🏗️ Build del Proyecto

```bash
cd functions
npm run build
```

## 🧪 Testing Local (Emulators)

```bash
# Desde la raíz de lightspeed-middleware/
firebase emulators:start
```

Esto iniciará:
- Functions: http://localhost:5002
- Hosting: http://localhost:5000
- Firebase UI: http://localhost:4000
- Firestore: puerto por defecto

## 📝 Endpoints Nuevos

### GET /analytics/inventory-status
Retorna análisis completo del inventario (con caché de 6h)

```bash
curl -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/analytics/inventory-status
```

### POST /analytics/refresh
Fuerza recalcular el análisis (invalida caché)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/analytics/refresh
```

### POST /chat/ask
Chat conversacional con IA

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Qué productos necesito reabastecer?"}' \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/chat/ask
```

## 🚀 Deploy a Producción

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

## 📊 Background Job

El job `analyzeInventoryJob` se ejecuta automáticamente cada 6 horas:
- 00:00
- 06:00
- 12:00
- 18:00

Zona horaria: America/Mazatlan

## 🔍 Ver Logs

```bash
# Logs en tiempo real
firebase functions:log

# Logs de una función específica
firebase functions:log --only api

# Logs del background job
firebase functions:log --only analyzeInventoryJob
```

## 💰 Costos Estimados

### Claude API (Haiku)
- Input: $1.00 per 1M tokens
- Output: $5.00 per 1M tokens
- **Costo por análisis:** ~$0.001-0.003

### Firebase
- Functions: 2M invocations/mes gratis
- Firestore: 1GB storage gratis
- Hosting: 10GB storage + 360MB/day gratis

**Total mensual estimado:** $10-20

## 🐛 Troubleshooting

### Error: "CLAUDE_API_KEY not configured"
```bash
firebase functions:secrets:set CLAUDE_API_KEY
```

### Error: Build falla
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Error: Firestore permission denied
Verifica que `firestore.rules` esté desplegado:
```bash
firebase deploy --only firestore:rules
```

## 📚 Estructura de Archivos

```
lightspeed-middleware/
├── firebase.json                 # Config Firebase
├── firestore.rules              # Reglas Firestore
├── firestore.indexes.json       # Índices Firestore
├── public/
│   └── index.html               # Landing page
└── functions/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts             # Main entry point
        ├── services/
        │   ├── claude.ts        # Claude AI integration
        │   ├── analytics.ts     # Inventory calculations
        │   ├── cache.ts         # Firestore cache
        │   └── lightspeed.ts    # Lightspeed API client
        ├── routes/
        │   ├── analytics.ts     # /analytics/* endpoints
        │   └── chat.ts          # /chat/* endpoints
        ├── jobs/
        │   └── analyze-inventory.ts  # Scheduled job
        └── types/
            └── analytics.ts     # TypeScript types
```

## ✅ Verificación Post-Deploy

1. Health check:
```bash
curl https://YOUR_PROJECT.web.app/health
```

2. Analytics endpoint:
```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  https://YOUR_PROJECT.web.app/analytics/inventory-status
```

3. Verificar que el job está programado:
Ve a Firebase Console → Functions → Scheduled functions
