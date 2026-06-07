import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { getFirebaseDb, getFirebaseStorage } from "./config"
import { getStoreId } from "@/lib/store-id"
import type { Product, Category, Sale, EWalletTransaction, CommissionSettings, InventoryTransaction, UtangRecord, UtangPayment, LoyaltyCustomer, LoyaltyTransaction, LoyaltyRule, LoyaltySettings, SubscriptionPlan, CustomerSubscription, SubscriptionTier, SubscriptionFeatures, StoreUser, UserRole, MarketDataPoint, Affiliate, AffiliateEarning, AffiliateWithdrawal, DeliverySettings, DeliveryOrder, DeliveryBanner } from "./types"

// Product Services
export const addProduct = async (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const docRef = await addDoc(collection(db, "products"), {
    ...Object.fromEntries(Object.entries(product).filter(([, v]) => v !== undefined)),
    storeId: getStoreId(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export const updateProduct = async (id: string, product: Partial<Product>) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const docRef = doc(db, "products", id)
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const [key, value] of Object.entries(product)) {
    data[key] = value === undefined ? deleteField() : value
  }
  await updateDoc(docRef, data)
}

export const deleteProduct = async (id: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  await deleteDoc(doc(db, "products", id))
}

export const getProducts = async () => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const sid = getStoreId()
  const querySnapshot = await getDocs(query(collection(db, "products"), where("storeId", "==", sid), orderBy("name")))
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product)
}

export const getProductByBarcode = async (barcode: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const q = query(collection(db, "products"), where("storeId", "==", getStoreId()), where("barcode", "==", barcode))
  const querySnapshot = await getDocs(q)
  if (querySnapshot.empty) return null
  const doc = querySnapshot.docs[0]
  return { id: doc.id, ...doc.data() } as Product
}

/** Real-time listener for products — calls `onChange` whenever any product is added/updated/deleted */
export const onProductsSnapshot = (onChange: (products: Product[]) => void): (() => void) => {
  const db = getFirebaseDb()
  if (!db) return () => {}
  const sid = getStoreId()
  const q = query(collection(db, "products"), where("storeId", "==", sid), orderBy("name"))
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product))
  }, (error) => {
    console.error("[onProductsSnapshot] error:", error)
  })
}

export const bulkAddProducts = async (products: Omit<Product, "id" | "createdAt" | "updatedAt">[]) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const sid = getStoreId()
  const BATCH_SIZE = 400
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const p of products.slice(i, i + BATCH_SIZE)) {
      const ref = doc(collection(db, "products"))
      batch.set(ref, {
        ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== "")),
        storeId: sid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

// Category Services
export const addCategory = async (category: Omit<Category, "id" | "createdAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const docRef = await addDoc(collection(db, "categories"), {
    ...category,
    storeId: getStoreId(),
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export const getCategories = async () => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const querySnapshot = await getDocs(query(collection(db, "categories"), where("storeId", "==", getStoreId()), orderBy("name")))
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Category)
}

export const deleteCategory = async (id: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  await deleteDoc(doc(db, "categories", id))
}

// Sales Services
export const addSale = async (sale: Omit<Sale, "id" | "createdAt">, storeLocation?: { region: string; province: string; city: string; barangay: string; businessType: string }) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const batch = writeBatch(db)
  const sid = getStoreId()

  const saleRef = doc(collection(db, "sales"))
  batch.set(saleRef, { ...sale, storeId: sid, createdAt: serverTimestamp() })

  const now = new Date()
  const dateStr = now.toISOString().split("T")[0]
  const monthStr = dateStr.slice(0, 7)

  // Fetch ALL product docs in parallel instead of one-by-one
  const productRefs = sale.items.map(item => doc(db, "products", item.productId))
  const productSnaps = await Promise.all(productRefs.map(r => getDoc(r)))

  for (let i = 0; i < sale.items.length; i++) {
    const item = sale.items[i]
    const productSnap = productSnaps[i]

    if (productSnap.exists()) {
      const currentStock = productSnap.data().stock
      const newStock = currentStock - item.quantity
      batch.update(productRefs[i], { stock: newStock, updatedAt: serverTimestamp() })

      const invTransRef = doc(collection(db, "inventoryTransactions"))
      batch.set(invTransRef, {
        productId: item.productId, productName: item.productName,
        type: "sale", quantity: -item.quantity,
        previousStock: currentStock, newStock,
        storeId: sid,
        notes: "Sale transaction", createdAt: serverTimestamp(),
      })
    }

    if (storeLocation) {
      const mdRef = doc(collection(db, "marketData"))
      batch.set(mdRef, {
        region: storeLocation.region,
        province: storeLocation.province,
        city: storeLocation.city,
        barangay: storeLocation.barangay,
        businessType: storeLocation.businessType,
        productName: item.productName,
        category: productSnap?.data?.()?.category ?? "Uncategorized",
        quantity: item.quantity,
        revenue: item.subtotal,
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
        date: dateStr,
        month: monthStr,
        createdAt: serverTimestamp(),
      } as Omit<MarketDataPoint, "id">)
    }
  }

  await batch.commit()
  return saleRef.id
}

