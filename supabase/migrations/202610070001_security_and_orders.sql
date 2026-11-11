-- Reviewed upgrade only; see docs/security-rollout.md. Never run historical SQL
-- root scripts afterwards. Credentials and legacy identifiers are preserved.
BEGIN;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS owner_password_v1 text;
ALTER TABLE public.families ALTER COLUMN owner_password DROP NOT NULL;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS product_type text;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS target_email text;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS price_snapshot numeric;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS currency_snapshot text;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS product_name_snapshot text;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS payment_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS admin_note text;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS fulfilled_member_id text REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.join_requests ADD COLUMN IF NOT EXISTS fulfilled_expiry_date timestamptz;
-- Production uses UUID order ids, historical bootstrap used TEXT. Preserve the
-- textual identifiers instead of inventing replacement ids or losing old orders.
ALTER TABLE public.join_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.join_requests ALTER COLUMN id TYPE text USING id::text;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='join_requests' AND column_name='requester_name') THEN
  EXECUTE 'UPDATE public.join_requests SET name=COALESCE(NULLIF(name, ''''),requester_name),email=COALESCE(NULLIF(email, ''''),requester_email),note=COALESCE(note,message)';
 END IF;
END $$;
UPDATE public.join_requests r SET product_type=COALESCE(r.product_type,f.product_type,'slot') FROM public.families f WHERE f.id=r.family_id;
UPDATE public.join_requests SET product_type='account_custom' WHERE family_id IS NULL AND product_type IS NULL;
-- Legacy prices are intentionally NOT fabricated from today's prices.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.join_requests'::regclass AND contype='f' AND confrelid='public.families'::regclass LOOP
  EXECUTE format('ALTER TABLE public.join_requests DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_family_history_fk') THEN
  ALTER TABLE public.join_requests ADD CONSTRAINT orders_family_history_fk FOREIGN KEY(family_id) REFERENCES public.families(id) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key ON public.join_requests(idempotency_key) WHERE idempotency_key IS NOT NULL;
-- Existing duplicate members must be reconciled explicitly; never delete them.
CREATE UNIQUE INDEX IF NOT EXISTS members_unique_email ON public.members(family_id,lower(btrim(email))) WHERE email IS NOT NULL AND btrim(email)<>'';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='family_nonnegative_prices') THEN
  ALTER TABLE public.families ADD CONSTRAINT family_nonnegative_prices CHECK(COALESCE(price_monthly,0)>=0 AND COALESCE(price_annual,0)>=0 AND COALESCE(price_sale,0)>=0) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='family_valid_storage') THEN
  ALTER TABLE public.families ADD CONSTRAINT family_valid_storage CHECK(storage_used IS NULL OR storage_used BETWEEN 0 AND 5120) NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='member_nonnegative_storage') THEN
  ALTER TABLE public.members ADD CONSTRAINT member_nonnegative_storage CHECK(storage_used IS NULL OR storage_used>=0) NOT VALID;
 END IF;
