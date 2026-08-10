-- Indumentaria Fit: foto principal y fotos por color.
-- Ejecutar una sola vez en Supabase > SQL Editor.

alter table public.products add column if not exists image_url text;

create table if not exists public.product_color_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color_id uuid not null references public.colors(id),
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, color_id)
);

alter table public.product_color_images enable row level security;
drop policy if exists internal_read on public.product_color_images;
create policy internal_read on public.product_color_images
  for select to authenticated
  using (public.current_app_role() is not null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images');

drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.current_app_role() in ('admin', 'manager'));

drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.current_app_role() in ('admin', 'manager'))
  with check (bucket_id = 'product-images' and public.current_app_role() in ('admin', 'manager'));

create or replace function public.set_product_photo(
  p_product_id uuid,
  p_color_name text,
  p_image_url text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_color_id uuid;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  if public.current_app_role() not in ('admin', 'manager') then
    raise exception 'No tiene permiso para modificar fotos';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and active = true) then
    raise exception 'Producto no encontrado';
  end if;

  if nullif(trim(p_color_name), '') is null then
    update public.products set image_url = p_image_url, updated_at = now() where id = p_product_id;
    return;
  end if;

  select c.id into v_color_id
  from public.colors c
  join public.variants v on v.color_id = c.id
  where v.product_id = p_product_id and lower(c.name) = lower(trim(p_color_name))
  limit 1;
  if v_color_id is null then raise exception 'Color no encontrado'; end if;

  insert into public.product_color_images(product_id, color_id, image_url)
  values (p_product_id, v_color_id, p_image_url)
  on conflict (product_id, color_id)
  do update set image_url = excluded.image_url, updated_at = now();
end;
$$;

revoke all on function public.set_product_photo(uuid, text, text) from public, anon;
grant execute on function public.set_product_photo(uuid, text, text) to authenticated;
