# Lo que tenéis que registrar vosotros

Lista de cuentas, claves y certificados, **en el orden en que hacen falta**. Cada paso dice
dónde se hace, cuánto cuesta y qué valor hay que copiar a `.env.local` (y luego a Vercel).

> 🔐 Regla de oro: las claves y certificados **nunca** se pegan en el chat, ni en el código, ni en
> GitHub. Solo en `.env.local` (vuestro ordenador) y en las variables de entorno de Vercel.

| # | Qué | Para qué fase | Coste | ¿Urge? |
|---|------|---------------|-------|--------|
| 1 | GitHub (ya lo tenéis) | 1 | Gratis | ✅ Hecho |
| 2 | Supabase | 1–2 | Gratis para empezar | **Ya** |
| 3 | Vercel | 1 | Gratis (plan Hobby) | **Ya** |
| 4 | Google Wallet: cuenta de emisor + Google Cloud | 3 | Gratis | Pronto |
| 5 | Apple Developer Program | 4 | 99 €/año | Antes de la fase 4 |
| 6 | Dominio propio | 4–8 | ~10–15 €/año | Recomendable, no obligatorio al principio |

---

## 2. Supabase (base de datos + login)

1. Entra en **https://supabase.com** → *Start your project* → regístrate con GitHub.
2. *New project*:
   - **Name:** `fidelizacion`
   - **Database password:** genera una fuerte y **guárdala en un gestor de contraseñas**.
   - **Region:** una de la UE (p. ej. *Central EU (Frankfurt)* o *West EU (Paris)*). Importante por el RGPD.
3. Cuando termine de crearse: **Project Settings → API Keys** (o *Data API*). Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (empieza por `sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (empieza por `sb_secret_…`) → `SUPABASE_SECRET_KEY` ⚠️ esta es secreta.
   - Si tu panel solo muestra las claves antiguas *anon* y *service_role*, valen igual:
     *anon* va en la publishable y *service_role* en la secret.

## 3. Vercel (donde se publica la web)

1. Entra en **https://vercel.com** → *Sign up* con GitHub.
2. *Add New → Project* → importa el repositorio `ordenador-nuevo-`.
3. **Muy importante:** en *Root Directory* pulsa *Edit* y elige la carpeta **`fidelizacion`**
   (el repositorio tiene otras cosas en la raíz).
4. En *Environment Variables* pega las de Supabase y `NEXT_PUBLIC_APP_URL` (al principio puede ser
   la dirección que te dé Vercel, tipo `https://fidelizacion-xxxx.vercel.app`).
5. *Deploy*. Al terminar, abre `https://…vercel.app/estado` en el móvil: deberías ver
   ✅ *Conexión con Supabase*.

## 4. Google Wallet (gratis)

Son dos sitios distintos: la **consola de Google Wallet** (la cuenta de emisor) y **Google Cloud**
(la cuenta de servicio que firma las tarjetas).

**a) Cuenta de emisor**
1. Entra en **https://pay.google.com/business/console** con la cuenta de Google de la empresa.
2. Menú *Google Wallet API* → acepta las condiciones y crea el emisor (*issuer*).
3. Copia el **Issuer ID** (un número largo) → `GOOGLE_WALLET_ISSUER_ID`.
4. Al principio estaréis en **modo demo**: las tarjetas solo funcionan para los usuarios de
   prueba que añadáis (perfecto para el local de prueba). En la consola: *Google Wallet API →
   Usuarios de prueba* (o *Test users*) → añadid las cuentas de Gmail de los móviles Android
   con los que vayáis a probar. Para el público hay que pedir *publishing access* más
   adelante; os aviso cuando toque.

**b) Cuenta de servicio en Google Cloud**
1. Entra en **https://console.cloud.google.com** → crea un proyecto (`fidelizacion-wallet`).
2. *APIs y servicios → Biblioteca* → busca **Google Wallet API** → *Habilitar*.
3. *IAM y administración → Cuentas de servicio → Crear cuenta de servicio*
   (nombre: `wallet-firmador`). No hace falta darle roles.
4. Entra en ella → pestaña *Claves* → *Agregar clave → Crear clave nueva → JSON*.
   Se descarga un archivo `.json`. **Guárdalo bien, no se puede volver a descargar.**
5. Convierte ese archivo a base64 desde la carpeta del proyecto:
   `npm run a-base64 -- ruta/al/archivo.json` → pega el resultado en
   `GOOGLE_WALLET_SERVICE_ACCOUNT_BASE64`.
6. Vuelve a la consola de Google Wallet → *Usuarios* → *Invitar usuario* → pega el email de la
   cuenta de servicio (termina en `@…iam.gserviceaccount.com`) con permiso de **Desarrollador**.

## 5. Apple Wallet (99 €/año)

**a) Darse de alta**
1. **https://developer.apple.com/programs/enroll** con un Apple ID con doble factor activado.
2. Como **particular** se aprueba en 1–2 días. Como **empresa** (recomendable si vais a vender, para que
   salga el nombre de la empresa) hace falta un número **D-U-N-S** (gratis, pero tarda 1–2 semanas).
   👉 Decidid esto pronto, es lo que más tarda de todo.
3. Copia tu **Team ID** (*Membership details*, 10 caracteres) → `APPLE_TEAM_ID`.

**b) Pass Type ID**
1. *Certificates, Identifiers & Profiles → Identifiers → +* → **Pass Type IDs**.
2. Descripción: `Tarjetas de fidelizacion` · Identificador: `pass.com.TUDOMINIO.fidelizacion`
   → `APPLE_PASS_TYPE_ID`.
   (Un solo Pass Type ID sirve para **todos** los negocios.)

**c) Certificado del pase** — esta parte la haremos juntos en la Fase 4, paso a paso, porque
necesita unos comandos. Resumen de lo que saldrá:
- `APPLE_PASS_CERT_BASE64` (el certificado), `APPLE_PASS_KEY_BASE64` (la clave privada) y
  `APPLE_PASS_KEY_PASSPHRASE` (su contraseña).
- `APPLE_WWDR_CERT_BASE64`: el certificado intermedio **WWDR G4** de
  https://www.apple.com/certificateauthority/
- El mismo certificado sirve para las notificaciones push (APNs): no hace falta otra clave.
- No hace falta tener un Mac: se puede hacer todo con `openssl`.

## 6. Dominio

- Para probar basta la dirección gratuita de Vercel (`…vercel.app`), que ya tiene HTTPS.
- Para vender, mejor uno propio (p. ej. en Cloudflare, Namecheap o DonDominio) y conectarlo en
  *Vercel → Settings → Domains*. Conviene tenerlo **antes de imprimir los QR de los locales**,
  porque el QR lleva la dirección dentro.
