-- Orion Clube: estrutura inicial para Supabase/PostgreSQL.
-- Execute em um projeto Supabase novo após revisar as políticas com a equipe responsável.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique,
  phone text,
  membership_status text not null default 'pending' check (membership_status in ('active','pending','inactive')),
  joined_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin_general','financeiro','atividades','associado')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);


-- Provisiona o perfil básico e o papel associado no cadastro do Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,full_name,email,phone,membership_status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''), split_part(new.email,'@',1)),
    new.email,
    nullif(trim(new.raw_user_meta_data->>'phone'),''),
    'pending'
  ) on conflict(id) do update set email=excluded.email;
  insert into public.user_roles(user_id,role) values(new.id,'associado') on conflict(user_id,role) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_orion on auth.users;
create trigger on_auth_user_created_orion
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.sync_auth_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin update public.profiles set email=new.email where id=new.id; return new; end; $$;
drop trigger if exists on_auth_user_email_updated_orion on auth.users;
create trigger on_auth_user_email_updated_orion after update of email on auth.users
for each row when (old.email is distinct from new.email) execute procedure public.sync_auth_email();


create table if not exists public.club_settings (
  id boolean primary key default true check (id),
  monthly_fee numeric(12,2) not null default 180.00 check (monthly_fee >= 0),
  due_day smallint not null default 10 check (due_day between 1 and 28),
  pix_key text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.club_settings(id) values (true) on conflict (id) do nothing;

-- Uma série guarda a regra de recorrência; cada encontro é uma ocorrência independente.
create table if not exists public.activity_series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Social',
  description text,
  location text,
  starts_on date not null,
  starts_at time not null,
  recurrence_frequency text not null default 'none' check (recurrence_frequency in ('none','daily','weekly','biweekly','monthly')),
  recurrence_interval integer not null default 1 check (recurrence_interval >= 1),
  recurrence_until date,
  unlimited_capacity boolean not null default false,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'published' check (status in ('draft','published','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((unlimited_capacity and capacity is null) or (not unlimited_capacity and capacity is not null)),
  check (recurrence_until is null or recurrence_until >= starts_on)
);

create table if not exists public.activity_occurrences (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.activity_series(id) on delete cascade,
  starts_at timestamptz not null,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'open' check (status in ('open','full','cancelled','completed')),
  created_at timestamptz not null default now(),
  unique(series_id, starts_at)
);

create table if not exists public.activity_signups (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.activity_occurrences(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','waitlist')),
  created_at timestamptz not null default now(),
  unique(occurrence_id, member_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  category text not null default 'NOTÍCIAS',
  image_path text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_dues (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  competence date not null,
  due_date date not null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'open' check (status in ('open','pending','paid','overdue','waived')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(member_id, competence)
);

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  due_id uuid not null references public.member_dues(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  amount_claimed numeric(12,2),
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status <> 'rejected') or (rejection_reason is not null and length(trim(rejection_reason)) >= 5))
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Auditoria server-side para submissão e revisão financeira; nunca registra o caminho privado do arquivo.
create or replace function public.audit_payment_submission()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if TG_OP='INSERT' then
    update public.member_dues set status='pending' where id=new.due_id and status in ('open','overdue');
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values (auth.uid(),'payment_submitted','payment_submission',new.id::text,
      jsonb_build_object('member_id',new.member_id,'due_id',new.due_id,'status',new.status,'amount_claimed',new.amount_claimed));
  elsif TG_OP='UPDATE' and old.status is distinct from new.status then
    if new.status='approved' then
      update public.member_dues set status='paid', paid_at=coalesce(new.reviewed_at,now()) where id=new.due_id;
    elsif new.status='rejected' then
      update public.member_dues set status=case when due_date < timezone('America/Sao_Paulo',now())::date then 'overdue' else 'open' end, paid_at=null where id=new.due_id;
    end if;
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values (coalesce(auth.uid(),new.reviewed_by),'payment_status_changed','payment_submission',new.id::text,
      jsonb_build_object('member_id',new.member_id,'old_status',old.status,'new_status',new.status,'reviewed_by',new.reviewed_by,'rejection_reason',new.rejection_reason));
  end if;
  return new;
end;
$$;
create trigger payment_submission_audit
 after insert or update on public.payment_submissions
 for each row execute procedure public.audit_payment_submission();

-- Mantém updated_at consistente nas entidades editáveis.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger activity_series_updated_at before update on public.activity_series for each row execute procedure public.set_updated_at();
create trigger posts_updated_at before update on public.posts for each row execute procedure public.set_updated_at();
create trigger club_settings_updated_at before update on public.club_settings for each row execute procedure public.set_updated_at();

create index if not exists activity_occurrences_starts_at_idx on public.activity_occurrences(starts_at);
create index if not exists activity_signups_occurrence_idx on public.activity_signups(occurrence_id, status);
create index if not exists posts_published_idx on public.posts(status, published_at desc);
create index if not exists member_dues_member_competence_idx on public.member_dues(member_id, competence desc);
create index if not exists payment_submissions_status_idx on public.payment_submissions(status, created_at desc);
create unique index if not exists payment_one_pending_per_due_idx on public.payment_submissions(due_id) where status='pending';
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function public.has_any_role(required_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = any(required_roles)
  );
$$;
revoke all on function public.has_any_role(text[]) from public;
grant execute on function public.has_any_role(text[]) to authenticated;

-- Perfil: atualização restrita a nome/telefone, nunca ao papel ou situação de associado.
create or replace function public.update_own_profile(new_full_name text, new_phone text)
returns public.profiles
language plpgsql security definer
set search_path = public
as $$
declare updated public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(new_full_name)) < 2 then raise exception 'Name is required'; end if;
  update public.profiles set full_name=trim(new_full_name), phone=nullif(trim(new_phone),''), updated_at=now()
  where id=auth.uid() returning * into updated;
  return updated;
end;
$$;
revoke all on function public.update_own_profile(text,text) from public;
grant execute on function public.update_own_profile(text,text) to authenticated;

-- RLS é obrigatória. As políticas não substituem testes de autorização por papel.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.club_settings enable row level security;
alter table public.activity_series enable row level security;
alter table public.activity_occurrences enable row level security;
alter table public.activity_signups enable row level security;
alter table public.posts enable row level security;
alter table public.member_dues enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
create policy "profiles_read_self_or_admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_any_role(array['admin_general','financeiro','atividades']));
create policy "profiles_admin_manage" on public.profiles for all to authenticated
using (public.has_any_role(array['admin_general'])) with check (public.has_any_role(array['admin_general']));

-- Roles: apenas o administrador geral administra papéis; usuários leem os próprios.
create policy "roles_read_self_or_admin" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_any_role(array['admin_general']));
create policy "roles_admin_manage" on public.user_roles for all to authenticated
using (public.has_any_role(array['admin_general'])) with check (public.has_any_role(array['admin_general']));

create policy "settings_read_authenticated" on public.club_settings for select to authenticated using (true);
create policy "settings_admin_manage" on public.club_settings for all to authenticated
using (public.has_any_role(array['admin_general'])) with check (public.has_any_role(array['admin_general']));

-- Atividades: associados consultam publicadas; equipe de atividades e administradores gerenciam.
create policy "activity_series_read_published" on public.activity_series for select to authenticated
using (status = 'published' or public.has_any_role(array['admin_general','atividades']));
create policy "activity_series_staff_manage" on public.activity_series for all to authenticated
using (public.has_any_role(array['admin_general','atividades'])) with check (public.has_any_role(array['admin_general','atividades']));
create policy "occurrences_read_authenticated" on public.activity_occurrences for select to authenticated
using (exists(select 1 from public.activity_series s where s.id = series_id and s.status = 'published') or public.has_any_role(array['admin_general','atividades']));
create policy "occurrences_staff_manage" on public.activity_occurrences for all to authenticated
using (public.has_any_role(array['admin_general','atividades'])) with check (public.has_any_role(array['admin_general','atividades']));
create policy "signups_read_self_or_activity_staff" on public.activity_signups for select to authenticated
using (member_id = auth.uid() or public.has_any_role(array['admin_general','atividades']));
-- Não há INSERT/UPDATE direto em activity_signups: inscrição e cancelamento usam RPCs transacionais.

-- Posts: feed publicado para associados; equipe de atividades e administrador publicam.
create policy "posts_read_published_or_staff" on public.posts for select to authenticated
using (status = 'published' or public.has_any_role(array['admin_general','atividades']));
create policy "posts_staff_manage" on public.posts for all to authenticated
using (public.has_any_role(array['admin_general','atividades'])) with check (public.has_any_role(array['admin_general','atividades']));

-- Financeiro: associado só enxerga seus próprios títulos e submissões; financeiro/admin gerenciam.
create policy "dues_read_self_or_finance" on public.member_dues for select to authenticated
using (member_id = auth.uid() or public.has_any_role(array['admin_general','financeiro']));
-- Cobranças são criadas/alteradas somente por funções controladas e triggers.
-- Não concedemos UPDATE direto sobre member_dues para evitar marcar mensalidades como pagas sem revisão.
create policy "payments_read_self_or_finance" on public.payment_submissions for select to authenticated
using (member_id = auth.uid() or public.has_any_role(array['admin_general','financeiro']));
create policy "payments_insert_self" on public.payment_submissions for insert to authenticated
with check (member_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null
  and storage_path like auth.uid()::text || '/%'
  and exists (select 1 from public.member_dues d where d.id = due_id and d.member_id = auth.uid() and d.status in ('open','overdue')));
-- A revisão financeira ocorre somente pela RPC review_payment_submission.

create policy "audit_read_admin" on public.audit_logs for select to authenticated
using (public.has_any_role(array['admin_general']));
-- Escrita de auditoria deve ocorrer por triggers/RPCs confiáveis, não por inserção livre do cliente.

-- Gera títulos de mensalidade para todos os associados ativos em uma competência.
-- Pode ser executado por um financeiro/admin; para cron de produção, prefira uma Edge Function service_role.
create or replace function public.generate_monthly_dues(target_competence date default date_trunc('month',timezone('America/Sao_Paulo',now()))::date)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  competence_month date := date_trunc('month',target_competence)::date;
  monthly_amount numeric(12,2);
  configured_due_day integer;
  inserted_count integer := 0;
begin
  if coalesce(auth.role(),'') <> 'service_role' and (auth.uid() is null or not public.has_any_role(array['admin_general','financeiro'])) then
    raise exception 'Not authorized';
  end if;
  select monthly_fee,due_day into monthly_amount,configured_due_day from public.club_settings where id=true;
  if monthly_amount is null then raise exception 'Club settings not configured'; end if;
  insert into public.member_dues(member_id,competence,due_date,amount,status)
  select p.id, competence_month, make_date(extract(year from competence_month)::int,extract(month from competence_month)::int,configured_due_day), monthly_amount, 'open'
    from public.profiles p where p.membership_status='active'
  on conflict(member_id,competence) do nothing;
  get diagnostics inserted_count = row_count;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'monthly_dues_generated','member_dues',competence_month::text,
    jsonb_build_object('competence',competence_month,'created_count',inserted_count,'amount',monthly_amount));
  return inserted_count;
end; $$;
revoke all on function public.generate_monthly_dues(date) from public;
grant execute on function public.generate_monthly_dues(date) to authenticated, service_role;

-- Marca cobranças não pagas cujo vencimento já passou. Idempotente.
create or replace function public.mark_overdue_dues()
returns integer
language plpgsql security definer set search_path = public as $$
declare changed_count integer := 0;
begin
  if coalesce(auth.role(),'') <> 'service_role' and (auth.uid() is null or not public.has_any_role(array['admin_general','financeiro'])) then
    raise exception 'Not authorized';
  end if;
  update public.member_dues set status='overdue'
   where status='open' and due_date < timezone('America/Sao_Paulo',now())::date;
  get diagnostics changed_count = row_count;
  if changed_count > 0 then
    insert into public.audit_logs(actor_id,action,entity_type,details)
    values(auth.uid(),'member_dues_marked_overdue','member_dues',jsonb_build_object('changed_count',changed_count,'processed_at',now()));
  end if;
  return changed_count;
end; $$;
revoke all on function public.mark_overdue_dues() from public;
grant execute on function public.mark_overdue_dues() to authenticated, service_role;

-- Materializa as ocorrências de uma série dentro de uma janela mensal solicitada.
-- Pode ser chamado por uma Edge Function/cron após a criação da série e antes da agenda.
create or replace function public.generate_activity_occurrences(target_series uuid, window_start date, window_end date)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  s public.activity_series;
  cursor_date date;
  created_count integer := 0;
  occurrence_at timestamptz;
begin
  if coalesce(auth.role(),'') <> 'service_role' and (auth.uid() is null or not public.has_any_role(array['admin_general','atividades'])) then
    raise exception 'Not authorized';
  end if;
  select * into s from public.activity_series where id=target_series;
  if not found then raise exception 'Activity series not found'; end if;
  if window_end < window_start then raise exception 'Invalid date window'; end if;
  cursor_date := greatest(window_start, s.starts_on);
  while cursor_date <= least(window_end, coalesce(s.recurrence_until, window_end)) loop
    if s.recurrence_frequency='none' then
      if cursor_date=s.starts_on then
        occurrence_at := (cursor_date + s.starts_at) at time zone 'America/Sao_Paulo';
      else
        occurrence_at := null;
      end if;
    else
      occurrence_at := null;
      if s.recurrence_frequency='daily' and mod(cursor_date-s.starts_on,s.recurrence_interval)=0 then
        occurrence_at := (cursor_date + s.starts_at) at time zone 'America/Sao_Paulo';
      elsif s.recurrence_frequency='weekly' and mod(cursor_date-s.starts_on,7*s.recurrence_interval)=0 then
        occurrence_at := (cursor_date + s.starts_at) at time zone 'America/Sao_Paulo';
      elsif s.recurrence_frequency='biweekly' and mod(cursor_date-s.starts_on,14*s.recurrence_interval)=0 then
        occurrence_at := (cursor_date + s.starts_at) at time zone 'America/Sao_Paulo';
      elsif s.recurrence_frequency='monthly'
        and extract(day from cursor_date)=least(extract(day from s.starts_on), extract(day from (date_trunc('month',cursor_date) + interval '1 month' - interval '1 day')::date))
        and mod((extract(year from cursor_date)::int-extract(year from s.starts_on)::int)*12 + extract(month from cursor_date)::int-extract(month from s.starts_on)::int,s.recurrence_interval)=0 then
        occurrence_at := (cursor_date + s.starts_at) at time zone 'America/Sao_Paulo';
      end if;
    end if;
    if occurrence_at is not null then
      insert into public.activity_occurrences(series_id,starts_at,capacity)
      values (s.id,occurrence_at,case when s.unlimited_capacity then null else s.capacity end)
      on conflict(series_id,starts_at) do nothing;
      if found then created_count := created_count + 1; end if;
    end if;
    cursor_date := cursor_date + 1;
  end loop;
  return created_count;
end;
$$;
revoke all on function public.generate_activity_occurrences(uuid,date,date) from public;
grant execute on function public.generate_activity_occurrences(uuid,date,date) to authenticated, service_role;

-- RPC transacional: bloqueia a ocorrência durante a checagem e evita exceder a capacidade.
create or replace function public.join_activity_occurrence(target_occurrence uuid)
returns public.activity_signups
language plpgsql security definer
set search_path = public
as $$
declare
  occ public.activity_occurrences;
  enrolled integer;
  new_signup public.activity_signups;
  signup_exists boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id=auth.uid() and p.membership_status='active') then raise exception 'Active membership required'; end if;
  select * into occ from public.activity_occurrences where id = target_occurrence for update;
  if not found then raise exception 'Occurrence not found'; end if;
  select * into new_signup from public.activity_signups
   where occurrence_id=target_occurrence and member_id=auth.uid();
  signup_exists := found;
  if signup_exists and new_signup.status='confirmed' then return new_signup; end if;
  if occ.status <> 'open' then raise exception 'Occurrence is not open'; end if;
  select count(*) into enrolled from public.activity_signups where occurrence_id = target_occurrence and status = 'confirmed';
  if occ.capacity is not null and enrolled >= occ.capacity then raise exception 'Occurrence is full'; end if;
  if signup_exists then
    update public.activity_signups set status='confirmed', created_at=now() where id=new_signup.id returning * into new_signup;
  else
    insert into public.activity_signups(occurrence_id, member_id, status)
    values (target_occurrence, auth.uid(), 'confirmed') returning * into new_signup;
  end if;
  return new_signup;
end;
$$;
revoke all on function public.join_activity_occurrence(uuid) from public;
grant execute on function public.join_activity_occurrence(uuid) to authenticated;


create or replace function public.refresh_occurrence_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare occurrence_key uuid; capacity_limit integer; current_count integer;
begin
  if TG_OP='DELETE' then occurrence_key := old.occurrence_id; else occurrence_key := new.occurrence_id; end if;
  select capacity into capacity_limit from public.activity_occurrences where id=occurrence_key;
  select count(*) into current_count from public.activity_signups
   where occurrence_id=occurrence_key and status='confirmed';
  update public.activity_occurrences set status=case
    when status in ('cancelled','completed') then status
    when capacity_limit is not null and current_count >= capacity_limit then 'full'
    else 'open' end
   where id=occurrence_key;
  if TG_OP='DELETE' then return old; else return new; end if;
end; $$;
create trigger activity_signup_refresh_capacity
after insert or update or delete on public.activity_signups
for each row execute procedure public.refresh_occurrence_capacity();

-- O cancelamento também é controlado e recalcula a situação da ocorrência.
create or replace function public.leave_activity_occurrence(target_occurrence uuid)
returns public.activity_signups
language plpgsql security definer set search_path = public as $$
declare result public.activity_signups;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.activity_occurrences
   where id=target_occurrence and starts_at > now() and status in ('open','full')
   for update;
  if not found then raise exception 'Occurrence is not cancellable'; end if;
  update public.activity_signups set status='cancelled'
   where occurrence_id=target_occurrence and member_id=auth.uid() and status='confirmed'
   returning * into result;
  if not found then raise exception 'Active signup not found'; end if;
  return result;
end; $$;
revoke all on function public.leave_activity_occurrence(uuid) from public;
grant execute on function public.leave_activity_occurrence(uuid) to authenticated;

-- Revisão financeira: transição única de pending para approved/rejected.
create or replace function public.review_payment_submission(target_payment uuid, decision text, reason text default null)
returns public.payment_submissions
language plpgsql security definer set search_path = public as $$
declare result public.payment_submissions;
begin
  if auth.uid() is null or not public.has_any_role(array['admin_general','financeiro']) then
    raise exception 'Not authorized';
  end if;
  if decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  if decision='rejected' and length(trim(coalesce(reason,''))) < 5 then
    raise exception 'Rejection reason must contain at least 5 characters';
  end if;
  update public.payment_submissions
     set status=decision, rejection_reason=case when decision='rejected' then trim(reason) else null end,
         reviewed_by=auth.uid(), reviewed_at=now()
   where id=target_payment and status='pending'
   returning * into result;
  if not found then raise exception 'Payment not found or already reviewed'; end if;
  return result;
end; $$;
revoke all on function public.review_payment_submission(uuid,text,text) from public;
grant execute on function public.review_payment_submission(uuid,text,text) to authenticated;

-- Buckets privados/públicos. A regra de leitura dos comprovantes é restrita por pasta do usuário.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('payment-proofs','payment-proofs',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['application/pdf','image/jpeg','image/png'];
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('club-media','club-media',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/png','image/jpeg','image/webp'];

create policy "payment_proof_upload_own_folder" on storage.objects for insert to authenticated
with check (bucket_id='payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "payment_proof_read_own_or_finance" on storage.objects for select to authenticated
using (bucket_id='payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_any_role(array['admin_general','financeiro'])));
create policy "club_media_read_public" on storage.objects for select to public
using (bucket_id='club-media');
create policy "club_media_upload_staff" on storage.objects for insert to authenticated
with check (bucket_id='club-media' and public.has_any_role(array['admin_general','atividades']));
create policy "club_media_update_staff" on storage.objects for update to authenticated
using (bucket_id='club-media' and public.has_any_role(array['admin_general','atividades']))
with check (bucket_id='club-media' and public.has_any_role(array['admin_general','atividades']));
create policy "club_media_delete_staff" on storage.objects for delete to authenticated
using (bucket_id='club-media' and public.has_any_role(array['admin_general','atividades']));

-- Observação: aplicar trigger updated_at, geração de ocorrências recorrentes,
-- criação mensal de member_dues e logging imutável via RPC/trigger antes da produção.
