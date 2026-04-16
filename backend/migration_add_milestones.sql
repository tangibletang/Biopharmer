-- ============================================================
-- Migration: add milestones table for ClinicalTrials.gov data
-- Run once in the Supabase SQL editor.
-- ============================================================

create table if not exists milestones (
    id          bigserial   primary key,
    ticker      text        not null,
    date        text        not null,   -- YYYY-MM-DD
    label       text        not null,
    detail      text        not null,
    type        text        not null check (type in ('positive', 'negative', 'neutral')),
    category    text        not null check (category in ('historical', 'projected')),
    source      text        not null default 'clinicaltrials_gov',
    created_at  timestamptz not null default now()
);

create index if not exists milestones_ticker_idx on milestones (ticker);
