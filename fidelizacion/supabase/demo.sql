-- ════════════════════════════════════════════════════════════════════
--  Datos de demostración + vuestra cuenta de superadmin
--
--  ANTES: crea tu usuario en Supabase → Authentication → Users →
--         Add user → Create new user (marca "Auto Confirm User").
--  LUEGO: cambia el email de la línea de abajo por el tuyo, pega todo
--         en SQL Editor y pulsa Run. Se puede ejecutar varias veces.
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  admin_email constant text := 'TU_EMAIL@ejemplo.com';   -- ← CAMBIA ESTO

  uid  uuid;
  biz  uuid;
  cust uuid;
  card uuid;
  d    record;
begin
  select id into uid from auth.users where lower(email) = lower(admin_email);
  if uid is null then
    raise exception 'No existe ningún usuario con el email %. Créalo primero en Authentication → Users.', admin_email;
  end if;

  -- 1. Tú eres superadmin de la plataforma
  insert into platform_admins (user_id) values (uid) on conflict do nothing;

  -- 2. Negocio de demostración
  insert into businesses (slug, name, bg_color, fg_color, label_color, is_demo)
  values ('cafe-la-esquina', 'Café La Esquina', '#3b2a20', '#f7efe6', '#d9c7b3', true)
  on conflict (slug) do update set name = excluded.name
  returning id into biz;

  insert into loyalty_programs (business_id, reward_type, visits_required, discount_percent, reward_description)
  values (biz, 'one_time', 10, 10, 'en tu comida')
  on conflict (business_id) do nothing;

  -- 3. Tú eres el dueño del negocio de demostración
  insert into staff_users (business_id, user_id, role, display_name)
  values (biz, uid, 'owner', 'Admin')
  on conflict (business_id, user_id) do update set role = 'owner', active = true;

  -- 4. Clientes de ejemplo (solo la primera vez)
  if exists (select 1 from customers where business_id = biz) then
    raise notice 'El negocio de demostración ya tenía clientes: no se añaden más.';
    return;
  end if;

  for d in
    select * from (values
      ('Lucía Martín',   'lucia@example.com',  7, 0),
      ('Marcos Gil',     'marcos@example.com', 10, 0),
      ('Ana Torres',     'ana@example.com',    2, 0),
      ('Javier Romero',  'javier@example.com', 23, 2),
      ('Carmen Ruiz',    'carmen@example.com', 0, 0)
    ) as t(name, email, visits, redeemed)
  loop
    insert into customers (business_id, name, email, privacy_accepted_at, marketing_opt_in, marketing_opt_in_at)
    values (biz, d.name, d.email, now() - interval '60 days', true, now() - interval '60 days')
    returning id into cust;

    insert into cards (business_id, customer_id, visits_total, visits_current, rewards_redeemed, last_visit_on)
    values (biz, cust, d.visits, d.visits - d.redeemed * 10, d.redeemed,
            case when d.visits > 0 then current_date - 1 end)
    returning id into card;

    -- Historial: una visita cada 2 días hacia atrás
    insert into transactions (business_id, card_id, type, local_date, created_at)
    select biz, card, 'visit', current_date - 1 - (g * 2), now() - make_interval(days => 1 + g * 2)
    from generate_series(0, d.visits - 1) g;

    insert into transactions (business_id, card_id, type, local_date, discount_percent, created_at)
    select biz, card, 'redeem', current_date - 1 - (g * 20), 10, now() - make_interval(days => 1 + g * 20)
    from generate_series(0, d.redeemed - 1) g;
  end loop;

  raise notice 'Listo: negocio de demostración "Café La Esquina" creado con 5 clientes.';
end $$;
