# Configurar Secretos en Firebase

Antes de desplegar, necesitas configurar los secretos requeridos.

## Secretos Necesarios

1. **LIGHTSPEED_PERSONAL_TOKEN** - Token de API de Lightspeed Retail
2. **BRIDGE_API_KEY** - API Key para autenticación del middleware
3. **GEMINI_API_KEY** - API Key de Google Gemini

## Configurar Secretos

Ejecuta estos comandos en la terminal:

```bash
# Navega al directorio del proyecto
cd "j:\Dropbox\Ai\app vend\lightspeed-middleware"

# Configura LIGHTSPEED_PERSONAL_TOKEN
firebase functions:secrets:set LIGHTSPEED_PERSONAL_TOKEN

# Cuando te pida el valor, pega tu token de Lightspeed

# Configura BRIDGE_API_KEY
firebase functions:secrets:set BRIDGE_API_KEY

# Cuando te pida el valor, genera una key segura (ejemplo: openssl rand -base64 32)

# Configura GEMINI_API_KEY
firebase functions:secrets:set GEMINI_API_KEY

# Cuando te pida el valor, pega tu API key de Gemini desde https://aistudio.google.com/app/apikey
```

## Generar una API Key Segura

Si necesitas generar una clave segura para BRIDGE_API_KEY:

### Windows (PowerShell)
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Git Bash / WSL / Linux / macOS
```bash
openssl rand -base64 32
```

## Después de Configurar

Una vez configurados todos los secretos, ejecuta:

```bash
firebase deploy
```

## Ver Secretos Configurados

Para ver qué secretos tienes configurados:

```bash
firebase functions:secrets:access LIGHTSPEED_PERSONAL_TOKEN
firebase functions:secrets:access BRIDGE_API_KEY
firebase functions:secrets:access GEMINI_API_KEY
```

## Obtener API Keys

### Lightspeed Personal Token
1. Ve a https://retail.lightspeedapp.com/
2. Settings → API Settings
3. Genera un Personal Access Token

### Gemini API Key
1. Ve a https://aistudio.google.com/app/apikey
2. Crea un nuevo API key
3. Copia la key generada

**GRATIS hasta 1500 requests/dia**

## Variables de Entorno Opcionales

### LIGHTSPEED_BASE_URL

URL base de la API de Lightspeed Retail. Solo necesario si usas una instancia diferente a la por defecto.

```bash
# Opcional - solo si necesitas apuntar a una URL personalizada
firebase functions:config:set lightspeed.base_url="https://api.lightspeedapp.com/API/V3"
```

Por defecto el middleware usa la URL estandar de Lightspeed Retail API. Solo configura esta variable si necesitas apuntar a un entorno diferente.
