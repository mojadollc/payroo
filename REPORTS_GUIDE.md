# 📊 Payroo POS — Reports Guide

A simple guide to understanding all the numbers on the Reports page.

---

## 🧾 Today's Performance Card

This card shows everything that happened **today** — all from the same data source so the numbers are consistent.

| Card | What it means |
|------|--------------|
| **Gross Sales** | Total cash collected from ALL product sales today |
| **Net Profit (All)** | Your actual profit from ALL products after subtracting cost of goods |
| **E-Wallet** | Total e-wallet transactions processed + your commission earned |
| **Total Earnings** | Net Profit + E-Wallet Commission — your real take-home money |
| **Tobacco Only** | Gross collected + Net profit from tobacco products only |

---

## 💡 Simple Formula

```
Gross Sales         = Total cash collected (ALL products)
  └─ Tobacco Gross  = Cash collected from tobacco only (subset of Gross Sales)

Net Profit (All)    = Gross Sales − Cost of all goods
  └─ Tobacco Net    = Tobacco Gross − Cost of tobacco stock (subset of Net Profit)

Total Earnings      = Net Profit (All) + E-Wallet Commission
```

---

## 🚬 Tobacco Report Explained

The Tobacco tab shows **tobacco products only** — Winston, Mighty, Marlboro, etc.

| Term | Meaning |
|------|---------|
| **Gross Revenue** | Total cash customers paid you for tobacco (includes your cost) |
| **Net Profit** | Tobacco Gross minus what you paid for the cigarette stock |
| **Sticks Sold** | Total units of tobacco sold in the period |
| **Stock Capital** | Current tobacco stock × cost price (money tied up in inventory) |

---

## ❓ Why is Tobacco Gross sometimes higher than Total Earnings?

**Because they measure completely different things.**

**Example:**

- You sold ₱1,158 worth of cigarettes today → **Tobacco Gross = ₱1,158**
- But you paid ₱975 to buy that stock → **Tobacco Net = ₱183**
- Your profit from ALL products + e-wallet = **Total Earnings = ₱1,132**

Tobacco Gross (₱1,158) looks bigger than Total Earnings (₱1,132) because:
- Tobacco Gross = **full revenue** (includes your cost of goods)
- Total Earnings = **profit only** (after subtracting all costs)

This is **normal and correct**. Gross is always bigger than Net.

---

## 📅 Selected Period vs Today

| Section | Date Range |
|---------|-----------|
| **Today's Performance** (top card) | Always today only |
| **Selected Period** (Tobacco tab) | Follows the date range picker (default: current month) |
| **Profit Tracker chart** | Follows the date range picker |

---

## 📈 Profit Tracker Chart

The chart shows **daily net profit** broken down by category:

| Color | What it tracks |
|-------|---------------|
| 🟢 Green | Sales net profit (all products) |
| 🔵 Blue | E-Wallet commission earned |
| 🟡 Amber | Tobacco net profit only |
| 🟣 Purple (dashed) | Total combined profit |

> **Tip:** Tobacco (amber) is always a subset of Sales (green) — you will always see amber below or equal to green.

---

## 💰 Key Rule to Remember

> **Gross** = full amount customers paid (includes your cost)
> **Net** = your actual profit (after subtracting cost of goods)
> **Total Earnings** = net profit from all products + e-wallet commission

**Gross is always bigger than Net.** The difference is the cost of your stock.

---

## 🔢 Real Example Walkthrough

Imagine today you made 3 transactions:

1. Customer bought Winston × 10 = **₱100** (you paid ₱75 for stock → profit ₱25)
2. Customer bought Mighty × 5 + Coke + Chips = **₱200** (profit ₱80)
3. Customer did GCash Cash-in ₱500 → you earn **₱10 commission**

| Card | Value | Calculation |
|------|-------|-------------|
| Gross Sales | ₱300 | ₱100 + ₱200 |
| Net Profit (All) | ₱105 | ₱25 + ₱80 |
| E-Wallet | ₱500 transacted, ₱10 commission | |
| Total Earnings | ₱115 | ₱105 + ₱10 |
| Tobacco Gross | ₱300 | ₱100 + ₱100 (tobacco items in sale 2) |
| Tobacco Net | ₱45 | ₱25 + ₱20 (tobacco profit only) |

---

*Last updated: August 2026 — Payroo POS v2.1*
