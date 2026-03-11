#!/bin/bash

# Script para autenticar y deployar en un solo paso

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║     🔐 AUTENTICACIÓN Y DEPLOY - App Vend Bug Fix             ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Paso 1: Autenticación de Firebase${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "Ejecutando: firebase login --reauth"
echo ""

npx firebase login --reauth

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ Firebase login falló${NC}"
    echo ""
    echo "Por favor ejecuta manualmente:"
    echo "  npx firebase login"
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Firebase autenticado correctamente${NC}"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${BLUE}Paso 2: Push a GitHub${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Try to push
if git push origin main 2>&1; then
    echo ""
    echo -e "${GREEN}✅ Push a GitHub exitoso${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Push falló - probablemente necesitas configurar credentials${NC}"
    echo ""
    echo "Opciones:"
    echo "  A) Usar GitHub CLI: gh auth login"
    echo "  B) Configurar token: git config credential.helper store"
    echo "  C) Usar SSH en vez de HTTPS"
    echo ""
    read -p "¿Quieres intentar con GitHub CLI (gh auth login)? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh auth login
        git push origin main
    else
        echo "Saltando push a GitHub por ahora..."
    fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

echo -e "${BLUE}Paso 3: Deploy a Firebase${NC}"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Use deploy script
./deploy-fix.sh

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}🎉 Proceso completado!${NC}"
echo ""
echo "Next steps:"
echo "  1. Abre: tests/manual-testing.html"
echo "  2. Prueba los endpoints"
echo "  3. Verifica el dashboard en producción"
echo ""
