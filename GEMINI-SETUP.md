# Gemini 2.0 Flash Setup

## Configuracion de Gemini API

### 1. Obtener API Key GRATIS

1. Ve a [Google AI Studio](https://aistudio.google.com/apikey)
2. Inicia sesion con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia la API key generada

### 2. Configurar en Firebase

```bash
cd lightspeed-middleware
firebase functions:secrets:set GEMINI_API_KEY
# Pega tu API key cuando se solicite
```

### 3. Verificar Configuracion

```bash
# Ver secrets configurados
firebase functions:secrets:access GEMINI_API_KEY
```

## Costos y Limites (Gemini 2.0 Flash)

### Free Tier (GRATIS)
- 1,500 requests/dia
- 1M tokens/minuto
- 10M tokens/dia
- **Costo: $0.00**

### Paid Tier (si superas el free tier)
- Input: $0.50 per 1M tokens
- Output: $3.00 per 1M output tokens

### Tu Uso Estimado
```
Analisis automaticos: 4/dia (cada 6h)
Consultas de chat: ~15-20/dia
Total: ~20-25 requests/dia

MUY por debajo del limite gratuito (1,500/dia)
Costo mensual: $0.00
```

## Modelo Utilizado

El proyecto usa `gemini-2.0-flash` configurado en `functions/src/services/gemini.ts`:
```typescript
this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
```

### Ventajas de Gemini 2.0 Flash
- GRATIS hasta 1,500 requests/dia
- Rapido y economico
- 1M tokens de contexto
- Multimodal (texto, imagenes, audio)
- Buena integracion con Firebase (mismo ecosistema Google)

## Endpoints Disponibles

### POST /chat
Chat conversacional con IA

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "Que productos necesito reabastecer?"}' \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/chat
```

Response:
```json
{
  "data": {
    "answer": "Basandome en el analisis...",
    "cost": 0.0000,
    "contextUsed": true
  }
}
```

### GET /analytics/inventory-status
Analisis completo del inventario (con insights de Gemini si hay problemas criticos)

```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/analytics/inventory-status
```

## Background Job

El job `analyzeInventoryJob` se ejecuta cada 6 horas:
- Calcula metricas de inventario
- Si detecta problemas criticos -> llama a Gemini para analisis profundo
- Guarda resultados en cache por 6 horas

**Horarios:** 00:00, 06:00, 12:00, 18:00 (America/Mazatlan)

## Monitoreo de Uso

### Ver logs de Gemini
```bash
firebase functions:log --only analyzeInventoryJob

# Buscar llamadas a Gemini
firebase functions:log | grep "Gemini"
```

### Metricas importantes
- Input/Output tokens por llamada
- Costo por analisis
- Tiempo de respuesta

## Troubleshooting

### Error: "GEMINI_API_KEY not configured"
```bash
firebase functions:secrets:set GEMINI_API_KEY
```

### Error: "Resource exhausted"
Has superado el limite del free tier (1,500/dia).
Soluciones:
1. Esperar 24h para reset del limite
2. Activar billing en Google Cloud (pasas a paid tier automaticamente)

### Verificar que Gemini este funcionando
```bash
# Local
curl -X POST \
  -H "Authorization: Bearer YOUR_BRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question": "Hola, funciona?"}' \
  http://localhost:5002/YOUR_PROJECT/us-central1/api/chat
```

## Referencias

- [Google AI Studio](https://aistudio.google.com)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
