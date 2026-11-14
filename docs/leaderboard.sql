-- Global leaderboards for the portfolio site (Supabase / Postgres).
-- 1. Create a free project at https://supabase.com
-- 2. Open SQL Editor, paste this file, and run it.
-- 3. Copy Project Settings > API > Project URL and the "anon public" key
--    into `leaderboard` in data.js.
--
-- The anon key is meant to be public. Row Level Security below only allows
-- reading scores and inserting new ones (no edits or deletes), and the
-- checks reject junk names and absurd scores. Scores are still submitted
-- from the browser, so treat the board as "for fun", not tamper-proof.

create table if not exists public.scores (
    id          bigint generated always as identity primary key,
    board       text        not null check (char_length(board) between 3 and 48),
    name        text        not null check (name ~ '^[A-Za-z0-9 _-]{2,16}$'),
    score       numeric     not null check (score >= 0 and score < 10000000),
    created_at  timestamptz not null default now()
);

create index if not exists scores_board_score_idx on public.scores (board, score);

alter table public.scores enable row level security;

drop policy if exists "Anyone can read scores" on public.scores;
create policy "Anyone can read scores"
    on public.scores for select
    using (true);

drop policy if exists "Anyone can add a score" on public.scores;
create policy "Anyone can add a score"
    on public.scores for insert
    with check (true);
