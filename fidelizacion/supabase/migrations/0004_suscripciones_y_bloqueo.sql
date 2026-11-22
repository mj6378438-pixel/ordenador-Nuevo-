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