export const voidSale = async (saleId: string): Promise<void> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const sid = getStoreId()

  // Load the sale
  const saleSnap = await getDoc(doc(db, "sales", saleId))
  if (!saleSnap.exists()) throw new Error("Sale not found")
  const sale = saleSnap.data() as Sale
  if (sale.status === "voided") throw new Error("Sale is already voided")

  // Fetch all product docs in parallel
  const productRefs = sale.items.map((item: any) => doc(db, "products", item.productId))
  const productSnaps = await Promise.all(productRefs.map((r: any) => getDoc(r)))

  const batch = writeBatch(db)

  // Mark sale as voided
  batch.update(doc(db, "sales", saleId), {
    status: "voided",
    voidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Restore stock for each item
  for (let i = 0; i < sale.items.length; i++) {
    const item = sale.items[i] as any
    const productSnap = productSnaps[i]
    if (!productSnap.exists()) continue

    const currentStock = productSnap.data().stock
    const restoredStock = currentStock + item.quantity

    batch.update(productRefs[i], { stock: restoredStock, updatedAt: serverTimestamp() })

    // Log inventory transaction for the reversal
    const invRef = doc(collection(db, "inventoryTransactions"))
    batch.set(invRef, {
      productId: item.productId,
      productName: item.productName,
      type: "void",
      quantity: item.quantity,
      previousStock: currentStock,
      newStock: restoredStock,
      storeId: sid,
      notes: `Sale voided — Ref: ${saleId}`,
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

export const getSales = async (startDate?: Date, endDate?: Date) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const sid = getStoreId()
  let q = query(collection(db, "sales"), where("storeId", "==", sid), orderBy("createdAt", "desc"))

  if (startDate && endDate) {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0)
    const end = new Date(endDate); end.setHours(23, 59, 59, 999)
    q = query(
      collection(db, "sales"),
      where("storeId", "==", sid),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
      orderBy("createdAt", "desc"),
    )
  }

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Sale)
}

// E-Wallet Services
export const addEWalletTransaction = async (
  transaction: Omit<EWalletTransaction, "id" | "createdAt" | "commission" | "profit">,
) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const commission = transaction.amount * transaction.commissionRate
  const profit = commission

  const docRef = await addDoc(collection(db, "ewalletTransactions"), {
    ...transaction,
    commission,
    profit,
    storeId: getStoreId(),
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export const getEWalletTransactions = async (startDate?: Date, endDate?: Date) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const sid = getStoreId()
  let q = query(collection(db, "ewalletTransactions"), where("storeId", "==", sid), orderBy("createdAt", "desc"))

  if (startDate && endDate) {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0)
    const end = new Date(endDate); end.setHours(23, 59, 59, 999)
    q = query(
      collection(db, "ewalletTransactions"),
      where("storeId", "==", sid),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
      orderBy("createdAt", "desc"),
    )
  }

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as EWalletTransaction)
}

// Commission Settings Services
export const getCommissionSettings = async () => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const sid = getStoreId()
  const querySnapshot = await getDocs(query(collection(db, "commissionSettings"), where("storeId", "==", sid)))
  if (querySnapshot.empty) {
    const defaultSettings = {
      xenditFlatFee: 10,
      xenditVatRate: 0.12,
      adminChargeRate: 0.01,
      sellerCashinRate: 0.02,
      gcashCashinRate: 0.02,
      gcashCashoutRate: 0.02,
      mayaCashinRate: 0.02,
      mayaCashoutRate: 0.02,
      storeId: sid,
      updatedAt: serverTimestamp(),
    }
    const docRef = await addDoc(collection(db, "commissionSettings"), defaultSettings)
    return { id: docRef.id, ...defaultSettings } as CommissionSettings
  }
  const doc = querySnapshot.docs[0]
  return { id: doc.id, ...doc.data() } as CommissionSettings
}

// Kiosk Cash-In Transaction Services
export const getCashinTransactions = async (storeId: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "cashinTransactions"), where("storeId", "==", storeId), orderBy("createdAt", "desc")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as any)
}

export const updateCommissionSettings = async (id: string, settings: Partial<CommissionSettings>) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const docRef = doc(db, "commissionSettings", id)
  await updateDoc(docRef, {
    ...settings,
    updatedAt: serverTimestamp(),
  })
}

