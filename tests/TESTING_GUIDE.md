# 🧪 Guía de Testing - App Vend (FASE 1)

## Métodos de Testing Disponibles

### 1️⃣ Testing Visual HTML (RECOMENDADO ✅)

**Archivo:** `tests/manual-testing.html`

**Cómo usar:**
1. Abre el archivo `tests/manual-testing.html` en tu navegador Chrome
2. La página tiene botones interactivos para probar todos los endpoints
3. Incluye visualización de resultados en tiempo real
4. No requiere instalación de dependencias

**Características:**
- ✅ Test de /health (público)
- ✅ Test de /reports/sales-comparison (FASE 1)
- ✅ Test de /analytics/inventory-status
- ✅ Test de POST /analytics/refresh
- ✅ Links directos al frontend desplegado
- ✅ Visualización de resultados formateada
- ✅ Indicadores de éxito/error con colores

---

### 2️⃣ Testing con CURL

#### A) Health Check (sin autenticación)
```bash
curl -X GET "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/health" | jq '.'
```

**Resultado esperado:**
```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-02-09T...",
    "version": "2.0.0",
    "uptime": 1000.530812955
  },
  "meta": {...}
}
```

#### B) Sales Comparison (FASE 1 - requiere API key)

**Test del último mes:**
```bash
curl -X GET "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/reports/sales-comparison?date_from=2025-01-09&date_to=2025-02-09&outlet_id=1" \
  -H "Authorization: Bearer bridge_vend_2025_secure_key" \
  -H "Content-Type: application/json" | jq '.'
```

**Test de la última semana:**
```bash
curl -X GET "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/reports/sales-comparison?date_from=2025-02-02&date_to=2025-02-09&outlet_id=1" \
  -H "Authorization: Bearer bridge_vend_2025_secure_key" \
  -H "Content-Type: application/json" | jq '.'
```

**Resultado esperado:**
```json
{
  "data": {
    "current": {
      "period": { "from": "2025-01-09", "to": "2025-02-09" },
      "summary": {
        "amount": 150000,
        "tickets": 450,
        "avg_ticket": 333.33
      }
    },
    "previous": {
      "period": { "from": "2024-12-10", "to": "2025-01-08" },
      "summary": {
        "amount": 140000,
        "tickets": 420,
        "avg_ticket": 333.33
      }
    },
    "changes": {
      "amount": 7.14,      // +7.14% vs período anterior
      "tickets": 7.14,     // +7.14% vs período anterior
      "avg_ticket": 0.0    // 0% cambio
    },
    "daily_sales": [
      { "date": "2025-01-09", "amount": 5000, "tickets": 15 },
      { "date": "2025-01-10", "amount": 4500, "tickets": 14 },
      // ... más días
    ]
  }
}
```

#### C) Inventory Status
```bash
curl -X GET "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/analytics/inventory-status" \
  -H "Authorization: Bearer bridge_vend_2025_secure_key" \
  -H "Content-Type: application/json" | jq '.data.resumen'
```

#### D) Refresh Analysis
```bash
curl -X POST "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/analytics/refresh" \
  -H "Authorization: Bearer bridge_vend_2025_secure_key" \
  -H "Content-Type: application/json" | jq '.'
```

---

### 3️⃣ Testing con Navegador (Manual)

#### Frontend Desplegado
- **Dashboard:** https://lightspeed-middleware.web.app/dashboard
- **Chat:** https://lightspeed-middleware.web.app/chat
- **Reports:** https://lightspeed-middleware.web.app/reports

#### Verificaciones Manuales del Dashboard (FASE 1)

**✅ Checklist de componentes:**

1. **PeriodSelector (nuevo)**
   - [ ] Se ve el selector de período con 4 opciones
   - [ ] Opciones: "Esta Semana", "Este Mes", "Últimos 3 Meses", "Personalizado"
   - [ ] Al hacer clic en cada opción, el estilo cambia (fondo blanco)
   - [ ] Al cambiar el período, las métricas se actualizan

2. **MetricCardWithChange (nuevo)**
   - [ ] Se ven 4 tarjetas de métricas en la primera fila
   - [ ] Cada tarjeta muestra:
     - [ ] Título (ej: "Ventas del Período")
     - [ ] Valor numérico (ej: "$150,000")
     - [ ] Porcentaje de cambio (ej: "+7.1% vs período anterior")
     - [ ] Icono de tendencia (flecha arriba ↗️, abajo ↘️, o neutro ➖)
     - [ ] Color del cambio (verde = positivo, rojo = negativo, gris = neutro)

