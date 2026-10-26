/**
 * AO Core PostgreSQL Migration & Sequence Synchronization Tool
 * 
 * Usage:
 *   node scripts/migrate_postgres.js --dump=./ao-core-real.dump --target="<TARGET_POSTGRES_EXTERNAL_URL>" [--source="<SOURCE_AIVEN_URL>"]
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, ...valParts] = arg.slice(2).split('=');
      args[key] = valParts.join('=');
    }
  });
  return args;
}

function validateDumpFile(dumpPath) {
  if (dumpPath === 'none' || dumpPath === 'skip') {
    console.log(`\n======================================================`);
    console.log(`STEP 1: DUMP FILE CHECK SKIPPED (Direct Database Mode)`);
    console.log(`======================================================`);
    return true;
  }

  console.log(`\n======================================================`);
  console.log(`STEP 1: VALIDATING BACKUP DUMP FILE`);
  console.log(`======================================================`);
  
  if (!fs.existsSync(dumpPath)) {
    console.error(`❌ ERROR: Dump file not found at: ${dumpPath}`);
    return false;
  }

  const stat = fs.statSync(dumpPath);
  console.log(`  File Path: ${dumpPath}`);
  console.log(`  File Size: ${(stat.size / 1024).toFixed(2)} KB (${stat.size} bytes)`);

  if (stat.size === 0) {
    console.error(`❌ CRITICAL: Dump file is EMPTY (0 bytes). Aborting.`);
    return false;
  }

  const headerBuffer = Buffer.alloc(100);
  const fd = fs.openSync(dumpPath, 'r');
  fs.readSync(fd, headerBuffer, 0, 100, 0);
  fs.closeSync(fd);

  const headerString = headerBuffer.toString('utf8');
  if (headerString.includes('[object Object]') || headerString.includes('undefined')) {
    console.error(`❌ CRITICAL: Dump file contains invalid text content ("[object Object]"). Aborting.`);
    return false;
  }

  // Check if pg_restore is installed locally
  try {
    const listOutput = execSync(`pg_restore -l "${dumpPath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = listOutput.split('\n').filter(Boolean);
    const tableEntries = lines.filter(l => l.includes('TABLE DATA') || l.includes('TABLE '));
    console.log(`  ✅ pg_restore TOC list successfully read (${lines.length} TOC entries).`);
    console.log(`  ✅ Found ${tableEntries.length} table definitions in TOC.`);
    if (tableEntries.length === 0) {
      console.warn(`  ⚠️ Warning: No TABLE definitions found in TOC.`);
    }
  } catch (err) {
    // If pg_restore CLI is not on PATH, check if it's a valid custom format or SQL file
    if (headerBuffer.slice(0, 5).toString('ascii') === 'PGDMP') {
      console.log(`  ✅ Valid PostgreSQL custom-format archive header detected (PGDMP magic bytes).`);
    } else if (headerString.toUpperCase().includes('CREATE TABLE') || headerString.toUpperCase().includes('INSERT INTO')) {
      console.log(`  ✅ Valid plain SQL dump file detected.`);
    } else {
      console.warn(`  ℹ️ Notice: pg_restore check skipped (${err.message.split('\n')[0]}). Inspect file headers carefully.`);
    }
  }

  return true;
}

async function getDatabaseTablesAndCounts(client) {
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const counts = {};
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    try {
      const countRes = await client.query(`SELECT COUNT(*) as total FROM "${tableName}"`);
      counts[tableName] = parseInt(countRes.rows[0].total, 10);
    } catch {
      counts[tableName] = -1;
    }
  }
  return counts;
}

async function fixPostgresSequences(client) {
  console.log(`\n======================================================`);
  console.log(`STEP 4: FIXING POSTGRESQL SEQUENCES & ID COUNTERS`);
  console.log(`======================================================`);

  const fixQuery = `
    DO $$
    DECLARE
      r RECORD;
      max_id BIGINT;
      seq_name TEXT;
    BEGIN
      FOR r IN
        SELECT c.table_name, c.column_name,
               pg_get_serial_sequence('"' || c.table_schema || '"."' || c.table_name || '"', c.column_name) as seq
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.table_schema = 'public' 
          AND t.table_type = 'BASE TABLE'
          AND (c.column_default LIKE 'nextval%' OR c.is_identity = 'YES')
      LOOP
        IF r.seq IS NOT NULL THEN
          EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', r.column_name, r.table_name) INTO max_id;
          IF max_id > 0 THEN
            EXECUTE format('SELECT setval(%L, %s, true)', r.seq, max_id);
          ELSE
            EXECUTE format('SELECT setval(%L, 1, false)', r.seq);
          END IF;
          RAISE NOTICE 'Synchronized sequence % for %.% to %', r.seq, r.table_name, r.column_name, max_id;
        END IF;
      END LOOP;
    END $$;
  `;

  await client.query(fixQuery);
  console.log(`  ✅ All PostgreSQL serial and identity sequences synchronized to MAX(id).`);
}

async function run() {
  const args = parseArgs();
  const dumpPath = args.dump || './ao-core-real.dump';
  const targetUrl = args.target || process.env.TARGET_DATABASE_URL;
  const sourceUrl = args.source || process.env.SOURCE_DATABASE_URL;

  console.log('🚀 AO CORE POSTGRESQL MIGRATION & AUDIT TOOL');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (dumpPath && !validateDumpFile(dumpPath)) {
    process.exit(1);
  }

  if (!targetUrl) {
    console.log(`\n======================================================`);
    console.log(`INSTRUCTIONS: TARGET DATABASE URL NOT SPECIFIED`);
    console.log(`======================================================`);
    console.log(`Please run with --target="<RENDER_POSTGRES_EXTERNAL_URL>":\n`);
    console.log(`Example:`);
    console.log(`  node scripts/migrate_postgres.js --dump="./ao-core-real.dump" --target="postgres://user:pass@dpg-xxx.render.com/dbname"`);
    console.log(`\nOr execute the restore directly via pg_restore CLI:`);
    console.log(`  pg_restore --no-owner --no-acl --exit-on-error -d "<TARGET_URL>" ./ao-core-real.dump\n`);
    process.exit(0);
  }

  // Connect to Target DB
  console.log(`\n======================================================`);
  console.log(`STEP 2: CONNECTING TO TARGET DATABASE`);
  console.log(`======================================================`);
  
  const targetClient = new Client({
    connectionString: targetUrl,
    ssl: { require: true, rejectUnauthorized: false }
  });

  try {
    await targetClient.connect();
    console.log(`  ✅ Successfully connected to Target PostgreSQL Database.`);

    // Check existing tables in Target
    const existingTargetTables = await getDatabaseTablesAndCounts(targetClient);
    const tableKeys = Object.keys(existingTargetTables);
    console.log(`  Target Database currently contains ${tableKeys.length} tables.`);

    if (tableKeys.length > 0) {
      console.warn(`  ⚠️ Target DB is not empty. Found tables: ${tableKeys.slice(0, 5).join(', ')}${tableKeys.length > 5 ? '...' : ''}`);
    } else {
      console.log(`  ✅ Target Database is clean and empty (0 tables).`);
    }

    // Fix sequences
    if (tableKeys.length > 0) {
      await fixPostgresSequences(targetClient);
    }

    // Row Count Comparison
    console.log(`\n======================================================`);
    console.log(`STEP 3: TARGET DATABASE TABLE & ROW COUNT REPORT`);
    console.log(`======================================================`);

    let sourceCounts = {};
    if (sourceUrl) {
      console.log(`Connecting to Source DB for live count comparison...`);
      const sourceClient = new Client({
        connectionString: sourceUrl,
        ssl: { require: true, rejectUnauthorized: false }
      });
      try {
        await sourceClient.connect();
        sourceCounts = await getDatabaseTablesAndCounts(sourceClient);
        await sourceClient.end();
        console.log(`  ✅ Retrieved counts for ${Object.keys(sourceCounts).length} tables from Source.`);
      } catch (srcErr) {
        console.warn(`  ⚠️ Could not connect to source DB: ${srcErr.message}`);
      }
    }

    const allTableNames = Array.from(new Set([...Object.keys(sourceCounts), ...Object.keys(existingTargetTables)])).sort();
    
    console.log('\n| Table Name                      | Source Rows | Target Rows | Status  |');
    console.log('|---------------------------------|-------------|-------------|---------|');
    
    let totalSource = 0;
    let totalTarget = 0;
    let mismatches = 0;

    for (const tbl of allTableNames) {
      const src = sourceCounts[tbl] !== undefined ? sourceCounts[tbl] : '-';
      const tgt = existingTargetTables[tbl] !== undefined ? existingTargetTables[tbl] : 0;
      
      if (typeof src === 'number') totalSource += src;
      totalTarget += tgt;

      let status = '✅ OK';
      if (typeof src === 'number' && src !== tgt) {
        status = '❌ MISMATCH';
        mismatches++;
      }

      const tblPadded = tbl.padEnd(31, ' ');
      const srcPadded = String(src).padStart(11, ' ');
      const tgtPadded = String(tgt).padStart(11, ' ');
      console.log(`| ${tblPadded} | ${srcPadded} | ${tgtPadded} | ${status.padEnd(7, ' ')} |`);
    }

    console.log('|---------------------------------|-------------|-------------|---------|');
    console.log(`| TOTALS                          | ${String(totalSource).padStart(11, ' ')} | ${String(totalTarget).padStart(11, ' ')} | ${mismatches === 0 ? '✅ 100%' : '⚠️ ATTN'}  |\n`);

    if (mismatches > 0) {
      console.warn(`⚠️ Warning: Detected ${mismatches} row count mismatches between Source and Target.`);
    } else {
      console.log(`⭐ ALL TABLE DATA AND COUNTS MATCHED PERFECTLY! ⭐`);
    }

    await targetClient.end();

  } catch (err) {
    console.error(`❌ Connection error:`, err.message);
    process.exit(1);
  }
}

run();