// Inventory Transaction Services
export const addInventoryTransaction = async (transaction: Omit<InventoryTransaction, "id" | "createdAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const batch = writeBatch(db)

  // Add inventory transaction
  const transRef = doc(collection(db, "inventoryTransactions"))
  batch.set(transRef, {
    ...transaction,
    storeId: getStoreId(),
    createdAt: serverTimestamp(),
  })

  // Update product stock
  const productRef = doc(db, "products", transaction.productId)
  batch.update(productRef, {
    stock: transaction.newStock,
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return transRef.id
}

export const getInventoryTransactions = async (productId?: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const sid = getStoreId()
  let q = query(collection(db, "inventoryTransactions"), where("storeId", "==", sid), orderBy("createdAt", "desc"))

  if (productId) {
    q = query(
      collection(db, "inventoryTransactions"),
      where("storeId", "==", sid),
      where("productId", "==", productId),
      orderBy("createdAt", "desc"),
    )
  }

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as InventoryTransaction)
}

// Image Upload Service
export const uploadProductImage = async (file: File, productId: string) => {
  const storage = getFirebaseStorage()
  if (!storage) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const storageRef = ref(storage, `products/${productId}/${file.name}`)
  await uploadBytes(storageRef, file)
  const downloadURL = await getDownloadURL(storageRef)
  return downloadURL
}

export const deleteProductImage = async (imageUrl: string) => {
  const storage = getFirebaseStorage()
  if (!storage) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const imageRef = ref(storage, imageUrl)
  await deleteObject(imageRef)
}

// Store Settings Services
export const getStoreSettings = async (): Promise<{ name: string; address: string; phone?: string; businessType?: string; region?: string; province?: string; city?: string; barangay?: string } | null> => {
  const db = getFirebaseDb()
  if (!db) return null
  const sid = getStoreId()
  if (!sid) return null
  const snap = await getDocs(query(collection(db, "storeSettings"), where("storeId", "==", sid)))
  if (snap.empty) return null
  return snap.docs[0].data() as { name: string; address: string; phone?: string; businessType?: string; region?: string; province?: string; city?: string; barangay?: string }
}

export const saveStoreSettings = async (settings: { name?: string; address?: string; phone?: string; businessType?: string; region?: string; province?: string; city?: string; barangay?: string }) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const sid = getStoreId()
  const snap = await getDocs(query(collection(db, "storeSettings"), where("storeId", "==", sid)))
  if (snap.empty) {
    await addDoc(collection(db, "storeSettings"), { ...settings, storeId: sid })
  } else {
    await updateDoc(snap.docs[0].ref, settings)
  }
}

// Utang (Credit) Services
export const addUtang = async (utang: Omit<UtangRecord, "id" | "createdAt" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const docRef = await addDoc(collection(db, "utang"), {
    ...utang,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export const getUtangList = async (status?: UtangRecord["status"]) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const sid = getStoreId()
  let q = query(collection(db, "utang"), where("storeId", "==", sid), orderBy("createdAt", "desc"))
  if (status) {
    q = query(collection(db, "utang"), where("storeId", "==", sid), where("status", "==", status), orderBy("createdAt", "desc"))
  }
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as UtangRecord)
}

export const searchUtangByName = async (name: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  // Search across ALL stores in the shared network
  const snap = await getDocs(query(collection(db, "utang"), where("status", "in", ["active", "partial"]), orderBy("createdAt", "desc")))
  const lower = name.toLowerCase()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as UtangRecord).filter(r => r.customerName.toLowerCase().includes(lower))
}

export const addUtangPayment = async (payment: Omit<UtangPayment, "id" | "createdAt">, utangId: string, newBalance: number) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const batch = writeBatch(db)
  const payRef = doc(collection(db, "utangPayments"))
  batch.set(payRef, { ...payment, createdAt: serverTimestamp() })
  const utangRef = doc(db, "utang", utangId)
  const status = newBalance <= 0 ? "settled" : "partial"
  batch.update(utangRef, {
    balance: Math.max(0, newBalance),
    amountPaid: payment.amount,
    status,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

export const getUtangPayments = async (utangId: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "utangPayments"), where("utangId", "==", utangId), orderBy("createdAt", "desc")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as UtangPayment)
}

export const deleteUtang = async (id: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await deleteDoc(doc(db, "utang", id))
}

// Loyalty Services
export const getLoyaltySettings = async (): Promise<LoyaltySettings> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const sid = getStoreId()
  const snap = await getDocs(query(collection(db, "loyaltySettings"), where("storeId", "==", sid)))
  if (snap.empty) {
    const defaults = { minRedeemCoins: 100, coinValuePeso: 1, storeId: sid, updatedAt: serverTimestamp() }
    const ref = await addDoc(collection(db, "loyaltySettings"), defaults)
    return { id: ref.id, ...defaults } as unknown as LoyaltySettings
  }
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as LoyaltySettings
}

export const saveLoyaltySettings = async (settings: Pick<LoyaltySettings, "minRedeemCoins" | "coinValuePeso">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const sid = getStoreId()
  const snap = await getDocs(query(collection(db, "loyaltySettings"), where("storeId", "==", sid)))
  const data = { ...settings, updatedAt: serverTimestamp() }
  if (snap.empty) await addDoc(collection(db, "loyaltySettings"), { ...data, storeId: sid })
  else await updateDoc(snap.docs[0].ref, data)
}

