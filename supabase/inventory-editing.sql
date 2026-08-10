-- Indumentaria Fit: corrección manual de stock y eliminación completa del stock activo.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create or replace function public.adjust_inventory_stock(p_lines jsonb, p_reason text default 'Corrección manual de stock')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  line record;
  stock_row public.stock_by_location%rowtype;
  difference integer;
  changed_rows integer := 0;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if public.current_app_role() not in ('admin', 'manager') then
    raise exception 'No tiene permiso para editar el stock';
  end if;

  for line in select * from jsonb_to_recordset(p_lines) as x(stock_id uuid, new_quantity integer) order by stock_id
  loop
    if line.new_quantity < 0 then raise exception 'El stock no puede ser negativo'; end if;
    select * into stock_row from public.stock_by_location where id = line.stock_id for update;
    if not found then raise exception 'Stock no encontrado'; end if;
    if line.new_quantity < stock_row.reserved then
      raise exception 'No se puede dejar menos stock que las unidades reservadas';
    end if;
    difference := line.new_quantity - stock_row.on_hand;
    if difference = 0 then continue; end if;
    update public.stock_by_location set on_hand = line.new_quantity, updated_at = now() where id = line.stock_id;
    insert into public.inventory_movements(variant_id, location_id, movement_type, quantity, reason, reference_type, user_id)
    values (stock_row.variant_id, stock_row.location_id, 'adjustment', difference, nullif(trim(p_reason), ''), 'stock_adjustment', auth.uid());
    changed_rows := changed_rows + 1;
  end loop;
  return changed_rows;
end;
$$;

create or replace function public.archive_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare stock_row record;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if public.current_app_role() not in ('admin', 'manager') then
    raise exception 'No tiene permiso para eliminar productos';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and active = true) then
    raise exception 'Producto no encontrado';
  end if;

  update public.reservations r set status = 'cancelled', updated_at = now()
  where r.status = 'active' and exists (
    select 1 from public.reservation_items ri
    join public.stock_by_location s on s.id = ri.stock_id
    join public.variants v on v.id = s.variant_id
    where ri.reservation_id = r.id and v.product_id = p_product_id
  );

  for stock_row in
    select s.* from public.stock_by_location s
    join public.variants v on v.id = s.variant_id
    where v.product_id = p_product_id
    order by s.id for update of s
  loop
    if stock_row.on_hand > 0 then
      insert into public.inventory_movements(variant_id, location_id, movement_type, quantity, reason, reference_type, reference_id, user_id)
      values (stock_row.variant_id, stock_row.location_id, 'product_deleted', -stock_row.on_hand, 'Producto eliminado', 'product', p_product_id, auth.uid());
    end if;
    update public.stock_by_location set on_hand = 0, reserved = 0, updated_at = now() where id = stock_row.id;
  end loop;

  update public.products set active = false, updated_at = now() where id = p_product_id;
  update public.variants set active = false where product_id = p_product_id;
end;
$$;

revoke all on function public.adjust_inventory_stock(jsonb, text) from public, anon;
revoke all on function public.archive_product(uuid) from public, anon;
grant execute on function public.adjust_inventory_stock(jsonb, text) to authenticated;
grant execute on function public.archive_product(uuid) to authenticated;
