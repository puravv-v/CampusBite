"use client";

import { useCallback, useEffect, useState } from "react";

type KitchenOrder = {
  id: number;
  status: "placed" | "preparing" | "ready";
  total: number;
  student_name: string;
  pickup_time: string;
  items: { name: string; quantity: number }[];
};

const columns: {
  status: KitchenOrder["status"];
  title: string;
  buttonLabel: string;
  nextStatus: "preparing" | "ready" | "collected";
  accent: string;
}[] = [
  { status: "placed", title: "New orders", buttonLabel: "Start preparing", nextStatus: "preparing", accent: "bg-sky-400" },
  { status: "preparing", title: "Preparing", buttonLabel: "Mark ready", nextStatus: "ready", accent: "bg-amber-400" },
  { status: "ready", title: "Ready for pickup", buttonLabel: "Collected", nextStatus: "collected", accent: "bg-emerald-400" },
];

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/kitchen", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load kitchen orders");
      setOrders(data.orders);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load kitchen orders");
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const interval = window.setInterval(() => void loadOrders(), 3000);
    return () => window.clearInterval(interval);
  }, [loadOrders]);

  async function advanceOrder(orderId: number, status: "preparing" | "ready" | "collected") {
    setUpdating(orderId);
    setError("");
    try {
      const response = await fetch("/api/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update order");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8 md:py-8">
      <header className="mx-auto mb-8 flex max-w-[1600px] items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">CampusBite · SRM</p>
          <h1 className="mt-1 text-2xl font-bold md:text-3xl">Kitchen board</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm font-medium text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Live
        </div>
      </header>

      {error && (
        <div role="alert" className="mx-auto mb-5 max-w-[1600px] rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-3">
        {columns.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.status);
          return (
            <section key={column.status} className="min-h-64 rounded-2xl border border-white/10 bg-white/[0.03]">
              <header className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <h2 className="font-semibold">{column.title}</h2>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">{columnOrders.length}</span>
              </header>
              <div className="space-y-3 p-3">
                {columnOrders.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">No orders here</p>
                )}
                {columnOrders.map((order) => (
                  <article key={order.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
                    <div className={`h-1 ${column.accent}`} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">Order #{order.id}</h3>
                          <p className="mt-1 text-sm text-slate-400">{order.student_name}</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1.5 text-sm font-medium text-slate-200">
                          {order.pickup_time}
                        </span>
                      </div>
                      <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-sm text-slate-300">
                        {order.items.map((item, index) => (
                          <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                            <span>{item.name}</span>
                            <span className="shrink-0 text-slate-500">× {item.quantity}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                        <span className="text-sm font-semibold">Rs {order.total}</span>
                        <button
                          type="button"
                          disabled={updating === order.id}
                          onClick={() => void advanceOrder(order.id, column.nextStatus)}
                          className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
                        >
                          {updating === order.id ? "Updating..." : column.buttonLabel}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
