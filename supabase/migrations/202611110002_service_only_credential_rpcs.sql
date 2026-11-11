-- Credential RPCs are server-only (2026-11-11).
--
-- app_save_family decides "is this an admin?" from its p_actor ARGUMENT. That is
-- correct when the save-family Edge Function calls it with the identity it verified
-- from the JWT, but October also granted EXECUTE to every signed-in account, so any
-- account could pass an admin's uuid and create or rewrite families.
--
-- app_reveal_family_password is admin-checked through auth.uid(), but it returns raw
-- ciphertext together with the legacy owner uuid that decrypts it. Its only caller was
-- a browser-side fallback that has been removed; the reveal-family-password Edge
-- Function reads and decrypts on the server instead.
--
-- Both become service_role only. Nothing is dropped or redefined.
-- Looks functions up by name so it is safe on a database where some are absent.
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('app_save_family','app_reveal_family_password') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);
 END LOOP;
END $$;
