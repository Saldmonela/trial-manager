-- Retire the public storefront (2026-11-11).
--
-- The app is now an internal admin tool: there is no public catalogue, no public
-- ordering and no public status lookup. Nothing calls these RPCs any more, so the
-- client-facing roles lose EXECUTE on them. This also removes two weaknesses:
--   * app_create_order / app_lookup_status were callable directly by anon, which
--     bypassed the rate limits that only existed in the (now deleted) Edge Functions;
--   * app_issue_status_code trusted a caller-supplied p_actor for its admin check.
--
-- Deliberately NOT done here: no table, row or function is dropped. Order history
-- (join_requests), status codes and settings stay intact, and service_role keeps
-- EXECUTE, so this is reversible by re-granting. Removing the dormant objects is a
-- separate, explicitly reviewed data operation.
--
-- Looks functions up by name so it is safe on a database where some are absent.
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('app_public_catalog','app_create_order','app_lookup_status','app_issue_status_code') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);
 END LOOP;
END $$;
