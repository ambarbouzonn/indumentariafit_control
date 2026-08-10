-- Indumentaria Fit: esquema inicial seguro para Supabase.
-- Ejecutar una sola vez desde Supabase > SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'manager', 'seller', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reservation_status as enum ('active', 'converted', 'cancelled', 'expired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.sale_status as enum ('confirmed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'seller',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  code text not null unique,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hex text,
  active boolean not null default true
);

create table if not exists public.sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  color_id uuid not null references public.colors(id),
  size_id uuid not null references public.sizes(id),
  sku text unique,
  active boolean not null default true,
  unique (product_id, color_id, size_id)
);

create table if not exists public.stock_by_location (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id),
  location_id uuid not null references public.locations(id),
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now(),
  unique (variant_id, location_id)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  status public.reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  stock_id uuid not null references public.stock_by_location(id),
  quantity integer not null check (quantity > 0),
  unique (reservation_id, stock_id)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number bigint generated always as identity unique,
  customer_name text,
  payment_method text not null,
  total numeric(12,2) not null default 0,
  status public.sale_status not null default 'confirmed',
  seller_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  variant_id uuid not null references public.variants(id),
  location_id uuid not null references public.locations(id),
  product_name text not null,
  color_name text not null,
  size_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id),
  location_id uuid not null references public.locations(id),
  movement_type text not null,
  quantity integer not null check (quantity <> 0),
  reason text,
  reference_type text,
  reference_id uuid,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists stock_variant_location_idx on public.stock_by_location(variant_id, location_id);