END $$;
ALTER TABLE public.oauth_states ADD COLUMN IF NOT EXISTS browser_nonce_hash text;
-- timestamptz defaults must not reinterpret a UTC wall-clock in a local zone.
ALTER TABLE public.oauth_states ALTER COLUMN expires_at SET DEFAULT (now()+interval '10 minutes');
ALTER TABLE public.oauth_states ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.connected_accounts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.connected_accounts ALTER COLUMN updated_at SET DEFAULT now();
CREATE TABLE IF NOT EXISTS public.app_rate_limits(bucket text NOT NULL,window_start timestamptz NOT NULL,hits integer NOT NULL,PRIMARY KEY(bucket,window_start));
CREATE INDEX IF NOT EXISTS app_rate_limits_expiration ON public.app_rate_limits(window_start);
CREATE TABLE IF NOT EXISTS public.app_status_codes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id text REFERENCES public.members(id) ON DELETE CASCADE,order_id text REFERENCES public.join_requests(id) ON DELETE CASCADE,code_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK((member_id IS NULL)<>(order_id IS NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS status_member_code ON public.app_status_codes(member_id) WHERE member_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS status_order_code ON public.app_status_codes(order_id) WHERE order_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.app_audit_log(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid REFERENCES auth.users(id),object_type text NOT NULL,object_id text NOT NULL,action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());

CREATE OR REPLACE FUNCTION public.app_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
$$;
CREATE OR REPLACE FUNCTION public.app_require_admin() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT public.app_is_admin() THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF; RETURN auth.uid(); END $$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO public.profiles(id,email,role) VALUES(NEW.id,NEW.email,'public') ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies are permissive (OR-combined): remove ALL old policies, including the
-- differently named policies found on the live database, not just repo names.
DO $$ DECLARE p record; t text; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('families','members','join_requests','profiles','settings','admin_users','connected_accounts','oauth_states','rpc_rate_limits','app_rate_limits','app_status_codes','app_audit_log') LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['families','members','join_requests','profiles','settings','admin_users','connected_accounts','oauth_states','rpc_rate_limits','app_rate_limits','app_status_codes','app_audit_log'] LOOP
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
   -- Table REVOKE does not remove separately granted column privileges.
   EXECUTE (SELECT format('REVOKE SELECT (%s),INSERT (%s),UPDATE (%s),REFERENCES (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,cols,t) FROM (SELECT string_agg(quote_ident(column_name),',') cols FROM information_schema.columns WHERE table_schema='public' AND table_name=t) x);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  END IF;
 END LOOP;
END $$;
CREATE POLICY app_admin_families ON public.families FOR SELECT TO authenticated USING(public.app_is_admin());
CREATE POLICY app_admin_members ON public.members FOR ALL TO authenticated USING(public.app_is_admin()) WITH CHECK(public.app_is_admin());
CREATE POLICY app_admin_orders ON public.join_requests FOR SELECT TO authenticated USING(public.app_is_admin());
CREATE POLICY app_profile_self ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY app_admin_settings ON public.settings FOR SELECT TO authenticated USING(public.app_is_admin());
CREATE POLICY app_admin_connections ON public.connected_accounts FOR ALL TO authenticated USING(public.app_is_admin() AND user_id=auth.uid()) WITH CHECK(public.app_is_admin() AND user_id=auth.uid());
CREATE POLICY app_admin_audit ON public.app_audit_log FOR SELECT TO authenticated USING(public.app_is_admin());
GRANT SELECT(id,name,owner_email,expiry_date,storage_used,notes,created_at,user_id,is_public,is_active,price_monthly,price_annual,price_sale,currency,product_type,sold_to_name,sold_to_email,sold_at,is_banned,archived_at) ON public.families TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.members TO authenticated;
GRANT SELECT ON public.join_requests,public.settings,public.app_audit_log TO authenticated;
GRANT SELECT(id,email,role) ON public.profiles TO authenticated;
GRANT SELECT(id,user_id,provider,provider_account_id,email,display_name,avatar_url,status,total_bytes,used_bytes,available_bytes,trash_bytes,last_synced_at,created_at),DELETE ON public.connected_accounts TO authenticated;

CREATE OR REPLACE FUNCTION public.app_validate_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE count_members integer; f public.families; BEGIN
 -- Sorted parent locks also cover moves; every insertion uses the same lock.
 IF TG_OP='UPDATE' THEN PERFORM id FROM public.families WHERE id IN (OLD.family_id,NEW.family_id) ORDER BY id FOR UPDATE;
 ELSE PERFORM id FROM public.families WHERE id=NEW.family_id FOR UPDATE; END IF;
 SELECT * INTO f FROM public.families WHERE id=NEW.family_id;
 IF NOT FOUND OR f.archived_at IS NOT NULL THEN RAISE EXCEPTION 'FAMILY_UNAVAILABLE'; END IF;
 NEW.email=lower(btrim(NEW.email));
 IF NEW.email IS NULL OR NEW.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(NEW.email)>254 THEN RAISE EXCEPTION 'INVALID_EMAIL'; END IF;
 SELECT count(*) INTO count_members FROM public.members WHERE family_id=NEW.family_id AND id<>NEW.id;
 IF count_members>=5 THEN RAISE EXCEPTION 'FAMILY_FULL'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS app_validate_member ON public.members;
CREATE TRIGGER app_validate_member BEFORE INSERT OR UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.app_validate_member();
CREATE OR REPLACE FUNCTION public.app_sync_order_aliases() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW=jsonb_populate_record(NEW,jsonb_build_object('requester_name',NEW.name,'requester_email',NEW.email,'message',NEW.note)); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS app_sync_order_aliases ON public.join_requests;
CREATE TRIGGER app_sync_order_aliases BEFORE INSERT OR UPDATE ON public.join_requests FOR EACH ROW EXECUTE FUNCTION public.app_sync_order_aliases();

CREATE OR REPLACE FUNCTION public.app_admin_families() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; BEGIN PERFORM public.app_require_admin();
 SELECT COALESCE(jsonb_agg((to_jsonb(f)-'owner_password'-'owner_password_v1') || jsonb_build_object('credential_status',CASE WHEN COALESCE(f.owner_password_v1,f.owner_password,'')<>'' THEN 'available' ELSE 'missing' END,'credential_version',CASE WHEN f.owner_password_v1 IS NOT NULL THEN 'v1' ELSE 'legacy' END,'members',COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM public.members m WHERE m.family_id=f.id),'[]'::jsonb)) ORDER BY f.created_at), '[]'::jsonb) INTO result FROM public.families f WHERE f.archived_at IS NULL;
 RETURN result; END $$;
CREATE OR REPLACE FUNCTION public.app_public_catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('families',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'expiry_date',f.expiry_date,'storage_used',f.storage_used,'price_monthly',f.price_monthly,'price_annual',f.price_annual,'price_sale',f.price_sale,'currency',f.currency,'product_type',f.product_type,'created_at',f.created_at,'sold_at',f.sold_at,'slots_available',greatest(0,5-(SELECT count(*) FROM public.members m WHERE m.family_id=f.id)))) FROM public.families f WHERE f.archived_at IS NULL AND f.is_public AND f.is_active AND NOT COALESCE(f.is_banned,false)), '[]'::jsonb),'settings',COALESCE((SELECT jsonb_object_agg(key,value) FROM public.settings WHERE key IN ('service_card_style','upgrade_service_title','upgrade_service_desc','upgrade_service_price','upgrade_service_features','upgrade_payment_type','upgrade_validity','public_orders_enabled','public_whatsapp','public_payment_instructions','public_terms')), '{}'::jsonb))
$$;
CREATE OR REPLACE FUNCTION public.app_consume_rate(p_bucket text,p_limit integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE window_time timestamptz; n integer; BEGIN
 IF p_limit<=0 OR p_seconds<=0 THEN RAISE EXCEPTION 'INVALID_RATE_LIMIT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('rate:'||p_bucket,0));
 window_time=clock_timestamp();
 SELECT COALESCE(sum(hits),0) INTO n FROM public.app_rate_limits WHERE bucket=p_bucket AND window_start>window_time-make_interval(secs=>p_seconds);
 IF n>=p_limit THEN RETURN false; END IF;
 INSERT INTO public.app_rate_limits VALUES(p_bucket,window_time,1) ON CONFLICT(bucket,window_start) DO UPDATE SET hits=public.app_rate_limits.hits+1;
 DELETE FROM public.app_rate_limits WHERE window_start<now()-interval '1 day';
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.app_create_order(p_input jsonb,p_email_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.families; existing public.join_requests; id_value text; prod text; price numeric; curr text; title text; settings_json jsonb; buyer text; cycle text; idem uuid; BEGIN
 buyer=lower(btrim(p_input->>'email')); prod=p_input->>'productType'; cycle=p_input->>'billingCycle'; idem=(p_input->>'idempotencyKey')::uuid;
 -- Serialise retries for this key before checking the previously created row.
 PERFORM pg_advisory_xact_lock(hashtextextended(idem::text,0));
 SELECT * INTO existing FROM public.join_requests WHERE idempotency_key=idem;
 IF FOUND THEN
  IF existing.email<>buyer OR existing.product_type<>prod OR COALESCE(existing.family_id,'')<>COALESCE(p_input->>'familyId','') OR COALESCE(existing.target_email,'')<>COALESCE(lower(btrim(p_input->>'targetEmail')),'') OR COALESCE(existing.billing_cycle,'')<>COALESCE(cycle,'') THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('orderId',existing.id,'amount',existing.price_snapshot,'currency',existing.currency_snapshot,'productName',existing.product_name_snapshot);
 END IF;
 SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) INTO settings_json FROM public.settings;
 IF NOT COALESCE((settings_json->>'public_orders_enabled')::boolean,false) OR COALESCE(settings_json->>'public_whatsapp','')='' OR COALESCE(settings_json->>'public_payment_instructions','')='' OR COALESCE(settings_json->>'public_terms','')='' THEN RAISE EXCEPTION 'ORDERS_DISABLED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pending:'||buyer||':'||COALESCE(p_input->>'familyId','upgrade-service'),0));
 IF EXISTS(SELECT 1 FROM public.join_requests WHERE lower(btrim(email))=buyer AND status='pending' AND COALESCE(family_id,'upgrade-service')=COALESCE(p_input->>'familyId','upgrade-service')) THEN RAISE EXCEPTION 'DUPLICATE_PENDING'; END IF;
 IF prod='account_custom' THEN
  IF COALESCE(p_input->>'familyId','')<>'' THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
  IF COALESCE(settings_json->>'upgrade_service_title','')='' OR COALESCE(settings_json->>'upgrade_validity','')='' THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
  price=(settings_json->>'upgrade_service_price')::numeric; curr='IDR'; title=settings_json->>'upgrade_service_title'; cycle=NULL;
 ELSE
  SELECT * INTO f FROM public.families WHERE id=p_input->>'familyId' FOR UPDATE;
  IF NOT FOUND OR f.archived_at IS NOT NULL OR NOT f.is_public OR NOT f.is_active OR COALESCE(f.is_banned,false) OR f.sold_at IS NOT NULL OR (f.expiry_date IS NOT NULL AND f.expiry_date<=now()) OR f.product_type<>prod THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
  IF prod='slot' THEN
   IF (SELECT count(*) FROM public.members WHERE family_id=f.id)>=5 THEN RAISE EXCEPTION 'FAMILY_FULL'; END IF;
   IF cycle NOT IN ('monthly','annual') OR cycle IS NULL THEN RAISE EXCEPTION 'INVALID_BILLING_CYCLE'; END IF;
   price=CASE WHEN cycle='annual' THEN f.price_annual ELSE f.price_monthly END;
  ELSIF prod='account_ready' THEN price=f.price_sale; cycle=NULL;
  ELSE RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
  curr=COALESCE(f.currency,'IDR'); title=f.name;
 END IF;
 IF price IS NULL OR price<=0 THEN RAISE EXCEPTION 'PRICE_UNAVAILABLE'; END IF;
 id_value=gen_random_uuid()::text;
 INSERT INTO public.join_requests(id,family_id,name,email,note,status,product_type,billing_cycle,target_email,price_snapshot,currency_snapshot,product_name_snapshot,idempotency_key)
 VALUES(id_value,NULLIF(p_input->>'familyId',''),btrim(p_input->>'name'),buyer,NULLIF(p_input->>'note',''),'pending',prod,cycle,CASE WHEN prod='account_custom' THEN lower(btrim(p_input->>'targetEmail')) ELSE NULL END,price,curr,title,idem);
 RETURN jsonb_build_object('orderId',id_value,'amount',price,'currency',curr,'productName',title,'whatsapp',settings_json->>'public_whatsapp','paymentInstructions',settings_json->>'public_payment_instructions','terms',settings_json->>'public_terms');
