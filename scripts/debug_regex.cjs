const fs = require('fs');
const content = `CREATE POLICY "Tenant admins can manage queue memberships" ON public.queue_members
FOR ALL
TO authenticated
USING (
  true
);`;

// Helper regex for identifiers (handles "quoted names with spaces" and schema.table)
// const idRegex = '(?:[a-zA-Z0-9_.]+|"[^"]+")'; 
// Note: The above simple regex allows dots in unquoted, or full quotes. 
// It doesn't perfectly handle "schema"."table" but for our replace logic it might be enough 
// if we just want to capture the whole string.
// Better: ((?:[a-zA-Z0-9_]+|"[^"]+")(?:\.(?:[a-zA-Z0-9_]+|"[^"]+"))*)
const complexIdRegex = '((?:[a-zA-Z0-9_]+|"[^"]+")(?:\\.(?:[a-zA-Z0-9_]+|"[^"]+"))*)';
// For Policy Names (just the name, no dots usually): ((?:[a-zA-Z0-9_]+|"[^"]+"))
const nameRegex = '((?:[a-zA-Z0-9_]+|"[^"]+"))';

const regexStr = `CREATE\\s+POLICY\\s+${nameRegex}\\s+ON\\s+${complexIdRegex}(.*?;)`;
console.log("Regex String:", regexStr);
const policyRegex = new RegExp(regexStr, 'gsi');

const match = policyRegex.exec(content);
console.log("Match:", match);

if (match) {
    console.log("Policy Name:", match[1]);
    console.log("Table Name:", match[2]);
}
