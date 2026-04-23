
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-automation-skip-logs-daily') THEN
    PERFORM cron.unschedule('purge-automation-skip-logs-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'purge-automation-skip-logs-daily',
  '15 3 * * *',
  $cron$ SELECT public.purge_automation_skip_logs(); $cron$
);
