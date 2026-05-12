-- Migration: Create flypal.flypal_camo_work_order table and load CSV data
-- Source: camo_work_orders.csv (scraped from FlyPal Deccan CAMO Work Order list)
-- Records: 5,300 rows covering 17-Mar-2022 to 11-May-2026

create schema if not exists flypal;

create table if not exists flypal.flypal_camo_work_order (
  id                uuid        primary key default gen_random_uuid(),
  work_order_date   date,
  wo_number         text        not null,
  reg_no            text,
  model             text,
  serial_no         text,
  created_by        text,
  doc_status        text,
  submitted_by      text,
  wo_status         text,
  closing_date      date,
  closed_by         text,
  job_completion    text,
  job_complied      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_flypal_camo_work_order_wo_number unique (wo_number)
);

comment on table flypal.flypal_camo_work_order is
  'CAMO Work Orders scraped from FlyPal Deccan system';
