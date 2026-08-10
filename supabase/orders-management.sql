-- Indumentaria Fit: pedidos por encargo con precios congelados.
-- Los pedidos no descuentan stock.

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null,
  customer_phone text not null,
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'ordered' check (status in ('ordered', 'ready', 'delivered', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.variants(id),
  product_name text not null,
  variant_label text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0)
);

alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;
drop policy if exists internal_read on public.customer_orders;
drop policy if exists internal_read on public.customer_order_items;
create policy internal_read on public.customer_orders for select to authenticated using (public.current_app_role() is not null);
create policy internal_read on public.customer_order_items for select to authenticated using (public.current_app_role() is not null);

create or replace function public.create_customer_order(
  p_customer_name text,
  p_customer_phone text,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order public.customer_orders%rowtype;
  line record;
  product_row public.products%rowtype;
  variant_text text;
  calculated_total numeric(12,2) := 0;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if public.current_app_role() not in ('admin', 'manager', 'seller') then raise exception 'No tiene permiso para crear pedidos'; end if;
  if nullif(trim(p_customer_name), '') is null or nullif(trim(p_customer_phone), '') is null then
    raise exception 'Completá el nombre y el teléfono';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Agregá al menos un producto'; end if;

  insert into public.customer_orders(customer_name, customer_phone, created_by)
  values (trim(p_customer_name), trim(p_customer_phone), auth.uid())
  returning * into new_order;

  for line in select * from jsonb_to_recordset(p_lines) as x(product_id uuid, variant_id uuid, quantity integer)
  loop
    if line.quantity is null or line.quantity <= 0 then raise exception 'Cantidad inválida'; end if;
    select * into product_row from public.products where id = line.product_id and active = true;
    if not found then raise exception 'Producto no encontrado'; end if;
    variant_text := '';
    if line.variant_id is not null then
      select c.name || ' · Talle ' || s.name into variant_text
      from public.variants v join public.colors c on c.id = v.color_id join public.sizes s on s.id = v.size_id
      where v.id = line.variant_id and v.product_id = line.product_id and v.active = true;
      if variant_text is null then raise exception 'Variante no encontrada'; end if;
    end if;
    insert into public.customer_order_items(order_id, product_id, variant_id, product_name, variant_label, quantity, unit_price, subtotal)
    values (new_order.id, product_row.id, line.variant_id, product_row.name, variant_text, line.quantity, product_row.price, line.quantity * product_row.price);
    calculated_total := calculated_total + line.quantity * product_row.price;
  end loop;

  update public.customer_orders set total = calculated_total where id = new_order.id;
  return jsonb_build_object('id', new_order.id, 'order_number', new_order.order_number);
end;
$$;

revoke all on function public.create_customer_order(text, text, jsonb) from public, anon;
grant execute on function public.create_customer_order(text, text, jsonb) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.customer_orders;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.customer_order_items;
exception when duplicate_object then null;
end $$;
