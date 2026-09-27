-- Run once in your Supabase project's SQL Editor. No service-role key is needed by the app.
begin;
create table public.auditflow_records (
 owner uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('workspace','client','audit','task','report','campaign','integration','oauth')),
 id text not null,
 data jsonb not null check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (owner,kind,id)
);
create index auditflow_records_owner_kind_date on public.auditflow_records(owner,kind,created_at desc);
create unique index auditflow_one_active_audit on public.auditflow_records(owner) where kind='audit' and data->>'status' in ('queued','running');
alter table public.auditflow_records enable row level security;
create policy auditflow_owner_records on public.auditflow_records for all to authenticated using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
revoke all on public.auditflow_records from anon;
grant select,insert,update,delete on public.auditflow_records to authenticated;
create table public.auditflow_shares (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 owner uuid not null references auth.users(id) on delete cascade,
 report_id text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index auditflow_shares_owner_report on public.auditflow_shares(owner,report_id);
alter table public.auditflow_shares enable row level security;
create policy auditflow_owner_shares on public.auditflow_shares for all to authenticated using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
revoke all on public.auditflow_shares from anon;
grant select,insert,update,delete on public.auditflow_shares to authenticated;
-- Only this narrowly scoped function can return one valid shared report anonymously.
create function public.auditflow_shared_report(p_token_hash text) returns jsonb language sql stable security definer set search_path='' as $$
 select r.data from public.auditflow_shares s join public.auditflow_records r on r.owner=s.owner and r.id=s.report_id and r.kind='report'
 where s.token_hash=p_token_hash and s.expires_at>now() and p_token_hash ~ '^[a-f0-9]{64}$' limit 1;
$$;
revoke all on function public.auditflow_shared_report(text) from public;
grant execute on function public.auditflow_shared_report(text) to anon,authenticated;
-- A row lock prevents two requests from claiming the same checkpoint concurrently.
create function public.auditflow_claim_audit(p_id text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb;
begin
 select data into item from public.auditflow_records where owner=auth.uid() and kind='audit' and id=p_id for update;
 if item is null or item->>'status' not in ('queued','running') then return null; end if;
 if coalesce((item->>'lease')::numeric,0)>extract(epoch from now())*1000-45000 then return null; end if;
 item=item||jsonb_build_object('lease',floor(extract(epoch from now())*1000),'status','running');
 update public.auditflow_records set data=item,updated_at=now() where owner=auth.uid() and kind='audit' and id=p_id;
 return item;
end; $$;
create function public.auditflow_save_audit(p_id text,p_data jsonb) returns void language sql security invoker set search_path='' as $$
 update public.auditflow_records set data=case when p_data->>'releaseLease'='true' then (p_data-'releaseLease')||jsonb_build_object('lease',0) else p_data end,updated_at=now() where owner=auth.uid() and kind='audit' and id=p_id and data->>'status'!='cancelled' and data->>'lease'=p_data->>'lease';
$$;
revoke all on function public.auditflow_claim_audit(text) from public;
revoke all on function public.auditflow_save_audit(text,jsonb) from public;
grant execute on function public.auditflow_claim_audit(text) to authenticated;
grant execute on function public.auditflow_save_audit(text,jsonb) to authenticated;
commit;
