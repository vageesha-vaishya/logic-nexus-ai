-- DB-VERIFICATION: flypal-pilot-log-book-schema-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

create extension if not exists pgcrypto;

create schema if not exists flypal;

create table if not exists flypal.flypal_pilot_log_book (
  id bigint generated always as identity primary key,
  ref_uuid uuid not null default gen_random_uuid(),
  aircraft text not null,
  pilot text,
  co_pilot text,
  log_no_log_page_no_flight_no text not null,
  classification text,
  departure_from text,
  arrival_to text,
  departure_time_utc timestamptz,
  arrival_time_utc timestamptz,
  block_time interval,
  in_air interval,
  ground interval,
  cycle_landing integer,
  is_processed boolean not null default false,
  failure_reason text,
  processed_date date,
  source_row_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint flypal_pilot_log_book_ref_uuid_uk unique (ref_uuid),
  constraint flypal_pilot_log_book_source_row_hash_uk unique (source_row_hash),
  constraint flypal_pilot_log_book_cycle_landing_ck
    check (cycle_landing is null or cycle_landing >= 0),
  constraint flypal_pilot_log_book_arrival_after_departure_ck
    check (
      arrival_time_utc is null
      or departure_time_utc is null
      or arrival_time_utc >= departure_time_utc
    )
);

create table if not exists flypal.flypal_pilot_log_book_import_errors (
  id bigint generated always as identity primary key,
  ref_uuid uuid not null default gen_random_uuid(),
  source_row_number integer not null,
  source_payload jsonb not null,
  error_detail text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint flypal_pilot_log_book_import_errors_ref_uuid_uk unique (ref_uuid)
);

create index if not exists flypal_pilot_log_book_aircraft_idx
  on flypal.flypal_pilot_log_book (aircraft);

create index if not exists flypal_pilot_log_book_departure_time_idx
  on flypal.flypal_pilot_log_book (departure_time_utc);

create index if not exists flypal_pilot_log_book_is_processed_idx
  on flypal.flypal_pilot_log_book (is_processed);

create index if not exists flypal_pilot_log_book_processed_date_idx
  on flypal.flypal_pilot_log_book (processed_date);

comment on table flypal.flypal_pilot_log_book is
  'FlyPal pilot log book imported from Rep1174308083 CSV with audit and processing controls.';

comment on column flypal.flypal_pilot_log_book.log_no_log_page_no_flight_no is
  'Sanitized from CSV column "Log No._Log Page No._Flight No.".';

comment on column flypal.flypal_pilot_log_book.departure_time_utc is
  'UTC datetime parsed from CSV format like DD-Mon-YYYY HH24:MI.';

comment on column flypal.flypal_pilot_log_book.source_row_hash is
  'Deterministic row signature used for idempotent load.';
