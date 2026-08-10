-- Indumentaria Fit: consolidar ubicaciones y permitir archivar productos.
-- Ejecutar una vez en Supabase > SQL Editor.

do $$
declare
  old_location_id uuid;
  deposit_location_id uuid;
  stock_row record;
begin
  select id into old_location_id from public.locations where name = 'Local Centro';
  select id into deposit_location_id from public.locations where name = 'Depósito';
  if old_location_id is null or deposit_location_id is null then return; end if;

  -- Las reservas abiertas de la ubicación anterior se cancelan y liberan antes de consolidar.
  update public.reservations r set status = 'cancelled', updated_at = now()
  where r.status = 'active' and exists (
    select 1 from public.reservation_items ri
    join public.stock_by_location s on s.id = ri.stock_id
    where ri.reservation_id = r.id and s.location_id = old_location_id
  );

  for stock_row in select * from public.stock_by_location where location_id = old_location_id for update
  loop
    insert into public.stock_by_location(variant_id, location_id, on_hand, reserved)
    values (stock_row.variant_id, deposit_location_id, stock_row.on_hand, 0)
    on conflict (variant_id, location_id) do update
      set on_hand = public.stock_by_location.on_hand + excluded.on_hand,
          updated_at = now();
    update public.stock_by_location set on_hand = 0, reserved = 0, updated_at = now() where id = stock_row.id;
  end loop;
  update public.locations set active = false where id = old_location_id;
end $$;

create or replace function public.archive_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if public.current_app_role() not in ('admin', 'manager') then
    raise exception 'No tiene permiso para eliminar productos';
  end if;
  if exists (
    select 1 from public.stock_by_location s
    join public.variants v on v.id = s.variant_id
    where v.product_id = p_product_id and (s.on_hand > 0 or s.reserved > 0)
  ) then
    raise exception 'El producto todavía tiene stock o reservas';
  end if;
  update public.products set active = false, updated_at = now() where id = p_product_id;
  if not found then raise exception 'Producto no encontrado'; end if;
  update public.variants set active = false where product_id = p_product_id;
end;
$$;

revoke all on function public.archive_product(uuid) from public, anon;
grant execute on function public.archive_product(uuid) to authenticated;
