if (!process.argv.includes('--dry-run')) throw new Error('DRY_RUN_REQUIRED');
console.log(JSON.stringify({ checks: ['counts', 'owners', 'timestamps', 'logical-references', 'checksums'], wrote: false }));
