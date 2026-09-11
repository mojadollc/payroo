-- Migration: local-first optimizations
-- Run with: psql $DATABASE_URL -f prisma/migrations/local_first_optimizations.sql

-- ── 1. Daily sales summary aggregation table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_sales_summary (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "storeId"   TEXT NOT NULL,
  date        TEXT NOT NULL,          -- YYYY-MM-DD in PH time
  "grossSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netProfit"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "txCount"    INTEGER NOT NULL DEFAULT 0,
  "itemsSold"  INTEGER NOT NULL DEFAULT 0,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT daily_sales_summary_store_date_key UNIQUE ("storeId", date)
);

CREATE INDEX IF NOT EXISTS daily_sales_summary_store_date
  ON daily_sales_summary ("storeId", date);

-- ── 2. Covering index for sales date-range queries (reports) ──────────────────
-- Covers: WHERE storeId = ? AND createdAt BETWEEN ? AND ?
-- INCLUDE total, profit avoids heap fetch for summary queries
CREATE INDEX IF NOT EXISTS idx_sales_store_created_covering
  ON sales ("storeId", "createdAt" DESC)
  INCLUDE (total, profit, status);

-- ── 3. Covering index for sale_items product breakdown ────────────────────────
-- Covers: JOIN sale_items ON saleId WHERE productId = ?
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_product
  ON sale_items ("saleId", "productId")
  INCLUDE ("productName", quantity, price, cost, subtotal);

-- ── 4. Covering index for ewallet date-range queries ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_ewallet_store_created_covering
  ON ewallet_transactions ("storeId", "createdAt" DESC)
  INCLUDE (amount, commission, profit, type, provider);

-- ── 5. Products: composite index for incremental sync ────────────────────────
-- Already in schema but ensure it exists: (storeId, updatedAt)
CREATE INDEX IF NOT EXISTS idx_products_store_updated
  ON products ("storeId", "updatedAt" ASC);

-- ── 6. Backfill daily_sales_summary from existing sales ──────────────────────
-- Run once after migration. Safe to re-run (upsert).
INSERT INTO daily_sales_summary ("storeId", date, "grossSales", "netProfit", "txCount", "itemsSold", "updatedAt")
SELECT
  s."storeId",
  TO_CHAR(s."createdAt" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS date,
  SUM(CASE WHEN s.status != 'voided' THEN s.total ELSE 0 END)  AS "grossSales",
  SUM(CASE WHEN s.status != 'voided' THEN s.profit ELSE 0 END) AS "netProfit",
  COUNT(CASE WHEN s.status != 'voided' THEN 1 END)             AS "txCount",
  COALESCE(SUM(CASE WHEN s.status != 'voided' THEN si_agg.qty ELSE 0 END), 0) AS "itemsSold"
FROM sales s
LEFT JOIN LATERAL (
  SELECT SUM(quantity) AS qty FROM sale_items WHERE "saleId" = s.id
) si_agg ON true
GROUP BY s."storeId", TO_CHAR(s."createdAt" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')
ON CONFLICT ("storeId", date) DO UPDATE SET
  "grossSales" = EXCLUDED."grossSales",
  "netProfit"  = EXCLUDED."netProfit",
  "txCount"    = EXCLUDED."txCount",
  "itemsSold"  = EXCLUDED."itemsSold",
  "updatedAt"  = now();