3. **LineChart de Ventas Diarias (nuevo)**
   - [ ] Se ve una gráfica de líneas con título "📈 Tendencia de Ventas Diarias"
   - [ ] Eje X muestra fechas
   - [ ] Eje Y muestra montos
   - [ ] Línea verde con puntos
   - [ ] Tooltip al hacer hover muestra fecha y monto

4. **Funcionalidad de Actualizar**
   - [ ] Botón "Actualizar" visible en la esquina superior derecha
   - [ ] Al hacer clic, el ícono gira (spinning)
   - [ ] Mensaje de cache actualizado después de refrescar

#### Casos de Error Comunes

**Si ves "Invalid API key":**
- El frontend está usando una API key incorrecta
- Verifica el archivo `frontend/.env` (debe tener la key correcta)
- Reconstruye el frontend: `cd frontend && npm run build`
- Redeploya: `npx firebase deploy --only hosting`

**Si no se ven las métricas de comparación:**
- Puede que no haya datos de ventas en Lightspeed
- Verifica el endpoint directamente con curl
- Revisa la consola del navegador (F12 → Console) para errores

**Si la gráfica no aparece:**
- Puede que `daily_sales` esté vacío (sin datos)
- Esto es normal si no hay ventas en el período seleccionado
- Prueba con un período diferente (ej: últimos 3 meses)

---

### 4️⃣ Testing con DevTools del Navegador

#### Chrome DevTools (F12)

**Network Tab:**
1. Abre DevTools → Network
2. Refresca la página
3. Busca requests a:
   - `sales-comparison` (nuevo endpoint FASE 1)
   - `inventory-status`
4. Verifica que respondan con status 200
5. Inspecciona el payload JSON

**Console Tab:**
1. Verifica que no haya errores JavaScript
2. Busca logs de React Query
3. Verifica que los datos se estén cacheando correctamente

**Application Tab:**
1. Local Storage → verifica que React Query guarde datos
2. Network → Disable cache para forzar requests frescos

---

## Resultados Esperados de FASE 1

### ✅ Backend
- [x] Endpoint `/reports/sales-comparison` funcional
- [x] Calcula período anterior automáticamente
- [x] Retorna cambios porcentuales (amount, tickets, avg_ticket)
- [x] Retorna daily_sales con breakdown diario
- [x] CORS configurado para frontend desplegado

### ✅ Frontend
- [x] PeriodSelector component
- [x] MetricCardWithChange component con indicadores visuales
- [x] Dashboard integrado con sales-comparison query
- [x] LineChart para tendencia de ventas diarias
- [x] Indicadores semánticos de color (verde/rojo/gris)
- [x] Build exitoso sin errores
- [x] Desplegado en Firebase Hosting

---

## Próximos Pasos (FASE 2)

**FASE 2 - Análisis de Ventas Profundo (2-3 semanas)**
- [ ] Heatmap de ventas por hora del día
- [ ] Análisis por día de la semana (mejores/peores días)
- [ ] Ventas por categoría de producto
- [ ] Comparación mes a mes

**FASE 3 - Predicciones y Alertas (3-4 semanas)**
- [ ] Predicción de quiebres de stock con ML
- [ ] Alertas automáticas por email
- [ ] Recomendaciones de reorden inteligentes
- [ ] Dashboard predictivo

---

## Troubleshooting

### Problema: "CORS error"
**Solución:** Verifica que el origen esté en `functions/src/index.ts`:
```typescript
const allowedOrigins = [
  'https://lightspeed-middleware.web.app',
  'https://lightspeed-middleware.firebaseapp.com',
  'http://localhost:5173',
];
```

### Problema: "401 Unauthorized"
**Solución:** La API key no coincide. Verifica:
1. Frontend `.env`: `VITE_API_KEY=bridge_vend_2025_secure_key`
2. Backend secret: `npx firebase functions:secrets:access BRIDGE_API_KEY`

### Problema: "No data" en las gráficas
**Solución:** Verifica que haya ventas en Lightspeed para el período seleccionado:
```bash
curl -X GET "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/reports/sales-summary?date_from=2025-01-01&date_to=2025-02-09&outlet_id=1" \
  -H "Authorization: Bearer bridge_vend_2025_secure_key" | jq '.data.totals'
```

---

## Comandos Útiles

```bash
# Ver logs del backend en tiempo real
npx firebase functions:log --only api

# Rebuild frontend
cd frontend && npm run build

# Deploy completo
npx firebase deploy

# Deploy solo functions
npx firebase deploy --only functions

# Deploy solo hosting
npx firebase deploy --only hosting
```

---

**¡Happy Testing! 🚀**
