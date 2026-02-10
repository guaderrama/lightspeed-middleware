# 🧪 Testing Tools - App Vend

## 🚀 Quick Start

### 1. Deploy el Fix Primero
```bash
cd ..  # Volver al root del proyecto

# Opción A: Push + Deploy todo de una vez (recomendado)
./push-and-deploy.sh

# Opción B: Solo deploy (si ya hiciste push)
./deploy-fix.sh

# Opción C: Manual
git push origin main
npx firebase deploy --only functions
```

### 2. Probar con la Herramienta Visual
```bash
# Abrir en Chrome
open manual-testing.html

# O arrastra el archivo a Chrome
```

**En la herramienta:**
1. Verifica que API URL esté en "Production (Firebase) ✅"
2. Click "Test /health" → Debería mostrar "Backend is HEALTHY"
3. Configura fechas para sales-comparison
4. Click "Test /reports/sales-comparison" → Debería mostrar cambios porcentuales

### 3. Probar el Frontend
```
https://lightspeed-middleware.web.app/dashboard
```

**Verificar:**
- ✅ PeriodSelector (4 botones)
- ✅ MetricCards con porcentajes
- ✅ Gráfica de líneas de ventas
- ✅ Sin errores en consola (F12)

---

## 📁 Archivos en este Directorio

| Archivo | Descripción | Uso |
|---------|-------------|-----|
| **manual-testing.html** ⭐ | Herramienta visual para testing | Abre en Chrome |
| **TESTING_GUIDE.md** | Guía completa con comandos curl | Referencia |
| **TESTING_SUMMARY.md** | Resumen ejecutivo de FASE 1 | Overview |
| **e2e/dashboard.spec.ts** | Tests E2E con Playwright | Ejecutar localmente |
| **open-testing-tool.sh** | Script para abrir testing tool | `./open-testing-tool.sh` |

---

## 🐛 El Bug que se Arregló

### Síntoma
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Invalid character in header content [\"Authorization\"]"
  }
}
```

### Causa
- `node-fetch` v3 con módulos ESM incompatible con Firebase Functions
- Afectaba todos los endpoints `/reports/*`

### Solución
- Usar fetch nativo de Node.js 22
- Archivo modificado: `functions/src/services/lightspeed.ts`

### Endpoints Arreglados
- ✅ `/reports/sales-summary`
- ✅ `/reports/sales-comparison` (FASE 1) ⭐
- ✅ `/reports/sales-top`

---

## 📊 Testing con curl (Terminal)

### Health Check
```bash
curl "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/health" | jq '.'
```

### Sales Comparison (FASE 1)
```bash
curl "https://us-central1-lightspeed-middleware.cloudfunctions.net/api/reports/sales-comparison?date_from=2025-01-09&date_to=2025-02-09&outlet_id=1" \
  -H "Authorization: Bearer sk-IVG-LS-20250821-aK7b9N3pXzW5rD1v" | jq '.data.changes'

# Deberías ver:
# {
#   "amount": 7.14,
#   "tickets": 7.14,
#   "avg_ticket": 0.0
# }
```

---

## 🎓 Troubleshooting

### "401 Unauthorized"
**Problema:** API key incorrecta
**Solución:** Verifica que estés usando la API key de producción:
- Production: `sk-IVG-LS-20250821-aK7b9N3pXzW5rD1v`
- Dev: `bridge_vend_2025_secure_key`

### "Invalid character in header"
**Problema:** Aún no has deployado el fix
**Solución:** Ejecuta `./deploy-fix.sh` desde el root del proyecto

### "No data" en las gráficas
**Problema:** No hay ventas en Lightspeed para el período seleccionado
**Solución:** Prueba con un período diferente (ej: últimos 3 meses)

### Frontend no carga datos
1. Abre DevTools (F12) → Console
2. Busca errores de red
3. Verifica que las requests a `/reports/sales-comparison` den 200 OK
4. Si dan error, revisa que hayas deployado las functions

---

## 🔗 Links Útiles

- **Manual Testing Tool**: [manual-testing.html](./manual-testing.html)
- **Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Session Documentation**: [../SESSION-2026-02-09-FIX.md](../SESSION-2026-02-09-FIX.md)
- **Frontend**: https://lightspeed-middleware.web.app
- **Backend**: https://us-central1-lightspeed-middleware.cloudfunctions.net/api

---

## 📝 Checklist de Verificación

### Después del Deploy
- [ ] ✅ `/health` responde con status "ok"
- [ ] ✅ `/reports/sales-comparison` responde con data (no error)
- [ ] ✅ Dashboard carga sin errores en consola
- [ ] ✅ PeriodSelector cambia las métricas
- [ ] ✅ Gráfica de ventas se visualiza correctamente
- [ ] ✅ MetricCards muestran porcentajes de cambio

### Si Todo Funciona
🎉 **¡FASE 1 completada y funcionando!**

Próximo: FASE 2 - Análisis de Ventas Profundo
- Heatmap de ventas por hora
- Análisis por día de la semana
- Ventas por categoría
- Comparación mes a mes

---

**¿Necesitas ayuda?** Consulta [TESTING_GUIDE.md](./TESTING_GUIDE.md) para más detalles.
