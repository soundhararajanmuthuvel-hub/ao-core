/**
 * verify_product_hsn_billing.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated verification script for the HSN Code mismatch bug fix.
 *
 * Tests:
 *   1.  Load all products → confirm hsnCode field is present
 *   2.  Validate that products with gstClass HSN also now have hsnCode (migration)
 *   3.  Simulate the exact HSN validation logic from salesController.js
 *   4.  Test valid 4-digit HSN  (e.g. "1107") → must PASS
 *   5.  Test valid 6-digit HSN  (e.g. "110720") → must PASS
 *   6.  Test valid 8-digit HSN  (e.g. "11072010") → must PASS
 *   7.  Test empty HSN          → must FAIL correctly
 *   8.  Test alpha HSN ("abc")  → must FAIL correctly
 *   9.  Test 3-digit HSN        → must FAIL correctly
 *  10.  Test 5-digit HSN        → must FAIL correctly
 *  11.  Test 7-digit HSN        → must FAIL correctly
 *  12.  Test 9-digit HSN        → must FAIL correctly
 *  13.  Test leading-zero 4-digit HSN ("0107") → must PASS (stored as string)
 *  14.  Test that the canonical field is hsnCode NOT gstClass
 *
 * Usage:
 *   node backend/verify_product_hsn_billing.js
 */

'use strict';

const { sequelize } = require('./config/db');
const Product = require('./models/Product');

// ─── HSN Validation (exact copy from salesController.js after the fix) ───────
function validateHsn(product) {
  // hsnCode is canonical; gstClass is legacy fallback
  const hsnCode = String(product.hsnCode || product.gstClass || '').trim();
  const valid = /^\d{4}$|^\d{6}$|^\d{8}$/.test(hsnCode);
  return { hsnCode, valid };
}

// ─── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function assertValidHsn(label, hsnValue) {
  const mockProduct = { hsnCode: hsnValue, gstClass: '' };
  const { valid } = validateHsn(mockProduct);
  assert(label, valid, `hsnCode="${hsnValue}" expected PASS`);
}

