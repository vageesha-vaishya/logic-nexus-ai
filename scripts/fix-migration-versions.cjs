
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../supabase/migrations');

// Get all SQL files
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

// Regex to capture version prefix
const versionRegex = /^(\d+)_/;

const filesByVersion = {};

files.forEach(file => {
  const match = file.match(versionRegex);
  if (match) {
    const version = match[1];
    if (!filesByVersion[version]) {
      filesByVersion[version] = [];
    }
    filesByVersion[version].push(file);
  }
});

Object.keys(filesByVersion).forEach(version => {
  const group = filesByVersion[version];
  
  // If we have multiple files with the same version prefix
  // OR if the version is short (8 digits) and we want to standardize to 14
  // But strictly, we only NEED to fix collisions.
  // The error was specifically about collision.
  
  if (group.length > 1) {
    console.log(`Fixing collision for version ${version}: ${group.length} files`);
    
    // Sort to ensure deterministic order
    group.sort();
    
    group.forEach((file, index) => {
      const originalPath = path.join(migrationsDir, file);
      
      // Construct new version
      // If version is 8 digits (YYYYMMDD), append HHMMSS
      // We'll use index for seconds to ensure uniqueness
      let newVersion;
      if (version.length === 8) {
        // e.g. 20260113 -> 20260113000000 + index
        const suffix = String(index).padStart(6, '0');
        newVersion = `${version}${suffix}`;
      } else {
        // If it's already long but colliding? (Unlikely unless manually messed up)
        // If it's 14 digits, we can't easily append. 
        // But the collisions we saw were 8 digits (20260113).
        // If we have 20260114 (8 digits), we convert to 20260114000000.
        // What if we have 20260112100000 and 20260112100000? (Duplicate full timestamp)
        // Then we need to increment.
        
        // For now, assume 8-digit collisions.
        if (version.length === 14) {
             // If we have full timestamp collision, we must increment last digit
             const prefix = version.substring(0, 12); // YYYYMMDDHHMM
             const seconds = parseInt(version.substring(12, 14));
             newVersion = `${prefix}${String(seconds + index).padStart(2, '0')}`;
        } else {
             const suffix = String(index).padStart(6, '0');
             newVersion = `${version}${suffix}`;
        }
      }
      
      // Reconstruct filename
      // Remove old version prefix
      const restOfName = file.substring(version.length + 1); // +1 for underscore
      const newName = `${newVersion}_${restOfName}`;
      const newPath = path.join(migrationsDir, newName);
      
      console.log(`Renaming ${file} -> ${newName}`);
      fs.renameSync(originalPath, newPath);
    });
  }
});

console.log('Migration version fix complete.');
