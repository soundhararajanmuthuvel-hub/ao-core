const { Sequelize } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Escapes values for safe SQL dump generation
 */
function escapeSqlValue(val, dialect = 'mysql') {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return dialect === 'postgres' ? (val ? 'TRUE' : 'FALSE') : (val ? '1' : '0');
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : 'NULL';
  }
  if (val instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = val.getUTCFullYear();
    const m = pad(val.getUTCMonth() + 1);
    const d = pad(val.getUTCDate());
    const h = pad(val.getUTCHours());
    const mi = pad(val.getUTCMinutes());
    const s = pad(val.getUTCSeconds());
    return `'${y}-${m}-${d} ${h}:${mi}:${s}'`;
  }
  if (Buffer.isBuffer(val)) {
    return dialect === 'postgres' ? `decode('${val.toString('hex')}', 'hex')` : `X'${val.toString('hex')}'`;
  }
  if (typeof val === 'object') {
    try {
      val = JSON.stringify(val);
    } catch {
      val = String(val);
    }
  }

  const str = String(val);
  if (dialect === 'mysql') {
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\0/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
    return `'${escaped}'`;
  } else {
    // postgres and sqlite standard single-quote escaping
    const escaped = str.replace(/'/g, "''");
    return `'${escaped}'`;
  }
}

/**
 * Stream a full database SQL backup to an Express writable stream (res) or standard Writable stream.
 */
