-- ============================================================
-- Biopharmer — Phase 1 Schema
-- Run this once in the Supabase SQL editor before seed.py
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Mechanism table (one row per company in the DMD micro-universe)
create table if not exists dmd_mechanisms (
    id             bigserial    primary key,
    ticker         text         unique not null,
    company_name   text         not null,
    mechanism_text text         not null,
    embedding      vector(1536)          -- text-embedding-3-small output
);

-- Index for fast cosine similarity search
create index if not exists dmd_mechanisms_embedding_idx
    on dmd_mechanisms
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 10);

-- 3. Clinical metrics table (1-to-1 with dmd_mechanisms)
create table if not exists clinical_metrics (
    id              bigserial primary key,
    ticker          text      not null references dmd_mechanisms(ticker) on delete cascade,
    emax_pct        numeric(5,2),   -- peak dystrophin restoration (% of normal)
    half_life_days  numeric(6,2),   -- serum/tissue half-life in days
    grade_3_ae_pct  numeric(5,2),   -- rate of Grade ≥3 adverse events (%)
    audit_text      text,
    unique (ticker)
);

-- ============================================================
-- Helper RPC used by seed.py to run DDL programmatically
-- (optional — only needed if you want seed.py to self-migrate)
-- ============================================================
create or replace function exec_sql(sql text)
returns void
language plpgsql
security definer
as $$
begin
  execute sql;
end;
$$;
