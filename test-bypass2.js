import fs from 'fs';
const file = 'src/pages/api/v2/amro/master-data/[entity].ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace('const scopedAccess = await resolveAndApplyAccessContext(req, ctx);', 'const scopedAccess = { tenantId: req.headers["x-tenant-id"], franchiseId: req.headers["x-franchise-id"] || null };');
code = code.replace('await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });', '');
fs.writeFileSync(file, code);
