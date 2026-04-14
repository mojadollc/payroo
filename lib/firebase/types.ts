import type { Timestamp } from "firebase/firestore"

export interface Product {
  id?: string
  name: string
  barcode: string
  price: number
  cost: number
  stock: number
  category: string
  imageUrl?: string
  description?: string
  unit?: string
  onSale?: boolean
  salePrice?: number
  // E-commerce specific fields
  sku?: string
  weight?: number          // in grams
  dimensions?: { length: number; width: number; height: number } // in cm
  shippingClass?: "standard" | "bulky" | "fragile" | "digital"
  variants?: ProductVariant[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ProductVariant {
  name: string             // e.g. "Color", "Size"
  options: string[]        // e.g. ["Red", "Blue", "Green"]
}

export interface Category {
  id?: string
  name: string
  description?: string
  createdAt: Timestamp
}

export interface Sale {
  id?: string
  items: SaleItem[]
  total: number
  paymentMethod: "cash" | "gcash" | "maya"
  status: "completed" | "pending" | "cancelled"
  createdAt: Timestamp
  profit: number
}

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
  cost: number
  subtotal: number
}

export interface EWalletTransaction {
  id?: string
  type: "cashin" | "cashout" | "load"
  provider: "gcash" | "maya"
  amount: number
  commission: number
  commissionRate: number
  profit: number
  customerName?: string
  customerNumber?: string
  referenceNumber: string
  status: "completed" | "pending" | "failed"
  createdAt: Timestamp
}

export interface CommissionSettings {
  id?: string
  // Kiosk cash-in fee breakdown
  xenditFlatFee: number       // Xendit transaction fee per txn (default ₱10)
  xenditVatRate: number        // VAT on Xendit fee (default 0.12 = 12%)
  adminChargeRate: number     // admin % of amountInserted (default 0.01 = 1%)
  sellerCashinRate: number    // seller % of amountInserted (default 0.03 = 3%, min 3%, max 50%)
  // Legacy manual e-wallet rates (kept for backward compat)
  gcashCashinRate: number
  gcashCashoutRate: number
  mayaCashinRate: number
  mayaCashoutRate: number
  updatedAt: Timestamp
}

export interface InventoryTransaction {
  id?: string
  productId: string
  productName: string
  type: "restock" | "sale" | "adjustment"
  quantity: number
  previousStock: number
  newStock: number
  notes?: string
  createdAt: Timestamp
}

export interface UtangRecord {
  id?: string
  customerName: string
  customerPhone?: string
  storeId: string        // Firebase project ID — shared network key
  storeName: string
  items: UtangItem[]
  totalAmount: number
  amountPaid: number
  balance: number
  status: "active" | "partial" | "settled"
  dueDate?: Timestamp
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface UtangItem {
  productName: string
  quantity: number
  price: number
  subtotal: number
}

export interface UtangPayment {
  id?: string
  utangId: string
  customerName: string
  amount: number
  method: "cash" | "gcash" | "maya"
  referenceNumber?: string
  createdAt: Timestamp
}

export interface LoyaltyCustomer {
  id?: string
  name: string
  phone?: string
  coins: number
  totalEarned: number
  totalRedeemed: number
  qrCode: string          // unique identifier encoded in QR
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface LoyaltyTransaction {
  id?: string
  customerId: string
  customerName: string
  type: "earn" | "redeem"
  coins: number
  saleItems?: { productName: string; quantity: number; coinsEarned: number }[]
  saleTotal?: number
  createdAt: Timestamp
}

export interface LoyaltyRule {
  id?: string
  productId: string
  productName: string
  buyQty: number          // buy X of this product...
  earnCoins: number       // ...earn Y coins
  updatedAt: Timestamp
}

export interface LoyaltySettings {
  id?: string
  minRedeemCoins: number  // minimum coins needed to redeem (default 100)
  coinValuePeso: number   // 1 coin = X pesos discount (default 1)
  updatedAt: Timestamp
}

export type SubscriptionTier = "basic" | "gold" | "enterprise"

export interface SubscriptionFeatures {
  pos: boolean
  inventory: boolean
  ewallet: boolean
  reports: boolean
  loyalty: boolean
  utang: boolean
  aiRestock: boolean
  multiUser: boolean
  exportData: boolean
  marketIntelligence: boolean
}

export interface SubscriptionPlan {
  id?: string
  tier: SubscriptionTier
  name: string
  price: number           // monthly price in PHP
  description: string
  features: SubscriptionFeatures
  isActive: boolean
  updatedAt: Timestamp
}

export interface CustomerSubscription {
  id?: string
  ownerName: string
  ownerEmail: string
  storeName: string
  businessType?: string
  phone?: string
  planId: string
  tier: SubscriptionTier
  status: "active" | "expired" | "suspended" | "pending"
  startDate: Timestamp | null
  endDate: Timestamp | null
  notes?: string
  features?: SubscriptionFeatures
  // Xendit payment tracking
  xenditInvoiceId?: string
  xenditPaymentStatus?: "PENDING" | "PAID" | "EXPIRED" | "FAILED"
  xenditPaymentUrl?: string
  externalId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Store user roles: owner manages the store, subadmin helps, cashier does POS only
export type UserRole = "owner" | "subadmin" | "cashier"

// Extra management permissions for subadmins (not tied to subscription plan)
export interface SubadminPermissions {
  manageUsers: boolean
  manageSettings: boolean
}

export interface StoreUser {
  id?: string
  name: string
  username: string
  pin: string
  role: UserRole
  externalId: string
  isActive: boolean
  allowedFeatures?: Partial<SubscriptionFeatures>  // For subadmin: which features they can access
  permissions?: Partial<SubadminPermissions>        // For subadmin: management page access
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Affiliate ────────────────────────────────────────────────────────────────

export interface Affiliate {
  id?: string
  name: string
  email: string
  phone?: string
  referralCode: string   // unique e.g. "mjd-abc123"
  walletBalance: number  // in PHP
  totalEarned: number
  totalWithdrawn: number
  totalReferrals: number
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface AffiliateEarning {
  id?: string
  affiliateId: string
  referralCode: string
  referredEmail: string
  referredStoreName: string
  planName: string
  planPrice: number
  commission: number     // fixed ₱50 per successful referral
  createdAt: Timestamp
}

export interface AffiliateWithdrawal {
  id?: string
  affiliateId: string
  affiliateName: string
  affiliateEmail: string
  amount: number
  gcashNumber: string
  gcashName: string
  status: "pending" | "approved" | "rejected"
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ─── Site Visits ──────────────────────────────────────────────────────────────
export interface SiteVisit {
  id?: string
  ip: string
  country: string
  countryCode: string
  city: string
  region: string
  page: string
  referrer: string
  userAgent: string
  isPWA?: boolean
  createdAt: Timestamp
}

// ─── Market Intelligence ───────────────────────────────────────────────────────
export interface MarketDataPoint {
  id?: string
  // anonymized store location metadata
  region: string          // e.g. "Cebu"
  province: string        // e.g. "Cebu Province"
  city: string            // e.g. "Cebu City"
  barangay: string        // e.g. "Lahug"
  businessType: string    // e.g. "retail"
  // product sold
  productName: string
  category: string
  quantity: number
  revenue: number
  // time
  hour: number            // 0-23
  dayOfWeek: number       // 0=Sun
  date: string            // YYYY-MM-DD
  month: string           // YYYY-MM
  createdAt: Timestamp
}