create index if not exists movements_created_at_idx on public.inventory_movements(created_at desc);
create index if not exists reservations_status_expiry_idx on public.reservations(status, expires_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  assigned_role public.app_role;
begin
  select case when exists(select 1 from public.profiles) then 'seller'::public.app_role else 'admin'::public.app_role end
    into assigned_role;
  insert into public.profiles(id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), assigned_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.release_expired_reservations()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  released_count integer := 0;
  item record;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  for item in
    select ri.stock_id, sum(ri.quantity)::integer as quantity
    from public.reservation_items ri
    join public.reservations r on r.id = ri.reservation_id
    where r.status = 'active' and r.expires_at <= now()
    group by ri.stock_id
    order by ri.stock_id
  loop
    update public.stock_by_location
      set reserved = greatest(0, reserved - item.quantity), updated_at = now()
      where id = item.stock_id;
    released_count := released_count + item.quantity;
  end loop;
  update public.reservations set status = 'expired', updated_at = now()
    where status = 'active' and expires_at <= now();
  return released_count;
end;
$$;

create or replace function public.reserve_stock(
  p_reservation_id uuid,
  p_stock_id uuid,
  p_quantity integer,
  p_customer_name text default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  result_id uuid;
  stock_row public.stock_by_location%rowtype;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if p_quantity <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  perform public.release_expired_reservations();

  select * into stock_row from public.stock_by_location where id = p_stock_id for update;
  if not found then raise exception 'Stock no encontrado'; end if;
  if stock_row.on_hand - stock_row.reserved < p_quantity then raise exception 'Stock insuficiente'; end if;

  if p_reservation_id is null then
    insert into public.reservations(customer_name, expires_at, created_by)
    values (nullif(trim(p_customer_name), ''), now() + interval '15 minutes', auth.uid())
    returning id into result_id;
  else
    select id into result_id from public.reservations
      where id = p_reservation_id and status = 'active' and created_by = auth.uid() for update;
    if result_id is null then raise exception 'La reserva ya no está activa'; end if;
    update public.reservations set expires_at = now() + interval '15 minutes', updated_at = now() where id = result_id;
  end if;

  insert into public.reservation_items(reservation_id, stock_id, quantity)
  values (result_id, p_stock_id, p_quantity)
  on conflict (reservation_id, stock_id)
  do update set quantity = public.reservation_items.quantity + excluded.quantity;

  update public.stock_by_location
    set reserved = reserved + p_quantity, updated_at = now()
    where id = p_stock_id;
  return result_id;
end;
$$;

create or replace function public.release_reserved_stock(
  p_reservation_id uuid,
  p_stock_id uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare current_quantity integer;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  select ri.quantity into current_quantity
  from public.reservation_items ri join public.reservations r on r.id = ri.reservation_id
  where r.id = p_reservation_id and r.created_by = auth.uid() and r.status = 'active' and ri.stock_id = p_stock_id
  for update;
  if current_quantity is null then return; end if;
  p_quantity := least(p_quantity, current_quantity);
  update public.stock_by_location set reserved = greatest(0, reserved - p_quantity), updated_at = now() where id = p_stock_id;
  if current_quantity = p_quantity then
    delete from public.reservation_items where reservation_id = p_reservation_id and stock_id = p_stock_id;
  else
    update public.reservation_items set quantity = quantity - p_quantity where reservation_id = p_reservation_id and stock_id = p_stock_id;
  end if;
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare item record;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if not exists (
    select 1 from public.reservations
    where id = p_reservation_id and status = 'active'
      and (created_by = auth.uid() or public.current_app_role() in ('admin', 'manager'))
    for update
  ) then raise exception 'Reserva no disponible'; end if;
  for item in select stock_id, quantity from public.reservation_items where reservation_id = p_reservation_id order by stock_id
  loop
    update public.stock_by_location set reserved = greatest(0, reserved - item.quantity), updated_at = now() where id = item.stock_id;
  end loop;
  update public.reservations set status = 'cancelled', updated_at = now() where id = p_reservation_id;
end;
$$;

create or replace function public.confirm_reserved_sale(
  p_reservation_id uuid,
  p_customer_name text,
  p_payment_method text
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  sale_id uuid;
  total_amount numeric(12,2) := 0;
  item record;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  perform public.release_expired_reservations();
  if not exists (
    select 1 from public.reservations
    where id = p_reservation_id and status = 'active' and expires_at > now() and created_by = auth.uid()
    for update
  ) then raise exception 'La reserva venció o no está disponible'; end if;

  insert into public.sales(customer_name, payment_method, seller_id)
  values (nullif(trim(p_customer_name), ''), p_payment_method, auth.uid()) returning id into sale_id;

  for item in
    select ri.stock_id, ri.quantity, s.variant_id, s.location_id, s.on_hand, s.reserved,
      p.name as product_name, p.price, c.name as color_name, z.name as size_name
    from public.reservation_items ri
    join public.stock_by_location s on s.id = ri.stock_id
    join public.variants v on v.id = s.variant_id
    join public.products p on p.id = v.product_id
    join public.colors c on c.id = v.color_id
    join public.sizes z on z.id = v.size_id
    where ri.reservation_id = p_reservation_id
    order by ri.stock_id
    for update of s
  loop
    if item.on_hand < item.quantity or item.reserved < item.quantity then raise exception 'Stock inconsistente'; end if;
    update public.stock_by_location
      set on_hand = on_hand - item.quantity, reserved = reserved - item.quantity, updated_at = now()
      where id = item.stock_id;
    insert into public.sale_items(sale_id, variant_id, location_id, product_name, color_name, size_name, quantity, unit_price)
    values (sale_id, item.variant_id, item.location_id, item.product_name, item.color_name, item.size_name, item.quantity, item.price);
    insert into public.inventory_movements(variant_id, location_id, movement_type, quantity, reason, reference_type, reference_id, user_id)
    values (item.variant_id, item.location_id, 'sale', -item.quantity, 'Venta confirmada', 'sale', sale_id, auth.uid());
    total_amount := total_amount + item.price * item.quantity;
  end loop;

  update public.sales set total = total_amount where id = sale_id;
  update public.reservations set status = 'converted', customer_name = nullif(trim(p_customer_name), ''), updated_at = now() where id = p_reservation_id;
  return sale_id;
end;
$$;

create or replace function public.record_inventory_intake(p_lines jsonb, p_reason text default 'Ingreso de mercadería')
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare line record; stock_row public.stock_by_location%rowtype; total_units integer := 0;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if public.current_app_role() not in ('admin', 'manager') then raise exception 'No tiene permiso para ingresar mercadería'; end if;
  for line in select * from jsonb_to_recordset(p_lines) as x(stock_id uuid, quantity integer) order by stock_id
  loop
    if line.quantity <= 0 then raise exception 'Cantidad inválida'; end if;
    select * into stock_row from public.stock_by_location where id = line.stock_id for update;
    if not found then raise exception 'Stock no encontrado'; end if;
    update public.stock_by_location set on_hand = on_hand + line.quantity, updated_at = now() where id = line.stock_id;
    insert into public.inventory_movements(variant_id, location_id, movement_type, quantity, reason, reference_type, user_id)
    values (stock_row.variant_id, stock_row.location_id, 'intake', line.quantity, p_reason, 'intake', auth.uid());
    total_units := total_units + line.quantity;
  end loop;
  return total_units;
end;
$$;

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.colors enable row level security;
alter table public.sizes enable row level security;
alter table public.variants enable row level security;
alter table public.stock_by_location enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','locations','categories','products','colors','sizes','variants','stock_by_location','reservations','reservation_items','sales','sale_items','inventory_movements']
  loop
    execute format('drop policy if exists internal_read on public.%I', table_name);
    execute format('create policy internal_read on public.%I for select to authenticated using (public.current_app_role() is not null)', table_name);
  end loop;
end $$;

revoke all on function public.reserve_stock(uuid, uuid, integer, text) from public, anon;
revoke all on function public.release_reserved_stock(uuid, uuid, integer) from public, anon;
revoke all on function public.cancel_reservation(uuid) from public, anon;
revoke all on function public.confirm_reserved_sale(uuid, text, text) from public, anon;
revoke all on function public.record_inventory_intake(jsonb, text) from public, anon;
grant execute on function public.reserve_stock(uuid, uuid, integer, text) to authenticated;
grant execute on function public.release_reserved_stock(uuid, uuid, integer) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
grant execute on function public.confirm_reserved_sale(uuid, text, text) to authenticated;
grant execute on function public.record_inventory_intake(jsonb, text) to authenticated;
grant execute on function public.release_expired_reservations() to authenticated;

insert into public.locations(id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Local Centro'),
  ('10000000-0000-0000-0000-000000000002', 'Depósito'),
  ('10000000-0000-0000-0000-000000000003', 'Feria')
on conflict (name) do nothing;

insert into public.categories(id, name) values
  ('20000000-0000-0000-0000-000000000001', 'Pantalones'),
  ('20000000-0000-0000-0000-000000000002', 'Remeras'),
  ('20000000-0000-0000-0000-000000000003', 'Calzas'),
  ('20000000-0000-0000-0000-000000000004', 'Conjuntos')
on conflict (name) do nothing;

insert into public.colors(id, name, hex) values
  ('30000000-0000-0000-0000-000000000001', 'Negro', '#272a28'),
  ('30000000-0000-0000-0000-000000000002', 'Crema', '#ede7d8'),
  ('30000000-0000-0000-0000-000000000003', 'Azul marino', '#26384e'),
  ('30000000-0000-0000-0000-000000000004', 'Bordó', '#793c43'),
  ('30000000-0000-0000-0000-000000000005', 'Blanco', '#f6f3eb'),
  ('30000000-0000-0000-0000-000000000006', 'Verde oliva', '#677057'),
  ('30000000-0000-0000-0000-000000000007', 'Taupe', '#a3917f'),
  ('30000000-0000-0000-0000-000000000008', 'Lila', '#9c82ac'),
  ('30000000-0000-0000-0000-000000000009', 'Chocolate', '#6f4c3d')
on conflict (name) do nothing;

insert into public.sizes(id, name, display_order) values
  ('40000000-0000-0000-0000-000000000001', 'S', 1),
  ('40000000-0000-0000-0000-000000000002', 'M', 2),
  ('40000000-0000-0000-0000-000000000003', 'L', 3),
  ('40000000-0000-0000-0000-000000000004', 'XL', 4),
  ('40000000-0000-0000-0000-000000000005', 'XXL', 5)
on conflict (name) do nothing;

insert into public.products(id, category_id, code, name, price) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'PAL-001', 'Palazzo de verano', 15000),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'REM-014', 'Remera Basic', 8500),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'BIK-007', 'Biker Seamless', 12000),
  ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'CON-021', 'Conjunto Rib', 24500)
on conflict (code) do nothing;

insert into public.variants(id, product_id, color_id, size_id, sku) values
  ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','PAL-NEG-S'),
  ('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','PAL-CRE-S'),
  ('60000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','PAL-NEG-M'),
  ('60000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002','PAL-BOR-M'),
  ('60000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','PAL-NEG-L'),
  ('60000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','PAL-AZU-S'),
  ('60000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','PAL-CRE-M'),
  ('60000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003','PAL-BOR-L'),
  ('60000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000001','REM-BLA-S'),
  ('60000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','REM-NEG-M'),
  ('60000000-0000-0000-0000-000000000011','50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000003','REM-VER-L'),
  ('60000000-0000-0000-0000-000000000012','50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004','REM-NEG-XL'),
  ('60000000-0000-0000-0000-000000000013','50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','BIK-NEG-S'),
  ('60000000-0000-0000-0000-000000000014','50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','BIK-NEG-M'),
  ('60000000-0000-0000-0000-000000000015','50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000003','BIK-TAU-L'),
  ('60000000-0000-0000-0000-000000000016','50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000002','BIK-LIL-M'),
  ('60000000-0000-0000-0000-000000000017','50000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000009','40000000-0000-0000-0000-000000000001','CON-CHO-S'),
  ('60000000-0000-0000-0000-000000000018','50000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000009','40000000-0000-0000-0000-000000000002','CON-CHO-M'),
  ('60000000-0000-0000-0000-000000000019','50000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','CON-NEG-L')
on conflict (sku) do nothing;

insert into public.stock_by_location(variant_id, location_id, on_hand, reserved)
select v.id,
  case
    when v.sku in ('PAL-AZU-S','PAL-CRE-M','REM-NEG-XL','BIK-LIL-M','CON-NEG-L') then '10000000-0000-0000-0000-000000000002'::uuid
    when v.sku in ('PAL-BOR-L') then '10000000-0000-0000-0000-000000000003'::uuid
    else '10000000-0000-0000-0000-000000000001'::uuid
  end,
  case v.sku
    when 'PAL-NEG-S' then 6 when 'PAL-CRE-S' then 3 when 'PAL-NEG-M' then 4 when 'PAL-BOR-M' then 2
    when 'PAL-NEG-L' then 1 when 'PAL-AZU-S' then 5 when 'PAL-CRE-M' then 3 when 'PAL-BOR-L' then 2
    when 'REM-BLA-S' then 8 when 'REM-NEG-M' then 7 when 'REM-VER-L' then 2 when 'REM-NEG-XL' then 9
    when 'BIK-NEG-S' then 3 when 'BIK-NEG-M' then 5 when 'BIK-TAU-L' then 0 when 'BIK-LIL-M' then 4
    when 'CON-CHO-S' then 2 when 'CON-CHO-M' then 1 when 'CON-NEG-L' then 3 else 0 end,
  0
from public.variants v
on conflict (variant_id, location_id) do nothing;

-- Realtime para refrescar las pantallas conectadas.
do $$ begin
  alter publication supabase_realtime add table public.stock_by_location;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.reservations;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.inventory_movements;
exception when duplicate_object then null;
end $$;
