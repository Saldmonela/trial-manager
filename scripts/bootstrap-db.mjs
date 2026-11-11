import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
export function bootstrapSql() {
  const files = fs.readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(file => file.endsWith('.sql') && !file.startsWith('20260726_')).sort();
  // July's file mixes manual ownership backfill and example JWT probes with DDL.
  // It is superseded by October hardening and is NEVER an automatic bootstrap step.
  return files.map(file => '-- ' + file + '\n' + fs.readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8')).join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(bootstrapSql());
