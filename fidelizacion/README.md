# Tarjetas de fidelización en Apple Wallet y Google Wallet

Sistema multi-negocio de tarjetas de puntos: el cliente escanea un QR en el mostrador, guarda la
tarjeta en su Wallet sin instalar ninguna app, y el dependiente le suma puntos escaneándola.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind) · Supabase (Postgres + Auth + RLS) ·
`passkit-generator` + APNs (Apple) · Google Wallet API (Google) · Vercel.

## Estado por fases

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Preparación: proyecto, conexión a Supabase, lista de cuentas | ✅ |
| 2 | Base de datos y login del personal | ✅ |
| 3 | Página de alta + Google Wallet | ✅ |
| 4 | Apple Wallet (`.pkpass` + servicio web de PassKit) | ⏳ |
| 5 | Panel del dependiente con escáner | ⏳ |
| 6 | Actualizaciones en directo (APNs + PATCH de Google) | ⏳ |
| 7 | Panel del dueño | ⏳ |
| 8 | Superadmin y multi-negocio completo | ⏳ |

## Alta del cliente

El QR del mostrador lleva a `/c/<negocio>` (p. ej. `/c/cafe-la-esquina`). El cliente pone su
nombre, su **email (obligatorio)**, su teléfono (opcional), acepta la privacidad y, si quiere,
marca la casilla de ofertas. Al terminar ve su tarjeta y el botón de su Wallet:
Google Wallet en Android, y Apple Wallet en iPhone (desde la Fase 4).

Si el email ya tiene tarjeta, solo se la enseñamos en el mismo móvil en el que se dio de alta.
Así nadie puede ver la tarjeta de otro escribiendo su email.

## Cómo funcionan los premios

Cada negocio elige su regla en `loyalty_programs`:

| Tipo | Qué pasa |
|------|----------|
| **Premio de una vez** (`one_time`) | Al llegar a N visitas, el cliente tiene X% de descuento. El dependiente lo aplica y el contador vuelve a empezar (si llevaba visitas de más, se conservan). |
| **Nivel permanente** (`permanent`) | A partir de N visitas, el cliente tiene X% **siempre**. |

- **Máximo una visita al día** por tarjeta. Lo impide la propia base de datos, según la zona horaria del negocio.
- Las visitas **no caducan**.
- No se puede escanear la misma tarjeta más de 5 veces por minuto.
- Las visitas y los canjes solo se registran mediante las funciones `scan_card`, `register_visit` y `redeem_reward`. Estas comprueban que quien lo hace es personal de ese negocio y anotan quién lo hizo.

## Base de datos

1. Supabase → **SQL Editor** → *New query* → pega `supabase/migrations/0001_esquema_inicial.sql` → **Run**.
2. Crea tu usuario en **Authentication → Users → Add user** (marca *Auto Confirm User*).
3. Haz lo mismo con `supabase/migrations/0002_email_obligatorio.sql`.
4. Abre `supabase/demo.sql`, cambia el email de la primera línea por el tuyo, pégalo en el SQL Editor y pulsa **Run**.
   Así serás superadmin y dueño del negocio de demostración «Café La Esquina», con 5 clientes de ejemplo.

## Qué cuentas hay que crear

Ver **[docs/CUENTAS.md](docs/CUENTAS.md)**: paso a paso, con dónde se hace y qué valor copiar.

## Instalación en local

Requisitos: [Node.js](https://nodejs.org) 22 o superior.

```bash
git clone https://github.com/mj6378438-pixel/ordenador-nuevo-.git
cd ordenador-nuevo-/fidelizacion
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev
```

Abre http://localhost:3000 y luego http://localhost:3000/estado para ver qué falta configurar.

## Variables de entorno

Todas están explicadas en [`.env.example`](.env.example). Resumen:

| Variable | Dónde se consigue | Secreta |
|----------|-------------------|---------|
| `NEXT_PUBLIC_APP_NAME` | La elegís vosotros | No |
| `NEXT_PUBLIC_APP_URL` | URL de la web (local o Vercel) | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → Publishable | No |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys → Secret | **Sí** |
| `GOOGLE_WALLET_ISSUER_ID` | Google Pay & Wallet Console | No |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_BASE64` | JSON de la cuenta de servicio, en base64 | **Sí** |
| `APPLE_TEAM_ID` | developer.apple.com → Membership | No |
| `APPLE_PASS_TYPE_ID` | El Pass Type ID registrado | No |
| `APPLE_PASS_CERT_BASE64` / `APPLE_PASS_KEY_BASE64` / `APPLE_PASS_KEY_PASSPHRASE` | Certificado del Pass Type ID | **Sí** |
| `APPLE_WWDR_CERT_BASE64` | apple.com/certificateauthority (WWDR G4) | No |
| `APPLE_PASS_AUTH_SECRET` | `openssl rand -hex 32` | **Sí** |

Los archivos (certificados, JSON) se guardan en base64 para que quepan en una variable:

```bash
npm run a-base64 -- ruta/al/archivo
```

Las variables que empiezan por `NEXT_PUBLIC_` las puede ver el navegador; **nunca** pongas ese
prefijo a una clave secreta.

## Despliegue en Vercel

1. Importa el repositorio en Vercel.
2. **Root Directory: `fidelizacion`** (importante: el repo tiene otras cosas en la raíz).
3. Copia las variables de entorno en *Settings → Environment Variables*.
4. Cada `git push` a la rama principal se publica solo.

## Estructura

```
fidelizacion/
├── docs/CUENTAS.md        Lista de cuentas y certificados a registrar
├── scripts/a-base64.mjs   Convierte certificados a base64
├── supabase/
│   ├── migrations/        Esquema de la base de datos (tablas, RLS, lógica de puntos)
│   └── demo.sql           Tu cuenta de superadmin + negocio de demostración
├── src/app/               Páginas (App Router)
│   ├── c/[slug]/          Página pública del negocio: alta del cliente, su tarjeta y privacidad
│   ├── entrar/            Login del personal
│   ├── panel/             Panel (requiere sesión)
│   └── estado/            Comprobación de la configuración (sin mostrar valores)
└── src/lib/
    ├── auth.ts            Usuario actual y sus negocios
    ├── env.ts             Lectura de variables de entorno
    ├── loyalty.ts         Reglas y textos de progreso («te faltan 3 visitas…»)
    ├── cards.ts           Lectura de negocios y tarjetas
    ├── wallet/google.ts   Enlace «Añadir a Google Wallet» (JWT firmado)
    └── supabase/          Clientes de Supabase (navegador, servidor y admin)
```

## Comandos

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Arranca en local con recarga automática |
| `npm run build` | Compila para producción |
| `npm run lint` | Revisa el código |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm test` | Pasa las pruebas automáticas |
