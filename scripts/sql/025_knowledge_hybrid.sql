-- 025: Keyword search alongside the vectors, because vectors alone missed.
--
-- Measured on the indexed corpus, top-1 similarity separates cleanly:
--
--   on-corpus queries      0.897 – 0.934
--   not-covered queries    0.752 – 0.824
--
-- which suggests a floor near 0.86. Except one query broke it:
--
--   "how do I get a bank loan to build a cold storage"  →  0.8238
--
-- The best match was the Agriculture Infrastructure Fund, whose text reads
-- "Loans up to ₹2 crore for post-harvest infra (storage, cold chain)". That is
-- exactly the right scheme, and a 0.86 floor would have thrown it away. The
-- word "storage" is sitting in the passage in plain sight; gte-small is a small
-- English model and simply does not bind "cold storage" to "cold chain"
-- tightly enough.
--
-- This is the classic failure of pure semantic search: it is good at paraphrase
-- and bad at exact terms. Keyword search has the opposite strengths. Running
-- both and merging is what catches a farmer who uses the scheme's own
-- vocabulary as well as one who describes it in their own words.

begin;

-- Generated, so it can never drift out of sync with `content`.
alter table public.knowledge_chunks
  add column if not exists fts tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(parent, '') || ' ' || content)
  ) stored;

create index if not exists knowledge_chunks_fts_idx
  on public.knowledge_chunks using gin (fts);

-- OR, not AND — and that distinction is the whole function.
--
-- `websearch_to_tsquery` joins every term with &, so the cold-storage question
-- above compiled to roughly:
--
--   'get' & 'bank' & 'loan' & 'build' & 'cold' & 'storage'
--
-- and matched nothing, because the passage never says "bank" or "build". A
-- natural-language question will essentially never satisfy an AND over all its
-- words. Swapping the operators to | asks the useful question instead — which
-- passage shares the most, and the rarest, of these words — and lets ts_rank
-- sort by how much overlap there really is.
--
-- The rank floor matters as much as the OR. Under OR a single common word is
-- enough to "match", so an off-topic question would drag back whatever chunk
-- happens to contain "world" or "get". Only a genuinely multi-term overlap
-- clears the threshold the caller applies.
-- Dropped by exact signature first: adding the min_rank parameter changes the
-- signature, so `create or replace` would leave the old two-argument version
-- in place as a second overload and every call becomes ambiguous.
drop function if exists public.match_knowledge_keyword(text, int);

create or replace function public.match_knowledge_keyword(
  query_text text,
  match_count int default 5,
  min_rank float default 0.02
)
returns table (
  source text, source_id text, title text, parent text, link text,
  content text, rank float
)
language sql stable
as $$
  with q as (
    select nullif(
      replace(websearch_to_tsquery('english', query_text)::text, '&', '|'),
      ''
    )::tsquery as tsq
  )
  select k.source, k.source_id, k.title, k.parent, k.link, k.content,
         ts_rank(k.fts, q.tsq)::float as rank
  from public.knowledge_chunks k, q
  where q.tsq is not null
    and k.fts @@ q.tsq
    and ts_rank(k.fts, q.tsq) >= min_rank
  order by rank desc
  limit greatest(1, least(match_count, 20));
$$;

commit;
