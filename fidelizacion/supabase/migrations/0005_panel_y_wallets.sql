-- ════════════════════════════════════════════════════════════════════
--  Panel del dueño, alta de bares y actualizaciones de los Wallet
--  Cómo aplicarlo: SQL Editor → pega este archivo → Run.
-- ════════════════════════════════════════════════════════════════════

-- ─── Cuota de alta (pago inicial) ───────────────────────────────────
alter table businesses add column if not exists setup_fee_cents integer;

-- La cuota de alta también la protege el bloqueo de suscripción
create or replace function protect_subscription() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not is_platform_admin() and (
       new.subscription_status    is distinct from old.subscription_status
    or new.trial_ends_at          is distinct from old.trial_ends_at
    or new.paid_until             is distinct from old.paid_until
    or new.grace_days             is distinct from old.grace_days
    or new.monthly_price_cents    is distinct from old.monthly_price_cents
    or new.setup_fee_cents        is distinct from old.setup_fee_cents
    or new.stripe_customer_id     is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.active                 is distinct from old.active
    or new.is_demo                is distinct from old.is_demo
    or new.slug                   is distinct from old.slug
  ) then
    raise exception 'Solo la plataforma puede cambiar la suscripción del negocio';
  end if;
  return new;
end $$;

-- ─── Al cambiar el diseño, la regla o la promoción, todas las
--     tarjetas del negocio pasan a "actualizadas" (Apple las recarga) ─
create or replace function touch_business_cards() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update cards set updated_at = now() where business_id = new.business_id;
  return new;
end $$;

create or replace function touch_cards_on_business() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.name, new.logo_url, new.bg_color, new.fg_color, new.label_color, new.promo_message)
     is distinct from
     (old.name, old.logo_url, old.bg_color, old.fg_color, old.label_color, old.promo_message) then
    update cards set updated_at = now() where business_id = new.id;
  end if;
  return new;
end $$;

create trigger businesses_touch_cards after update on businesses
  for each row execute function touch_cards_on_business();
create trigger programs_touch_cards after update on loyalty_programs
  for each row execute function touch_business_cards();

-- ─── Logos de los negocios (Supabase Storage, lectura pública) ──────
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
    on conflict (id) do nothing;
  end if;
end $$;

-- ─── Estadísticas para el panel del dueño ───────────────────────────
create or replace function owner_stats(p_business uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b businesses; today date;
begin
  if not is_owner_of(p_business) then
    return null;
  end if;
  select * into b from businesses where id = p_business;
  today := (now() at time zone b.timezone)::date;

  return jsonb_build_object(
    'customers_total',  (select count(*) from customers where business_id = p_business),
    'customers_30d',    (select count(*) from customers where business_id = p_business
                           and created_at > now() - interval '30 days'),
    'marketing_optin',  (select count(*) from customers where business_id = p_business and marketing_opt_in),
    'visits_today',     (select count(*) from transactions where business_id = p_business
                           and type = 'visit' and local_date = today),
    'visits_30d',       (select count(*) from transactions where business_id = p_business
                           and type = 'visit' and local_date > today - 30),
    'redeems_30d',      (select count(*) from transactions where business_id = p_business
                           and type = 'redeem' and local_date > today - 30),
    'redeems_total',    (select count(*) from transactions where business_id = p_business and type = 'redeem'),
    'with_discount',    (select count(*) from cards c join loyalty_programs p using (business_id)
                           where c.business_id = p_business and
                           case p.reward_type when 'one_time' then c.visits_current else c.visits_total end
                           >= p.visits_required),
    -- Visitas por día, últimos 30 días (para el gráfico)
    'visits_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d), '[]'::jsonb)
      from (
        select g::date d, (select count(*) from transactions t
                            where t.business_id = p_business and t.type = 'visit' and t.local_date = g::date) n
        from generate_series(today - 29, today, interval '1 day') g
      ) x)
  );
end $$;
revoke all on function owner_stats(uuid) from public, anon;
grant execute on function owner_stats(uuid) to authenticated;

-- ─── Alta de un bar desde el panel de superadmin ────────────────────
-- (el usuario del dueño lo crea antes el servidor en Supabase Auth)
create or replace function admin_create_business(
  p_name text, p_slug text, p_owner uuid, p_owner_name text,
  p_trial_days integer, p_monthly_price_cents integer, p_setup_fee_cents integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare biz uuid;
begin
  if not is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if exists (select 1 from businesses where slug = p_slug) then
    return jsonb_build_object('ok', false, 'error', 'slug_taken');
  end if;

  insert into businesses (name, slug, trial_ends_at, monthly_price_cents, setup_fee_cents, subscription_status)
  values (trim(p_name), p_slug, now() + make_interval(days => greatest(p_trial_days, 0)),
          p_monthly_price_cents, p_setup_fee_cents, 'trial')
  returning id into biz;

  insert into loyalty_programs (business_id) values (biz);
  insert into staff_users (business_id, user_id, role, display_name)
  values (biz, p_owner, 'owner', trim(p_owner_name))
  on conflict (business_id, user_id) do update set role = 'owner', active = true;

  insert into audit_log (business_id, actor_user_id, action, details)
  values (biz, auth.uid(), 'business.create', jsonb_build_object('slug', p_slug));
  return jsonb_build_object('ok', true, 'business_id', biz);
end $$;
revoke all on function admin_create_business(text, text, uuid, text, integer, integer, integer) from public, anon;
grant execute on function admin_create_business(text, text, uuid, text, integer, integer, integer) to authenticated;

-- ─── Solo para el servidor (clave secreta) ──────────────────────────

-- Buscar un usuario por email (para dar de alta dueños y personal)
create or replace function user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
revoke all on function user_id_by_email(text) from public, anon, authenticated;
grant execute on function user_id_by_email(text) to service_role;

-- Apple Wallet: pases de un dispositivo que han cambiado desde una fecha
create or replace function apple_updated_serials(p_device text, p_since timestamptz)
returns table (serial_number uuid, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.serial_number, c.updated_at
  from apple_device_registrations r join cards c on c.serial_number = r.serial_number
  where r.device_library_id = p_device
    and (p_since is null or c.updated_at > p_since)
$$;
revoke all on function apple_updated_serials(text, timestamptz) from public, anon, authenticated;
grant execute on function apple_updated_serials(text, timestamptz) to service_role;
