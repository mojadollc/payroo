import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import "./globals.css"
import { LayoutShell } from "@/components/layout-shell"
import { VisitorTracker } from "@/components/visitor-tracker"
import { PWAUpdateManager } from "@/components/pwa-update-manager"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL("https://payroo.xyz"),
  title: {
    default: "Payroo POS - #1 POS System for Filipino Stores | Inventory, E-Wallet, Loyalty",
    template: "%s | Payroo POS",
  },
  description: "Best POS system for sari-sari stores, salons, carinderia, motorshops & Filipino SMEs. Inventory management, barcode scanning, GCash/Maya e-wallet, loyalty program, AI restock, utang tracking, sales reports. Works offline. Free trial!",
  keywords: [
    "POS system Philippines", "point of sale Philippines", "sari-sari store POS",
    "inventory management system", "inventory system Philippines",
    "barcode scanner POS", "barcode inventory system",
    "GCash POS", "Maya POS", "e-wallet cash in", "e-wallet cash out",
    "salon POS system", "carinderia POS", "restaurant POS Philippines",
    "motorshop POS", "pharmacy POS", "retail POS system",
    "small business POS", "SME POS Philippines", "affordable POS",
    "loyalty program system", "customer loyalty Philippines",
    "sales report system", "profit tracker", "business analytics",
    "utang tracker", "credit tracking system",
    "AI restock", "smart inventory", "stock management",
    "offline POS", "PWA POS", "mobile POS",
    "payroll system Philippines", "employee management",
    "multi-user POS", "cashier management system",
    "Payroo", "Payroo POS", "Filipino business software",
    "tindahan POS", "negosyo POS", "paninda system",
  ],
  generator: "Next.js",
  applicationName: "Payroo POS",
  authors: [{ name: "MOJADOO", url: "https://payroo.xyz" }],
  creator: "MOJADOO",
  publisher: "MOJADOO",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Payroo POS",
  },
  category: "business",
  classification: "Point of Sale System",
  openGraph: {
    title: "Payroo POS - Best POS & Inventory System for Filipino Stores",
    description: "Complete POS solution: inventory management, barcode scanning, GCash/Maya e-wallet, loyalty program, AI restock, sales reports. Built for sari-sari stores, salons, carinderia & more. Works offline!",
    type: "website",
    url: "https://payroo.xyz",
    siteName: "Payroo POS",
    locale: "en_PH",
    images: [
      {
        url: "https://payroo.xyz/og-image.png",
        width: 1200,
        height: 630,
        alt: "Payroo POS - #1 POS & Inventory System for Filipino Stores",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Payroo POS - #1 POS System for Filipino Stores",
    description: "Affordable POS with inventory, barcode scanning, GCash/Maya, loyalty program & offline support. Built for Filipino SMEs.",
    images: ["https://payroo.xyz/og-image.png"],
  },
  alternates: {
    canonical: "https://payroo.xyz",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {},
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#EFBF04",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#EFBF04" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
      </head>
      <body className="font-sans antialiased">
        <Script id="json-ld" type="application/ld+json" strategy="beforeInteractive">{`
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                "name": "Payroo POS",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web, Android, iOS",
                "url": "https://payroo.xyz",
                "description": "Complete POS and inventory management system for Filipino stores. Features barcode scanning, GCash/Maya e-wallet integration, loyalty program, AI restock engine, sales reports, and offline support.",
                "offers": {
                  "@type": "AggregateOffer",
                  "lowPrice": "299",
                  "highPrice": "899",
                  "priceCurrency": "PHP",
                  "offerCount": "2"
                },
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": "4.8",
                  "ratingCount": "150",
                  "bestRating": "5"
                },
                "featureList": "Point of Sale, Inventory Management, Barcode Scanning, GCash Integration, Maya Integration, E-Wallet Cash In, E-Wallet Cash Out, Loyalty Program, AI Restock, Sales Reports, Profit Analytics, Utang/Credit Tracking, Multi-User Access, Offline Support, PWA Mobile App",
                "screenshot": "https://payroo.xyz/icon-512.png",
                "softwareVersion": "2.0",
                "author": {
                  "@type": "Organization",
                  "name": "MOJADOO",
                  "url": "https://payroo.xyz"
                }
              },
              {
                "@type": "Organization",
                "name": "Payroo POS",
                "url": "https://payroo.xyz",
                "logo": "https://payroo.xyz/icon-512.png",
                "description": "POS and inventory management system built for Filipino SMEs — sari-sari stores, salons, carinderia, motorshops, pharmacies, and more.",
                "areaServed": {
                  "@type": "Country",
                  "name": "Philippines"
                },
                "sameAs": []
              },
              {
                "@type": "WebSite",
                "name": "Payroo POS",
                "url": "https://payroo.xyz",
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": "https://payroo.xyz/?q={search_term_string}",
                  "query-input": "required name=search_term_string"
                }
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "What is the best POS system for sari-sari stores in the Philippines?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Payroo POS is the best POS system for sari-sari stores. It includes inventory management, barcode scanning, GCash/Maya e-wallet integration, loyalty program, and works offline. Plans start at ₱299/month."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Does Payroo POS work offline?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes! Payroo POS works offline as a PWA (Progressive Web App). Your data syncs automatically when you reconnect to the internet."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Can I use GCash and Maya with Payroo POS?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes! Payroo POS has built-in GCash and Maya e-wallet integration for cash-in and cash-out transactions. You can also accept payments via bank transfer and over-the-counter channels."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "How much does a POS system cost in the Philippines?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Payroo POS starts at ₱299/month for the Basic plan with POS and inventory. The Gold plan at ₱899/month includes all features: e-wallet, loyalty, AI restock, reports, and multi-user access."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "What types of businesses can use Payroo POS?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Payroo POS works for sari-sari stores, salons, carinderia, motorshops, pharmacies, water refilling stations, laundry shops, e-commerce stores, and any Filipino SME that needs point-of-sale and inventory management."
                    }
                  }
                ]
              }
            ]
          }
        `}</Script>
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(function(reg) {
              reg.addEventListener('updatefound', function() {
                var newSW = reg.installing;
                if (!newSW) return;
                newSW.addEventListener('statechange', function() {
                  if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                    newSW.postMessage({ type: 'SKIP_WAITING' });
                  }
                });
              });

              setInterval(function() { reg.update().catch(function(){}); }, 60000);
              document.addEventListener('visibilitychange', function() {
                if (document.visibilityState === 'visible') reg.update().catch(function(){});
              });
            });

            var swReloaded = false;
            navigator.serviceWorker.addEventListener('controllerchange', function() {
              if (swReloaded) return;
              var lastReload = sessionStorage.getItem('sw_reload_ts');
              if (lastReload && (Date.now() - Number(lastReload)) < 10000) return;
              swReloaded = true;
              sessionStorage.setItem('sw_reload_ts', String(Date.now()));
              window.location.reload();
            });
          }
        `}</Script>
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '3067939633389947');
          fbq('track', 'PageView');
        `}</Script>
        <LayoutShell>{children}</LayoutShell>
        <PWAUpdateManager />
        <VisitorTracker />
        <Analytics />
      </body>
    </html>
  )
}
