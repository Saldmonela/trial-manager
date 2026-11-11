import { build } from 'vite';
delete process.env.VITE_SUPABASE_URL; delete process.env.VITE_SUPABASE_ANON_KEY;
await build({envDir:false,build:{write:false}});
console.log('Build verified without dotenv files or emitted bundle.');
