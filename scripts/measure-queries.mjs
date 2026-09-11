#!/usr/bin/env node
/**
 * scripts/measure-queries.mjs
 *
 * Runs EXPLAIN ANALYZE on the key POS queries and prints timing.
 * Run before and after applying local_first_optimizations.sql to measure impact.
 *
 * Usage:
 *   node scripts/measure-queries.mjs [storeId]
 *
 * Requires DATABASE_URL in environment (loads from .env.local).
 */

import { readFileSync } from "fs"
import { createRequire } from "module"

// Load .env.local only if DATABASE_URL not already set
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(".env.local", "utf8")
    for (const line of env.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "")
    }
  } catch {}
}

const require = createRequire(import.meta.url)
const { Client } = require("pg")

const storeId = process.argv[2] || "test-store-id"

const QUERIES = [
  {
    label: "Sales full scan (before index)",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT id, total, profit, status, "createdAt"
      FROM sales
      WHERE "storeId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 500`,
  },
  {
    label: "Sales date-range with items (reports page)",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT s.id, s.total, s.profit, s.status, s."createdAt",
             si."productName", si.quantity, si.price, si.cost, si.subtotal
      FROM sales s
      JOIN sale_items si ON si."saleId" = s.id
      WHERE s."storeId" = $1
        AND s."createdAt" >= NOW() - INTERVAL '30 days'
      ORDER BY s."createdAt" DESC`,
  },
  {
    label: "Daily summary aggregation (after optimization)",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT date, "grossSales", "netProfit", "txCount", "itemsSold"
      FROM daily_sales_summary
      WHERE "storeId" = $1
      ORDER BY date DESC
      LIMIT 30`,
  },
  {
    label: "Product incremental sync (since timestamp)",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT id, name, barcode, price, cost, stock, "updatedAt"
      FROM products
      WHERE "storeId" = $1
        AND "updatedAt" > NOW() - INTERVAL '1 hour'
      ORDER BY "updatedAt" ASC`,
  },
  {
    label: "Barcode lookup (single product)",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT id, name, barcode, price, stock
      FROM products
      WHERE "storeId" = $1
        AND barcode = 'TEST-BARCODE-001'`,
  },
]

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  console.log("\n═══════════════════════════════════════════════════════════")
  console.log("  POS Query Performance Measurement")
  console.log(`  Store: ${storeId}`)
  console.log("═══════════════════════════════════════════════════════════\n")

  for (const q of QUERIES) {
    console.log(`▶ ${q.label}`)
    console.log("─".repeat(60))
    try {
      const t0 = performance.now()
      const result = await client.query(q.sql, [storeId])
      const elapsed = (performance.now() - t0).toFixed(1)

      const plan = result.rows.map((r) => Object.values(r)[0]).join("\n")
      // Extract the actual time from the plan
      const timeMatch = plan.match(/Execution Time:\s*([\d.]+)\s*ms/)
      const planTime = timeMatch ? timeMatch[1] : "?"

      console.log(plan)
      console.log(`\n  ⏱  Client round-trip: ${elapsed}ms  |  PG execution: ${planTime}ms\n`)
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}\n`)
    }
  }

  await client.end()
  console.log("═══════════════════════════════════════════════════════════")
  console.log("  Done. Compare Seq Scan vs Index Scan in the plans above.")
  console.log("═══════════════════════════════════════════════════════════\n")
}

run().catch(console.error)
