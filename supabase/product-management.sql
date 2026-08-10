-- Indumentaria Fit: alta y edición segura de productos.
-- Ejecutar en Supabase > SQL Editor después de setup.sql.

create or replace function public.save_product(
  p_product_id uuid,
  p_name text,
  p_code text,
  p_category text,
  p_price numeric,
  p_colors text[],
  p_sizes text[]
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_category_id uuid;
  v_color_id uuid;
  v_size_id uuid;
  v_variant_id uuid;
  color_name text;
  size_name text;
  size_position integer := 0;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if public.current_app_role() not in ('admin', 'manager') then
    raise exception 'No tiene permiso para modificar productos';
  end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_code), '') is null or nullif(trim(p_category), '') is null then
    raise exception 'Completá nombre, código y categoría';
  end if;
  if p_price < 0 then raise exception 'El precio no puede ser negativo'; end if;
  if coalesce(array_length(p_colors, 1), 0) = 0 or coalesce(array_length(p_sizes, 1), 0) = 0 then
    raise exception 'Ingresá al menos un color y un talle';
  end if;

  insert into public.categories(name, active)
  values (trim(p_category), true)
  on conflict (name) do update set active = true
  returning id into v_category_id;

  if p_product_id is null then
    insert into public.products(category_id, code, name, price)
    values (v_category_id, upper(trim(p_code)), trim(p_name), p_price)
    returning id into v_product_id;
  else
    update public.products
    set category_id = v_category_id, code = upper(trim(p_code)), name = trim(p_name),
        price = p_price, updated_at = now()
    where id = p_product_id
    returning id into v_product_id;
    if v_product_id is null then raise exception 'Producto no encontrado'; end if;
  end if;

  foreach color_name in array p_colors loop
    color_name := trim(color_name);
    if color_name = '' then continue; end if;
    insert into public.colors(name, active) values (color_name, true)
    on conflict (name) do update set active = true
    returning id into v_color_id;

    size_position := 0;
    foreach size_name in array p_sizes loop
      size_name := trim(size_name);
      if size_name = '' then continue; end if;
      size_position := size_position + 1;
      insert into public.sizes(name, display_order, active) values (size_name, size_position, true)
      on conflict (name) do update set active = true
      returning id into v_size_id;

      insert into public.variants(product_id, color_id, size_id, active)
      values (v_product_id, v_color_id, v_size_id, true)
      on conflict (product_id, color_id, size_id) do update set active = true
      returning id into v_variant_id;

      insert into public.stock_by_location(variant_id, location_id, on_hand, reserved)
      select v_variant_id, id, 0, 0 from public.locations where active = true
      on conflict (variant_id, location_id) do nothing;
    end loop;
  end loop;
  return v_product_id;
end;
$$;

revoke all on function public.save_product(uuid, text, text, text, numeric, text[], text[]) from public, anon;
grant execute on function public.save_product(uuid, text, text, text, numeric, text[], text[]) to authenticated;
