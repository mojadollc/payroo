-- ─── Realtime NOTIFY trigger ─────────────────────────────────────────────────
-- Run once against your PostgreSQL database:
--   psql $DATABASE_URL -f prisma/migrations/notify_trigger.sql

CREATE OR REPLACE FUNCTION notify_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    TG_TABLE_NAME || '_changed',
    json_build_object(
      'action',  TG_OP,
      'storeId', COALESCE(NEW."storeId", OLD."storeId")
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- products
DROP TRIGGER IF EXISTS trg_products_notify ON products;
CREATE TRIGGER trg_products_notify
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION notify_change();

-- sales
DROP TRIGGER IF EXISTS trg_sales_notify ON sales;
CREATE TRIGGER trg_sales_notify
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION notify_change();

-- utang_records
DROP TRIGGER IF EXISTS trg_utang_notify ON utang_records;
CREATE TRIGGER trg_utang_notify
  AFTER INSERT OR UPDATE OR DELETE ON utang_records
  FOR EACH ROW EXECUTE FUNCTION notify_change();

-- ewallet_transactions
DROP TRIGGER IF EXISTS trg_ewallet_notify ON ewallet_transactions;
CREATE TRIGGER trg_ewallet_notify
  AFTER INSERT OR UPDATE OR DELETE ON ewallet_transactions
  FOR EACH ROW EXECUTE FUNCTION notify_change();
