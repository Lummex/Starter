-- Test helpers for phase_a_security.test.sql (included with \ir). Opens the transaction.

\set QUIET on
\pset pager off
begin;

create temp table results (n serial, name text, ok boolean, detail text);
grant all on results to public;
grant all on sequence results_n_seq to public;

-- ---------- helpers ----------
create function pg_temp.ok(p_name text, p_ok boolean, p_detail text default '') returns void
language sql as $$ insert into results (name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail) $$;

-- Act as a logged-in player (aal1 = password only, aal2 = with 2-step), or as anon (p_user null).
create function pg_temp.act_as(p_user uuid, p_aal text default 'aal1') returns void
language plpgsql as $$
begin
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

create function pg_temp.back() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Runs p_sql as the given caller and expects it to be REFUSED: an error, or
-- (for UPDATE/DELETE hidden by row security) zero rows touched.
create function pg_temp.refused(p_name text, p_user uuid, p_aal text, p_sql text, p_expect text default null) returns void
language plpgsql as $$
declare
  rc bigint := -1;
  err text := null;
begin
  perform pg_temp.act_as(p_user, p_aal);
  begin
    execute p_sql;
    get diagnostics rc = row_count;
  exception when others then
    err := sqlerrm;
  end;
  perform pg_temp.back();
  if err is not null then
    perform pg_temp.ok(p_name, p_expect is null or err ilike '%' || p_expect || '%', 'refused: ' || err);
  else
    perform pg_temp.ok(p_name, rc = 0 and p_expect is null, 'not refused, rows touched: ' || rc);
  end if;
end $$;

-- Runs p_sql as the caller and expects it to work. Returns nothing; records the error if any.
create function pg_temp.works(p_name text, p_user uuid, p_aal text, p_sql text) returns void
language plpgsql as $$
declare err text := null;
begin
  perform pg_temp.act_as(p_user, p_aal);
  begin
    execute p_sql;
  exception when others then err := sqlerrm;
  end;
  perform pg_temp.back();
  perform pg_temp.ok(p_name, err is null, coalesce('error: ' || err, ''));
end $$;

-- Counts the rows a SELECT returns for the caller (-1 = the select was refused).
create function pg_temp.count_as(p_user uuid, p_aal text, p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.act_as(p_user, p_aal);
  begin
    execute 'select count(*) from (' || p_sql || ') s' into n;
  exception when others then n := -1;
  end;
  perform pg_temp.back();
  return n;
end $$;

-- my_collection() as that player (card_id, count).
create function pg_temp.collection_of(p_user uuid) returns table (card_id text, count bigint)
language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.act_as(p_user, 'aal1');
  select jsonb_agg(to_jsonb(m)) into r from public.my_collection() m;
  perform pg_temp.back();
  return query select x ->> 'card_id', (x ->> 'count')::bigint from jsonb_array_elements(coalesce(r, '[]'::jsonb)) x;
end $$;

-- Calls a jsonb-returning function as the caller.
create function pg_temp.json_as(p_user uuid, p_aal text, p_sql text) returns jsonb
language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.act_as(p_user, p_aal);
  begin
    execute p_sql into r;
  exception when others then r := jsonb_build_object('error', sqlerrm);
  end;
  perform pg_temp.back();
  return r;
end $$;

