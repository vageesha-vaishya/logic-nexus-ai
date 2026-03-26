const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 8081,
  path: '/api/v2/amro/master-data/assembly_models?page=1&page_size=500&sort_by=name&sort_dir=asc',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': 'e42ec6fd-6b88-4721-befe-4443d9743120',
    'x-user-id': 'user-1',
    'x-user-role': 'tenant_admin',
    'x-user-permissions': 'view_amro_dashboard,edit_aircraft_records'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});

req.on('error', e => console.error(e));
req.end();
