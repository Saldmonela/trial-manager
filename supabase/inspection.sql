-- Metadata only. No customer rows, function bodies, or secret values.
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
 'columns',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position)x),
 'policies',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public')x),
 'indexes',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public')x),
 'constraints',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT c.relname,con.conname,pg_get_constraintdef(con.oid) definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')x),
 'table_privileges',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT r.rolname,c.relname,has_table_privilege(r.oid,c.oid,'SELECT') can_select,has_table_privilege(r.oid,c.oid,'INSERT') can_insert,has_table_privilege(r.oid,c.oid,'UPDATE') can_update,has_table_privilege(r.oid,c.oid,'DELETE') can_delete FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relkind='r')x),
 'column_privileges',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT grantee,table_name,column_name,privilege_type FROM information_schema.column_privileges WHERE table_schema='public' AND grantee IN ('anon','authenticated'))x),
 'functions',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,p.proconfig,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')x),
 'triggers',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT t.tgname,n.nspname function_schema,p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE NOT t.tgisinternal)x),
 'publications',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT schemaname,tablename FROM pg_publication_tables WHERE pubname='supabase_realtime')x),
 'default_privileges',(SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT defaclrole::regrole,defaclnamespace::regnamespace,defaclobjtype,defaclacl FROM pg_default_acl)x)
) metadata;
COMMIT;