END $$;

CREATE OR REPLACE FUNCTION public.app_record_payment(p_order_id text,p_verified boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; BEGIN actor=public.app_require_admin();
 UPDATE public.join_requests SET payment_verified=p_verified WHERE id=p_order_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'PENDING_ORDER_REQUIRED'; END IF;
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action,details) VALUES(actor,'order',p_order_id,'payment_verification',jsonb_build_object('verified',p_verified));
END $$;
CREATE OR REPLACE FUNCTION public.app_transition_order(p_order_id text,p_status text,p_payment_verified boolean DEFAULT false,p_reason text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; r public.join_requests; f public.families; member_id text; expiration timestamptz; months integer; warning text; BEGIN
 actor=public.app_require_admin(); SELECT * INTO r FROM public.join_requests WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF r.status=p_status AND r.status<>'pending' THEN RETURN jsonb_build_object('orderId',r.id,'status',r.status); END IF;
 IF r.status<>'pending' OR p_status NOT IN ('approved','rejected','cancelled') THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
 IF p_status='approved' THEN
  IF NOT p_payment_verified OR NOT r.payment_verified THEN RAISE EXCEPTION 'PAYMENT_NOT_VERIFIED'; END IF;
  IF r.product_type IN ('slot','account_ready') THEN
   SELECT * INTO f FROM public.families WHERE id=r.family_id FOR UPDATE;
   IF NOT FOUND OR f.archived_at IS NOT NULL OR NOT f.is_active OR COALESCE(f.is_banned,false) OR f.sold_at IS NOT NULL OR (f.expiry_date IS NOT NULL AND f.expiry_date<=now()) THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
   IF r.product_type='slot' THEN
    months=CASE r.billing_cycle WHEN 'monthly' THEN 1 WHEN 'annual' THEN 12 ELSE NULL END;
    IF months IS NULL THEN RAISE EXCEPTION 'INVALID_BILLING_CYCLE'; END IF;
    expiration=(((now() AT TIME ZONE 'Asia/Jakarta')::date+make_interval(months=>months))::date+time '23:59:59') AT TIME ZONE 'Asia/Jakarta';
    member_id=gen_random_uuid()::text;
    INSERT INTO public.members(id,family_id,name,email,added_at,member_type,expiry_date) VALUES(member_id,r.family_id,r.name,r.email,now(),'pembeli',expiration);
    IF f.expiry_date IS NOT NULL AND expiration>f.expiry_date THEN warning='Masa aktif member melampaui family; family perlu diperpanjang.'; END IF;
   ELSE UPDATE public.families SET sold_to_name=r.name,sold_to_email=r.email,sold_at=now() WHERE id=f.id; END IF;
  ELSIF r.product_type<>'account_custom' THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
 ELSIF COALESCE(btrim(p_reason),'')='' THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 UPDATE public.join_requests SET status=p_status,payment_verified=CASE WHEN p_status='approved' THEN true ELSE payment_verified END,reviewed_by=actor,reviewed_at=now(),admin_note=p_reason,fulfilled_member_id=member_id,fulfilled_expiry_date=expiration WHERE id=r.id;
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action,details) VALUES(actor,'order',r.id,p_status,jsonb_build_object('previousStatus',r.status,'paymentVerified',p_payment_verified,'reason',p_reason));
 RETURN jsonb_build_object('orderId',r.id,'status',p_status,'warning',warning);
