-- ════════════════════════════════════════════════════════════════════
--  INSTALACIÓN COMPLETA DE LA BASE DE DATOS
--  Para un proyecto de Supabase NUEVO y vacío. Pega TODO en
--  SQL Editor → New query → Run. Solo se ejecuta una vez.
--  (Archivo generado con "npm run unir-sql": no lo edites a mano.)
--  Incluye: 0001_esquema_inicial.sql, 0002_email_obligatorio.sql, 0003_escanear_y_sumar.sql, 0004_suscripciones_y_bloqueo.sql
-- ════════════════════════════════════════════════════════════════════


-- ▼▼▼ 0001_esquema_inicial.sql ▼▼▼

-- ════════════════════════════════════════════════════════════════════
--  Fidelización · Esquema inicial (Fase 2)
--  Multi-negocio: cada fila lleva business_id y Row Level Security
--  garantiza que cada negocio solo ve lo suyo.
--
--  Cómo aplicarlo: Supabase → SQL Editor → New query → pega TODO este
--  archivo → Run. Se puede ejecutar una sola vez sobre un proyecto vacío.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── Tipos ──────────────────────────────────────────────────────────
create type staff_role as enum ('owner', 'staff');

-- one_time  = premio de una vez: al llegar a N visitas tiene X% una vez,
--             se aplica y el contador vuelve a empezar.
-- permanent = nivel permanente: a partir de N visitas, X% siempre.
create type reward_type as enum ('one_time', 'permanent');

create type transaction_type as enum ('visit', 'redeem', 'adjust');

