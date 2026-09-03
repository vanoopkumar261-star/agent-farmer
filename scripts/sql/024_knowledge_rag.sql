-- 024: Retrieval for the AI assistant (RAG).
--
-- The assistant knows this farmer's fields, crops, soil and weather, and knows
-- nothing about the 58 pages of handbooks and 8 government schemes we wrote
-- ourselves. So when someone asks "am I eligible for PM-KISAN", the answer
-- comes out of the language model's general memory: fluent, uncited, and able
-- to be confidently wrong about somebody's money. This gives it a shelf of
-- books to quote instead.
--
-- ── Why the embeddings live in Supabase ──────────────────────────────────────
-- Groq powers every other AI call in this app, and Groq has no embedding
-- models and no /v1/embeddings endpoint. Supabase's Edge Runtime ships
-- `gte-small` natively (see supabase/functions/embed), so retrieval costs no
-- extra API key and no money.
--
-- ── vector(384) ──────────────────────────────────────────────────────────────
-- Measured, not assumed: the deployed function was called and its output
-- inspected — 384 floats, L2 norm exactly 1.000000. The width is fixed at
-- column creation, so it was worth reading rather than trusting a model card.
--
-- Because the vectors are unit length, inner product ranks identically to
-- cosine and is cheaper, hence `vector_ip_ops` on the indexes.
--
-- ── Two tables, deliberately ─────────────────────────────────────────────────
-- Shared knowledge and a farmer's own conversation history are NOT mixed into
-- one table behind a conditional policy. A single "public rows OR my rows"
-- policy is precisely where a cross-tenant leak gets written, and this schema
-- has already been through one RLS hardening pass (015, 018, 019, 021). So the
-- public shelf and the private diary are separate objects with separate
-- policies, following mandi_geocache (008) and notifications (006) in turn.

begin;

create extension if not exists vector;

-- ── The public shelf: schemes, handbook pages, crop profiles ────────────────

create table if not exists public.knowledge_chunks (
  id           uuid primary key default gen_random_uuid(),
  -- 'scheme' | 'library' | 'agronomy'
  source       text not null,
  -- Stable id within that source, e.g. 'pm-kisan' or 'vermicompost#3'.
  source_id    text not null,
  title        text not null,
  -- Parent book / crop, for a citation that reads like a reference.
  parent       text,
  -- Where a citation should send the farmer: an official government page for a
  -- scheme, or an in-app library route for a handbook page.
  link         text,
  content      text not null,
  -- sha256 of `content`, so re-indexing re-embeds only what actually changed
  -- instead of all 86 chunks every run.
  content_hash text not null,
  embedding    vector(384) not null,
  created_at   timestamptz not null default now()
);

create unique index if not exists knowledge_chunks_source_uidx
  on public.knowledge_chunks (source, source_id);
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding vector_ip_ops);

alter table public.knowledge_chunks enable row level security;

grant select on public.knowledge_chunks to authenticated;
grant select, insert, update, delete on public.knowledge_chunks to service_role;

drop policy if exists "knowledge readable" on public.knowledge_chunks;
create policy "knowledge readable" on public.knowledge_chunks
  for select to authenticated
  using (true);

-- ── The private diary: this farmer's own past exchanges ─────────────────────
--
-- Retrieved for continuity only. These are the assistant's OWN earlier words,
-- so they are never presented to the model as a citable source — quoting a
-- previous answer back as evidence would launder an old mistake into a
-- reference. The retrieval layer keeps them in a separate, lower-weighted slot
-- and the prompt labels them as conversation, not authority.

create table if not exists public.farmer_memory_chunks (
  id         uuid primary key default gen_random_uuid(),
  farmer_id  uuid not null references public.farmer_profiles(id) on delete cascade,
  content    text not null,
  embedding  vector(384) not null,
  created_at timestamptz not null default now()
);

create index if not exists farmer_memory_farmer_idx
  on public.farmer_memory_chunks (farmer_id, created_at desc);
create index if not exists farmer_memory_embedding_idx
  on public.farmer_memory_chunks using hnsw (embedding vector_ip_ops);

alter table public.farmer_memory_chunks enable row level security;

grant select, insert, update, delete on public.farmer_memory_chunks to authenticated, service_role;

drop policy if exists "own memory - all" on public.farmer_memory_chunks;
create policy "own memory - all" on public.farmer_memory_chunks
  for all to authenticated
  using (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = farmer_memory_chunks.farmer_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.farmer_profiles p
      where p.id = farmer_memory_chunks.farmer_id and p.owner_id = auth.uid()
    )
  );

-- ── Search ───────────────────────────────────────────────────────────────────
--
-- `<#>` is negative inner product, so similarity = -(distance). Returned rather
-- than thresholded in SQL: gte-small packs everything into roughly 0.70–0.90
-- (an unrelated pair measured 0.77), so an absolute cutoff is meaningless and
-- the decision of what counts as a real match is made in TypeScript against the
-- spread of the results. See src/lib/rag/retrieve.ts.

create or replace function public.match_knowledge(
  query_embedding vector(384),
  match_count int default 5
)
returns table (
  source text, source_id text, title text, parent text, link text,
  content text, similarity float
)
language sql stable
as $$
  select k.source, k.source_id, k.title, k.parent, k.link, k.content,
         -(k.embedding <#> query_embedding) as similarity
  from public.knowledge_chunks k
  order by k.embedding <#> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

-- Farmer memory is searched through a SECURITY INVOKER function so the RLS
-- policy above still applies — the caller can only ever reach their own rows.
create or replace function public.match_farmer_memory(
  query_embedding vector(384),
  match_count int default 3
)
returns table (content text, created_at timestamptz, similarity float)
language sql stable
as $$
  select m.content, m.created_at,
         -(m.embedding <#> query_embedding) as similarity
  from public.farmer_memory_chunks m
  order by m.embedding <#> query_embedding
  limit greatest(1, least(match_count, 10));
$$;

commit;
