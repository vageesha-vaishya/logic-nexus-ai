const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 8081,
  path: '/api/v2/amro/master-data/assembly_models',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': 'e42ec6fd-6b88-4721-befe-4443d9743120'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});

req.on('error', e => console.error(e));
req.end();
