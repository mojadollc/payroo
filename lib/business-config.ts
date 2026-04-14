export type BusinessType =
  | "retail"          // Sari-sari, grocery, convenience
  | "laundry"         // Laundry shop
  | "motorshop"       // Motorcycle parts & repair
  | "salon"           // Salon / barbershop
  | "food"            // Carinderia / food stall / restaurant
  | "pharmacy"        // Drugstore / pharmacy
  | "hardware"        // Hardware store
  | "printing"        // Printing / tarpaulin shop
  | "ecommerce"       // Online shop / e-commerce
  | "bakery"          // Bakery / pastry shop
  | "clothing"        // Clothing / apparel store
  | "school-supplies" // School & office supplies

export interface BusinessConfig {
  type: BusinessType
  label: string
  emoji: string
  description: string
  itemLabel: string          // "Product" | "Service" | "Part" | "Item"
  itemLabelPlural: string
  stockLabel: string         // "Stock" | "Qty" | "Available"
  stockUnit: string          // default unit
  costLabel: string          // "Cost" | "Material Cost"
  priceLabel: string         // "Price" | "Rate" | "Service Fee"
  barcodeRequired: boolean
  trackStock: boolean        // false = services don't deplete stock
  units: string[]
  defaultCategories: string[]
  posPlaceholder: string     // search bar hint text
}

