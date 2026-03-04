const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const config = {
  host: process.env.VPS_IP || '72.61.249.111',
  username: process.env.VPS_USER || 'root',
  password: process.env.VPS_PASSWORD,
};

if (!config.password) {
  console.error('Error: VPS_PASSWORD environment variable is required.');
  console.log('Usage: VPS_PASSWORD=\'your_password\' node scripts/create_admin_user.cjs');
  process.exit(1);
}

const conn = new Client();

console.log(`Connecting to VPS ${config.host}...`);

const createUserSql = `
-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Create the user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768',
  'authenticated',
  'authenticated',
  'Bahuguna.vimal@gmail.com',
  crypt('Vimal@1234', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- Ensure the user is in public.profiles (if your app uses it)
INSERT INTO public.profiles (id, email, first_name, last_name, is_active)
VALUES (
  'ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768',
  'Bahuguna.vimal@gmail.com',
  'Vimal',
  'Bahuguna',
  true
) ON CONFLICT (id) DO UPDATE SET is_active = true;

-- Assign Platform Admin role (adjust role name/id as per your schema)
-- Assuming you have a user_roles table
INSERT INTO public.user_roles (user_id, role, assigned_by)
VALUES (
  'ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768',
  'platform_admin',
  'ce4c64f5-cd8c-4d2d-bbbd-04972c4a7768'
) ON CONFLICT (user_id, role, tenant_id, franchise_id) DO NOTHING;
`;

conn.on('ready', () => {
  console.log('SSH Connection ready');
  
  const remoteTempSql = '/tmp/create_admin.sql';
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP connection failed:', err);
      conn.end();
      process.exit(1);
    }
    
    const writeStream = sftp.createWriteStream(remoteTempSql);
    writeStream.write(createUserSql);
    writeStream.end();
    
    writeStream.on('close', () => {
      console.log('SQL script uploaded. Executing...');
      
      // Execute via docker exec
      const cmd = `cat ${remoteTempSql} | docker exec -i supabase-db psql -U postgres`;
      
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
          console.log(`SQL execution exited with code ${code}`);
          conn.exec(`rm ${remoteTempSql}`, () => {
             conn.end();
             if (code === 0) {
               console.log('Admin user creation script executed successfully.');
             } else {
               console.error('Failed to execute admin user creation script.');
             }
          });
        }).on('data', (data) => {
          console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
          console.log('STDERR: ' + data);
        });
      });
    });
  });
}).connect({
  host: config.host,
  username: config.username,
  password: config.password
});