-- ─── Negocios ───────────────────────────────────────────────────────
create table businesses (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name          text not null check (length(name) between 1 and 80),
  logo_url      text,
  -- Colores de la tarjeta (formato #RRGGBB)
  bg_color      text not null default '#3b2a20' check (bg_color ~ '^#[0-9a-fA-F]{6}$'),
  fg_color      text not null default '#f7efe6' check (fg_color ~ '^#[0-9a-fA-F]{6}$'),
  label_color   text not null default '#d9c7b3' check (label_color ~ '^#[0-9a-fA-F]{6}$'),
  -- Zona horaria: decide qué es "hoy" para la regla de una visita al día
  timezone      text not null default 'Europe/Madrid',
  -- Mensaje o promoción que se muestra en todas las tarjetas (Fase 7)
  promo_message text,
  is_demo       boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── Superadmins (vosotros) ─────────────────────────────────────────
create table platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ─── Personal de cada negocio ───────────────────────────────────────
-- Una persona puede trabajar en varios negocios (una fila por negocio).
create table staff_users (
  business_id  uuid not null references businesses (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         staff_role not null default 'staff',
  display_name text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index staff_users_user_idx on staff_users (user_id);

-- ─── Regla de puntos (una por negocio) ──────────────────────────────
create table loyalty_programs (
  business_id        uuid primary key references businesses (id) on delete cascade,
  reward_type        reward_type not null default 'one_time',
  visits_required    integer not null default 10 check (visits_required between 1 and 1000),
  discount_percent   integer not null default 10 check (discount_percent between 1 and 100),
  -- Texto libre: "en tu comida", "en un plato", "en la cuenta"...
  reward_description text not null default 'en tu consumición',
  updated_at         timestamptz not null default now()
);

-- ─── Clientes ───────────────────────────────────────────────────────
create table customers (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses (id) on delete cascade,
  name                text not null check (length(name) between 1 and 80),
  email               text,
  phone               text,
  -- RGPD: consentimiento obligatorio guardado con su fecha
  privacy_accepted_at timestamptz not null,
  marketing_opt_in    boolean not null default false,
  marketing_opt_in_at timestamptz,
  created_at          timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create unique index customers_email_uniq on customers (business_id, lower(email)) where email is not null;
create unique index customers_phone_uniq on customers (business_id, phone) where phone is not null;

-- ─── Tarjetas ───────────────────────────────────────────────────────
-- El token del QR: 24 caracteres aleatorios, seguros para URL
create or replace function new_card_token() returns text
language sql volatile as $$
  select translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_')
$$;

create table cards (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses (id) on delete cascade,
  customer_id      uuid not null unique references customers (id) on delete cascade,
  -- Número de serie del pase de Apple
  serial_number    uuid not null unique default gen_random_uuid(),
  -- Lo que va dentro del QR: aleatorio y opaco (nunca el email ni el id)
  public_token     text not null unique default new_card_token(),
  visits_total     integer not null default 0 check (visits_total >= 0),
  -- Visitas que cuentan para el próximo premio (en premio de una vez)
  visits_current   integer not null default 0 check (visits_current >= 0),
  rewards_redeemed integer not null default 0 check (rewards_redeemed >= 0),
  last_visit_on    date,
  google_object_id text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index cards_business_idx on cards (business_id);


-- ─── Movimientos (visitas, canjes, ajustes) ─────────────────────────
create table transactions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses (id) on delete cascade,
  card_id          uuid not null references cards (id) on delete cascade,
  type             transaction_type not null,
  -- Fecha local del negocio (para la regla de una visita al día)
  local_date       date not null,
  discount_percent integer,
  note             text,
  -- Quién lo hizo
  staff_user_id    uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);
-- La base de datos IMPIDE dos visitas de la misma tarjeta el mismo día
create unique index transactions_one_visit_per_day
  on transactions (card_id, local_date) where type = 'visit';
create index transactions_business_idx on transactions (business_id, created_at desc);
create index transactions_card_idx on transactions (card_id, created_at desc);

-- ─── Apple Wallet: servicio web de PassKit (Fase 4) ─────────────────
create table push_tokens (
  device_library_id text primary key,
  push_token        text not null,
  updated_at        timestamptz not null default now()
);

create table apple_device_registrations (
  device_library_id text not null references push_tokens (device_library_id) on delete cascade,
  serial_number     uuid not null references cards (serial_number) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (device_library_id, serial_number)
);
create index apple_registrations_serial_idx on apple_device_registrations (serial_number);

-- ─── Registro de auditoría ──────────────────────────────────────────
create table audit_log (
  id            bigint generated always as identity primary key,
  business_id   uuid references businesses (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action        text not null,
  entity_id     uuid,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_business_idx on audit_log (business_id, created_at desc);
create index audit_log_scan_idx on audit_log (entity_id, created_at desc) where action = 'card.scan';

-- ════════════════════════════════════════════════════════════════════
--  Funciones de permisos (usadas por las políticas RLS)
-- ════════════════════════════════════════════════════════════════════
create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

create or replace function is_staff_of(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_users
    where business_id = b and user_id = auth.uid() and active
  ) or is_platform_admin()
$$;

create or replace function is_owner_of(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_users
    where business_id = b and user_id = auth.uid() and active and role = 'owner'
  ) or is_platform_admin()
$$;

-- ════════════════════════════════════════════════════════════════════
--  Row Level Security
--  Regla general: el personal LEE los datos de su negocio; las
--  visitas y canjes solo se escriben a través de las funciones de
--  abajo, que comprueban permisos y reglas.
-- ════════════════════════════════════════════════════════════════════
alter table businesses                 enable row level security;
alter table platform_admins            enable row level security;
alter table staff_users                enable row level security;
alter table loyalty_programs           enable row level security;
alter table customers                  enable row level security;
alter table cards                      enable row level security;
alter table transactions               enable row level security;
alter table push_tokens                enable row level security;  -- solo servidor
alter table apple_device_registrations enable row level security;  -- solo servidor
alter table audit_log                  enable row level security;

create policy "ver mi negocio" on businesses for select using (is_staff_of(id));
create policy "dueño edita su negocio" on businesses for update using (is_owner_of(id)) with check (is_owner_of(id));
create policy "superadmin crea negocios" on businesses for insert with check (is_platform_admin());

create policy "superadmin se ve" on platform_admins for select using (user_id = auth.uid());

create policy "ver compañeros" on staff_users for select
  using (user_id = auth.uid() or is_staff_of(business_id));
create policy "dueño gestiona personal" on staff_users for all
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));

create policy "ver regla" on loyalty_programs for select using (is_staff_of(business_id));
create policy "dueño edita regla" on loyalty_programs for update
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
create policy "superadmin crea regla" on loyalty_programs for insert with check (is_platform_admin());

create policy "ver clientes" on customers for select using (is_staff_of(business_id));
create policy "dueño borra clientes (RGPD)" on customers for delete using (is_owner_of(business_id));

create policy "ver tarjetas" on cards for select using (is_staff_of(business_id));
create policy "ver movimientos" on transactions for select using (is_staff_of(business_id));
create policy "dueño ve auditoría" on audit_log for select using (is_owner_of(business_id));

-- ════════════════════════════════════════════════════════════════════
--  Lógica de puntos
-- ════════════════════════════════════════════════════════════════════

-- Estado de una tarjeta tal y como lo ve el dependiente
create or replace function card_status(c cards, p loyalty_programs)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'card_id',            c.id,
    'visits_total',       c.visits_total,
    'visits_current',     c.visits_current,
    'visits_required',    p.visits_required,
    'reward_type',        p.reward_type,
    'discount_percent',   p.discount_percent,
    'reward_description', p.reward_description,
    'rewards_redeemed',   c.rewards_redeemed,
    'last_visit_on',      c.last_visit_on,
    -- ¿Tiene ahora mismo el descuento?
    'has_discount', case p.reward_type
        when 'one_time'  then c.visits_current >= p.visits_required
        when 'permanent' then c.visits_total   >= p.visits_required
      end,
    'visits_remaining', greatest(0, p.visits_required - case p.reward_type
        when 'one_time'  then c.visits_current
        when 'permanent' then c.visits_total
      end)
  )
$$;

-- Escanear una tarjeta: devuelve el cliente y su estado, SIN sumar nada.
-- Incluye el límite anti-trampas de escaneos por minuto.
create or replace function scan_card(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c cards; p loyalty_programs; cust customers; b businesses;
  recent integer;
begin
  select * into c from cards where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not is_staff_of(c.business_id) then
    -- No revelamos si la tarjeta existe en otro negocio
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*) into recent from audit_log
   where action = 'card.scan' and entity_id = c.id
     and created_at > now() - interval '1 minute';
  if recent >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into audit_log (business_id, actor_user_id, action, entity_id)
  values (c.business_id, auth.uid(), 'card.scan', c.id);

  select * into p from loyalty_programs where business_id = c.business_id;
  select * into cust from customers where id = c.customer_id;
  select * into b from businesses where id = c.business_id;

  return jsonb_build_object(
    'ok', true,
    'customer_name', cust.name,
    'visited_today', coalesce(c.last_visit_on = (now() at time zone b.timezone)::date, false)
  ) || card_status(c, p);
end $$;

-- Sumar una visita (máximo una por día y tarjeta)
create or replace function register_visit(p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c cards; p loyalty_programs; b businesses;
  today date;
  had_discount boolean;
begin
  select * into c from cards where id = p_card_id for update;
  if not found or not is_staff_of(c.business_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select * into b from businesses where id = c.business_id;
  select * into p from loyalty_programs where business_id = c.business_id;
  today := (now() at time zone b.timezone)::date;

  if c.last_visit_on = today then
    return jsonb_build_object('ok', false, 'error', 'already_today') || card_status(c, p);
  end if;

  had_discount := (card_status(c, p) ->> 'has_discount')::boolean;

  insert into transactions (business_id, card_id, type, local_date, staff_user_id)
  values (c.business_id, c.id, 'visit', today, auth.uid());

  update cards set
    visits_total   = visits_total + 1,
    visits_current = visits_current + 1,
    last_visit_on  = today,
    updated_at     = now()
  where id = c.id
  returning * into c;

  insert into audit_log (business_id, actor_user_id, action, entity_id)
  values (c.business_id, auth.uid(), 'card.visit', c.id);

  return jsonb_build_object(
    'ok', true,
    -- true justo en la visita en la que consigue el descuento
    'just_unlocked', not had_discount and (card_status(c, p) ->> 'has_discount')::boolean
  ) || card_status(c, p);
end $$;

-- Aplicar el descuento.
--  · Premio de una vez: se gasta y el contador vuelve a empezar
--    (si llevaba visitas de más, se conservan para el siguiente).
--  · Nivel permanente: solo se anota que se ha usado.
create or replace function redeem_reward(p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c cards; p loyalty_programs; b businesses;
begin
  select * into c from cards where id = p_card_id for update;
  if not found or not is_staff_of(c.business_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select * into p from loyalty_programs where business_id = c.business_id;
  select * into b from businesses where id = c.business_id;

  if not (card_status(c, p) ->> 'has_discount')::boolean then
    return jsonb_build_object('ok', false, 'error', 'no_reward') || card_status(c, p);
  end if;

  insert into transactions (business_id, card_id, type, local_date, discount_percent, staff_user_id)
  values (c.business_id, c.id, 'redeem', (now() at time zone b.timezone)::date,
          p.discount_percent, auth.uid());

  update cards set
    visits_current   = case when p.reward_type = 'one_time'
                            then visits_current - p.visits_required
                            else visits_current end,
    rewards_redeemed = rewards_redeemed + 1,
    updated_at       = now()
  where id = c.id
  returning * into c;

  insert into audit_log (business_id, actor_user_id, action, entity_id, details)
  values (c.business_id, auth.uid(), 'card.redeem', c.id,
          jsonb_build_object('discount_percent', p.discount_percent));

  return jsonb_build_object('ok', true, 'applied_percent', p.discount_percent) || card_status(c, p);
end $$;

-- Las funciones de puntos solo para usuarios con sesión iniciada
revoke all on function scan_card(text), register_visit(uuid), redeem_reward(uuid) from public, anon;
grant execute on function scan_card(text), register_visit(uuid), redeem_reward(uuid) to authenticated;


-- ▼▼▼ 0002_email_obligatorio.sql ▼▼▼

-- ════════════════════════════════════════════════════════════════════
--  Fase 3 · El email del cliente pasa a ser obligatorio
--  (el teléfono sigue siendo opcional).
--  Cómo aplicarlo: SQL Editor → pega este archivo → Run.
-- ════════════════════════════════════════════════════════════════════

-- Quita la regla antigua "email o teléfono"
alter table customers drop constraint if exists customers_check;

alter table customers alter column email set not null;
alter table customers add constraint customers_email_format
  check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- De dónde vino el cliente (QR del mostrador, demo...) para estadísticas
alter table customers add column if not exists source text not null default 'qr';

-- Alta de un cliente desde la página pública del negocio.
-- Crea cliente + tarjeta a la vez. Si el email ya existe en ese negocio,
-- NO crea otra: devuelve status 'exists' y el servidor decide qué mostrar.
-- Solo la llama el servidor (clave secreta), nunca el navegador.
create or replace function register_customer(
  p_slug text, p_name text, p_email text, p_phone text, p_marketing boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b businesses; cust customers; c cards;
begin
  select * into b from businesses where slug = p_slug and active;
  if not found then
    return jsonb_build_object('status', 'no_business');
  end if;

  select * into cust from customers
   where business_id = b.id and lower(email) = lower(trim(p_email));
  if found then
    select * into c from cards where customer_id = cust.id;
    return jsonb_build_object('status', 'exists', 'token', c.public_token);
  end if;

  insert into customers (business_id, name, email, phone, privacy_accepted_at,
                         marketing_opt_in, marketing_opt_in_at)
  values (b.id, trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), now(),
          p_marketing, case when p_marketing then now() end)
  returning * into cust;

  insert into cards (business_id, customer_id) values (b.id, cust.id)
  returning * into c;

  insert into audit_log (business_id, action, entity_id, details)
  values (b.id, 'customer.signup', cust.id, jsonb_build_object('marketing', p_marketing));

  return jsonb_build_object('status', 'created', 'token', c.public_token);
exception when unique_violation then
  -- Dos altas simultáneas con el mismo email: tratamos como existente
  return jsonb_build_object('status', 'exists', 'token',
    (select k.public_token from cards k join customers u on u.id = k.customer_id
      where u.business_id = b.id and lower(u.email) = lower(trim(p_email))));
end $$;

revoke all on function register_customer(text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function register_customer(text, text, text, text, boolean) to service_role;

-- Email de contacto del negocio (sale en la política de privacidad, para
-- que el cliente pueda pedir que borren sus datos)
alter table businesses add column if not exists contact_email text;
alter table businesses add column if not exists legal_name text;


-- ▼▼▼ 0003_escanear_y_sumar.sql ▼▼▼

-- ════════════════════════════════════════════════════════════════════
--  Fase 5 · Escanear = sumar visita
--  El camarero escanea la tarjeta y la visita se apunta sola (si no ha
--  venido ya hoy). Devuelve todo lo que la app necesita para mostrar.
--  Cómo aplicarlo: SQL Editor → pega este archivo → Run.
-- ════════════════════════════════════════════════════════════════════
create or replace function scan_and_visit(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c cards; b businesses; cust customers;
  scan jsonb; visit jsonb;
begin
  scan := scan_card(p_token);          -- comprueba permisos y límite por minuto
  if not (scan ->> 'ok')::boolean then
    return scan;
  end if;

  select * into c from cards where id = (scan ->> 'card_id')::uuid;
  select * into b from businesses where id = c.business_id;
  select * into cust from customers where id = c.customer_id;

  if (scan ->> 'visited_today')::boolean then
    return scan || jsonb_build_object(
      'business_name', b.name, 'visit_added', false, 'just_unlocked', false);
  end if;

  visit := register_visit(c.id);
  return visit || jsonb_build_object(
    'ok', true,
    'customer_name', cust.name,
    'business_name', b.name,
    'visited_today', true,
    'visit_added', (visit ->> 'ok')::boolean);
end $$;

revoke all on function scan_and_visit(text) from public, anon;
grant execute on function scan_and_visit(text) to authenticated;


-- ▼▼▼ 0004_suscripciones_y_bloqueo.sql ▼▼▼

-- ════════════════════════════════════════════════════════════════════
--  Suscripciones y bloqueo por impago
--
--  Cada negocio tiene un estado de suscripción. Si no está al día:
--    · el personal NO puede escanear, sumar visitas ni aplicar descuentos
--    · NO se pueden dar de alta clientes nuevos
--    · las tarjetas de los clientes siguen en su Wallet (no se pierde nada)
--  Al pagar, se desbloquea al instante.
--
--  Estados: trial (prueba gratis) · active (al día) · past_due (pago
--  fallido, dentro del margen) · blocked (bloqueado a mano) · cancelled.
--
--  Cómo aplicarlo: SQL Editor → pega este archivo → Run.
-- ════════════════════════════════════════════════════════════════════

create type subscription_status as enum ('trial', 'active', 'past_due', 'blocked', 'cancelled');

alter table businesses
  add column subscription_status subscription_status not null default 'trial',
  add column trial_ends_at  timestamptz not null default now() + interval '30 days',
  -- Hasta cuándo está pagado (null en 'active' = sin fecha, p. ej. alta manual)
  add column paid_until     timestamptz,
  -- Días de margen tras vencer el pago antes de cortar el servicio
  add column grace_days     integer not null default 7 check (grace_days between 0 and 60),
  add column monthly_price_cents integer,
  add column stripe_customer_id     text unique,
  add column stripe_subscription_id text unique;

-- Hasta cuándo funciona el servicio de un negocio
create or replace function service_until(b businesses) returns timestamptz
language sql stable as $$
  select case
    when not b.active then '-infinity'::timestamptz
    when b.is_demo then 'infinity'::timestamptz
    when b.subscription_status = 'trial' then b.trial_ends_at
    when b.subscription_status in ('active', 'past_due') then
      coalesce(b.paid_until + make_interval(days => b.grace_days), 'infinity'::timestamptz)
    else '-infinity'::timestamptz
  end
$$;

create or replace function service_ok(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select now() < service_until(b) from businesses b where b.id = p_business), false)
$$;

-- Nadie salvo vosotros (superadmin o el servidor) puede tocar la suscripción.
-- Así un dueño no puede ponerse "al día" él solo.
-- (Sin "security definer" a propósito: así ve el rol real de quien intenta el cambio)
create or replace function protect_subscription() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not is_platform_admin() and (
       new.subscription_status   is distinct from old.subscription_status
    or new.trial_ends_at         is distinct from old.trial_ends_at
    or new.paid_until            is distinct from old.paid_until
    or new.grace_days            is distinct from old.grace_days
    or new.monthly_price_cents   is distinct from old.monthly_price_cents
    or new.stripe_customer_id    is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.active                is distinct from old.active
    or new.is_demo               is distinct from old.is_demo
  ) then
    raise exception 'Solo la plataforma puede cambiar la suscripción del negocio';
  end if;
  return new;
end $$;

create trigger businesses_protect_subscription
  before update on businesses
  for each row execute function protect_subscription();

-- Acciones del superadmin desde su panel
create or replace function admin_subscription(p_business uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b businesses;
begin
  if not is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select * into b from businesses where id = p_business for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  case p_action
    when 'pay_month' then   -- ha pagado un mes (se suma a lo que ya tuviera)
      update businesses set subscription_status = 'active',
        paid_until = greatest(coalesce(paid_until, now()), now()) + interval '1 month'
      where id = b.id;
    when 'extend_trial' then
      update businesses set subscription_status = 'trial',
        trial_ends_at = greatest(trial_ends_at, now()) + interval '14 days'
      where id = b.id;
    when 'block' then
      update businesses set subscription_status = 'blocked' where id = b.id;
    when 'unblock' then     -- reactiva sin fecha de fin (hasta que se decida)
      update businesses set subscription_status = 'active', paid_until = null where id = b.id;
    else
      return jsonb_build_object('ok', false, 'error', 'bad_action');
  end case;

  insert into audit_log (business_id, actor_user_id, action, details)
  values (b.id, auth.uid(), 'subscription.' || p_action, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function admin_subscription(uuid, text) from public, anon;
grant execute on function admin_subscription(uuid, text) to authenticated;

-- Estado de la suscripción para mostrar avisos en el panel
create or replace function my_business_service(p_business uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_staff_of(p_business) then (
    select jsonb_build_object(
      'status', b.subscription_status,
      'service_ok', now() < service_until(b),
      'service_until', service_until(b),
      'trial_ends_at', b.trial_ends_at,
      'paid_until', b.paid_until,
      'is_demo', b.is_demo)
    from businesses b where b.id = p_business)
  end
$$;

-- ─── Las funciones de puntos y de alta ahora comprueban el pago ─────
create or replace function scan_card(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c cards; p loyalty_programs; cust customers; b businesses;
  recent integer;
begin
  select * into c from cards where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not is_staff_of(c.business_id) then
    -- No revelamos si la tarjeta existe en otro negocio
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not service_ok(c.business_id) then
    return jsonb_build_object('ok', false, 'error', 'suspended');
  end if;

  select count(*) into recent from audit_log
   where action = 'card.scan' and entity_id = c.id
     and created_at > now() - interval '1 minute';
  if recent >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into audit_log (business_id, actor_user_id, action, entity_id)
  values (c.business_id, auth.uid(), 'card.scan', c.id);

  select * into p from loyalty_programs where business_id = c.business_id;
  select * into cust from customers where id = c.customer_id;
  select * into b from businesses where id = c.business_id;

  return jsonb_build_object(
    'ok', true,
    'customer_name', cust.name,
    'visited_today', coalesce(c.last_visit_on = (now() at time zone b.timezone)::date, false)
  ) || card_status(c, p);
end $$;

create or replace function register_visit(p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c cards; p loyalty_programs; b businesses;
  today date;
  had_discount boolean;
begin
  select * into c from cards where id = p_card_id for update;
  if not found or not is_staff_of(c.business_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not service_ok(c.business_id) then
    return jsonb_build_object('ok', false, 'error', 'suspended');
  end if;
  select * into b from businesses where id = c.business_id;
  select * into p from loyalty_programs where business_id = c.business_id;
  today := (now() at time zone b.timezone)::date;

  if c.last_visit_on = today then
    return jsonb_build_object('ok', false, 'error', 'already_today') || card_status(c, p);
  end if;

  had_discount := (card_status(c, p) ->> 'has_discount')::boolean;

  insert into transactions (business_id, card_id, type, local_date, staff_user_id)
  values (c.business_id, c.id, 'visit', today, auth.uid());

  update cards set
    visits_total   = visits_total + 1,
    visits_current = visits_current + 1,
    last_visit_on  = today,
    updated_at     = now()
  where id = c.id
  returning * into c;

  insert into audit_log (business_id, actor_user_id, action, entity_id)
  values (c.business_id, auth.uid(), 'card.visit', c.id);

  return jsonb_build_object(
    'ok', true,
    -- true justo en la visita en la que consigue el descuento
    'just_unlocked', not had_discount and (card_status(c, p) ->> 'has_discount')::boolean
  ) || card_status(c, p);
end $$;

create or replace function redeem_reward(p_card_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c cards; p loyalty_programs; b businesses;
begin
  select * into c from cards where id = p_card_id for update;
  if not found or not is_staff_of(c.business_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not service_ok(c.business_id) then
    return jsonb_build_object('ok', false, 'error', 'suspended');
  end if;
  select * into p from loyalty_programs where business_id = c.business_id;
  select * into b from businesses where id = c.business_id;

  if not (card_status(c, p) ->> 'has_discount')::boolean then
    return jsonb_build_object('ok', false, 'error', 'no_reward') || card_status(c, p);
  end if;

  insert into transactions (business_id, card_id, type, local_date, discount_percent, staff_user_id)
  values (c.business_id, c.id, 'redeem', (now() at time zone b.timezone)::date,
          p.discount_percent, auth.uid());

  update cards set
    visits_current   = case when p.reward_type = 'one_time'
                            then visits_current - p.visits_required
                            else visits_current end,
    rewards_redeemed = rewards_redeemed + 1,
    updated_at       = now()
  where id = c.id
  returning * into c;

  insert into audit_log (business_id, actor_user_id, action, entity_id, details)
  values (c.business_id, auth.uid(), 'card.redeem', c.id,
          jsonb_build_object('discount_percent', p.discount_percent));

  return jsonb_build_object('ok', true, 'applied_percent', p.discount_percent) || card_status(c, p);
end $$;

create or replace function register_customer(
  p_slug text, p_name text, p_email text, p_phone text, p_marketing boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b businesses; cust customers; c cards;
begin
  select * into b from businesses where slug = p_slug and active;
  if not found then
    return jsonb_build_object('status', 'no_business');
  end if;
  if not service_ok(b.id) then
    return jsonb_build_object('status', 'suspended');
  end if;

  select * into cust from customers
   where business_id = b.id and lower(email) = lower(trim(p_email));
  if found then
    select * into c from cards where customer_id = cust.id;
    return jsonb_build_object('status', 'exists', 'token', c.public_token);
  end if;

  insert into customers (business_id, name, email, phone, privacy_accepted_at,
                         marketing_opt_in, marketing_opt_in_at)
  values (b.id, trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''), now(),
          p_marketing, case when p_marketing then now() end)
  returning * into cust;

  insert into cards (business_id, customer_id) values (b.id, cust.id)
  returning * into c;

  insert into audit_log (business_id, action, entity_id, details)
  values (b.id, 'customer.signup', cust.id, jsonb_build_object('marketing', p_marketing));

  return jsonb_build_object('status', 'created', 'token', c.public_token);
exception when unique_violation then
  -- Dos altas simultáneas con el mismo email: tratamos como existente
  return jsonb_build_object('status', 'exists', 'token',
    (select k.public_token from cards k join customers u on u.id = k.customer_id
      where u.business_id = b.id and lower(u.email) = lower(trim(p_email))));
end $$;

-- El negocio de demostración no caduca nunca
update businesses set subscription_status = 'active' where is_demo;
