-- Pickle Rating: Philippine pickleball rankings, computed from our own matches
-- (no DUPR needed).
--
-- Clients can read everything (rankings are public) but never write tables
-- directly: every change goes through the security-definer functions below,
-- which check who is calling and do the rating math in one transaction.

-- ---------------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------------

create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  -- Philippine administrative regions (18, including the Negros Island Region).
  region text not null check (region in (
    'NCR', 'CAR', 'R1', 'R2', 'R3', 'R4A', 'MIMAROPA', 'R5', 'R6', 'NIR',
    'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'BARMM'
  )),
  city text check (city is null or char_length(btrim(city)) between 1 and 60),
  singles_rating integer not null default 1500,
  doubles_rating integer not null default 1500,
  singles_played integer not null default 0,
  doubles_played integer not null default 0,
  singles_wins integer not null default 0,
  doubles_wins integer not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index players_singles_rank_idx on public.players (singles_rating desc) where singles_played > 0;
create index players_doubles_rank_idx on public.players (doubles_rating desc) where doubles_played > 0;
create index players_region_city_idx on public.players (region, lower(city));
create index players_name_idx on public.players (lower(display_name));

-- ---------------------------------------------------------------------------
-- Clubs: each club keeps its own ratings from matches played within it
-- ---------------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  region text not null check (region in (
    'NCR', 'CAR', 'R1', 'R2', 'R3', 'R4A', 'MIMAROPA', 'R5', 'R6', 'NIR',
    'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'BARMM'
  )),
  city text check (city is null or char_length(btrim(city)) between 1 and 60),
  description text check (description is null or char_length(description) <= 500),
  created_by uuid not null references public.players (id),
  created_at timestamptz not null default now()
);
create unique index clubs_name_unique on public.clubs (lower(btrim(name)));

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  player_id uuid not null references public.players (id),
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, player_id)
);
create index club_members_player_idx on public.club_members (player_id);

create table public.club_ratings (
  club_id uuid not null references public.clubs (id) on delete cascade,
  player_id uuid not null references public.players (id),
  format text not null check (format in ('singles', 'doubles')),
  rating integer not null default 1500,
  played integer not null default 0,
  wins integer not null default 0,
  primary key (club_id, player_id, format)
);
create index club_ratings_rank_idx on public.club_ratings (club_id, format, rating desc);

-- ---------------------------------------------------------------------------
-- Tournaments (single-elimination brackets)
-- ---------------------------------------------------------------------------

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 100),
  format text not null check (format in ('singles', 'doubles')),
  club_id uuid references public.clubs (id),
  region text not null check (region in (
    'NCR', 'CAR', 'R1', 'R2', 'R3', 'R4A', 'MIMAROPA', 'R5', 'R6', 'NIR',
    'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'BARMM'
  )),
  city text check (city is null or char_length(btrim(city)) between 1 and 60),
  venue text check (venue is null or char_length(venue) <= 120),
  starts_on date not null,
  description text check (description is null or char_length(description) <= 1000),
  max_entries integer not null default 16 check (max_entries between 2 and 64),
  status text not null default 'registration' check (status in ('registration', 'in_progress', 'completed', 'cancelled')),
  organizer_id uuid not null references public.players (id),
  winner_entry_id uuid,
  created_at timestamptz not null default now()
);
create index tournaments_status_idx on public.tournaments (status, starts_on);

-- One entry is a singles player or a doubles pair.
create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player1_id uuid not null references public.players (id),
  player2_id uuid references public.players (id),
  seed integer,
  created_at timestamptz not null default now(),
  check (player2_id is null or player2_id <> player1_id)
);
create index tournament_entries_tournament_idx on public.tournament_entries (tournament_id);
alter table public.tournaments
  add constraint tournaments_winner_fk foreign key (winner_entry_id) references public.tournament_entries (id);

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  format text not null check (format in ('singles', 'doubles')),
  played_at timestamptz not null,
  -- [{"team1": 11, "team2": 7}, ...], validated by normalize_games().
  games jsonb not null,
  winner_team smallint not null check (winner_team in (1, 2)),
  -- Club matches also count toward that club's own ratings.
  club_id uuid references public.clubs (id),
  tournament_id uuid references public.tournaments (id),
  location text check (location is null or char_length(location) <= 120),
  notes text check (notes is null or char_length(notes) <= 280),
  -- pending: waiting for the other team. confirmed: counts toward ratings.
  -- disputed: the other team rejected the score; an admin decides.
  -- cancelled: withdrawn by whoever recorded it. voided: removed by an admin.
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'disputed', 'cancelled', 'voided')),
  created_by uuid not null references public.players (id),
  confirmed_at timestamptz,
  resolved_by uuid references public.players (id),
  created_at timestamptz not null default now()
);
create index matches_status_confirmed_idx on public.matches (status, confirmed_at);
create index matches_created_idx on public.matches (created_at desc);
create index matches_club_idx on public.matches (club_id) where club_id is not null;

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id),
  team smallint not null check (team in (1, 2)),
  -- When this player confirmed or disputed (the recorder is set on creation).
  responded_at timestamptz,
  primary key (match_id, player_id)
);
create index match_players_player_idx on public.match_players (player_id);

