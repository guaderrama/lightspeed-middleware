#!/bin/bash

# Script para abrir la herramienta de testing en Chrome
# Uso: ./open-testing-tool.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HTML_FILE="$SCRIPT_DIR/manual-testing.html"

echo "🧪 Abriendo App Vend Testing Tool..."
echo "📄 Archivo: $HTML_FILE"

# Detectar sistema operativo y abrir con el navegador apropiado
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if [ -d "/Applications/Google Chrome.app" ]; then
        open -a "Google Chrome" "$HTML_FILE"
        echo "✅ Abriendo en Chrome (macOS)"
    else
        open "$HTML_FILE"
        echo "✅ Abriendo con navegador por defecto (macOS)"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v google-chrome &> /dev/null; then
        google-chrome "$HTML_FILE" &
        echo "✅ Abriendo en Chrome (Linux)"
    elif command -v chromium-browser &> /dev/null; then
        chromium-browser "$HTML_FILE" &
        echo "✅ Abriendo en Chromium (Linux)"
    else
        xdg-open "$HTML_FILE" &
        echo "✅ Abriendo con navegador por defecto (Linux)"
    fi
elif [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]]; then
    # Windows (Git Bash / Cygwin)
    if [ -f "/c/Program Files/Google/Chrome/Application/chrome.exe" ]; then
        "/c/Program Files/Google/Chrome/Application/chrome.exe" "$HTML_FILE" &
        echo "✅ Abriendo en Chrome (Windows)"
    else
        start "$HTML_FILE"
        echo "✅ Abriendo con navegador por defecto (Windows)"
    fi
else
    echo "❓ Sistema operativo desconocido. Abriendo con navegador por defecto..."
    xdg-open "$HTML_FILE" 2>/dev/null || open "$HTML_FILE" 2>/dev/null || start "$HTML_FILE" 2>/dev/null
fi

echo ""
echo "📊 Instrucciones:"
echo "  1. Verifica que la API URL esté en 'Production (Firebase)'"
echo "  2. Haz clic en 'Test /health' para verificar que el backend funciona"
echo "  3. Configura las fechas para sales-comparison"
echo "  4. Haz clic en 'Test /reports/sales-comparison' para ver FASE 1"
echo ""
echo "📚 Para más información, consulta:"
echo "  - tests/TESTING_GUIDE.md"
echo "  - tests/TESTING_SUMMARY.md"
echo ""
echo "🚀 Happy Testing!"