async function streamDatabaseBackup(writableStream, options = {}) {
  const dialect = sequelize.getDialect();
  const timestamp = new Date().toISOString();
  const databaseName = sequelize.config.database || 'ao_core';
  const adminName = options.adminName || 'Super Admin';

  const write = (str) => {
    return new Promise((resolve) => {
      if (!writableStream.write(str)) {
        writableStream.once('drain', resolve);
      } else {
        resolve();
      }
    });
  };

  // 1. Write SQL Dump Header
  await write(`-- ==========================================================\n`);
  await write(`-- AO Core ERP Database Backup\n`);
  await write(`-- Dialect:   ${dialect.toUpperCase()}\n`);
  await write(`-- Database:  ${databaseName}\n`);
  await write(`-- Generated: ${timestamp}\n`);
  await write(`-- CreatedBy: ${adminName}\n`);
  await write(`-- ==========================================================\n\n`);

  if (dialect === 'mysql') {
    await write(`/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n`);
    await write(`/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n`);
    await write(`/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n`);
    await write(`/*!50503 SET NAMES utf8mb4 */;\n`);
    await write(`/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;\n`);
    await write(`/*!40103 SET TIME_ZONE='+00:00' */;\n`);
    await write(`/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n`);
    await write(`/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`);
    await write(`/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n`);
    await write(`/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n`);

    // Fetch list of all base tables in MySQL
    let tables = [];
    try {
      const [tableRows] = await sequelize.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
      tables = tableRows.map((row) => Object.values(row)[0]).filter(Boolean);
    } catch {
      const [tableRows] = await sequelize.query("SHOW TABLES");
      tables = tableRows.map((row) => Object.values(row)[0]).filter(Boolean);
    }

    for (const tableName of tables) {
      // 1. Table structure
      await write(`--\n-- Table structure for table \`${tableName}\`\n--\n`);
      await write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
      try {
        const [createRows] = await sequelize.query(`SHOW CREATE TABLE \`${tableName}\``);
        if (createRows && createRows[0]) {
          const createSql = createRows[0]['Create Table'] || Object.values(createRows[0])[1];
          await write(`${createSql};\n\n`);
        }
      } catch (createErr) {
        await write(`-- Note: Failed to retrieve SHOW CREATE TABLE for ${tableName}: ${createErr.message}\n\n`);
      }

      // 2. Table data
      try {
        const [countRes] = await sequelize.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
        const totalRows = countRes && countRes[0] ? Number(countRes[0].total || countRes[0].TOTAL || 0) : 0;

        if (totalRows > 0) {
          await write(`--\n-- Dumping data for table \`${tableName}\` (Total: ${totalRows} rows)\n--\n`);
          await write(`LOCK TABLES \`${tableName}\` WRITE;\n`);
          await write(`/*!40000 ALTER TABLE \`${tableName}\` DISABLE KEYS */;\n`);

          const batchSize = 500;
          let offset = 0;
          while (offset < totalRows) {
            const rows = await sequelize.query(`SELECT * FROM \`${tableName}\` LIMIT ${batchSize} OFFSET ${offset}`, {
              type: Sequelize.QueryTypes.SELECT,
              raw: true
            });

            if (!rows || rows.length === 0) break;

            const columns = Object.keys(rows[0]);
            const colList = columns.map((c) => `\`${c}\``).join(', ');

            const valueRows = rows.map((row) => {
              const vals = columns.map((col) => escapeSqlValue(row[col], 'mysql'));
              return `(${vals.join(', ')})`;
            });

            await write(`INSERT INTO \`${tableName}\` (${colList}) VALUES\n${valueRows.join(',\n')};\n`);
            offset += rows.length;
          }

          await write(`/*!40000 ALTER TABLE \`${tableName}\` ENABLE KEYS */;\n`);
          await write(`UNLOCK TABLES;\n\n`);
        }
      } catch (dataErr) {
        await write(`-- Note: Failed to dump data for table ${tableName}: ${dataErr.message}\n\n`);
      }
    }

    // MySQL Footer
    await write(`/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;\n`);
    await write(`/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n`);
    await write(`/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n`);
    await write(`/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n`);
    await write(`/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n`);
    await write(`/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n`);
    await write(`/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n`);
    await write(`/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n`);
    await write(`-- Dump completed at ${new Date().toISOString()}\n`);

  } else if (dialect === 'postgres') {
    await write(`SET statement_timeout = 0;\n`);
    await write(`SET lock_timeout = 0;\n`);
    await write(`SET client_encoding = 'UTF8';\n`);
    await write(`SET standard_conforming_strings = on;\n`);
    await write(`SET check_function_bodies = false;\n`);
    await write(`SET client_min_messages = warning;\n`);
    await write(`SET row_security = off;\n\n`);

    const tables = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const { table_name: tableName } of tables) {
      await write(`--\n-- Table: "${tableName}"\n--\n`);

      // Query columns metadata
      const columns = await sequelize.query(
        `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :tableName ORDER BY ordinal_position`,
        { replacements: { tableName }, type: Sequelize.QueryTypes.SELECT }
      );

      if (columns.length > 0) {
        const colDefs = columns.map((col) => {
          let def = `  "${col.column_name}" ${col.data_type.toUpperCase()}`;
          if (col.column_default) def += ` DEFAULT ${col.column_default}`;
          if (col.is_nullable === 'NO') def += ` NOT NULL`;
          return def;
        });
        await write(`CREATE TABLE IF NOT EXISTS "${tableName}" (\n${colDefs.join(',\n')}\n);\n\n`);
      }

      // Dump data
      try {
        const rows = await sequelize.query(`SELECT * FROM "${tableName}"`, {
          type: Sequelize.QueryTypes.SELECT,
          raw: true
        });

        if (rows && rows.length > 0) {
          const colNames = Object.keys(rows[0]);
          const colHeader = colNames.map((c) => `"${c}"`).join(', ');

          const batchSize = 250;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const valueRows = batch.map((row) => {
              const vals = colNames.map((col) => escapeSqlValue(row[col], 'postgres'));
              return `(${vals.join(', ')})`;
            });
            await write(`INSERT INTO "${tableName}" (${colHeader}) VALUES\n${valueRows.join(',\n')};\n`);
          }
          await write(`\n`);
        }
      } catch (err) {
        await write(`-- Note: Failed to dump data for table ${tableName}: ${err.message}\n\n`);
      }
    }

    await write(`-- PostgreSQL Dump completed at ${new Date().toISOString()}\n`);

  } else {
    // SQLite dialect
    await write(`PRAGMA foreign_keys=OFF;\n`);
    await write(`BEGIN TRANSACTION;\n\n`);

    const tables = await sequelize.query(
      `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND substr(name, -7) != '_backup' ORDER BY name`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const table of tables) {
      const tableName = table.name;
      const createSql = table.sql;

      await write(`--\n-- Table structure for table "${tableName}"\n--\n`);
      await write(`DROP TABLE IF EXISTS "${tableName}";\n`);
      if (createSql) {
        await write(`${createSql};\n\n`);
      }

      try {
        const rows = await sequelize.query(`SELECT * FROM "${tableName}"`, {
          type: Sequelize.QueryTypes.SELECT,
          raw: true
        });

        if (rows && rows.length > 0) {
          await write(`--\n-- Dumping data for table "${tableName}" (${rows.length} records)\n--\n`);
          const colNames = Object.keys(rows[0]);
          const colHeader = colNames.map((c) => `"${c}"`).join(', ');

          const batchSize = 100;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const valueRows = batch.map((row) => {
              const vals = colNames.map((col) => escapeSqlValue(row[col], 'sqlite'));
              return `(${vals.join(', ')})`;
            });
            await write(`INSERT INTO "${tableName}" (${colHeader}) VALUES\n${valueRows.join(',\n')};\n`);
          }
          await write(`\n`);
        }
      } catch (err) {
        await write(`-- Note: Failed to dump data for table ${tableName}: ${err.message}\n\n`);
      }
    }

    // Dump SQLite indexes
    try {
      const indexes = await sequelize.query(
        `SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND substr(name, -7) != '_backup'`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      if (indexes.length > 0) {
        await write(`--\n-- Indexes\n--\n`);
        for (const idx of indexes) {
          if (idx.sql) {
            await write(`${idx.sql};\n`);
          }
        }
        await write(`\n`);
      }
    } catch (_) {}

    await write(`COMMIT;\n`);
    await write(`PRAGMA foreign_keys=ON;\n`);
    await write(`-- SQLite Dump completed at ${new Date().toISOString()}\n`);
  }
}

/**
 * Generate full backup file to a local path (used for internal auto-backups or tests)
 */
async function generateBackupFile(targetPath, options = {}) {
  const fs = require('fs');
  const stream = fs.createWriteStream(targetPath, { encoding: 'utf8' });

  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', resolve);

    streamDatabaseBackup(stream, options)
      .then(() => stream.end())
      .catch((err) => {
        stream.destroy(err);
        reject(err);
      });
  });
}

module.exports = {
  escapeSqlValue,
  streamDatabaseBackup,
  generateBackupFile
};
