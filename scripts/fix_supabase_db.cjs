const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const config = {
  host: process.env.VPS_IP,
  username: process.env.VPS_USER || 'root',
  password: process.env.VPS_PASSWORD,
  // The directory where docker-compose.yml is likely located
  remoteDockerDir: '/home/SOSLogicPro/logicProSupabaseDev/docker',
  sqlFile: path.resolve(__dirname, '../supabase/docker-init/00-init-supabase-db.sql')
};

if (!config.host || !config.password) {
  console.error('Error: VPS_IP and VPS_PASSWORD environment variables are required.');
  console.log('Usage: VPS_IP=x.x.x.x VPS_PASSWORD=secret node scripts/fix_supabase_db.cjs');
  process.exit(1);
}

const conn = new Client();

console.log(`Connecting to VPS ${config.host}...`);

conn.on('ready', () => {
  console.log('SSH Connection ready');

  // Read the SQL file content
  const sqlContent = fs.readFileSync(config.sqlFile, 'utf8');
  
  // Escape single quotes for shell command if necessary, but we will use a heredoc or pipe
  // Best way to run this is to pipe it into docker exec
  // We need to be careful with special characters in SQL
  
  // We'll upload the file to /tmp and then run it
  const remoteTempSql = '/tmp/00-init-supabase-db.sql';
  
  console.log('Uploading SQL script...');
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP connection failed:', err);
      conn.end();
      process.exit(1);
    }
    
    const writeStream = sftp.createWriteStream(remoteTempSql);
    writeStream.write(sqlContent);
    writeStream.end();
    
    writeStream.on('close', () => {
      console.log('SQL script uploaded. Executing...');
      
      // Command to execute the SQL script inside the container
      // We assume the container name is 'supabase-db'
      const cmd = `cat ${remoteTempSql} | docker exec -i supabase-db psql -U postgres`;
      
      conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
          console.log(`SQL execution exited with code ${code}`);
          
          // Cleanup
          conn.exec(`rm ${remoteTempSql}`, (err, stream) => {
             conn.end();
             if (code === 0) {
               console.log('Database initialization successful!');
               console.log('You may need to restart other containers (realtime, etc) for changes to take effect.');
             } else {
               console.error('Database initialization failed.');
               process.exit(1);
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
