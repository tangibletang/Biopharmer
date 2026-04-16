-- ============================================================
-- Migration: add `sector` column to dmd_mechanisms
-- Run once in the Supabase SQL editor.
-- ============================================================

-- 1. Add the column (safe to re-run; no-op if it already exists)
alter table dmd_mechanisms
    add column if not exists sector text not null default 'dmd';

-- 2. Back-fill existing DMD rows so the default is explicit
update dmd_mechanisms
set    sector = 'dmd'
where  sector is null or sector = 'dmd';

-- 3. Drop the now-redundant DEFAULT so future inserts must be explicit
alter table dmd_mechanisms
    alter column sector drop default;

-- 4. (Optional) Index for fast sector-scoped vector searches
create index if not exists dmd_mechanisms_sector_idx
    on dmd_mechanisms (sector);
