import { startVitest } from 'vitest/node';
delete process.env.VITE_SUPABASE_URL;
delete process.env.VITE_SUPABASE_ANON_KEY;
// Tests never load dotenv files or accidentally connect to a live project.
const ctx = await startVitest('test', process.argv.slice(2), {run:true,watch:false,config:'vitest.config.ts'}, {envDir:false});
if (ctx) await ctx.close();
