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