export const getLoyaltyRules = async (): Promise<LoyaltyRule[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(collection(db, "loyaltyRules"))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as LoyaltyRule)
}

export const saveLoyaltyRule = async (rule: Omit<LoyaltyRule, "id" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  // upsert by productId
  const snap = await getDocs(query(collection(db, "loyaltyRules"), where("productId", "==", rule.productId)))
  const data = { ...rule, updatedAt: serverTimestamp() }
  if (snap.empty) await addDoc(collection(db, "loyaltyRules"), data)
  else await updateDoc(snap.docs[0].ref, data)
}

export const deleteLoyaltyRule = async (id: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await deleteDoc(doc(db, "loyaltyRules", id))
}

export const getLoyaltyCustomers = async (): Promise<LoyaltyCustomer[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "loyaltyCustomers"), where("storeId", "==", getStoreId()), orderBy("name")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as LoyaltyCustomer)
}

export const getLoyaltyCustomerByQR = async (qrCode: string): Promise<LoyaltyCustomer | null> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "loyaltyCustomers"), where("qrCode", "==", qrCode)))
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as LoyaltyCustomer
}

export const createLoyaltyCustomer = async (name: string, phone?: string): Promise<LoyaltyCustomer> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const qrCode = `loyalty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const data = {
    name,
    phone: phone || "",
    coins: 0,
    totalEarned: 0,
    totalRedeemed: 0,
    qrCode,
    storeId: getStoreId(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, "loyaltyCustomers"), data)
  return { id: ref.id, ...data } as unknown as LoyaltyCustomer
}

export const earnLoyaltyCoins = async (
  customerId: string,
  customerName: string,
  coinsToAdd: number,
  saleItems: LoyaltyTransaction["saleItems"],
  saleTotal: number,
) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const batch = writeBatch(db)
  const custRef = doc(db, "loyaltyCustomers", customerId)
  const custSnap = await getDoc(custRef)
  if (!custSnap.exists()) throw new Error("Customer not found")
  const current = custSnap.data() as LoyaltyCustomer
  batch.update(custRef, {
    coins: current.coins + coinsToAdd,
    totalEarned: current.totalEarned + coinsToAdd,
    updatedAt: serverTimestamp(),
  })
  const txRef = doc(collection(db, "loyaltyTransactions"))
  batch.set(txRef, {
    customerId, customerName, type: "earn", coins: coinsToAdd,
    saleItems, saleTotal, createdAt: serverTimestamp(),
  })
  await batch.commit()
}

export const redeemLoyaltyCoins = async (customerId: string, customerName: string, coinsToRedeem: number) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const batch = writeBatch(db)
  const custRef = doc(db, "loyaltyCustomers", customerId)
  const custSnap = await getDoc(custRef)
  if (!custSnap.exists()) throw new Error("Customer not found")
  const current = custSnap.data() as LoyaltyCustomer
  if (current.coins < coinsToRedeem) throw new Error("Insufficient coins")
  batch.update(custRef, {
    coins: current.coins - coinsToRedeem,
    totalRedeemed: current.totalRedeemed + coinsToRedeem,
    updatedAt: serverTimestamp(),
  })
  const txRef = doc(collection(db, "loyaltyTransactions"))
  batch.set(txRef, {
    customerId, customerName, type: "redeem", coins: coinsToRedeem, createdAt: serverTimestamp(),
  })
  await batch.commit()
}

export const getLoyaltyTransactions = async (customerId?: string): Promise<LoyaltyTransaction[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const q = customerId
    ? query(collection(db, "loyaltyTransactions"), where("customerId", "==", customerId), orderBy("createdAt", "desc"))
    : query(collection(db, "loyaltyTransactions"), orderBy("createdAt", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as LoyaltyTransaction)
}

// System Services
export const clearAllData = async () => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured. Please set your environment variables and refresh the page.")
  const sid = getStoreId()
  if (!sid) throw new Error("Store ID not found.")

  // Helper: delete docs in safe batches of 400
  const deleteDocs = async (refs: { ref: ReturnType<typeof doc> }[]) => {
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db)
      refs.slice(i, i + 400).forEach(d => batch.delete(d.ref))
      await batch.commit()
    }
  }

  // Collections that directly store storeId
  const directCollections = [
    "products",
    "sales",
    "ewalletTransactions",
    "inventoryTransactions",
    "commissionSettings",
    "utang",
    "loyaltyCustomers",
    "loyaltySettings",
    "storeSettings",
  ]

  for (const col of directCollections) {
    const snap = await getDocs(query(collection(db, col), where("storeId", "==", sid)))
    if (!snap.empty) await deleteDocs(snap.docs)
  }

  // utangPayments: no storeId — delete via this store's utang IDs
  const utangSnap = await getDocs(query(collection(db, "utang"), where("storeId", "==", sid)))
  for (const utangDoc of utangSnap.docs) {
    const paySnap = await getDocs(query(collection(db, "utangPayments"), where("utangId", "==", utangDoc.id)))
    if (!paySnap.empty) await deleteDocs(paySnap.docs)
  }

  // loyaltyTransactions: no storeId — delete via this store's customer IDs
  const custSnap = await getDocs(query(collection(db, "loyaltyCustomers"), where("storeId", "==", sid)))
  for (const custDoc of custSnap.docs) {
    const txSnap = await getDocs(query(collection(db, "loyaltyTransactions"), where("customerId", "==", custDoc.id)))
    if (!txSnap.empty) await deleteDocs(txSnap.docs)
  }
}

// ─── Subscription Plan Services ───────────────────────────────────────────────

const DEFAULT_PLANS: Omit<SubscriptionPlan, "id" | "updatedAt">[] = [
  {
    tier: "basic",
    name: "FREE",
    price: 0,
    description: "Perfect for small sari-sari stores",
    isActive: true,
    features: {
      pos: true, inventory: true, ewallet: true, reports: true,
      loyalty: false, utang: false, aiRestock: false, multiUser: false,
      exportData: false, marketIntelligence: false, delivery: false,
    },
  },
  {
    tier: "gold",
    name: "Gold",
    price: 499,
    description: "Full-featured for growing businesses",
    isActive: true,
    features: {
      pos: true, inventory: true, ewallet: true, reports: true,
      loyalty: true, utang: true, aiRestock: true, multiUser: true,
      exportData: true, marketIntelligence: true, delivery: true,
    },
  },
]

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "subscriptionPlans"), orderBy("price")))
  if (snap.empty) {
    // seed defaults
    const batch = writeBatch(db)
    const seeded: SubscriptionPlan[] = []
    for (const plan of DEFAULT_PLANS) {
      const ref = doc(collection(db, "subscriptionPlans"))
      const data = { ...plan, updatedAt: serverTimestamp() }
      batch.set(ref, data)
      seeded.push({ id: ref.id, ...data } as unknown as SubscriptionPlan)
    }
    await batch.commit()
    return seeded
  }

  // Deduplicate plans by tier — keep only the first (lowest-priced) doc per tier
  const plans = snap.docs.map(d => ({ id: d.id, ...d.data() }) as SubscriptionPlan)
  const seen = new Map<string, SubscriptionPlan>()
  const dupeIds: string[] = []
  for (const p of plans) {
    if (!seen.has(p.tier)) {
      seen.set(p.tier, p)
    } else {
      dupeIds.push(p.id!)
    }
  }
  // Clean up duplicates in background
  if (dupeIds.length > 0) {
    Promise.all(dupeIds.map(id => deleteDoc(doc(db, "subscriptionPlans", id)))).catch(console.error)
  }
  return Array.from(seen.values())
}

export const updateSubscriptionPlan = async (id: string, data: Partial<SubscriptionPlan>) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await updateDoc(doc(db, "subscriptionPlans", id), { ...data, updatedAt: serverTimestamp() })

  // Always propagate features to all customers on this plan when features are included
  if (data.features) {
    const custSnap = await getDocs(query(collection(db, "customerSubscriptions"), where("planId", "==", id)))
    console.log(`[updateSubscriptionPlan] Propagating features to ${custSnap.size} customers on plan ${id}`, data.features)
    if (!custSnap.empty) {
      const batch = writeBatch(db)
      custSnap.docs.forEach(d => {
        batch.update(d.ref, { features: data.features, updatedAt: serverTimestamp() })
      })
      await batch.commit()
    }
  }
}

export const addSubscriptionPlan = async (plan: Omit<SubscriptionPlan, "id" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const ref = await addDoc(collection(db, "subscriptionPlans"), { ...plan, updatedAt: serverTimestamp() })
  return ref.id
}

export const deleteSubscriptionPlan = async (id: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await deleteDoc(doc(db, "subscriptionPlans", id))
}

// ─── Customer Subscription Services ──────────────────────────────────────────

export const getCustomerSubscriptions = async (): Promise<CustomerSubscription[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "customerSubscriptions"), orderBy("createdAt", "desc")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as CustomerSubscription)
}

export const addCustomerSubscription = async (sub: Omit<CustomerSubscription, "id" | "createdAt" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const ref = await addDoc(collection(db, "customerSubscriptions"), {
    ...sub, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  return ref.id
}

export const updateCustomerSubscription = async (id: string, data: Partial<CustomerSubscription>) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await updateDoc(doc(db, "customerSubscriptions", id), { ...data, updatedAt: serverTimestamp() })
}

export const deleteCustomerSubscription = async (id: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await deleteDoc(doc(db, "customerSubscriptions", id))
}

// ─── Store User Services ───────────────────────────────────────────────────────

export const getStoreUsers = async (externalId: string): Promise<StoreUser[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "storeUsers"), where("externalId", "==", externalId), orderBy("createdAt", "asc")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as StoreUser)
}

export const addStoreUser = async (user: Omit<StoreUser, "id" | "createdAt" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  // Check username uniqueness within the store
  const existing = await getDocs(query(collection(db, "storeUsers"), where("externalId", "==", user.externalId), where("username", "==", user.username)))
  if (!existing.empty) throw new Error("Username already exists in this store.")
  const ref = await addDoc(collection(db, "storeUsers"), { ...user, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export const updateStoreUser = async (id: string, data: Partial<StoreUser>) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await updateDoc(doc(db, "storeUsers", id), { ...data, updatedAt: serverTimestamp() })
}

export const deleteStoreUser = async (id: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await deleteDoc(doc(db, "storeUsers", id))
}

export const loginStoreUser = async (externalId: string, username: string, pin: string): Promise<StoreUser | null> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(
    collection(db, "storeUsers"),
    where("externalId", "==", externalId),
    where("username", "==", username),
    where("pin", "==", pin),
    where("isActive", "==", true)
  ))
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as StoreUser
}

// ─── Market Intelligence Services ─────────────────────────────────────────────

export const getMarketTopProducts = async (filters: {
  city?: string; region?: string; barangay?: string
  category?: string; businessType?: string
  month?: string; limit?: number
}): Promise<{ productName: string; category: string; totalQty: number; totalRevenue: number; city: string }[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")

  let q = query(collection(db, "marketData"), orderBy("createdAt", "desc"))
  if (filters.month) q = query(collection(db, "marketData"), where("month", "==", filters.month), orderBy("createdAt", "desc"))
  else if (filters.city) q = query(collection(db, "marketData"), where("city", "==", filters.city), orderBy("createdAt", "desc"))

  const snap = await getDocs(q)
  const rows = snap.docs.map(d => d.data() as MarketDataPoint)

  // Apply remaining filters in memory
  const filtered = rows.filter(r => {
    if (filters.city && r.city !== filters.city) return false
    if (filters.region && r.region !== filters.region) return false
    if (filters.barangay && r.barangay !== filters.barangay) return false
    if (filters.category && r.category !== filters.category) return false
    if (filters.businessType && r.businessType !== filters.businessType) return false
    return true
  })

  // Aggregate by product
  const map = new Map<string, { productName: string; category: string; totalQty: number; totalRevenue: number; city: string }>()
  for (const r of filtered) {
    const key = r.productName
    const existing = map.get(key)
    if (existing) {
      existing.totalQty += r.quantity
      existing.totalRevenue += r.revenue
    } else {
      map.set(key, { productName: r.productName, category: r.category, totalQty: r.quantity, totalRevenue: r.revenue, city: r.city })
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, filters.limit ?? 20)
}

export const getMarketHourlySales = async (filters: { city?: string; productName?: string; month?: string }) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")

  const snap = await getDocs(query(collection(db, "marketData"), orderBy("createdAt", "desc")))
  const rows = snap.docs.map(d => d.data() as MarketDataPoint).filter(r => {
    if (filters.city && r.city !== filters.city) return false
    if (filters.productName && r.productName !== filters.productName) return false
    if (filters.month && r.month !== filters.month) return false
    return true
  })

  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, totalQty: 0, totalRevenue: 0 }))
  for (const r of rows) hours[r.hour].totalQty += r.quantity
  return hours
}

export const getMarketCityBreakdown = async (filters: { productName?: string; month?: string; region?: string }) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")

  const snap = await getDocs(query(collection(db, "marketData"), orderBy("createdAt", "desc")))
  const rows = snap.docs.map(d => d.data() as MarketDataPoint).filter(r => {
    if (filters.productName && r.productName !== filters.productName) return false
    if (filters.month && r.month !== filters.month) return false
    if (filters.region && r.region !== filters.region) return false
    return true
  })

  const map = new Map<string, { city: string; region: string; totalQty: number; totalRevenue: number; storeCount: Set<string> }>()
  for (const r of rows) {
    const key = r.city
    const ex = map.get(key)
    if (ex) { ex.totalQty += r.quantity; ex.totalRevenue += r.revenue }
    else map.set(key, { city: r.city, region: r.region, totalQty: r.quantity, totalRevenue: r.revenue, storeCount: new Set() })
  }

  return Array.from(map.values())
    .map(v => ({ city: v.city, region: v.region, totalQty: v.totalQty, totalRevenue: v.totalRevenue }))
    .sort((a, b) => b.totalQty - a.totalQty)
}

export const getMarketDistinctValues = async (field: "city" | "region" | "category" | "businessType" | "productName") => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "marketData"), orderBy(field)))
  const vals = new Set(snap.docs.map(d => d.data()[field] as string).filter(Boolean))
  return Array.from(vals).sort()
}

// ─── Affiliate Services ────────────────────────────────────────────────────────────────

export const AFFILIATE_COMMISSION = 150 // ₱150 per successful referral

export const registerAffiliate = async (data: { name: string; email: string; phone?: string }): Promise<Affiliate> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  // Check if email already registered
  const existing = await getDocs(query(collection(db, "affiliates"), where("email", "==", data.email)))
  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data() } as Affiliate
  }
  const referralCode = `mjd-${Math.random().toString(36).slice(2, 8)}`
  const affiliate: Omit<Affiliate, "id"> = {
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    referralCode,
    walletBalance: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    totalReferrals: 0,
    isActive: true,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  }
  const ref = await addDoc(collection(db, "affiliates"), affiliate)
  return { id: ref.id, ...affiliate }
}

export const getAffiliateByEmail = async (email: string): Promise<Affiliate | null> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "affiliates"), where("email", "==", email)))
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Affiliate
}

export const getAffiliateByCode = async (referralCode: string): Promise<Affiliate | null> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "affiliates"), where("referralCode", "==", referralCode)))
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Affiliate
}

export const getAllAffiliates = async (): Promise<Affiliate[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "affiliates"), orderBy("createdAt", "desc")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Affiliate)
}

export const getAffiliateEarnings = async (affiliateId: string): Promise<AffiliateEarning[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "affiliateEarnings"), where("affiliateId", "==", affiliateId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as AffiliateEarning).sort((a, b) => {
    const aTime = (a.createdAt as any)?.toDate?.()?.getTime?.() ?? 0
    const bTime = (b.createdAt as any)?.toDate?.()?.getTime?.() ?? 0
    return bTime - aTime
  })
}

export const creditAffiliateCommission = async (
  referralCode: string,
  referredEmail: string,
  referredStoreName: string,
  planName: string,
  planPrice: number,
) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const affiliate = await getAffiliateByCode(referralCode)
  if (!affiliate || !affiliate.id) return
  const batch = writeBatch(db)
  // Add earning record
  const earnRef = doc(collection(db, "affiliateEarnings"))
  batch.set(earnRef, {
    affiliateId: affiliate.id,
    referralCode,
    referredEmail,
    referredStoreName,
    planName,
    planPrice,
    commission: AFFILIATE_COMMISSION,
    createdAt: serverTimestamp(),
  })
  // Update affiliate wallet
  const affRef = doc(db, "affiliates", affiliate.id)
  batch.update(affRef, {
    walletBalance: (affiliate.walletBalance || 0) + AFFILIATE_COMMISSION,
    totalEarned: (affiliate.totalEarned || 0) + AFFILIATE_COMMISSION,
    totalReferrals: (affiliate.totalReferrals || 0) + 1,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

export const requestAffiliateWithdrawal = async (
  affiliateId: string,
  affiliateName: string,
  affiliateEmail: string,
  amount: number,
  paymentMethod: string,
  accountNumber: string,
  accountName: string,
): Promise<string> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const affiliate = await getDocs(query(collection(db, "affiliates"), where("email", "==", affiliateEmail)))
  if (affiliate.empty) throw new Error("Affiliate not found")
  const aff = affiliate.docs[0].data() as Affiliate
  if ((aff.walletBalance || 0) < amount) throw new Error("Insufficient wallet balance")
  if (amount < 750) throw new Error("Minimum withdrawal is ₱750")
  // Deduct from wallet immediately (hold)
  await updateDoc(affiliate.docs[0].ref, {
    walletBalance: (aff.walletBalance || 0) - amount,
    updatedAt: serverTimestamp(),
  })
  const ref = await addDoc(collection(db, "affiliateWithdrawals"), {
    affiliateId,
    affiliateName,
    affiliateEmail,
    amount,
    paymentMethod,
    accountNumber,
    accountName,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export const getAllWithdrawals = async (): Promise<AffiliateWithdrawal[]> => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const snap = await getDocs(query(collection(db, "affiliateWithdrawals"), orderBy("createdAt", "desc")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as AffiliateWithdrawal)
}

export const updateWithdrawalStatus = async (
  withdrawalId: string,
  status: "approved" | "rejected",
  notes?: string,
  affiliateId?: string,
  amount?: number,
) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const batch = writeBatch(db)
  const wRef = doc(db, "affiliateWithdrawals", withdrawalId)
  batch.update(wRef, { status, notes: notes || "", updatedAt: serverTimestamp() })
  // If rejected, refund the wallet
  if (status === "rejected" && affiliateId && amount) {
    const affSnap = await getDocs(query(collection(db, "affiliates"), where("__name__", "==", affiliateId)))
    if (!affSnap.empty) {
      const aff = affSnap.docs[0].data() as Affiliate
      batch.update(affSnap.docs[0].ref, {
        walletBalance: (aff.walletBalance || 0) + amount,
        updatedAt: serverTimestamp(),
      })
    } else {
      // fallback: get by id directly
      const affRef = doc(db, "affiliates", affiliateId)
      const affDoc = await getDoc(affRef)
      if (affDoc.exists()) {
        const aff = affDoc.data() as Affiliate
        batch.update(affRef, {
          walletBalance: (aff.walletBalance || 0) + amount,
          updatedAt: serverTimestamp(),
        })
      }
    }
  }
  if (status === "approved" && affiliateId && amount) {
    const affRef = doc(db, "affiliates", affiliateId)
    const affDoc = await getDoc(affRef)
    if (affDoc.exists()) {
      const aff = affDoc.data() as Affiliate
      batch.update(affRef, {
        totalWithdrawn: (aff.totalWithdrawn || 0) + amount,
        updatedAt: serverTimestamp(),
      })
    }
  }
  await batch.commit()
}

// ─── Delivery Services ─────────────────────────────────────────────────────────

export const getDeliverySettings = async (storeId: string): Promise<DeliverySettings | null> => {
  const db = getFirebaseDb()
  if (!db) return null
  const snap = await getDocs(query(collection(db, "deliverySettings"), where("storeId", "==", storeId)))
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as DeliverySettings
}

export const saveDeliverySettings = async (settings: Omit<DeliverySettings, "id" | "createdAt" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const clean = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined))
  const snap = await getDocs(query(collection(db, "deliverySettings"), where("storeId", "==", settings.storeId)))
  if (snap.empty) {
    await addDoc(collection(db, "deliverySettings"), { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  } else {
    await updateDoc(snap.docs[0].ref, { ...clean, updatedAt: serverTimestamp() })
  }
}

export const getAllDeliveryStores = async (): Promise<DeliverySettings[]> => {
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(query(collection(db, "deliverySettings"), where("enabled", "==", true)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as DeliverySettings)
}

export const getDeliveryProducts = async (storeId: string, productIds: string[]): Promise<Product[]> => {
  const db = getFirebaseDb()
  if (!db) return []
  if (productIds.length === 0) return []
  // Firestore "in" queries limited to 30
  const products: Product[] = []
  for (let i = 0; i < productIds.length; i += 30) {
    const batch = productIds.slice(i, i + 30)
    const snap = await getDocs(query(collection(db, "products"), where("storeId", "==", storeId), where("__name__", "in", batch)))
    products.push(...snap.docs.map(d => ({ id: d.id, ...d.data() }) as Product))
  }
  return products
}

export const addDeliveryOrder = async (order: Omit<DeliveryOrder, "id" | "createdAt" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const ref = await addDoc(collection(db, "deliveryOrders"), { ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export const getDeliveryOrders = async (storeId: string): Promise<DeliveryOrder[]> => {
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(query(collection(db, "deliveryOrders"), where("storeId", "==", storeId), orderBy("createdAt", "desc")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as DeliveryOrder)
}

export const updateDeliveryOrderStatus = async (orderId: string, status: DeliveryOrder["status"]) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await updateDoc(doc(db, "deliveryOrders", orderId), { status, updatedAt: serverTimestamp() })
}

// Search products across all delivery-enabled stores
export const searchDeliveryProducts = async (searchTerm: string): Promise<{ product: Product; store: DeliverySettings }[]> => {
  const db = getFirebaseDb()
  if (!db) return []
  const stores = await getAllDeliveryStores()
  if (!stores.length) return []
  const lower = searchTerm.toLowerCase()
  const results: { product: Product; store: DeliverySettings }[] = []
  for (const store of stores) {
    if (!store.enabledProductIds.length) continue
    const prods = await getDeliveryProducts(store.storeId, store.enabledProductIds)
    for (const p of prods) {
      if (p.name.toLowerCase().includes(lower) || p.category.toLowerCase().includes(lower)) {
        results.push({ product: p, store })
      }
    }
  }
  return results
}

// ─── Delivery Banner Services ──────────────────────────────────────────────────

export const getDeliveryBanners = async (): Promise<DeliveryBanner[]> => {
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(query(collection(db, "deliveryBanners"), where("active", "==", true), orderBy("order")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as DeliveryBanner)
}

export const getAllDeliveryBanners = async (): Promise<DeliveryBanner[]> => {
  const db = getFirebaseDb()
  if (!db) return []
  const snap = await getDocs(query(collection(db, "deliveryBanners"), orderBy("order")))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as DeliveryBanner)
}

export const addDeliveryBanner = async (banner: Omit<DeliveryBanner, "id" | "createdAt" | "updatedAt">) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  const ref = await addDoc(collection(db, "deliveryBanners"), { ...banner, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export const updateDeliveryBanner = async (id: string, data: Partial<DeliveryBanner>) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await updateDoc(doc(db, "deliveryBanners", id), { ...data, updatedAt: serverTimestamp() })
}

export const deleteDeliveryBanner = async (id: string) => {
  const db = getFirebaseDb()
  if (!db) throw new Error("Firebase not configured.")
  await deleteDoc(doc(db, "deliveryBanners", id))
}

export const uploadDeliveryImage = async (file: File, folder: string) => {
  const storage = getFirebaseStorage()
  if (!storage) throw new Error("Firebase not configured.")
  const storageRef = ref(storage, `delivery/${folder}/${Date.now()}_${file.name}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}