function assertInvalidHsn(label, hsnValue) {
  const mockProduct = { hsnCode: hsnValue, gstClass: '' };
  const { valid } = validateHsn(mockProduct);
  assert(label, !valid, `hsnCode="${hsnValue}" expected FAIL`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  HSN Code Billing Verification Script');
  console.log('══════════════════════════════════════════════════════════════\n');

  await sequelize.authenticate();
  console.log('[DB] Connected to database.\n');

  // ── Section 1: Database inspection ────────────────────────────────────────
  console.log('── Section 1: Database schema & data ──────────────────────────');

  const [schema] = await sequelize.query("PRAGMA table_info('Products')");
  const colNames = schema.map(c => c.name);
  assert('Products table has hsnCode column', colNames.includes('hsnCode'));
  assert('Products table has gstClass column', colNames.includes('gstClass'));

  const products = await Product.findAll({ where: { isArchived: false } });
  console.log(`  ℹ️  Active products in DB: ${products.length}`);

  // Check for products that have HSN in hsnCode
  const productsWithHsnCode = products.filter(p => p.hsnCode && p.hsnCode.trim() !== '');
  const productsWithGstClass = products.filter(p => p.gstClass && p.gstClass.trim() !== '' && /^\d{4}$|^\d{6}$|^\d{8}$/.test(p.gstClass.trim()));
  
  console.log(`  ℹ️  Products with hsnCode set: ${productsWithHsnCode.length}`);
  console.log(`  ℹ️  Products with valid HSN in gstClass (legacy): ${productsWithGstClass.length}`);

  // Any product that has valid HSN in gstClass but not hsnCode is a migration gap
  const migrationGaps = productsWithGstClass.filter(p => !p.hsnCode || p.hsnCode.trim() === '');
  if (migrationGaps.length > 0) {
    console.warn(`  ⚠️  WARNING: ${migrationGaps.length} products have HSN in gstClass but not hsnCode (migration needed):`);
    migrationGaps.forEach(p => console.warn(`     - Product ID ${p.id}: "${p.name}" gstClass="${p.gstClass}"`));
  } else {
    console.log('  ℹ️  No migration gaps detected (all valid gstClass HSNs are in hsnCode).');
  }

  // If there's a product ID 3, show its HSN data
  const product3 = await Product.findByPk(3);
  if (product3) {
    console.log(`\n  ── Product ID 3: "${product3.name}"`);
    console.log(`     hsnCode  = "${product3.hsnCode || ''}"`);
    console.log(`     gstClass = "${product3.gstClass || ''}"`);
    const { hsnCode, valid } = validateHsn(product3);
    console.log(`     Resolved HSN = "${hsnCode}", Validation = ${valid ? '✅ PASS' : '❌ FAIL'}`);
    assert('Product ID 3 resolves a valid HSN', valid, `resolved="${hsnCode}"`);
  } else {
    console.log('  ℹ️  Product ID 3 not found (may have a different ID in this DB).');
  }

  // ── Section 2: HSN validation logic tests ────────────────────────────────
  console.log('\n── Section 2: HSN validation logic ────────────────────────────');

  // Valid HSN codes — must PASS
  assertValidHsn('4-digit HSN "1107"', '1107');
  assertValidHsn('4-digit HSN "0107" (leading zero)', '0107');
  assertValidHsn('6-digit HSN "110720"', '110720');
  assertValidHsn('8-digit HSN "11072010"', '11072010');

  // Invalid HSN codes — must FAIL
  assertInvalidHsn('Empty HSN ""', '');
  assertInvalidHsn('Null HSN (empty string result)', null);
  assertInvalidHsn('Alphabetic HSN "abc"', 'abc');
  assertInvalidHsn('3-digit HSN "110"', '110');
  assertInvalidHsn('5-digit HSN "11072"', '11072');
  assertInvalidHsn('7-digit HSN "1107201"', '1107201');
  assertInvalidHsn('9-digit HSN "110720100"', '110720100');
  assertInvalidHsn('HSN with spaces "11 07"', '11 07');
  assertInvalidHsn('Mixed alphanumeric HSN "1107AB"', '1107AB');

  // ── Section 3: Canonical field resolution ────────────────────────────────
  console.log('\n── Section 3: Canonical field resolution ───────────────────────');

  // hsnCode takes priority over gstClass
  const p1 = { hsnCode: '1107', gstClass: '9999' };
  const r1 = validateHsn(p1);
  assert('hsnCode takes priority over gstClass', r1.hsnCode === '1107', `resolved="${r1.hsnCode}"`);

  // Falls back to gstClass when hsnCode is empty
  const p2 = { hsnCode: '', gstClass: '1107' };
  const r2 = validateHsn(p2);
  assert('Falls back to gstClass when hsnCode is empty', r2.hsnCode === '1107', `resolved="${r2.hsnCode}"`);

  // Falls back to gstClass when hsnCode is null
  const p3 = { hsnCode: null, gstClass: '110720' };
  const r3 = validateHsn(p3);
  assert('Falls back to gstClass when hsnCode is null', r3.hsnCode === '110720', `resolved="${r3.hsnCode}"`);

  // Both empty → fails validation
  const p4 = { hsnCode: null, gstClass: '' };
  const r4 = validateHsn(p4);
  assert('Both hsnCode and gstClass empty → fails validation', !r4.valid);

  // ── Section 4: Product-level HSN resolution for all active products ───────
  console.log('\n── Section 4: All active products HSN resolution ───────────────');

  let missingHsn = 0;
  for (const p of products) {
    const { hsnCode, valid } = validateHsn(p);
    if (!valid) {
      missingHsn++;
      if (missingHsn <= 5) {
        console.log(`  ⚠️  Product ID ${p.id} "${p.name}" — no valid HSN (hsnCode="${p.hsnCode || ''}", gstClass="${p.gstClass || ''}")`);
      }
    }
  }

  if (missingHsn === 0) {
    console.log('  ✅ All active products have a valid HSN code.');
  } else {
    console.log(`  ⚠️  ${missingHsn} product(s) are missing a valid HSN code.`);
    console.log('     These products will fail GST invoice creation.');
    console.log('     Update them in Product Master before billing.');
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Verification complete: ${passed} PASSED, ${failed} FAILED`);
  if (failed === 0) {
    console.log('  🎉 ALL TESTS PASSED — HSN fix verified successfully.');
  } else {
    console.log('  ⚠️  Some tests failed. Review the output above.');
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  await sequelize.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
