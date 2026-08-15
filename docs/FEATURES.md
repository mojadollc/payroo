# Payroo POS System — Full Feature Documentation

**Version:** 1.0  
**Stack:** Next.js 15, PostgreSQL, Prisma ORM, Tailwind CSS  
**Deployed at:** https://pntos.payroo.xyz  
**Repository:** https://github.com/mojadollc/payroo.git

---

## Table of Contents

1. [Point of Sale (POS)](#1-point-of-sale-pos)
2. [Inventory Management](#2-inventory-management)
3. [Reports](#3-reports)
4. [E-Wallet Services](#4-e-wallet-services)
5. [Pay Bills](#5-pay-bills)
6. [Utang (Credit Tracker)](#6-utang-credit-tracker)
7. [Loyalty Program](#7-loyalty-program)
8. [Delivery Management](#8-delivery-management)
9. [AI Restock](#9-ai-restock)
10. [Market Intelligence](#10-market-intelligence)
11. [User Management](#11-user-management)
12. [Store Settings](#12-store-settings)
13. [Branch Management](#13-branch-management)
14. [Subscription & Billing](#14-subscription--billing)
15. [Operations Tools](#15-operations-tools)
16. [PWA / Mobile App](#16-pwa--mobile-app)
17. [System / Infrastructure](#17-system--infrastructure)

---

## 1. Point of Sale (POS)

**Route:** `/pos`

| Feature | Description |
|---|---|
| Barcode scanning | Camera-based and USB/OTG hardware scanner support |
| Product search | Live search with suggestions dropdown |
| Stock badge | Color-coded stock indicator — green (normal), orange (low ≤5), red (out of stock) |
| Quick-add | Quantity selector directly in search dropdown |
| Cart management | Add, remove, adjust quantity per item |
| Variant support | Products with color, size, flavor, etc. |
| Sale price | On Sale toggle with discounted price display |
| Payment methods | Cash, GCash, Maya |
| Checkout | Change calculator, receipt summary |
| Void sales | Cancel/void completed transactions |
| Offline support | IndexedDB cache for products and cart |
| Cart persistence | Cart saved to localStorage on every change |
| Animated cart FAB | Smiley cart with blinking eyes, floating bounce, "More Sales Today!" label |

---

## 2. Inventory Management

**Route:** `/inventory`

| Feature | Description |
|---|---|
| Add product | Name, barcode, price, cost, stock, category, image, description, unit |
| Edit product | Update all product fields including image |
| Delete product | Removes product and related records (inventory transactions, sale items) |
| Product image | Upload with auto square crop (Shopee-style, 600×600 JPEG) |
| Image storage | Saved to `/var/www/pntos.payroo.xyz/inventory/products/images/` |
| Barcode generation | Auto EAN-12 barcode generator |
| Barcode scanner | Camera scanner for product lookup |
| Auto-fill | Open Food Facts API — auto-fills name and category from barcode |
| Categories | Create, edit, delete product categories |
| Stock tracking | Real-time stock per product |
| Low stock badge | Visual alert when stock ≤ 10 |
| Bulk CSV upload | Import multiple products via CSV file |
| Stock adjustment | Manual restock or adjustment with notes |
| Inventory history | Full transaction history per product |
| Product variants | Color, size, flavor, etc. with options |
| E-commerce fields | SKU, weight (grams), dimensions (L×W×H cm), shipping class |
| Unit of measure | Per-product unit (pcs, kg, L, box, etc.) |
| On Sale toggle | Mark product on sale with sale price |

---

## 3. Reports

**Route:** `/reports`

| Feature | Description |
|---|---|
| Date range picker | Filter reports by custom date range |
| Sales report | All sales with items, quantities, revenue, profit |
| Profit tracking | Revenue vs cost of goods, net profit |
| E-Wallet report | GCash/Maya transactions with commissions |
| Bill Payments report | Total billed amount + service fee earned |
| Tobacco report | Separate compliance tracking for tobacco products |
| Profit chart | Visual bar/line chart of profit over time |
| CSV export | Download sales and e-wallet data as CSV |
| Today's summary | Quick stats card for today's performance |
| Top selling items | Top 5 products by quantity sold today |
| Stats cards | Total revenue, profit, sales count, e-wallet, bills |

---

## 4. E-Wallet Services

**Route:** `/ewallet`

| Feature | Description |
|---|---|
| GCash Cash-in | Process GCash top-up for customers |
| GCash Cash-out | Process GCash withdrawal for customers |
| Maya Cash-in | Process Maya top-up for customers |
| Maya Cash-out | Process Maya withdrawal for customers |
| E-Load | Load mobile credits via GBits API (all networks) |
| Commission settings | Configure flat or percentage fee per service |
| Transaction history | Full history with amount, commission, profit |
| Xendit disbursement | Send money to bank/e-wallet via Xendit |
| Xendit webhook | Real-time payment status updates |
| Balance tracking | GBits balance cached and displayed |

---

## 5. Pay Bills

**Route:** `/bills`

| Feature | Description |
|---|---|
| Quick biller select | Tap buttons for MERALCO, GLOBE, SMART, PLDT, MAYNILAD, MANILA WATER, CONVERGE, SKY CABLE, CIGNAL, PETRON, SSS, PhilHealth, Pag-IBIG, BIR |
| Custom biller | Type any biller name manually |
| Account number | Manual input or auto-generated if left empty |
| Amount input | Required — bill amount to be paid |
| Service fee | Required — store's service charge |
| Overall total | Live calculation of amount + service fee |
| TXN Reference | Unique identifier per transaction (e.g. `BP-1234567890-AB12CD`) |
| Receipt display | Shows full receipt after successful payment |
| Transaction history | List of all bill payments with delete option |
| Reports integration | Bill payments included in revenue and profit totals |

---

## 6. Utang (Credit Tracker)

**Route:** `/utang`

| Feature | Description |
|---|---|
| Record utang | Create credit record for a customer |
| Add items | List of products/items included in the credit |
| Partial payment | Record partial payments against balance |
| Full settlement | Mark utang as fully paid |
| Payment history | All payments per utang record |
| Balance tracking | Running balance per customer |
| Due date | Optional due date per record |
| Status tracking | Active / Partial / Settled |
| Customer search | Search by customer name |

---

## 7. Loyalty Program

**Route:** `/loyalty`

| Feature | Description |
|---|---|
| Customer registration | Register customer with name, phone, QR code |
| QR code | Unique QR per customer for scanning at checkout |
| Earn coins | Configurable coins earned per product purchase |
| Redeem coins | Redeem coins as discount at checkout |
| Loyalty rules | Set earn rules per product (buy X → earn Y coins) |
| Transaction history | Full earn/redeem history per customer |
| Coin value | Configure ₱ value per coin |
| Minimum redeem | Set minimum coins required to redeem |

---

## 8. Delivery Management

**Route:** `/delivery-manage` (store) · `/delivery` (customer)

| Feature | Description |
|---|---|
| Delivery settings | Enable/disable, store name, hours, min order, delivery fee |
| Product selection | Choose which products are available for delivery |
| Banner management | Upload and manage store banners |
| Order management | View and update order status |
| Order statuses | Pending → Confirmed → Preparing → Delivering → Delivered → Cancelled |
| Customer store page | Public-facing delivery page for customers |
| Order search | Search delivery orders |
| Store logo/image | Upload store image for delivery page |

---

## 9. AI Restock

**Route:** `/restock`

| Feature | Description |
|---|---|
| Restock suggestions | AI-powered recommendations based on sales velocity |
| Low stock alerts | Highlights products needing reorder |
| Reorder quantities | Suggested order quantities per product |

---

## 10. Market Intelligence

**Route:** `/market-intelligence`

| Feature | Description |
|---|---|
| Regional data | Sales data aggregated by region/province/city/barangay |
| Product performance | Top products by area |
| Business comparison | Compare performance across business types |
| Revenue trends | Monthly revenue trends |
| Filters | Filter by region, city, product, category |

---

## 11. User Management

**Route:** `/users`

| Feature | Description |
|---|---|
| Roles | Owner, Sub-admin, Cashier |
| PIN login | 4-digit PIN authentication |
| Add users | Create staff accounts with role assignment |
| Edit users | Update name, username, PIN, role |
| Deactivate users | Disable user access without deleting |
| Feature permissions | Per-user feature access control |
| Page permissions | Per-user page access (manage settings, manage users) |
| PIN reset | Reset PIN via email (temp PIN sent) |

---

## 12. Store Settings

**Route:** `/settings`

| Feature | Description |
|---|---|
| Store name | Display name across the app |
| Address | Full store address |
| Phone number | Store contact number |
| Business type | Sari-sari, salon, carinderia, etc. |
| Region/Province/City/Barangay | Location fields |
| Store ID | Unique store identifier |

---

## 13. Branch Management

| Feature | Description |
|---|---|
| Multi-branch | Support for multiple store branches |
| Branch switcher | Switch between branches in navbar |
| Data isolation | Each branch has its own data |
| Branch creation | Add branches under main store account |

---

## 14. Subscription & Billing

**Route:** `/subscription`

| Feature | Description |
|---|---|
| Tiers | Basic, Gold, Enterprise |
| Xendit payment | Pay subscription via Xendit invoice |
| Expiry reminders | Email sent before subscription expires |
| Feature gating | Features locked/unlocked per tier |
| Affiliate system | Referral codes with commission tracking |
| Affiliate earnings | ₱150 commission per referred subscription |
| Affiliate withdrawals | Request withdrawal via GCash/bank |
| Admin management | Manage plans, customers, affiliates, expenses |

---

## 15. Operations Tools

| Feature | Route | Description |
|---|---|---|
| e-Lista | `/elista` | Digital shopping/order list with items, qty, price, amount |
| Checklist | `/checklist` | Daily task checklist with done/undone toggle |
| Dashboard | `/dashboard` | Overview stats and quick access |

---

## 16. PWA / Mobile App

| Feature | Description |
|---|---|
| Installable | Add to home screen on Android/iOS |
| Offline mode | Service worker caches app shell and product data |
| Mobile bottom nav | POS · E-Wallet · Inventory · Pay Bills · Reports · More |
| Bottom sheets | Mobile-friendly drawer UI for cart, forms |
| Install prompt | In-app "Install App" button |
| Auto update | Detects new version and prompts refresh |
| Safe area | Handles iPhone notch and Android nav bar |

---

## 17. System / Infrastructure

| Feature | Description |
|---|---|
| Database | PostgreSQL via Prisma ORM |
| Framework | Next.js 15 App Router (Turbopack) |
| Image storage | Local filesystem — `/var/www/pntos.payroo.xyz/inventory/products/images/` |
| Image API | `/api/image/[...path]` — serves images with path traversal protection |
| Image upload | `/api/upload` — crop, save, return URL |
| Real-time | Server-Sent Events (SSE) via `/api/realtime` |
| Email | Nodemailer + Gmail SMTP |
| Payments | Xendit (invoices, disbursements, webhooks) |
| E-Load | GBits API integration |
| Visitor tracking | IP, country, city, page, referrer, PWA flag |
| Admin tools | Repair account, fix images, migrate store ID |
| PM2 | Process manager for Node.js on VPS |
| Nginx | Reverse proxy on Ubuntu VPS |

---

## Summary

| Category | Count |
|---|---|
| Major feature areas | 17 |
| Pages / Routes | 20+ |
| API endpoints | 35+ |
| Database models | 30+ |
| Supported billers | 14 |
| Payment methods | Cash, GCash, Maya, Xendit |
| User roles | Owner, Sub-admin, Cashier |
| Subscription tiers | Basic, Gold, Enterprise |

---

*Last updated: August 2026*  
*Maintained by: Payroo Development Team*
