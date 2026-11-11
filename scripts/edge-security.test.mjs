import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const root=path.resolve('supabase/functions');
const KEY=Buffer.alloc(32,7).toString('base64');
async function runtime(entry,options={}) {
 const queries=[]; const rpcCalls=[]; let handler;
 const context=vm.createContext({Deno:{env:{get:name=>({FRONTEND_URL:'https://shop.example.test',FAMILY_CREDENTIAL_KEY_V1:KEY,TOKEN_ENCRYPTION_KEY:KEY,GOOGLE_CLIENT_ID:'synthetic-client',GOOGLE_CLIENT_SECRET:'synthetic-client-secret',GOOGLE_OAUTH_REDIRECT_URI:'https://edge.example.test/callback',...options.env})[name]},serve:fn=>{handler=fn}},crypto:webcrypto,TextEncoder,TextDecoder,atob,btoa,Date,URL,URLSearchParams,Request,Response,AbortSignal,fetch:options.fetch||(()=>{throw new Error('Network calls prohibited in tests');}),console:{error(){},warn(){},log(){}}});
 const synthetic=bindings=>new vm.SyntheticModule(Object.keys(bindings),function(){for(const[k,v]of Object.entries(bindings))this.setExport(k,v);},{context});
 const svc={from(table){const q={table,action:'select',payload:null,filters:[],columns:null,single:false};
  const c={select(columns){q.columns=columns;return c;},insert(value){q.action='insert';q.payload=value;return c;},update(value){q.action='update';q.payload=value;return c;},upsert(value){q.action='upsert';q.payload=value;return c;},delete(){q.action='delete';return c;},eq(column,value){q.filters.push([column,'eq',value]);return c;},is(column,value){q.filters.push([column,'is',value]);return c;},gt(column,value){q.filters.push([column,'gt',value]);return c;},lt(){return c;},in(){return c;},single(){q.single=true;return c;},maybeSingle(){q.single=true;return c;},then(resolve,reject){
   queries.push(q);const result=table==='profiles'?{data:{role:options.admin===false?'public':'admin'},error:null}:(options.query?.(q)??{data:q.action==='select'?null:{id:'synthetic-id'},error:null});
   return Promise.resolve(result).then(resolve,reject);
  }};return c;
 },rpc(name,params){rpcCalls.push({name,params});return Promise.resolve(options.rpc?.(name,params)??{data:name==='app_consume_rate'?true:{},error:null});}};
 const service=synthetic({serviceClient:()=>svc,userClient:()=>({auth:{getUser:async()=>({data:{user:options.loggedOut?null:{id:options.actor||A}},error:null})}})});
 const modules=new Map([[path.join(root,'_shared/supabase.ts'),service]]);
 if(options.google)modules.set(path.join(root,'_shared/google.ts'),synthetic(options.google));
 function load(file) {
  if(modules.has(file))return modules.get(file);
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod=new vm.SourceTextModule(source,{context,identifier:file});modules.set(file,mod);
  return mod;
 }
 const mod=load(path.resolve(root,entry));await mod.link((spec,reference)=>{if(!spec.startsWith('.'))throw new Error('Unexpected remote import '+spec);return load(path.resolve(path.dirname(reference.identifier),spec));});await mod.evaluate();
 return {handler,queries,rpcCalls,exports:mod.namespace,call:async(body={})=>{const response=await handler(new Request('https://edge.example.test/function',{method:'POST',headers:{Origin:'https://shop.example.test','Content-Type':'application/json'},body:JSON.stringify(body)}));return{status:response.status,body:await response.json()};}};
}
test('credential encryption uses random IVs and family AAD',async()=>{const r=await runtime('_shared/credentials.ts');const first=await r.exports.encryptCredential(' synthetic password ','family-a'),second=await r.exports.encryptCredential(' synthetic password ','family-a');assert.notEqual(first,second);assert.equal(await r.exports.decryptCredential(first,'family-a'),' synthetic password ');await assert.rejects(r.exports.decryptCredential(first,'family-b'),/Password tidak dapat dibuka/);});
test('missing and malformed server keys reject writes',async()=>{for(const key of ['', 'bad-key']){const r=await runtime('_shared/credentials.ts',{env:{FAMILY_CREDENTIAL_KEY_V1:key}});await assert.rejects(r.exports.encryptCredential('password','family'),/kredensial/);}});
test('legacy vector decrypts with its stored owner id',async()=>{
 const salt=new Uint8Array(16).fill(1),iv=new Uint8Array(12).fill(2);
 const material=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(A),'PBKDF2',false,['deriveKey']);
 const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt']);
 const encrypted=new Uint8Array(await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode('legacy-synthetic-password')));
 const value=Buffer.concat([salt,iv,encrypted]).toString('base64');
 const r=await runtime('_shared/credentials.ts');assert.equal(await r.exports.decryptLegacy(value,A),'legacy-synthetic-password');await assert.rejects(r.exports.decryptLegacy(value,B),/tidak dapat diverifikasi/);await assert.rejects(r.exports.decryptLegacy('plaintext-or-corrupt',A),/tidak dapat diverifikasi/);
});
test('non-admin cannot save credentials or operate Drive',async()=>{for(const entry of ['save-family/index.ts','drive-connect-url/index.ts','reveal-family-password/index.ts','drive-disconnect/index.ts']){const r=await runtime(entry,{admin:false});assert.equal((await r.call()).status,403);assert.ok(!r.queries.some(q=>q.table!=='profiles'));}});
test('metadata edits do not read or rewrite the legacy credential',async()=>{const r=await runtime('save-family/index.ts');assert.equal((await r.call({id:'family',operation:'update',name:'Family',ownerEmail:'owner@example.test',storageUsed:0,priceMonthly:1,priceAnnual:2,priceSale:0,productType:'slot',notes:''})).status,200);const save=r.rpcCalls.find(c=>c.name==='app_save_family');assert.equal(save.params.p_ciphertext,null);assert.ok(!r.queries.some(q=>q.table==='families'));});
test('new passwords are encrypted and omitted from metadata RPC input',async()=>{const r=await runtime('save-family/index.ts');assert.equal((await r.call({id:'family',operation:'create',name:'Family',ownerEmail:'owner@example.test',ownerPassword:' synthetic password ',storageUsed:0,productType:'slot'})).status,200);const save=r.rpcCalls.find(c=>c.name==='app_save_family');assert.ok(save.params.p_ciphertext.startsWith('v1:'));assert.ok(!('ownerPassword' in save.params.p_input));});
test('oversized requests are rejected',async()=>{const r=await runtime('save-family/index.ts');assert.equal((await r.call({notes:'x'.repeat(20000)})).status,413);});
test('Drive connect refuses destinations outside the allowlist',async()=>{const r=await runtime('drive-connect-url/index.ts',{google:{buildConsentUrl:()=> 'https://accounts.google.com/consent'}});assert.equal((await r.call({origin:'https://attacker.example.test',redirectTo:'/storage',browserNonce:'a'.repeat(64)})).status,400);assert.ok(!r.queries.some(q=>q.table==='oauth_states'));});
test('public callback redirects to trusted frontend without attaching accounts',async()=>{const r=await runtime('drive-oauth-callback/index.ts',{query:()=>({data:{redirect_to:'https://shop.example.test/storage',browser_nonce_hash:'hash'},error:null})});const response=await r.handler(new Request('https://edge.example.test/callback?state=synthetic-state&code=synthetic-victim-code'));assert.equal(response.status,302);assert.equal(new URL(response.headers.get('location')).origin,'https://shop.example.test');assert.ok(response.headers.get('location').includes('#drive_state='));assert.ok(!r.queries.some(q=>q.table==='connected_accounts'||q.action!=='select'));});
test('legacy state and malicious callback redirects are refused',async()=>{for(const data of [{redirect_to:'https://attacker.example.test/path',browser_nonce_hash:'hash'},{redirect_to:'https://shop.example.test/storage',browser_nonce_hash:null}]){const r=await runtime('drive-oauth-callback/index.ts',{query:()=>({data,error:null})});const response=await r.handler(new Request('https://edge.example.test/callback?state=state&code=code'));assert.equal(new URL(response.headers.get('location')).origin,'https://shop.example.test');assert.ok(response.headers.get('location').includes('drive_error=invalid_state'));}});
test('completion checks actor and nonce before exchanging a code',async()=>{let exchanged=false;const r=await runtime('drive-complete-connect/index.ts',{actor:B,rpc:()=>({data:null,error:{message:'INVALID_OAUTH_STATE'}}),google:{DRIVE_SCOPES:[],exchangeCode:async()=>{exchanged=true;},getDriveQuota:()=>{},getUserInfo:()=>{}}});assert.equal((await r.call({state:'state',code:'victim-code',browserNonce:'bad-nonce'})).status,409);assert.equal(exchanged,false);assert.equal(r.rpcCalls[0].params.p_actor,B);});
const expired={id:'account',access_token_encrypted:null,refresh_token_encrypted:null,token_expires_at:null};
test('missing refresh token reports failure',async()=>{const r=await runtime('drive-sync-quota/index.ts',{query:q=>({data:q.table==='connected_accounts'&&q.action==='select'?[expired]:{id:'account'},error:null})});const result=await r.call({all:true});assert.equal(result.body.data.results[0].ok,false);assert.equal(result.body.data.results[0].code,'RECONNECT_REQUIRED');});
test('database write errors cannot report successful quota sync',async()=>{const c=await runtime('_shared/crypto.ts');const cipher=await c.exports.encrypt('synthetic-token');const r=await runtime('drive-sync-quota/index.ts',{google:{getDriveQuota:async()=>({used_bytes:1,total_bytes:10}),refreshAccessToken:async()=>({})},query:q=>q.action==='select'?{data:[{...expired,access_token_encrypted:cipher,token_expires_at:'2099-01-01'}],error:null}:{data:null,error:{message:'Synthetic database failure'}}});const result=await r.call({all:true});assert.equal(result.body.data.results[0].ok,false);assert.equal(result.body.data.results[0].code,'DATABASE_ERROR');});
test('temporary refresh failure does not disconnect the account',async()=>{const c=await runtime('_shared/crypto.ts');const cipher=await c.exports.encrypt('synthetic-refresh');const r=await runtime('drive-sync-quota/index.ts',{google:{getDriveQuota:async()=>({}),refreshAccessToken:async()=>{throw new Error('Temporary provider failure');}},query:q=>({data:q.action==='select'?[{...expired,refresh_token_encrypted:cipher}]:{id:'account'},error:null})});assert.equal((await r.call({all:true})).body.data.results[0].ok,false);assert.ok(!r.queries.some(q=>q.action==='update'&&q.payload.status==='disconnected'));});
test('failed revocation preserves the connected account',async()=>{const c=await runtime('_shared/crypto.ts');const cipher=await c.exports.encrypt('synthetic-refresh');const r=await runtime('drive-disconnect/index.ts',{query:()=>({data:{refresh_token_encrypted:cipher},error:null}),fetch:async()=>new Response('{}',{status:503})});assert.equal((await r.call({accountId:'account'})).status,503);assert.ok(!r.queries.some(q=>q.action==='delete'));});
test('stored access token rejection refreshes once and retries quota',async()=>{
 const c=await runtime('_shared/crypto.ts');const access=await c.exports.encrypt('synthetic-old'),refresh=await c.exports.encrypt('synthetic-refresh');let tokenCalls=0,quotaCalls=0;
 const r=await runtime('drive-sync-quota/index.ts',{query:q=>({data:q.action==='select'?[{...expired,access_token_encrypted:access,refresh_token_encrypted:refresh,token_expires_at:'2099-01-01'}]:{id:'account'},error:null}),fetch:async url=>{
  if(String(url).includes('/token')){tokenCalls++;return new Response(JSON.stringify({access_token:'synthetic-new',expires_in:3600}),{status:200});}
  quotaCalls++;return quotaCalls===1?new Response('{}',{status:401}):new Response(JSON.stringify({storageQuota:{usage:'1',limit:'10'}}),{status:200});
 }});
 assert.equal((await r.call({all:true})).body.data.results[0].ok,true);assert.equal(tokenCalls,1);assert.equal(quotaCalls,2);
});
test('explicit permanent refresh revocation disconnects only that account',async()=>{
 const c=await runtime('_shared/crypto.ts');const refresh=await c.exports.encrypt('synthetic-refresh');
 const r=await runtime('drive-sync-quota/index.ts',{query:q=>({data:q.action==='select'?[{...expired,refresh_token_encrypted:refresh}]:{id:'account'},error:null}),fetch:async()=>new Response(JSON.stringify({error:'invalid_grant'}),{status:400})});
 assert.equal((await r.call({all:true})).body.data.results[0].code,'RECONNECT_REQUIRED');assert.equal(r.queries.filter(q=>q.action==='update'&&q.payload.status==='disconnected').length,1);
});
test('explicit migration rejects unreadable legacy data without writing',async()=>{
 const r=await runtime('migrate-family-password/index.ts',{query:()=>({data:{user_id:A,owner_password:'invalid-or-plaintext',owner_password_v1:null},error:null})});
 assert.equal((await r.call({familyId:'family'})).body.code,'UNREADABLE_CREDENTIAL');assert.ok(!r.rpcCalls.some(q=>q.name==='app_migrate_credential'));
});
