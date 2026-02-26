const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
console.log('Testing connection with:', connectionString.replace(/:([^:@]+)@/, ':****@'));

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log('Connected successfully!');
    return client.end();
  })
  .catch(err => {
    console.error('Connection failed:', err.message);
    process.exit(1);
  });
