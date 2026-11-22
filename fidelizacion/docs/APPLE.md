# Activar Apple Wallet

El código ya está hecho. Apple Wallet se activa solo en cuanto las 6 variables de abajo están
puestas en Vercel. Hasta entonces, los clientes con iPhone ven «Apple Wallet: disponible muy
pronto» y pueden usar el QR de su página.

**Antes de empezar necesitas:**
- La cuenta de **Apple Developer** aprobada (99 €/año).
- El **Pass Type ID** creado, por ejemplo `pass.com.tumarca.fidelizacion`.
- La web publicada con **HTTPS** y con `NEXT_PUBLIC_APP_URL` apuntando a ella. Apple solo
  actualiza las tarjetas a través de HTTPS.
- **`openssl`**: en Mac ya viene; en Windows, abre «Git Bash», que se instala con
  [Git para Windows](https://git-scm.com/download/win).

No hace falta tener un Mac.

## 1. Crear la clave y la solicitud de certificado

En la terminal, dentro de una carpeta nueva (por ejemplo `apple-certificado`):

```bash
openssl genrsa -out pase.key 2048
openssl req -new -key pase.key -out pase.csr -subj "/emailAddress=TU_EMAIL/CN=Tarjetas fidelizacion/C=ES"
```

⚠️ `pase.key` es la clave privada. **No la mandes a nadie ni la subas a GitHub.**

## 2. Pedir el certificado a Apple

1. [developer.apple.com/account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Certificates** → **+**.
2. Elige **Pass Type ID Certificate** → **Continue**.
3. Elige vuestro Pass Type ID → sube el archivo `pase.csr` → **Continue** → **Download**.
   Se descarga `pass.cer`. Muévelo a la misma carpeta.

## 3. Convertir los certificados

```bash
# Certificado del pase
openssl x509 -inform DER -in pass.cer -out pase.pem

# Certificado intermedio de Apple (WWDR G4)
curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem

# Secreto para los tokens de los pases
openssl rand -hex 32
```

## 4. Pasarlos a base64 y ponerlos en Vercel

Mac (cada comando copia el resultado al portapapeles; pégalo en Vercel antes del siguiente):

```bash
base64 -i pase.pem | pbcopy     # → APPLE_PASS_CERT_BASE64
base64 -i pase.key | pbcopy     # → APPLE_PASS_KEY_BASE64
base64 -i wwdr.pem | pbcopy     # → APPLE_WWDR_CERT_BASE64
```

Windows (Git Bash):

```bash
base64 -w0 pase.pem > /dev/clipboard   # → APPLE_PASS_CERT_BASE64
base64 -w0 pase.key > /dev/clipboard   # → APPLE_PASS_KEY_BASE64
base64 -w0 wwdr.pem > /dev/clipboard   # → APPLE_WWDR_CERT_BASE64
```

En Vercel → **Settings** → **Environment Variables**:

| Variable | Valor |
|----------|-------|
| `APPLE_TEAM_ID` | Team ID (developer.apple.com → Membership) |
| `APPLE_PASS_TYPE_ID` | p. ej. `pass.com.tumarca.fidelizacion` |
| `APPLE_PASS_CERT_BASE64` | el de `pase.pem` |
| `APPLE_PASS_KEY_BASE64` | el de `pase.key` |
| `APPLE_PASS_KEY_PASSPHRASE` | no hace falta crearla (la clave del paso 1 no tiene contraseña) |
| `APPLE_WWDR_CERT_BASE64` | el de `wwdr.pem` |
| `APPLE_PASS_AUTH_SECRET` | el resultado de `openssl rand -hex 32` |

Luego, **Deployments** → **Redeploy**. Abre `/estado`: las variables de la fase 4 tienen que
salir como «Puesta».

## 5. Probar

1. Con un iPhone, abre `https://TU-WEB/c/cafe-la-esquina` en Safari y date de alta.
2. Pulsa **Añadir a Apple Wallet** → **Añadir**.
3. Con la app del personal, escanea la tarjeta. Al poco, la tarjeta del iPhone cambia sola y llega un aviso («Te faltan…»).

## Mantenimiento

- **El certificado caduca al año.** Repite los pasos 2 a 4 antes de que caduque, con el mismo
  `pase.key` y `pase.csr`. Las tarjetas que ya tienen los clientes siguen funcionando.
- Guarda `pase.key`, `pase.pem` y el secreto en el gestor de contraseñas de la empresa.