create table public.bracket_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round integer not null check (round >= 1),
  position integer not null check (position >= 0),
  entry1_id uuid references public.tournament_entries (id),
  entry2_id uuid references public.tournament_entries (id),
  winner_entry_id uuid references public.tournament_entries (id),
  match_id uuid references public.matches (id),
  unique (tournament_id, round, position)
);

create table public.rating_history (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id),
  format text not null check (format in ('singles', 'doubles')),
  rating_before integer not null,
  rating_after integer not null,
  club_id uuid references public.clubs (id),
  club_rating_before integer,
  club_rating_after integer,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);
create index rating_history_player_idx on public.rating_history (player_id, format, id);

-- Doubles partner statistics: every confirmed doubles match with each partner.
create view public.partner_stats with (security_invoker = true) as
select
  me.player_id,
  partner.player_id as partner_id,
  count(*)::integer as matches,
  (count(*) filter (where me.team = m.winner_team))::integer as wins,
  max(m.played_at) as last_played_at
from public.match_players me
join public.match_players partner
  on partner.match_id = me.match_id and partner.team = me.team and partner.player_id <> me.player_id
join public.matches m on m.id = me.match_id
where m.status = 'confirmed' and m.format = 'doubles'
group by me.player_id, partner.player_id;

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger players_updated_at before update on public.players
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: public reads, no direct writes except own profile fields
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_ratings enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.bracket_matches enable row level security;
alter table public.rating_history enable row level security;

create policy players_public_read on public.players for select to anon, authenticated using (true);
create policy players_update_own on public.players for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy clubs_public_read on public.clubs for select to anon, authenticated using (true);
create policy club_members_public_read on public.club_members for select to anon, authenticated using (true);
create policy club_ratings_public_read on public.club_ratings for select to anon, authenticated using (true);
create policy tournaments_public_read on public.tournaments for select to anon, authenticated using (true);
create policy tournament_entries_public_read on public.tournament_entries for select to anon, authenticated using (true);
create policy matches_public_read on public.matches for select to anon, authenticated using (true);
create policy match_players_public_read on public.match_players for select to anon, authenticated using (true);
create policy bracket_matches_public_read on public.bracket_matches for select to anon, authenticated using (true);
create policy rating_history_public_read on public.rating_history for select to anon, authenticated using (true);

revoke all on table
  public.players, public.clubs, public.club_members, public.club_ratings, public.tournaments,
  public.tournament_entries, public.matches, public.match_players, public.bracket_matches,
  public.rating_history, public.partner_stats
from anon, authenticated;
grant select on table
  public.players, public.clubs, public.club_members, public.club_ratings, public.tournaments,
  public.tournament_entries, public.matches, public.match_players, public.bracket_matches,
  public.rating_history, public.partner_stats
to anon, authenticated;
-- A player may edit their own name and location, never ratings or admin status.
grant update (display_name, region, city) on table public.players to authenticated;

-- ---------------------------------------------------------------------------
-- New sign-ups get a player profile from their sign-up details
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Invalid details fail the check constraints, so the sign-up is rejected as a whole.
  insert into public.players (id, display_name, region, city)
  values (
    new.id,
    btrim(new.raw_user_meta_data->>'display_name'),
    new.raw_user_meta_data->>'region',
    nullif(btrim(coalesce(new.raw_user_meta_data->>'city', '')), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- New players move faster until they have 20 rated matches in that format.
-- Mirrored in lib/elo.ts; tests/db.test.mjs checks the two agree.
create function public.elo_k(p_played integer)
returns integer language sql immutable set search_path = '' as $$
  select case when p_played < 20 then 32 else 16 end;
$$;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.players p where p.id = auth.uid()), false);
$$;

create function public.require_player()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null or not exists (select 1 from public.players where id = v_me) then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

-- Checks game scores and works out the winner. Scores are whole numbers 0-99,
-- no tied games, 1-5 games, and one team must win more games.
create function public.normalize_games(p_games jsonb, out games jsonb, out winner_team smallint)
language plpgsql immutable set search_path = '' as $$
declare
  v_game jsonb;
  v_score1 integer;
  v_score2 integer;
  v_wins1 integer := 0;
  v_wins2 integer := 0;
