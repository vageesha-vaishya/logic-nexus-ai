# Migration Helper Scripts

This directory contains helper utilities for the migration process.

## test-connection.js

Node.js script to test connectivity to the new Supabase database.

### Usage

```bash
node helpers/test-connection.js
```

### What it tests

- ✓ Configuration file loading
- ✓ Supabase client initialization
- ✓ Database connectivity
- ✓ Basic query execution
- ✓ RPC function availability
- ✓ Authentication system access

### Requirements

- Node.js installed
- `new-supabase-config.env` file configured
- `@supabase/supabase-js` package (auto-installed by Lovable)

### Output

Success output:
```
✓ Configuration loaded
✓ Supabase client created
✓ Database connection successful
✓ Found X tables
✓ Authentication check passed
SUCCESS: All connection tests passed
```

Error output will show specific issues with connectivity or configuration.

## Adding More Helpers

You can add additional helper scripts here for:
- Data validation
- Custom transformations
- Post-migration checks
- Performance testing
