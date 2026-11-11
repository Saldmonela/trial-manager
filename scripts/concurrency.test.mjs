import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {bootstrapSql} from './bootstrap-db.mjs';
const url=process.env.TEST_DATABASE_URL;
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
let root;
before(async()=>{
 if(!url)return;
 const parsed=new URL(url);if(!['127.0.0.1','localhost','::1'].includes(parsed.hostname)||parsed.pathname!=='/trial_manager_test')throw new Error('Only the loopback synthetic test database is permitted.');
 root=new pg.Client({connectionString:url});await root.connect();
 await root.query("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;");
 await root.query(bootstrapSql());await root.query("INSERT INTO auth.users VALUES('"+A+"','admin-a@example.test'),('"+B+"','admin-b@example.test');UPDATE public.profiles SET role='admin';");
});
after(async()=>{await root?.end();});
async function actor(client,id){
 await client.query('BEGIN;SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);
}
async function createOrder(email,family,product='slot'){
 const input={name:'Synthetic Buyer',email,familyId:family,productType:product,billingCycle:product==='slot'?'monthly':null,idempotencyKey:crypto.randomUUID()};
 return (await root.query('SELECT public.app_create_order($1::jsonb,$2) data',[JSON.stringify(input),'hash'])).rows[0].data.orderId;
}
async function approve(id,actorId) {
 const client=new pg.Client({connectionString:url});await client.connect();
 try {
  await actor(client,actorId);await client.query('SELECT public.app_record_payment($1,true)',[id]);await client.query('COMMIT');
  await actor(client,actorId);const result=await client.query("SELECT public.app_transition_order($1,'approved',true,NULL)",[id]);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
}
test('two real sessions competing for the last slot yield exactly one approval',{skip:!url},async()=>{
 await root.query("INSERT INTO public.settings(key,value) VALUES('public_orders_enabled','true'),('public_whatsapp','\"6281234567890\"'),('public_payment_instructions','\"Synthetic instructions\"'),('public_terms','\"Synthetic terms\"');");
 await root.query("INSERT INTO public.families(id,user_id,name,owner_email,product_type,price_monthly,expiry_date) VALUES('slot',$1,'Slot','owner@example.test','slot',25000,'2099-12-31')",[A]);
 for(let i=0;i<4;i++)await root.query('INSERT INTO public.members(id,family_id,email) VALUES($1,$2,$3)',['m'+i,'slot','m'+i+'@example.test']);
 const first=await createOrder('first@example.test','slot'),second=await createOrder('second@example.test','slot');
 const results=await Promise.allSettled([approve(first,A),approve(second,B)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(Number((await root.query("SELECT count(*) FROM public.members WHERE family_id='slot'")).rows[0].count),5);
 assert.equal(Number((await root.query("SELECT count(*) FROM public.join_requests WHERE status='pending'")).rows[0].count),1);
});
test('two real sessions cannot sell the same ready account twice',{skip:!url},async()=>{
 await root.query("INSERT INTO public.families(id,user_id,name,owner_email,product_type,price_sale,expiry_date) VALUES('ready',$1,'Ready','owner@example.test','account_ready',100000,'2099-12-31')",[A]);
 const first=await createOrder('first-ready@example.test','ready','account_ready'),second=await createOrder('second-ready@example.test','ready','account_ready');
 const results=await Promise.allSettled([approve(first,A),approve(second,B)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(Number((await root.query("SELECT count(*) FROM public.join_requests WHERE family_id='ready' AND status='approved'")).rows[0].count),1);
});
test('two direct member writes cannot race past capacity',{skip:!url},async()=>{
 await root.query("INSERT INTO public.families(id,user_id,name,owner_email,product_type,price_monthly,expiry_date) VALUES('direct',$1,'Direct','owner@example.test','slot',25000,'2099-12-31')",[A]);
 for(let i=0;i<4;i++)await root.query('INSERT INTO public.members(id,family_id,email) VALUES($1,$2,$3)',['d'+i,'direct','d'+i+'@example.test']);
 async function insert(id,actorId){const client=new pg.Client({connectionString:url});await client.connect();try{await actor(client,actorId);await client.query("INSERT INTO public.members(id,family_id,email) VALUES($1,'direct',$2)",[id,id+'@example.test']);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}}
 const results=await Promise.allSettled([insert('d4',A),insert('d5',B)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