begin
  games := '[]'::jsonb;
  if p_games is null or jsonb_typeof(p_games) <> 'array' or jsonb_array_length(p_games) not between 1 and 5 then
    raise exception 'Enter between 1 and 5 games.' using errcode = '22023';
  end if;
  for v_game in select value from jsonb_array_elements(p_games) loop
    if jsonb_typeof(v_game) <> 'object'
       or coalesce(v_game->>'team1', '') !~ '^[0-9]{1,2}$'
       or coalesce(v_game->>'team2', '') !~ '^[0-9]{1,2}$' then
      raise exception 'Each game needs a whole-number score for both teams.' using errcode = '22023';
    end if;
    v_score1 := (v_game->>'team1')::integer;
    v_score2 := (v_game->>'team2')::integer;
    if v_score1 = v_score2 then
      raise exception 'A game cannot end in a tie.' using errcode = '22023';
    end if;
    if v_score1 > v_score2 then v_wins1 := v_wins1 + 1; else v_wins2 := v_wins2 + 1; end if;
    games := games || jsonb_build_array(jsonb_build_object('team1', v_score1, 'team2', v_score2));
  end loop;
  if v_wins1 = v_wins2 then
    raise exception 'Both teams won the same number of games. Add the deciding game.' using errcode = '22023';
  end if;
  winner_team := case when v_wins1 > v_wins2 then 1 else 2 end;
end;
$$;

create function public.check_played_at(p_played_at timestamptz)
returns void language plpgsql stable set search_path = '' as $$
begin
  if p_played_at is null or p_played_at > now() + interval '1 hour' or p_played_at < now() - interval '30 days' then
    raise exception 'Record matches within 30 days of playing them, and not in the future.' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Elo
-- ---------------------------------------------------------------------------

