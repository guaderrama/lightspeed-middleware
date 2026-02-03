# Gemini 3 Flash Setup - Enero 2026

## 🎯 Configuración de Gemini API

### 1. Obtener API Key GRATIS

1. Ve a [Google AI Studio](https://aistudio.google.com/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia la API key generada

### 2. Configurar en Firebase

```bash
cd lightspeed-middleware
firebase functions:secrets:set GEMINI_API_KEY
# Pega tu API key cuando se solicite
```

### 3. Verificar Configuración

```bash
# Ver secrets configurados
firebase functions:secrets:access GEMINI_API_KEY
```

## 💰 Costos y Límites (Gemini 3 Flash)

### Free Tier (GRATIS)
- ✅ 1,500 requests/día
- ✅ 1M tokens/minuto
- ✅ 10M tokens/día
- ✅ **Costo: $0.00**

### Paid Tier (si superas el free tier)
- Input: $0.50 per 1M tokens
- Output: $3.00 per 1M tokens

### Tu Uso Estimado
```
Análisis automáticos: 4/día (cada 6h)
Consultas de chat: ~15-20/día
Total: ~20-25 requests/día

✅ MUY por debajo del límite gratuito (1,500/día)
💰 Costo mensual: $0.00
```

## 🔧 Características de Gemini 3 Flash

### Ventajas
- ✅ **GRATIS** hasta 1,500 requests/día
- ✅ **3x más rápido** que Gemini Pro
- ✅ **1M tokens de contexto** (vs 200k de Claude)
- ✅ **Multimodal** (texto, imágenes, audio)
- ✅ **Mejor integración con Firebase** (mismo ecosistema Google)
- ✅ **Supera a Pro en coding** (78% vs 76% SWE-bench)

### Comparativa

| Modelo | Costo/Análisis | Velocidad | Contexto |
|---|---|---|---|
| Gemini 3 Flash | $0.00 (gratis) | 0.5s | 1M tokens |
| Claude Haiku | $0.0045 | 1.0s | 200k tokens |
| GPT-4 Turbo | $0.025 | 2-5s | 128k tokens |

## 🚀 Endpoints Disponibles

### POST /chat/ask
Chat conversacional con IA

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "¿Qué productos necesito reabastecer?"}' \
  http://localhost:5000/chat/ask
```

Response:
```json
{
  "data": {
    "answer": "Basándome en el análisis...",
    "cost": 0.0000,
    "contextUsed": true
  }
}
```

### GET /analytics/inventory-status
Análisis completo del inventario (con insights de Gemini si hay problemas críticos)

```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  http://localhost:5000/analytics/inventory-status
```

## 🔄 Background Job

El job `analyzeInventoryJob` se ejecuta cada 6 horas:
- Calcula métricas de inventario
- Si detecta problemas críticos → llama a Gemini para análisis profundo
- Guarda resultados en caché por 6 horas

**Horarios:** 00:00, 06:00, 12:00, 18:00 (America/Mazatlan)

## 📊 Monitoreo de Uso

### Ver logs de Gemini
```bash
firebase functions:log --only analyzeInventoryJob

# Buscar llamadas a Gemini
firebase functions:log | grep "Gemini"
```

### Métricas importantes
- Input/Output tokens por llamada
- Costo por análisis
- Tiempo de respuesta

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY not configured"
```bash
firebase functions:secrets:set GEMINI_API_KEY
```

### Error: "Resource exhausted"
Has superado el límite del free tier (1,500/día).
Soluciones:
1. Esperar 24h para reset del límite
2. Activar billing en Google Cloud (pasas a paid tier automáticamente)

### Verificar que Gemini esté funcionando
```bash
# Local
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"question": "Hola, ¿funciona?"}' \
  http://localhost:5000/chat/ask
```

## 📚 Referencias

- [Google AI Studio](https://aistudio.google.com)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini 3 Flash Announcement](https://blog.google/products/gemini/gemini-3-flash/)

## ✅ Ventajas vs Claude

| Feature | Gemini 3 Flash | Claude 3.5 Haiku |
|---|---|---|
| **Costo** | $0 (free tier) | $2.70/mes |
| **Velocidad** | 0.5s | 1.0s |
| **Contexto** | 1M tokens | 200k tokens |
| **Multimodal** | ✅ Sí | ❌ No |
| **Tier gratuito** | ✅ 1,500/día | ❌ No |
| **Integración Firebase** | ✅ Excelente | ⚠️ Buena |

**Ahorro mensual: $2.70**