export const BUSINESS_CONFIGS: Record<BusinessType, BusinessConfig> = {
  retail: {
    type: "retail",
    label: "Retail / Sari-Sari Store",
    emoji: "🏪",
    description: "Grocery, convenience, sari-sari store",
    itemLabel: "Product",
    itemLabelPlural: "Products",
    stockLabel: "Stock",
    stockUnit: "pcs",
    costLabel: "Cost Price",
    priceLabel: "Selling Price",
    barcodeRequired: true,
    trackStock: true,
    units: ["pcs", "pack", "box", "dozen", "bottle", "can", "sachet", "pouch", "bag", "roll", "tube", "ml", "L", "g", "kg"],
    defaultCategories: ["Beverages", "Snacks", "Canned Goods", "Grains & Pasta", "Condiments", "Personal Care", "Dairy", "Frozen Goods"],
    posPlaceholder: "Search by name or scan barcode...",
  },
  laundry: {
    type: "laundry",
    label: "Laundry Shop",
    emoji: "👕",
    description: "Laundry, dry cleaning, pressing services",
    itemLabel: "Service",
    itemLabelPlural: "Services",
    stockLabel: "Capacity",
    stockUnit: "kg",
    costLabel: "Operating Cost",
    priceLabel: "Service Rate",
    barcodeRequired: false,
    trackStock: false,
    units: ["kg", "load", "pcs", "pair", "set", "dozen"],
    defaultCategories: ["Wash & Dry", "Wash, Dry & Fold", "Dry Clean", "Press / Iron", "Stain Removal", "Comforter / Blanket", "Curtains", "Add-ons"],
    posPlaceholder: "Search service...",
  },
  motorshop: {
    type: "motorshop",
    label: "Motorshop / Auto Parts",
    emoji: "🔧",
    description: "Motorcycle parts, repair, and accessories",
    itemLabel: "Part / Service",
    itemLabelPlural: "Parts & Services",
    stockLabel: "Stock",
    stockUnit: "pcs",
    costLabel: "Cost Price",
    priceLabel: "Selling Price",
    barcodeRequired: false,
    trackStock: true,
    units: ["pcs", "set", "pair", "box", "liter", "ml", "roll", "meter"],
    defaultCategories: ["Engine Parts", "Electrical", "Brakes", "Tires & Wheels", "Oils & Lubricants", "Body Parts", "Accessories", "Labor / Service"],
    posPlaceholder: "Search part or service...",
  },
  salon: {
    type: "salon",
    label: "Salon / Barbershop",
    emoji: "✂️",
    description: "Hair salon, barbershop, beauty services",
    itemLabel: "Service",
    itemLabelPlural: "Services",
    stockLabel: "Slots",
    stockUnit: "session",
    costLabel: "Material Cost",
    priceLabel: "Service Fee",
    barcodeRequired: false,
    trackStock: false,
    units: ["session", "pcs", "ml", "g", "set"],
    defaultCategories: ["Haircut", "Hair Color", "Hair Treatment", "Rebond / Relax", "Manicure / Pedicure", "Facial", "Waxing", "Products"],
    posPlaceholder: "Search service...",
  },
  food: {
    type: "food",
    label: "Carinderia / Food Stall",
    emoji: "🍽️",
    description: "Restaurant, carinderia, food stall, café",
    itemLabel: "Menu Item",
    itemLabelPlural: "Menu Items",
    stockLabel: "Available",
    stockUnit: "serving",
    costLabel: "Food Cost",
    priceLabel: "Menu Price",
    barcodeRequired: false,
    trackStock: true,
    units: ["serving", "plate", "bowl", "cup", "glass", "order", "pcs", "kg", "g"],
    defaultCategories: ["Rice Meals", "Viand", "Soup", "Merienda", "Drinks", "Dessert", "Breakfast", "Specials"],
    posPlaceholder: "Search menu item...",
  },
  pharmacy: {
    type: "pharmacy",
    label: "Pharmacy / Drugstore",
    emoji: "💊",
    description: "Medicine, vitamins, health products",
    itemLabel: "Medicine",
    itemLabelPlural: "Medicines",
    stockLabel: "Stock",
    stockUnit: "pcs",
    costLabel: "Cost Price",
    priceLabel: "Selling Price",
    barcodeRequired: true,
    trackStock: true,
    units: ["pcs", "tablet", "capsule", "bottle", "sachet", "box", "strip", "vial", "ampule", "ml", "g"],
    defaultCategories: ["Prescription", "OTC Medicines", "Vitamins & Supplements", "First Aid", "Personal Care", "Baby Care", "Medical Devices", "Herbal"],
    posPlaceholder: "Search medicine or scan barcode...",
  },
  hardware: {
    type: "hardware",
    label: "Hardware Store",
    emoji: "🔨",
    description: "Construction materials, tools, supplies",
    itemLabel: "Item",
    itemLabelPlural: "Items",
    stockLabel: "Stock",
    stockUnit: "pcs",
    costLabel: "Cost Price",
    priceLabel: "Selling Price",
    barcodeRequired: false,
    trackStock: true,
    units: ["pcs", "bag", "box", "roll", "meter", "liter", "kg", "set", "pair", "sheet", "length"],
    defaultCategories: ["Cement & Aggregates", "Steel & Metal", "Lumber & Wood", "Electrical", "Plumbing", "Paint", "Tools", "Fasteners", "Roofing"],
    posPlaceholder: "Search item...",
  },
  printing: {
    type: "printing",
    label: "Printing / Tarpaulin Shop",
    emoji: "🖨️",
    description: "Printing, tarpaulin, ID, document services",
    itemLabel: "Service",
    itemLabelPlural: "Services",
    stockLabel: "Capacity",
    stockUnit: "pcs",
    costLabel: "Material Cost",
    priceLabel: "Service Rate",
    barcodeRequired: false,
    trackStock: false,
    units: ["pcs", "sqft", "sqm", "page", "sheet", "set", "copy"],
    defaultCategories: ["Tarpaulin", "ID / Cards", "Document Printing", "Photo Print", "Sticker", "Shirt Printing", "Lamination", "Binding"],
    posPlaceholder: "Search service...",
  },
  ecommerce: {
    type: "ecommerce",
    label: "Online Shop / E-Commerce",
    emoji: "🛒",
    description: "Online store, Shopee, Lazada, TikTok Shop",
    itemLabel: "Product",
    itemLabelPlural: "Products",
    stockLabel: "Stock",
    stockUnit: "pcs",
    costLabel: "Cost Price",
    priceLabel: "Selling Price",
    barcodeRequired: false,
    trackStock: true,
    units: ["pcs", "pack", "set", "box", "pair", "bundle", "roll", "sheet", "kg", "g", "L", "ml"],
    defaultCategories: ["Fashion & Apparel", "Electronics", "Home & Living", "Beauty & Health", "Toys & Hobbies", "Sports & Outdoors", "Food & Grocery", "Books & Stationery", "Automotive", "Others"],
    posPlaceholder: "Search product or SKU...",
  },
  bakery: {
    type: "bakery",
    label: "Bakery / Pastry Shop",
    emoji: "🍞",
    description: "Bread, cakes, pastries, and baked goods",
    itemLabel: "Item",
    itemLabelPlural: "Items",
    stockLabel: "Available",
    stockUnit: "pcs",
    costLabel: "Baking Cost",
    priceLabel: "Selling Price",
    barcodeRequired: false,
    trackStock: true,
    units: ["pcs", "slice", "loaf", "dozen", "box", "tray", "kg", "g"],
    defaultCategories: ["Bread", "Cakes", "Pastries", "Cookies", "Cupcakes", "Donuts", "Drinks", "Seasonal"],
    posPlaceholder: "Search baked goods...",
  },
  clothing: {
    type: "clothing",
    label: "Clothing / Apparel Store",
    emoji: "👗",
    description: "Clothes, shoes, bags, and accessories",
    itemLabel: "Item",
    itemLabelPlural: "Items",
    stockLabel: "Stock",
    stockUnit: "pcs",
    costLabel: "Cost Price",
    priceLabel: "Selling Price",
    barcodeRequired: false,
    trackStock: true,
    units: ["pcs", "pair", "set", "pack", "dozen"],
    defaultCategories: ["Men's Wear", "Women's Wear", "Kids' Wear", "Shoes", "Bags", "Accessories", "Underwear", "Activewear", "Sale Items"],
    posPlaceholder: "Search item or code...",
  },
  "school-supplies": {
    type: "school-supplies",
    label: "School & Office Supplies",
    emoji: "📚",
    description: "Notebooks, pens, art materials, office supplies",
    itemLabel: "Item",
    itemLabelPlural: "Items",
    stockLabel: "Stock",
    stockUnit: "pcs",
    costLabel: "Cost Price",
    priceLabel: "Selling Price",
    barcodeRequired: false,
    trackStock: true,
    units: ["pcs", "pack", "box", "ream", "set", "dozen", "roll", "bottle"],
    defaultCategories: ["Notebooks & Paper", "Pens & Pencils", "Art Materials", "Folders & Binders", "Bags & Cases", "Office Supplies", "Calculators & Tech", "Craft Supplies"],
    posPlaceholder: "Search item...",
  },
}

export const getBusinessConfig = (type?: BusinessType | string): BusinessConfig =>
  BUSINESS_CONFIGS[(type as BusinessType) ?? "retail"] ?? BUSINESS_CONFIGS.retail

export const BUSINESS_TYPE_OPTIONS = Object.values(BUSINESS_CONFIGS).map(c => ({
  value: c.type,
  label: `${c.emoji} ${c.label}`,
  description: c.description,
}))
