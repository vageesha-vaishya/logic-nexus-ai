const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ANSI Color Codes for Logs
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m"
};

const log = (msg, type = 'info') => {
    const timestamp = new Date().toISOString();
    let color = colors.reset;
    if (type === 'error') color = colors.red;
    if (type === 'success') color = colors.green;
    if (type === 'warn') color = colors.yellow;
    if (type === 'info') color = colors.blue;
    
    console.log(`${color}[${timestamp}] [${type.toUpperCase()}] ${msg}${colors.reset}`);
};

async function applySql() {
    const targetUrl = process.argv[2];
    const scriptPath = process.argv[3];

    if (!targetUrl || !scriptPath) {
        log('Usage: node apply-sql.js <TARGET_DB_URL> <SCRIPT_PATH_OR_DIR>', 'error');
        process.exit(1);
    }

    const client = new Client({ 
        connectionString: targetUrl,
        connectionTimeoutMillis: 10000 // 10s timeout
    });

    try {
        log(`Connecting to database...`, 'info');
        await client.connect();
        log('Connected successfully.', 'success');

        let files = [];
        
        // Check if path is directory or file
        const stats = fs.statSync(scriptPath);
        if (stats.isDirectory()) {
            files = fs.readdirSync(scriptPath)
                .filter(file => file.endsWith('.sql'))
                .sort() // Ensure sequential order
                .map(file => path.join(scriptPath, file));
            log(`Detected ${files.length} SQL scripts in directory: ${scriptPath}`, 'info');
        } else {
            files = [scriptPath];
            log(`Detected single SQL script: ${scriptPath}`, 'info');
        }

        if (files.length === 0) {
            log('No SQL files found to execute.', 'warn');
            return;
        }

        for (const file of files) {
            const fileName = path.basename(file);
            log(`Preparing to execute: ${fileName}`, 'info');
            
            const sqlContent = fs.readFileSync(file, 'utf8');
            
            try {
                // Start Transaction
                await client.query('BEGIN');
                
                // Execute Script
                await client.query(sqlContent);
                
                // Commit Transaction
                await client.query('COMMIT');
                
                log(`Successfully executed: ${fileName}`, 'success');
            } catch (err) {
                // Rollback Transaction
                await client.query('ROLLBACK');
                
                log(`Failed to execute: ${fileName}`, 'error');
                log(`Error Message: ${err.message}`, 'error');
                
                if (err.position) {
                    log(`Error Position: ${err.position}`, 'error');
                }
                
                // Stop execution on first failure to maintain consistency
                log('Aborting sequence due to error.', 'error');
                process.exit(1);
            }
        }

        log('All scripts executed successfully.', 'success');

    } catch (err) {
        log(`System Error: ${err.message}`, 'error');
        process.exit(1);
    } finally {
        await client.end();
    }
}

applySql();
