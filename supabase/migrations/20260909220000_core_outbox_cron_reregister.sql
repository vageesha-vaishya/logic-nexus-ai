-- Re-register core.outbox's monthly partition-provisioner cron job.
--
-- 20260531001700_core_outbox_partition_autoprovisioner.sql created
-- core.ensure_outbox_partition_for/_ahead() and scheduled a monthly
-- cron.schedule('outbox-partition-provisioner', ...) job to keep calling
-- them. On production, the functions exist (confirmed live) and the
-- table's partitions currently run through 2027-03 (extended by the later
-- 20260531001400 migration), so there's no immediate write failure like
-- platform.llm_usage hit -- but cron.job has no row for this job at all.
-- Same missing-cron-state pattern flagged as a side finding while fixing
-- the llm_usage ledger (20260909210000): cron.job is extension-owned
-- runtime state, not schema, and apparently didn't survive this
-- database's reconstitution from prod. Re-running the original
-- cron.schedule call is idempotent on jobname and simply re-registers it;
-- the immediate ensure_outbox_partitions_ahead(3) call is a no-op today
-- (partitions already exist through 2027-03) but costs nothing and
-- matches the llm_usage migration's belt-and-suspenders pattern.

SELECT cron.schedule(
  'outbox-partition-provisioner',
  '0 2 1 * *',
  $cron$ SELECT core.ensure_outbox_partitions_ahead(3); $cron$
);

SELECT core.ensure_outbox_partitions_ahead(3);
