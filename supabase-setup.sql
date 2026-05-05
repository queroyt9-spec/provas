-- ============================================================
-- SED/SC Treinador de Questões — Supabase setup
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ============================================================

-- 1. Tabelas ──────────────────────────────────────────────────

create table if not exists exams (
  id              text primary key,
  title           text not null default '',
  year            integer not null default 0,
  board           text not null default '',
  agency          text not null default '',
  role            text not null default '',
  area            text not null default '',
  tags            text[] not null default '{}',
  source_url      text,
  answer_key_url  text,
  created_at      timestamptz default now()
);

create table if not exists questions (
  id              text primary key,
  exam_id         text not null references exams(id) on delete cascade,
  number          integer not null default 0,
  type            text not null default 'multiple_choice',
  area            text not null default '',
  topic           text not null default '',
  statement       text not null default '',
  alternatives    jsonb not null default '{}',
  correct_answer  text not null default '',
  explanation     text not null default '',
  tags            text[] not null default '{}',
  needs_review    boolean not null default false,
  has_media       boolean not null default false,
  media_url       text,
  created_at      timestamptz default now()
);

create table if not exists attempts (
  id              text primary key,
  question_id     text not null references questions(id) on delete cascade,
  selected_answer text not null default '',
  is_correct      boolean not null default false,
  answered_at     timestamptz not null default now()
);

create table if not exists flashcards (
  id              text primary key,
  question_id     text not null references questions(id) on delete cascade,
  front           text not null default '',
  back            text not null default '',
  status          text not null default 'new',
  due_at          timestamptz not null default now(),
  interval_days   integer not null default 1,
  ease            float not null default 2.5,
  created_at      timestamptz default now()
);

-- 2. Coluna user_id em todas as tabelas ──────────────────────
-- Separa os dados por usuário logado no app.
-- Execute mesmo se as tabelas já existirem (ALTER TABLE é seguro).

alter table exams      add column if not exists user_id text not null default 'admin';
alter table questions  add column if not exists user_id text not null default 'admin';
alter table attempts   add column if not exists user_id text not null default 'admin';
alter table flashcards add column if not exists user_id text not null default 'admin';

-- 3. Sem RLS — acesso aberto via anon key ─────────────────────
-- O app usa usuário local para separar os dados.

-- 3. Storage bucket ───────────────────────────────────────────
-- No painel Storage > New bucket:
--   Nome: question-media  |  Public: SIM

-- 4. Policies para Storage (question-media) ───────────────────
-- Sem estas policies, o upload retorna:
-- "new row violates row-level security policy"

drop policy if exists "question-media public read" on storage.objects;
create policy "question-media public read"
on storage.objects for select
to public
using (bucket_id = 'question-media');

drop policy if exists "question-media anon insert" on storage.objects;
create policy "question-media anon insert"
on storage.objects for insert
to anon
with check (bucket_id = 'question-media');

drop policy if exists "question-media anon update" on storage.objects;
create policy "question-media anon update"
on storage.objects for update
to anon
using (bucket_id = 'question-media')
with check (bucket_id = 'question-media');

drop policy if exists "question-media anon delete" on storage.objects;
create policy "question-media anon delete"
on storage.objects for delete
to anon
using (bucket_id = 'question-media');