END $$;

CREATE OR REPLACE FUNCTION public.app_archive_family(p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; BEGIN actor=public.app_require_admin(); UPDATE public.families SET archived_at=now(),is_active=false WHERE id=p_id AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'FAMILY_NOT_FOUND'; END IF;
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action) VALUES(actor,'family',p_id,'archived'); END $$;
CREATE OR REPLACE FUNCTION public.app_cancel_sale(p_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; BEGIN actor=public.app_require_admin(); UPDATE public.families SET sold_at=NULL,sold_to_name=NULL,sold_to_email=NULL WHERE id=p_id AND sold_at IS NOT NULL AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'SALE_NOT_FOUND'; END IF;
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action) VALUES(actor,'family',p_id,'sale_cancelled'); END $$;

CREATE OR REPLACE FUNCTION public.app_reveal_family_password(p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; f public.families; BEGIN
 actor=public.app_require_admin();
 SELECT * INTO f FROM public.families WHERE id=p_id AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'FAMILY_NOT_FOUND'; END IF;
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action) VALUES(actor,'family',p_id,'credential_revealed');
 RETURN jsonb_build_object('id',f.id,'user_id',f.user_id,'owner_password',f.owner_password,'owner_password_v1',f.owner_password_v1);
END $$;

CREATE OR REPLACE FUNCTION public.app_save_family(p_actor uuid,p_input jsonb,p_ciphertext text DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; id_value text; m jsonb; BEGIN
 actor=COALESCE(p_actor,auth.uid());
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND role='admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 id_value=p_input->>'id';
 IF p_input->>'operation'='create' THEN
  IF p_ciphertext IS NULL THEN RAISE EXCEPTION 'PASSWORD_REQUIRED'; END IF;
  INSERT INTO public.families(id,user_id,name,owner_email,owner_password,owner_password_v1,expiry_date,storage_used,notes,price_monthly,price_annual,price_sale,currency,product_type,is_banned,is_public,is_active)
  VALUES(id_value,actor,p_input->>'name',lower(p_input->>'ownerEmail'),CASE WHEN p_ciphertext NOT LIKE 'v1:%' THEN p_ciphertext ELSE NULL END,p_ciphertext,NULLIF(p_input->>'expiryDate','')::timestamptz,(p_input->>'storageUsed')::numeric,p_input->>'notes',(p_input->>'priceMonthly')::numeric,(p_input->>'priceAnnual')::numeric,(p_input->>'priceSale')::numeric,COALESCE(p_input->>'currency','IDR'),p_input->>'productType',COALESCE((p_input->>'isBanned')::boolean,false),COALESCE((p_input->>'isPublic')::boolean,true),COALESCE((p_input->>'isActive')::boolean,true));
  FOR m IN SELECT value FROM jsonb_array_elements(COALESCE(p_input->'members','[]'::jsonb)) LOOP
   INSERT INTO public.members(id,family_id,name,email,added_at,storage_used,member_type,expiry_date) VALUES(COALESCE(m->>'id',gen_random_uuid()::text),id_value,m->>'name',m->>'email',COALESCE(NULLIF(m->>'addedAt','')::timestamptz,now()),COALESCE((m->>'storageUsed')::numeric,0),COALESCE(m->>'memberType','pembeli'),NULLIF(m->>'expiryDate','')::timestamptz);
  END LOOP;
 ELSIF p_input->>'operation'='update' THEN
  UPDATE public.families SET name=p_input->>'name',owner_email=lower(p_input->>'ownerEmail'),owner_password=CASE WHEN p_ciphertext IS NOT NULL AND p_ciphertext NOT LIKE 'v1:%' THEN p_ciphertext ELSE owner_password END,owner_password_v1=COALESCE(p_ciphertext,owner_password_v1),expiry_date=NULLIF(p_input->>'expiryDate','')::timestamptz,storage_used=(p_input->>'storageUsed')::numeric,notes=p_input->>'notes',price_monthly=(p_input->>'priceMonthly')::numeric,price_annual=(p_input->>'priceAnnual')::numeric,price_sale=(p_input->>'priceSale')::numeric,currency=COALESCE(p_input->>'currency','IDR'),product_type=p_input->>'productType',is_banned=COALESCE((p_input->>'isBanned')::boolean,false),is_public=COALESCE((p_input->>'isPublic')::boolean,is_public),is_active=COALESCE((p_input->>'isActive')::boolean,is_active) WHERE id=id_value AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAMILY_NOT_FOUND'; END IF;
 ELSE RAISE EXCEPTION 'INVALID_OPERATION'; END IF;
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action) VALUES(actor,'family',id_value,p_input->>'operation'); RETURN id_value;
END $$;
CREATE OR REPLACE FUNCTION public.app_save_settings(p_settings jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; pair record; BEGIN actor=public.app_require_admin();
 FOR pair IN SELECT * FROM jsonb_each(p_settings) LOOP
  IF pair.key NOT IN ('service_card_style','upgrade_service_title','upgrade_service_desc','upgrade_service_price','upgrade_service_features','upgrade_payment_type','upgrade_validity','public_orders_enabled','public_whatsapp','public_payment_instructions','public_terms') THEN RAISE EXCEPTION 'INVALID_SETTING'; END IF;
  IF pair.key='upgrade_service_price' AND (jsonb_typeof(pair.value)<>'number' OR (pair.value#>>'{}')::numeric<0) THEN RAISE EXCEPTION 'INVALID_PRICE'; END IF;
  IF pair.key='public_orders_enabled' AND jsonb_typeof(pair.value)<>'boolean' THEN RAISE EXCEPTION 'INVALID_SETTING'; END IF;
  IF pair.key NOT IN ('upgrade_service_price','upgrade_service_features','public_orders_enabled') AND (jsonb_typeof(pair.value)<>'string' OR length(pair.value#>>'{}')>2000) THEN RAISE EXCEPTION 'INVALID_SETTING'; END IF;
  IF pair.key='upgrade_service_features' AND (jsonb_typeof(pair.value)<>'array' OR jsonb_array_length(pair.value)>5) THEN RAISE EXCEPTION 'INVALID_SETTING'; END IF;
  INSERT INTO public.settings(key,value,updated_at) VALUES(pair.key,pair.value,now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.settings WHERE key='public_orders_enabled' AND value='true'::jsonb) THEN
  IF NOT EXISTS(SELECT 1 FROM public.settings WHERE key='public_whatsapp' AND value#>>'{}' ~ '^[0-9]{8,15}$') OR NOT EXISTS(SELECT 1 FROM public.settings WHERE key='public_payment_instructions' AND length(btrim(value#>>'{}')) BETWEEN 1 AND 2000) OR NOT EXISTS(SELECT 1 FROM public.settings WHERE key='public_terms' AND length(btrim(value#>>'{}')) BETWEEN 1 AND 2000) THEN RAISE EXCEPTION 'PUBLIC_CONFIGURATION_REQUIRED'; END IF;
 END IF;
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action,details) VALUES(actor,'settings','public','updated',jsonb_build_object('keys',ARRAY(SELECT jsonb_object_keys(p_settings))));
END $$;

CREATE OR REPLACE FUNCTION public.app_migrate_credential(p_actor uuid,p_id text,p_expected_legacy text,p_ciphertext text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 UPDATE public.families SET owner_password_v1=p_ciphertext WHERE id=p_id AND owner_password=p_expected_legacy AND owner_password_v1 IS NULL AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'CREDENTIAL_CHANGED'; END IF;
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action) VALUES(p_actor,'family',p_id,'credential_migrated');
END $$;

CREATE OR REPLACE FUNCTION public.app_issue_status_code(p_actor uuid,p_hash text,p_member_id text DEFAULT NULL,p_order_id text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; BEGIN
 actor=COALESCE(p_actor,auth.uid());
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND role='admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 IF (p_member_id IS NULL)=(p_order_id IS NULL) OR length(p_hash)<>64 THEN RAISE EXCEPTION 'INVALID_CODE_SCOPE'; END IF;
 IF p_member_id IS NOT NULL THEN
  PERFORM id FROM public.members WHERE id=p_member_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
  DELETE FROM public.app_status_codes WHERE member_id=p_member_id;
 ELSE
  PERFORM id FROM public.join_requests WHERE id=p_order_id AND status='approved' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'APPROVED_ORDER_REQUIRED'; END IF;
  DELETE FROM public.app_status_codes WHERE order_id=p_order_id;
 END IF;
 INSERT INTO public.app_status_codes(member_id,order_id,code_hash) VALUES(p_member_id,p_order_id,p_hash);
 INSERT INTO public.app_audit_log(actor_id,object_type,object_id,action) VALUES(actor,'status_code',COALESCE(p_member_id,p_order_id),'rotated');
END $$;
CREATE OR REPLACE FUNCTION public.app_lookup_status(p_email text,p_hash text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(info),'[]'::jsonb) FROM (
 SELECT jsonb_build_object('member_name',m.name,'email',m.email,'family_name',f.name,'member_type',m.member_type,'member_expiry_date',m.expiry_date,'family_expiry_date',f.expiry_date,'added_at',m.added_at,'storage_used_gb',m.storage_used) info
 FROM public.app_status_codes c JOIN public.members m ON m.id=c.member_id JOIN public.families f ON f.id=m.family_id WHERE c.code_hash=p_hash AND lower(m.email)=lower(p_email)
 UNION ALL
 SELECT jsonb_build_object('member_name',r.name,'email',r.email,'family_name',COALESCE(r.product_name_snapshot,f.name,'Upgrade'),'member_type','pembeli','member_expiry_date',r.fulfilled_expiry_date,'family_expiry_date',f.expiry_date,'added_at',r.created_at,'storage_used_gb',COALESCE(m.storage_used,0),'order_status',r.status,'product_type',r.product_type)
 FROM public.app_status_codes c JOIN public.join_requests r ON r.id=c.order_id LEFT JOIN public.families f ON f.id=r.family_id LEFT JOIN public.members m ON m.id=r.fulfilled_member_id WHERE c.code_hash=p_hash AND lower(r.email)=lower(p_email)
 ) results
$$;
CREATE OR REPLACE FUNCTION public.app_consume_oauth_state(p_state text,p_actor uuid,p_nonce_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.oauth_states; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
 UPDATE public.oauth_states SET consumed_at=now() WHERE state=p_state AND user_id=p_actor AND browser_nonce_hash=p_nonce_hash AND consumed_at IS NULL AND expires_at>now() RETURNING * INTO s;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_OAUTH_STATE'; END IF; RETURN to_jsonb(s);
END $$;

-- Close every legacy definer RPC as well as the email-only lookup. Old helper
-- functions may remain for history, but cannot bypass the new public surface.
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.prosecdef OR p.proname='lookup_member_status') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.app_is_admin(),public.app_require_admin(),public.app_admin_families(),public.app_reveal_family_password(text),public.app_save_family(uuid,jsonb,text),public.app_issue_status_code(uuid,text,text,text),public.app_record_payment(text,boolean),public.app_transition_order(text,text,boolean,text),public.app_archive_family(text),public.app_cancel_sale(text),public.app_save_settings(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_public_catalog(),public.app_create_order(jsonb,text),public.app_lookup_status(text,text) TO anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.app_audit_log_id_seq TO service_role;
-- Private token/credential tables must never enter a row publication.
DO $$ DECLARE t text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH t IN ARRAY ARRAY['families','connected_accounts','oauth_states','app_status_codes'] LOOP
   IF EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I',t); END IF;
  END LOOP;
 END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
