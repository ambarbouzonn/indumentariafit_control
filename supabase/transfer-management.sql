-- Indumentaria Fit: transferencias seguras entre ubicaciones.
-- Ejecutar en Supabase > SQL Editor después de setup.sql.

create or replace function public.transfer_inventory(
  p_source_stock_id uuid,
  p_destination_location_id uuid,
  p_quantity integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.stock_by_location%rowtype;
  destination_stock_id uuid;
  transfer_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if public.current_app_role() not in ('admin', 'manager') then
    raise exception 'No tiene permiso para transferir mercadería';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Cantidad inválida'; end if;

  select * into source_row from public.stock_by_location where id = p_source_stock_id;
  if not found then raise exception 'Stock de origen no encontrado'; end if;
  if source_row.location_id = p_destination_location_id then raise exception 'El origen y el destino deben ser diferentes'; end if;
  if source_row.on_hand - source_row.reserved < p_quantity then raise exception 'Stock disponible insuficiente'; end if;
  if not exists (select 1 from public.locations where id = p_destination_location_id and active = true) then
    raise exception 'Ubicación de destino no encontrada';
  end if;

  insert into public.stock_by_location(variant_id, location_id, on_hand, reserved)
  values (source_row.variant_id, p_destination_location_id, 0, 0)
  on conflict (variant_id, location_id) do update set updated_at = public.stock_by_location.updated_at
  returning id into destination_stock_id;

  perform 1 from public.stock_by_location
  where id in (p_source_stock_id, destination_stock_id)
  order by id for update;
  select * into source_row from public.stock_by_location where id = p_source_stock_id;
  if source_row.on_hand - source_row.reserved < p_quantity then raise exception 'Stock disponible insuficiente'; end if;
  update public.stock_by_location set on_hand = on_hand - p_quantity, updated_at = now() where id = p_source_stock_id;
  update public.stock_by_location set on_hand = on_hand + p_quantity, updated_at = now() where id = destination_stock_id;

  insert into public.inventory_movements(variant_id, location_id, movement_type, quantity, reason, reference_type, reference_id, user_id)
  values
    (source_row.variant_id, source_row.location_id, 'transfer_out', -p_quantity, 'Transferencia de salida', 'transfer', transfer_id, auth.uid()),
    (source_row.variant_id, p_destination_location_id, 'transfer_in', p_quantity, 'Transferencia de entrada', 'transfer', transfer_id, auth.uid());
  return transfer_id;
end;
$$;

revoke all on function public.transfer_inventory(uuid, uuid, integer) from public, anon;
grant execute on function public.transfer_inventory(uuid, uuid, integer) to authenticated;
