const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const config = {
  host: process.env.VPS_IP,
  username: process.env.VPS_USER || 'root',
  password: process.env.VPS_PASSWORD,
  remotePath: '/home/SOSLogicPro/logicProSupabaseDev/docker/volumes/functions',
  localPath: path.resolve(__dirname, '../supabase/functions'),
  tempRemote: '/tmp/functions_deploy'
};

if (!config.host || !config.password) {
  console.error('Error: VPS_IP and VPS_PASSWORD environment variables are required.');
  process.exit(1);
}

const conn = new Client();

console.log(`Deploying functions to VPS ${config.host}...`);

conn.on('ready', () => {
  console.log('SSH Connection ready');

  // 1. Create temp directory
  conn.exec(`rm -rf ${config.tempRemote} && mkdir -p ${config.tempRemote}`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      if (code !== 0) {
        console.error(`Failed to create temp directory. Exit code: ${code}`);
        conn.end();
        process.exit(1);
      }
      
      console.log('Temp directory created. Starting file upload...');
      
      // Upload using SFTP
      conn.sftp((err, sftp) => {
          if (err) {
              console.error('SFTP connection failed:', err);
              conn.end();
              process.exit(1);
          }
          
          uploadDirectory(sftp, config.localPath, config.tempRemote)
            .then(() => {
              console.log('Upload complete. Moving files to destination...');
              
              // 2. Move files to destination
              const moveCmd = `cp -r ${config.tempRemote}/* ${config.remotePath}/ && rm -rf ${config.tempRemote}`;
              
              conn.exec(moveCmd, (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                  console.log(`Move command exited with code ${code}`);
                  conn.end();
                  if (code === 0) {
                    console.log('Deployment complete successfully.');
                    process.exit(0);
                  } else {
                    console.error('Deployment failed during file move.');
                    process.exit(1);
                  }
                }).on('data', (data) => {
                  console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                  console.log('STDERR: ' + data);
                });
              });
            })
            .catch(err => {
              console.error('Upload failed:', err);
              conn.end();
              process.exit(1);
            });
      });
    }).on('data', (data) => {
      // console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
  process.exit(1);
}).connect({
  host: config.host,
  port: 22,
  username: config.username,
  password: config.password,
  readyTimeout: 20000,
});

async function uploadDirectory(sftp, localDir, remoteDir) {
    // Recursive upload helper
    async function uploadDir(currentLocal, currentRemote) {
      const files = fs.readdirSync(currentLocal);
      
      // Ensure remote directory exists
      try {
        await new Promise((res, rej) => {
          sftp.mkdir(currentRemote, (err) => {
            // Ignore error if directory exists (code 4 usually, or generic failure check)
            if (err && err.code !== 4) {
                 // Try to proceed anyway, maybe it exists
                 // console.log('mkdir warning:', err.message);
            }
            res();
          });
        });
      } catch (e) {
          // ignore
      }

      for (const file of files) {
        const localPath = path.join(currentLocal, file);
        const remotePath = `${currentRemote}/${file}`;
        const stats = fs.statSync(localPath);

        if (stats.isDirectory()) {
          await uploadDir(localPath, remotePath);
        } else {
          await new Promise((res, rej) => {
            sftp.fastPut(localPath, remotePath, (err) => {
              if (err) return rej(err);
              // console.log(`Uploaded: ${file}`);
              res();
            });
          });
        }
      }
    }

    return uploadDir(localDir, remoteDir);
}
