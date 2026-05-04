-- ============================================================
-- SED/SC Treinador de Questões — Supabase setup
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ============================================================

-- 1. Tabelas ──────────────────────────────────────────────────

create table if not exists exams (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
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
  user_id         uuid not null references auth.users(id) on delete cascade,
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
  user_id         uuid not null references auth.users(id) on delete cascade,
  question_id     text not null references questions(id) on delete cascade,
  selected_answer text not null default '',
  is_correct      boolean not null default false,
  answered_at     timestamptz not null default now()
);

create table if not exists flashcards (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  question_id     text not null references questions(id) on delete cascade,
  front           text not null default '',
  back            text not null default '',
  status          text not null default 'new',
  due_at          timestamptz not null default now(),
  interval_days   integer not null default 1,
  ease            float not null default 2.5,
  created_at      timestamptz default now()
);

-- 2. Row Level Security ───────────────────────────────────────

alter table exams      enable row level security;
alter table questions  enable row level security;
alter table attempts   enable row level security;
alter table flashcards enable row level security;

create policy "Usuário vê seus próprios exames"
  on exams for all using (auth.uid() = user_id);

create policy "Usuário vê suas próprias questões"
  on questions for all using (auth.uid() = user_id);

create policy "Usuário vê suas próprias tentativas"
  on attempts for all using (auth.uid() = user_id);

create policy "Usuário vê seus próprios flashcards"
  on flashcards for all using (auth.uid() = user_id);

-- 3. Storage bucket ───────────────────────────────────────────
-- Execute separadamente no painel Storage > New bucket:
--   Nome: question-media  |  Public: SIM

-- Depois execute esta policy:
create policy "Usuário gerencia suas próprias mídias"
  on storage.objects for all
  using (
    bucket_id = 'question-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'question-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