-- Applies one confirmed match to every player's rating (and, for a club match,
-- their club rating). Doubles teams are rated by the average of both partners;
-- each player then moves by their own K-factor. Idempotent: a match already in
-- rating_history is skipped.
create function public.apply_match_rating(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_match public.matches%rowtype;
  v_team1 numeric;
  v_team2 numeric;
  v_expected1 numeric;
  v_club_team1 numeric;
  v_club_team2 numeric;
  v_club_expected1 numeric;
  v_player record;
  v_before integer;
  v_played integer;
  v_after integer;
  v_club_before integer;
  v_club_played integer;
  v_club_after integer;
  v_won boolean;
  v_score integer;
begin
  select * into v_match from public.matches where id = p_match;
  if not found or v_match.status <> 'confirmed' then
    raise exception 'Only confirmed matches change ratings.' using errcode = '55000';
  end if;
  if exists (select 1 from public.rating_history where match_id = p_match) then return; end if;

  -- Lock the players in a fixed order so concurrent confirmations cannot deadlock.
  perform 1 from public.players
    where id in (select player_id from public.match_players where match_id = p_match)
    order by id for update;

  select
    avg(case when v_match.format = 'singles' then p.singles_rating else p.doubles_rating end) filter (where mp.team = 1),
    avg(case when v_match.format = 'singles' then p.singles_rating else p.doubles_rating end) filter (where mp.team = 2)
  into v_team1, v_team2
  from public.match_players mp
  join public.players p on p.id = mp.player_id
  where mp.match_id = p_match;
  v_expected1 := 1 / (1 + power(10::numeric, (v_team2 - v_team1) / 400));

  if v_match.club_id is not null then
    insert into public.club_ratings (club_id, player_id, format)
    select v_match.club_id, mp.player_id, v_match.format from public.match_players mp where mp.match_id = p_match
    on conflict do nothing;
    perform 1 from public.club_ratings
      where club_id = v_match.club_id and format = v_match.format
        and player_id in (select player_id from public.match_players where match_id = p_match)
      order by player_id for update;
    select
      avg(cr.rating) filter (where mp.team = 1),
      avg(cr.rating) filter (where mp.team = 2)
    into v_club_team1, v_club_team2
    from public.match_players mp
    join public.club_ratings cr on cr.player_id = mp.player_id and cr.club_id = v_match.club_id and cr.format = v_match.format
    where mp.match_id = p_match;
    v_club_expected1 := 1 / (1 + power(10::numeric, (v_club_team2 - v_club_team1) / 400));
  end if;

  for v_player in
    select mp.player_id, mp.team from public.match_players mp where mp.match_id = p_match order by mp.player_id
  loop
    v_won := v_player.team = v_match.winner_team;
    v_score := case when v_won then 1 else 0 end;

    if v_match.format = 'singles' then
      select singles_rating, singles_played into v_before, v_played from public.players where id = v_player.player_id;
    else
      select doubles_rating, doubles_played into v_before, v_played from public.players where id = v_player.player_id;
    end if;
    v_after := v_before + round(public.elo_k(v_played) * (
      v_score - (case when v_player.team = 1 then v_expected1 else 1 - v_expected1 end)
    ))::integer;

    if v_match.format = 'singles' then
      update public.players set
        singles_rating = v_after, singles_played = singles_played + 1, singles_wins = singles_wins + v_score
      where id = v_player.player_id;
    else
      update public.players set
        doubles_rating = v_after, doubles_played = doubles_played + 1, doubles_wins = doubles_wins + v_score
      where id = v_player.player_id;
    end if;

    v_club_before := null;
    v_club_after := null;
    if v_match.club_id is not null then
      select rating, played into v_club_before, v_club_played from public.club_ratings
        where club_id = v_match.club_id and player_id = v_player.player_id and format = v_match.format;
      v_club_after := v_club_before + round(public.elo_k(v_club_played) * (
        v_score - (case when v_player.team = 1 then v_club_expected1 else 1 - v_club_expected1 end)
      ))::integer;
      update public.club_ratings set rating = v_club_after, played = played + 1, wins = wins + v_score
        where club_id = v_match.club_id and player_id = v_player.player_id and format = v_match.format;
    end if;

    insert into public.rating_history
      (match_id, player_id, format, rating_before, rating_after, club_id, club_rating_before, club_rating_after, created_at)
    values
      (p_match, v_player.player_id, v_match.format, v_before, v_after, v_match.club_id, v_club_before, v_club_after,
       coalesce(v_match.confirmed_at, now()));
  end loop;
end;
$$;

-- Rebuilds one format's ratings (national and club) from scratch by replaying
-- every confirmed match in the order it was confirmed. Used when an admin
-- voids a confirmed match.
create function public.recompute_ratings(p_format text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_match uuid;
begin
  if p_format not in ('singles', 'doubles') then
    raise exception 'Unknown format.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('pickle-rating:recompute'));
  if p_format = 'singles' then
    update public.players set singles_rating = 1500, singles_played = 0, singles_wins = 0
      where singles_played > 0 or singles_rating <> 1500;
  else
    update public.players set doubles_rating = 1500, doubles_played = 0, doubles_wins = 0
      where doubles_played > 0 or doubles_rating <> 1500;
  end if;
  update public.club_ratings set rating = 1500, played = 0, wins = 0 where format = p_format;
  delete from public.rating_history where format = p_format;
  for v_match in
    select id from public.matches where format = p_format and status = 'confirmed' order by confirmed_at, id
  loop
    perform public.apply_match_rating(v_match);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------

-- Records a match the caller played in. It stays pending (no rating change)
-- until someone on the other team confirms the score. A club match needs every
-- player to be a member of that club.
create function public.record_match(
  p_format text,
  p_played_at timestamptz,
  p_team1 uuid[],
  p_team2 uuid[],
  p_games jsonb,
  p_club uuid default null,
  p_location text default null,
  p_notes text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_size integer;
  v_everyone uuid[];
  v_result record;
  v_match uuid;
begin
  if p_format is null or p_format not in ('singles', 'doubles') then
    raise exception 'Choose singles or doubles.' using errcode = '22023';
  end if;
  v_size := case when p_format = 'singles' then 1 else 2 end;
  if coalesce(cardinality(p_team1), 0) <> v_size or coalesce(cardinality(p_team2), 0) <> v_size then
    raise exception 'A % match needs % player(s) on each team.', p_format, v_size using errcode = '22023';
  end if;
  v_everyone := p_team1 || p_team2;
  if array_position(v_everyone, null) is not null
     or (select count(distinct x) from unnest(v_everyone) as x) <> v_size * 2 then
    raise exception 'Each player can only appear once in a match.' using errcode = '22023';
  end if;
  if not (v_me = any (v_everyone)) then
    raise exception 'You can only record matches you played in.' using errcode = '42501';
  end if;
  if (select count(*) from public.players where id = any (v_everyone)) <> v_size * 2 then
    raise exception 'One of the players could not be found.' using errcode = '22023';
  end if;
  if p_club is not null and (
    select count(*) from public.club_members where club_id = p_club and player_id = any (v_everyone)
  ) <> v_size * 2 then
    raise exception 'Every player must be a member of the club to record a club match.' using errcode = '22023';
  end if;
  perform public.check_played_at(p_played_at);
  if (select count(*) from public.matches where created_by = v_me and status = 'pending') >= 20 then
    raise exception 'You have 20 matches waiting for confirmation. Ask your opponents to confirm them first.' using errcode = '54000';
  end if;
  select * into v_result from public.normalize_games(p_games);

  insert into public.matches (format, played_at, games, winner_team, club_id, location, notes, created_by)
  values (
    p_format, p_played_at, v_result.games, v_result.winner_team, p_club,
    nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''), v_me
  )
  returning id into v_match;

  insert into public.match_players (match_id, player_id, team, responded_at)
  select v_match, x, 1, case when x = v_me then now() end from unnest(p_team1) as x
  union all
  select v_match, x, 2, case when x = v_me then now() end from unnest(p_team2) as x;

  return v_match;
end;
$$;

-- Someone on the other team confirms the score (ratings update) or disputes it.
create function public.respond_to_match(p_match uuid, p_confirm boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_match public.matches%rowtype;
  v_my_team smallint;
  v_recorder_team smallint;
begin
  select * into v_match from public.matches where id = p_match for update;
  if not found then
    raise exception 'Match not found.' using errcode = 'P0002';
  end if;
  if v_match.status <> 'pending' then
    raise exception 'This match is already %.', v_match.status using errcode = '55000';
  end if;
  select team into v_my_team from public.match_players where match_id = p_match and player_id = v_me;
  if v_my_team is null then
    raise exception 'Only players in this match can respond to it.' using errcode = '42501';
  end if;
  select team into v_recorder_team from public.match_players where match_id = p_match and player_id = v_match.created_by;
  if v_my_team = v_recorder_team then
    raise exception 'The other team confirms the score.' using errcode = '42501';
  end if;

  update public.match_players set responded_at = now() where match_id = p_match and player_id = v_me;
  if p_confirm then
    update public.matches set status = 'confirmed', confirmed_at = now() where id = p_match;
    perform public.apply_match_rating(p_match);
    return 'confirmed';
  end if;
  update public.matches set status = 'disputed' where id = p_match;
  return 'disputed';
end;
$$;

-- Whoever recorded a match can withdraw it while it is still pending.
create function public.cancel_match(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_match public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match for update;
  if not found then
    raise exception 'Match not found.' using errcode = 'P0002';
  end if;
  if v_match.created_by <> v_me then
    raise exception 'Only the player who recorded this match can cancel it.' using errcode = '42501';
  end if;
  if v_match.status <> 'pending' then
    raise exception 'Only pending matches can be cancelled.' using errcode = '55000';
  end if;
  update public.matches set status = 'cancelled' where id = p_match;
end;
$$;

-- Admins settle disputes: 'confirm' counts the match, 'void' removes it.
-- Voiding a confirmed match rebuilds that format's ratings without it.
create function public.admin_resolve_match(p_match uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_match public.matches%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access is required.' using errcode = '42501';
  end if;
  select * into v_match from public.matches where id = p_match for update;
  if not found then
    raise exception 'Match not found.' using errcode = 'P0002';
  end if;
  if v_match.tournament_id is not null then
    raise exception 'Tournament results are managed in the bracket.' using errcode = '55000';
  end if;
  if p_action = 'confirm' then
    if v_match.status not in ('pending', 'disputed') then
      raise exception 'Only pending or disputed matches can be confirmed.' using errcode = '55000';
    end if;
    update public.matches set status = 'confirmed', confirmed_at = now(), resolved_by = auth.uid() where id = p_match;
    perform public.apply_match_rating(p_match);
    return 'confirmed';
  elsif p_action = 'void' then
    if v_match.status not in ('pending', 'disputed', 'confirmed') then
      raise exception 'This match is already %.', v_match.status using errcode = '55000';
    end if;
    update public.matches set status = 'voided', resolved_by = auth.uid() where id = p_match;
    if v_match.status = 'confirmed' then
      perform public.recompute_ratings(v_match.format);
    end if;
    return 'voided';
  end if;
  raise exception 'Unknown action.' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------

create function public.create_club(p_name text, p_region text, p_city text default null, p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_club uuid;
begin
  if (select count(*) from public.clubs where created_by = v_me) >= 5 then
    raise exception 'You can create up to 5 clubs.' using errcode = '54000';
  end if;
  if exists (select 1 from public.clubs where lower(btrim(name)) = lower(btrim(p_name))) then
    raise exception 'A club with that name already exists.' using errcode = '23505';
  end if;
  insert into public.clubs (name, region, city, description, created_by)
  values (btrim(p_name), p_region, nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_description, '')), ''), v_me)
  returning id into v_club;
  insert into public.club_members (club_id, player_id, role) values (v_club, v_me, 'owner');
  return v_club;
end;
$$;

create function public.join_club(p_club uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
begin
  if not exists (select 1 from public.clubs where id = p_club) then
    raise exception 'Club not found.' using errcode = 'P0002';
  end if;
  insert into public.club_members (club_id, player_id) values (p_club, v_me) on conflict do nothing;
end;
$$;

create function public.leave_club(p_club uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
begin
  if exists (select 1 from public.club_members where club_id = p_club and player_id = v_me and role = 'owner') then
    raise exception 'The club owner cannot leave the club.' using errcode = '55000';
  end if;
  delete from public.club_members where club_id = p_club and player_id = v_me;
end;
$$;

create function public.remove_club_member(p_club uuid, p_player uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
begin
  if not exists (select 1 from public.club_members where club_id = p_club and player_id = v_me and role in ('owner', 'admin')) then
    raise exception 'Only club owners and admins can remove members.' using errcode = '42501';
  end if;
  if exists (select 1 from public.club_members where club_id = p_club and player_id = p_player and role = 'owner') then
    raise exception 'The club owner cannot be removed.' using errcode = '55000';
  end if;
  delete from public.club_members where club_id = p_club and player_id = p_player;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------------

create function public.create_tournament(
  p_name text,
  p_format text,
  p_starts_on date,
  p_region text,
  p_city text default null,
  p_venue text default null,
  p_club uuid default null,
  p_max_entries integer default 16,
  p_description text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_tournament uuid;
begin
  if p_club is not null and not exists (
    select 1 from public.club_members where club_id = p_club and player_id = v_me and role in ('owner', 'admin')
  ) then
    raise exception 'Only club owners and admins can create club tournaments.' using errcode = '42501';
  end if;
  if p_starts_on is null or p_starts_on < (now() at time zone 'Asia/Manila')::date - 1 then
    raise exception 'Choose a start date from today onward.' using errcode = '22023';
  end if;
  if (select count(*) from public.tournaments where organizer_id = v_me and status in ('registration', 'in_progress')) >= 5 then
    raise exception 'You can run up to 5 open tournaments at a time.' using errcode = '54000';
  end if;
  insert into public.tournaments (name, format, starts_on, region, city, venue, club_id, max_entries, description, organizer_id)
  values (
    btrim(p_name), p_format, p_starts_on, p_region, nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_venue, '')), ''), p_club, p_max_entries, nullif(btrim(coalesce(p_description, '')), ''), v_me
  )
  returning id into v_tournament;
  return v_tournament;
end;
$$;

-- The caller registers themselves (with a partner for doubles).
create function public.register_for_tournament(p_tournament uuid, p_partner uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_tournament public.tournaments%rowtype;
  v_entry uuid;
begin
  select * into v_tournament from public.tournaments where id = p_tournament for update;
  if not found then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;
  if v_tournament.status <> 'registration' then
    raise exception 'Registration for this tournament is closed.' using errcode = '55000';
  end if;
  if v_tournament.format = 'doubles' and (p_partner is null or p_partner = v_me) then
    raise exception 'Choose a doubles partner.' using errcode = '22023';
  end if;
  if v_tournament.format = 'singles' and p_partner is not null then
    raise exception 'Singles entries have no partner.' using errcode = '22023';
  end if;
  if p_partner is not null and not exists (select 1 from public.players where id = p_partner) then
    raise exception 'Partner not found.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.tournament_entries
    where tournament_id = p_tournament and (player1_id in (v_me, p_partner) or player2_id in (v_me, p_partner))
  ) then
    raise exception 'You or your partner are already registered.' using errcode = '23505';
  end if;
  if v_tournament.club_id is not null and (
    select count(*) from public.club_members where club_id = v_tournament.club_id and player_id in (v_me, p_partner)
  ) <> (case when p_partner is null then 1 else 2 end) then
    raise exception 'This is a club tournament: every player must be a club member.' using errcode = '42501';
  end if;
  if (select count(*) from public.tournament_entries where tournament_id = p_tournament) >= v_tournament.max_entries then
    raise exception 'This tournament is full.' using errcode = '54000';
  end if;
  insert into public.tournament_entries (tournament_id, player1_id, player2_id)
  values (p_tournament, v_me, p_partner)
  returning id into v_entry;
  return v_entry;
end;
$$;

create function public.withdraw_from_tournament(p_tournament uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
begin
  if not exists (select 1 from public.tournaments where id = p_tournament and status = 'registration') then
    raise exception 'You can only withdraw before the bracket starts.' using errcode = '55000';
  end if;
  delete from public.tournament_entries
    where tournament_id = p_tournament and (player1_id = v_me or player2_id = v_me);
end;
$$;

-- Moves the winner of a bracket slot into the next round (or finishes the tournament).
create function public.advance_bracket(p_bracket uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_slot public.bracket_matches%rowtype;
  v_last_round integer;
begin
  update public.bracket_matches set winner_entry_id = p_winner where id = p_bracket returning * into v_slot;
  select max(round) into v_last_round from public.bracket_matches where tournament_id = v_slot.tournament_id;
  if v_slot.round = v_last_round then
    update public.tournaments set status = 'completed', winner_entry_id = p_winner where id = v_slot.tournament_id;
    return;
  end if;
  if v_slot.position % 2 = 0 then
    update public.bracket_matches set entry1_id = p_winner
      where tournament_id = v_slot.tournament_id and round = v_slot.round + 1 and position = v_slot.position / 2;
  else
    update public.bracket_matches set entry2_id = p_winner
      where tournament_id = v_slot.tournament_id and round = v_slot.round + 1 and position = v_slot.position / 2;
  end if;
end;
$$;

-- Closes registration and builds the bracket. Entries are seeded by rating
-- (a pair by its average); the bracket is the next power of two, and the top
-- seeds get byes. Seed 1 and 2 can only meet in the final.
create function public.start_tournament(p_tournament uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_tournament public.tournaments%rowtype;
  v_count integer;
  v_size integer := 2;
  v_rounds integer := 1;
  v_order integer[] := array[1];
  v_next integer[];
  v_n integer := 1;
  v_seed integer;
  v_round integer;
  v_position integer;
  v_entry1 uuid;
  v_entry2 uuid;
  v_slot uuid;
begin
  select * into v_tournament from public.tournaments where id = p_tournament for update;
  if not found then
    raise exception 'Tournament not found.' using errcode = 'P0002';
  end if;
  if v_tournament.organizer_id <> v_me then
    raise exception 'Only the organizer can start the tournament.' using errcode = '42501';
  end if;
  if v_tournament.status <> 'registration' then
    raise exception 'This tournament has already started.' using errcode = '55000';
  end if;
  select count(*) into v_count from public.tournament_entries where tournament_id = p_tournament;
  if v_count < 2 then
    raise exception 'A tournament needs at least 2 entries.' using errcode = '55000';
  end if;

  while v_size < v_count loop
    v_size := v_size * 2;
    v_rounds := v_rounds + 1;
  end loop;

  update public.tournament_entries e set seed = ranked.seed
  from (
    select te.id, row_number() over (
      order by (
        select avg(case when v_tournament.format = 'singles' then p.singles_rating else p.doubles_rating end)
        from public.players p where p.id in (te.player1_id, te.player2_id)
      ) desc, te.created_at, te.id
    )::integer as seed
    from public.tournament_entries te
    where te.tournament_id = p_tournament
  ) ranked
  where e.id = ranked.id;

  -- Standard seed order, e.g. 8 slots: 1 8 4 5 2 7 3 6.
  while v_n < v_size loop
    v_n := v_n * 2;
    v_next := '{}';
    foreach v_seed in array v_order loop
      v_next := v_next || v_seed || (v_n + 1 - v_seed);
    end loop;
    v_order := v_next;
  end loop;

  for v_round in 1..v_rounds loop
    for v_position in 0..(v_size / (2 ^ v_round)::integer) - 1 loop
      insert into public.bracket_matches (tournament_id, round, position) values (p_tournament, v_round, v_position);
    end loop;
  end loop;

  for v_position in 0..(v_size / 2) - 1 loop
    select id into v_entry1 from public.tournament_entries where tournament_id = p_tournament and seed = v_order[v_position * 2 + 1];
    select id into v_entry2 from public.tournament_entries where tournament_id = p_tournament and seed = v_order[v_position * 2 + 2];
    update public.bracket_matches set entry1_id = v_entry1, entry2_id = v_entry2
      where tournament_id = p_tournament and round = 1 and position = v_position
      returning id into v_slot;
    if v_entry2 is null then
      perform public.advance_bracket(v_slot, v_entry1);
    end if;
  end loop;

  update public.tournaments set status = 'in_progress' where id = p_tournament;
end;
$$;

-- The organizer enters a bracket result. It counts immediately (the organizer
-- is the referee), updates ratings, and moves the winner on.
create function public.report_bracket_result(p_bracket uuid, p_games jsonb, p_played_at timestamptz default now())
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
  v_slot public.bracket_matches%rowtype;
  v_tournament public.tournaments%rowtype;
  v_entry1 public.tournament_entries%rowtype;
  v_entry2 public.tournament_entries%rowtype;
  v_result record;
  v_match uuid;
begin
  select * into v_slot from public.bracket_matches where id = p_bracket for update;
  if not found then
    raise exception 'Bracket match not found.' using errcode = 'P0002';
  end if;
  select * into v_tournament from public.tournaments where id = v_slot.tournament_id;
  if v_tournament.organizer_id <> v_me then
    raise exception 'Only the organizer can enter bracket results.' using errcode = '42501';
  end if;
  if v_tournament.status <> 'in_progress' then
    raise exception 'This tournament is not in progress.' using errcode = '55000';
  end if;
  if v_slot.winner_entry_id is not null then
    raise exception 'This bracket match already has a result.' using errcode = '55000';
  end if;
  if v_slot.entry1_id is null or v_slot.entry2_id is null then
    raise exception 'Both sides of this bracket match are not decided yet.' using errcode = '55000';
  end if;
  perform public.check_played_at(p_played_at);
  select * into v_result from public.normalize_games(p_games);
  select * into v_entry1 from public.tournament_entries where id = v_slot.entry1_id;
  select * into v_entry2 from public.tournament_entries where id = v_slot.entry2_id;

  insert into public.matches
    (format, played_at, games, winner_team, club_id, tournament_id, location, status, created_by, confirmed_at)
  values
    (v_tournament.format, p_played_at, v_result.games, v_result.winner_team, v_tournament.club_id, v_tournament.id,
     v_tournament.venue, 'confirmed', v_me, now())
  returning id into v_match;
  insert into public.match_players (match_id, player_id, team, responded_at)
  select v_match, x.player_id, x.team, now()
  from (values
    (v_entry1.player1_id, 1::smallint), (v_entry1.player2_id, 1::smallint),
    (v_entry2.player1_id, 2::smallint), (v_entry2.player2_id, 2::smallint)
  ) as x (player_id, team)
  where x.player_id is not null;

  update public.bracket_matches set match_id = v_match where id = p_bracket;
  perform public.apply_match_rating(v_match);
  perform public.advance_bracket(p_bracket, case when v_result.winner_team = 1 then v_slot.entry1_id else v_slot.entry2_id end);
  return v_match;
end;
$$;

create function public.cancel_tournament(p_tournament uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.require_player();
begin
  if not exists (select 1 from public.tournaments where id = p_tournament and organizer_id = v_me) then
    raise exception 'Only the organizer can cancel the tournament.' using errcode = '42501';
  end if;
  update public.tournaments set status = 'cancelled'
    where id = p_tournament and status in ('registration', 'in_progress');
  if not found then
    raise exception 'This tournament is already finished.' using errcode = '55000';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions: helpers are internal; actions need a signed-in player
-- ---------------------------------------------------------------------------

revoke all on function
  public.set_updated_at(),
  public.handle_new_user(),
  public.elo_k(integer),
  public.is_admin(),
  public.require_player(),
  public.normalize_games(jsonb),
  public.check_played_at(timestamptz),
  public.apply_match_rating(uuid),
  public.recompute_ratings(text),
  public.record_match(text, timestamptz, uuid[], uuid[], jsonb, uuid, text, text),
  public.respond_to_match(uuid, boolean),
  public.cancel_match(uuid),
  public.admin_resolve_match(uuid, text),
  public.create_club(text, text, text, text),
  public.join_club(uuid),
  public.leave_club(uuid),
  public.remove_club_member(uuid, uuid),
  public.create_tournament(text, text, date, text, text, text, uuid, integer, text),
  public.register_for_tournament(uuid, uuid),
  public.withdraw_from_tournament(uuid),
  public.advance_bracket(uuid, uuid),
  public.start_tournament(uuid),
  public.report_bracket_result(uuid, jsonb, timestamptz),
  public.cancel_tournament(uuid)
from public, anon, authenticated;

grant execute on function
  public.is_admin(),
  public.record_match(text, timestamptz, uuid[], uuid[], jsonb, uuid, text, text),
  public.respond_to_match(uuid, boolean),
  public.cancel_match(uuid),
  public.admin_resolve_match(uuid, text),
  public.create_club(text, text, text, text),
  public.join_club(uuid),
  public.leave_club(uuid),
  public.remove_club_member(uuid, uuid),
  public.create_tournament(text, text, date, text, text, text, uuid, integer, text),
  public.register_for_tournament(uuid, uuid),
  public.withdraw_from_tournament(uuid),
  public.start_tournament(uuid),
  public.report_bracket_result(uuid, jsonb, timestamptz),
  public.cancel_tournament(uuid)
to authenticated;
