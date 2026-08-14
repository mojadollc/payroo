// Postgres-compatible shared types (no Firebase Timestamp dependency)

export interface EWalletTransaction {
  id?: string
  storeId?: string
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
  createdAt: Date | string
}

export interface CommissionSettings {
  id?: string
  storeId?: string
  xenditFlatFee: number
  xenditVatRate: number
  adminChargeRate: number
  sellerCashinRate: number
  gcashCashinRate: number
  gcashCashoutRate: number
  mayaCashinRate: number
  mayaCashoutRate: number
  eloadFeeType: "flat" | "percentage"
  eloadFeeValue: number
  updatedAt?: Date | string
}
