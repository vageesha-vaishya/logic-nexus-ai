
import { emailPluginRegistry } from '../src/services/email/EmailPluginRegistry';

console.log('Verifying Email Plugin Registry...');
const plugins = emailPluginRegistry.getAllPlugins();
console.log(`Found ${plugins.length} plugins.`);

plugins.forEach(p => {
  console.log(`- Plugin: ${p.name} (${p.id})`);
  console.log(`  Description: ${p.description}`);
  console.log(`  Requires OAuth: ${p.requiresOAuth}`);
  console.log(`  Config Fields: ${p.getConfigFields().map(f => f.key).join(', ')}`);
});

if (plugins.length !== 3) {
  console.error('Error: Expected 3 plugins (gmail, office365, smtp_imap)');
  process.exit(1);
}

console.log('Email Plugin Registry verification passed.');
