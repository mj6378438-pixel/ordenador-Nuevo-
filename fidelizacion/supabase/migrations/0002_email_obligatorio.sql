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
