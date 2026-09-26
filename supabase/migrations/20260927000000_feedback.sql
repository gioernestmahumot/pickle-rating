-- Player feedback: suggestions, app problems and score/rating issues.
-- Players send it through send_feedback(); only admins can read it and move
-- it through new -> seen -> done.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null check (kind in ('suggestion', 'problem', 'score')),
  message text not null check (char_length(btrim(message)) between 5 and 1000),
  status text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_status_created_idx on public.feedback (status, created_at desc);
create index feedback_player_created_idx on public.feedback (player_id, created_at desc);

create trigger feedback_updated_at before update on public.feedback
for each row execute function public.set_updated_at();

alter table public.feedback enable row level security;
create policy feedback_admin_read on public.feedback for select to authenticated using (public.is_admin());
revoke all on table public.feedback from anon, authenticated;
grant select on table public.feedback to authenticated;

create function public.send_feedback(p_kind text, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_id uuid;
begin
  if p_kind is null or p_kind not in ('suggestion', 'problem', 'score') then
    raise exception 'Choose what your feedback is about.' using errcode = '22023';
  end if;
  if p_message is null or char_length(btrim(p_message)) < 5 then
    raise exception 'Write a little more so we understand.' using errcode = '22023';
  end if;
  if char_length(btrim(p_message)) > 1000 then
    raise exception 'Keep it under 1000 characters.' using errcode = '22023';
  end if;
  if (select count(*) from public.feedback where player_id = v_me and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'You can send up to 5 messages a day. Please try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.feedback (player_id, kind, message) values (v_me, p_kind, btrim(p_message)) returning id into v_id;
  return v_id;
end;
$$;

create function public.admin_set_feedback_status(p_feedback uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('new', 'seen', 'done') then
    raise exception 'Unknown status.' using errcode = '22023';
  end if;
  update public.feedback set status = p_status where id = p_feedback;
  if not found then
    raise exception 'Feedback not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.send_feedback(text, text), public.admin_set_feedback_status(uuid, text) from public, anon, authenticated;
grant execute on function public.send_feedback(text, text), public.admin_set_feedback_status(uuid, text) to authenticated;
