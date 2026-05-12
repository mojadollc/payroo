"use client"

import { FeatureGate } from "@/components/feature-gate"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DeliverySettingsPanel } from "@/components/delivery/delivery-settings"
import { DeliveryOrdersList } from "@/components/delivery/delivery-orders"
import { Truck, ClipboardList } from "lucide-react"
import { MobileAppShell } from "@/components/mobile-app-shell"

function DeliveryManagePageContent() {
  return (
    <MobileAppShell
      title="Delivery"
      subtitle="Manage orders & settings"
    >
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        <Tabs defaultValue="orders" className="w-full">
          <div className="px-1">
            <TabsList className="w-full grid grid-cols-2 bg-muted">
              <TabsTrigger value="orders" className="gap-1.5"><ClipboardList className="h-4 w-4" /> Orders</TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5"><Truck className="h-4 w-4" /> Settings</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="orders" className="mt-0">
            <div className="p-1">
              <DeliveryOrdersList />
            </div>
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <div className="p-1">
              <DeliverySettingsPanel />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop View */}
      <div className="hidden md:block container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Delivery
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your online delivery store and orders</p>
        </div>
        <Tabs defaultValue="orders">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders" className="gap-1.5"><ClipboardList className="h-4 w-4" /> Orders</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Truck className="h-4 w-4" /> Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-4">
            <DeliveryOrdersList />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <DeliverySettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </MobileAppShell>
  )
}

export default function DeliveryManagePage() {
  return (
    <FeatureGate feature="delivery">
      <DeliveryManagePageContent />
    </FeatureGate>
  )
}
