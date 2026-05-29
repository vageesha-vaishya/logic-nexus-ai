import app from './app.js';

const port = Number(process.env.SALES_API_PORT) || 3201;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: 'sales_api.started', port, service: 'sales-api' }));
});
