// Queries public.ux_feedback for one round and prints the quantitative
// half of that round's docs/design-system/usability/round-N.md. Pure
// `buildRoundMarkdown` + a thin CLI reading from Supabase directly.
//
// Usage: node docs/design-system/usability/export.mjs --round N
// Requires SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in the
// gitignored repo-root `env` file (never committed — see the design-
// system README's secrets convention).
import { pathToFileURL } from 'node:url';

export function buildRoundMarkdown(rows, round) {
  if (rows.length === 0) return `No feedback rows for round ${round} yet.`;

  const byTask = new Map();
  for (const r of rows) {
    if (!byTask.has(r.task_id)) byTask.set(r.task_id, []);
    byTask.get(r.task_id).push(r);
  }

  const lines = [];
  lines.push(`## Round ${round} — quantitative summary`);
  lines.push('');
  lines.push(`${rows.length} feedback row(s) across ${byTask.size} task(s).`);
  lines.push('');
  lines.push('| Task | Completed (yes) | Ease (mean / median) | N |');
  lines.push('|---|---|---|---|');
  for (const [taskId, taskRows] of byTask) {
    const completedCount = taskRows.filter(r => r.completed === 'yes').length;
    const pct = Math.round((completedCount / taskRows.length) * 100);
    const easeValues = taskRows.map(r => r.ease).filter(e => typeof e === 'number').sort((a, b) => a - b);
    const mean = easeValues.length ? (easeValues.reduce((a, b) => a + b, 0) / easeValues.length) : NaN;
    const median = easeValues.length
      ? (easeValues.length % 2 === 1
          ? easeValues[(easeValues.length - 1) / 2]
          : (easeValues[easeValues.length / 2 - 1] + easeValues[easeValues.length / 2]) / 2)
      : NaN;
    lines.push(`| ${taskId} | ${pct}% (${completedCount}/${taskRows.length}) | mean ${mean.toFixed(1)} / median ${median} | ${taskRows.length} |`);
  }

  lines.push('');
  lines.push('## Comments by route');
  lines.push('');
  const byRoute = new Map();
  for (const r of rows) {
    if (!r.comment) continue;
    if (!byRoute.has(r.route)) byRoute.set(r.route, []);
    byRoute.get(r.route).push(r.comment);
  }
  if (byRoute.size === 0) {
    lines.push('_No comments left._');
  } else {
    for (const [route, comments] of byRoute) {
      lines.push(`**${route}**`);
      for (const c of comments) lines.push(`- ${c}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const roundIdx = args.indexOf('--round');
  const round = roundIdx >= 0 ? Number(args[roundIdx + 1]) : NaN;
  if (!Number.isInteger(round)) {
    console.error('Usage: node export.mjs --round N');
    process.exitCode = 1;
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — put them in the gitignored repo-root `env` file.');
    process.exitCode = 1;
    return;
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('ux_feedback').select('*').eq('round', round);
  if (error) {
    console.error('Query failed:', error.message);
    process.exitCode = 1;
    return;
  }
  console.log(buildRoundMarkdown(data ?? [], round));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(err => { console.error(err); process.exitCode = 1; });
}
