-- Remover políticas e tabela existentes
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload avatar" on storage.objects;
drop policy if exists "Users can update avatar" on storage.objects;
drop policy if exists "Users can delete avatar" on storage.objects;
drop policy if exists "Avatars are viewable by everyone" on public.avatars;
drop policy if exists "Users can insert their own avatar" on public.avatars;
drop policy if exists "Users can update own avatar" on public.avatars;
drop trigger if exists set_updated_at on public.avatars;
drop function if exists public.handle_updated_at();
drop table if exists public.avatars;

-- Criar o bucket 'avatars' se ainda não existir
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Habilitar RLS para o bucket
alter table storage.objects enable row level security;

-- Política para permitir acesso público para download/visualização
create policy "Avatar images are publicly accessible"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- Política para permitir upload apenas para usuários autenticados
create policy "Users can upload avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
);

-- Política para permitir que usuários atualizem avatares
create policy "Users can update avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
);

-- Política para permitir que usuários deletem avatares
create policy "Users can delete avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
);

-- Configurar limites e restrições do bucket
update storage.buckets
set public = true,
    file_size_limit = 5242880, -- 5MB em bytes
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
where id = 'avatars';

-- Criar tabela de avatares
create table public.avatars (
    id uuid default gen_random_uuid() primary key,
    user_id text not null unique,
    url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para a tabela avatars
alter table public.avatars enable row level security;

-- Políticas para a tabela avatars
create policy "Avatars are viewable by everyone"
on public.avatars for select
using (true);

create policy "Users can insert their own avatar"
on public.avatars for insert
with check (true);

create policy "Users can update own avatar"
on public.avatars for update
using (true);

-- Função para atualizar o timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Trigger para atualizar o timestamp
create trigger set_updated_at
    before update on public.avatars
    for each row
    execute function public.handle_updated_at(); 