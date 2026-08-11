"use client"

import { useState, useEffect } from "react"
import { Package, Phone, MapPin, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getStoreId } from "@/lib/store-id"
import { getStoreId } from "@/lib/store-id"
import type { DeliveryOrder } from "@/lib/firebase/types"

const STATUS_FLOW: DeliveryOrder["status"][] = ["pending", "confirmed", "preparing", "delivering", "delivered"]
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-purple-100 text-purple-700",
  delivering: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
}

export function DeliveryOrdersList() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    fetch(`/api/delivery/orders?storeId=${getStoreId()}`)
      .then(r => r.json())
      .then(({ data: o }) => { setOrders(o ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const nextStatus = (current: DeliveryOrder["status"]): DeliveryOrder["status"] | null => {
    const idx = STATUS_FLOW.indexOf(current)
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
  }

  const handleUpdate = async (orderId: string, status: DeliveryOrder["status"]) => {
    await fetch("/api/delivery/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status }),
    })
    load()
  }

  if (loading) return <p className="text-center text-muted-foreground py-8">Loading orders...</p>
  if (orders.length === 0) return <p className="text-center text-muted-foreground py-8">No delivery orders yet</p>

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const next = nextStatus(order.status)
        const date = (order.createdAt as any)?.toDate?.()
        return (
          <Card key={order.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{order.customerName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {order.customerPhone}</span>
                    {date && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {date.toLocaleString("en-PH")}</span>}
                  </div>
                </div>
                <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
              </div>
              <p className="text-xs flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /> {order.customerAddress}</p>
              {order.notes && <p className="text-xs italic text-muted-foreground">Note: {order.notes}</p>}
              <div className="border-t pt-2 space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.quantity}× {item.productName}</span>
                    <span>₱{item.subtotal}</span>
                  </div>
                ))}
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Delivery fee</span><span>₱{order.deliveryFee}</span></div>
                )}
                <div className="flex justify-between font-bold text-sm border-t pt-1"><span>Total</span><span>₱{order.total}</span></div>
              </div>
              {order.status !== "delivered" && order.status !== "cancelled" && (
                <div className="flex gap-2">
                  {next && <Button size="sm" onClick={() => handleUpdate(order.id!, next)} className="flex-1">Mark as {next}</Button>}
                  <Button size="sm" variant="destructive" onClick={() => handleUpdate(order.id!, "cancelled")}>Cancel</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
