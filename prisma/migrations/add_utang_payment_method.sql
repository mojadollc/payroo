-- Migration: add utang to PaymentMethod enum + utangCustomerName/utangId to sales

-- 1. Add 'utang' to the PaymentMethod enum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'utang';

-- 2. Add utangCustomerName column to sales
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "utangCustomerName" TEXT;

-- 3. Add utangId column to sales
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "utangId" TEXT;
