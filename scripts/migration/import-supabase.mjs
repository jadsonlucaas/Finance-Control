const required = ['--input', '--checkpoint'];
for (const flag of required) if (!process.argv.includes(flag)) throw new Error(`ARGUMENT_REQUIRED:${flag}`);
if (!process.argv.includes('--dry-run')) throw new Error('DRY_RUN_REQUIRED_UNTIL_CUTOVER_ISSUE_APPROVED');
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SERVICE_ROLE_NOT_ACCEPTED_IN_PREPARATION_MODE');
console.log(JSON.stringify({ mode: 'dry-run', resumable: true, idempotent: true, wrote: false }));
