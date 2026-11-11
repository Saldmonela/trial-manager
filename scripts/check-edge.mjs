import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const files=fs.readdirSync('supabase/functions',{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!=='_shared').map(e=>'supabase/functions/'+e.name+'/index.ts');
const result=spawnSync('deno',['check',...files],{stdio:'inherit',windowsHide:true});
if(result.error){console.error('Deno 2 is required for Edge typechecking.');process.exitCode=1;}else process.exitCode=result.status||0;
