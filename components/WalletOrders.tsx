"use client";

import { useEffect, useState } from "react";

type Wallet = { name: string; balance: number };
type Order = {
  id: number;
  status: string;
  total: number;
  pickup_time: string;
  items: string[];
};

const statusStyles: Record<string, string> = {
  placed: "bg-sky-100 text-sky-800",
  preparing: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  collected: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
};

export default function WalletOrders({ refreshKey }: { refreshKey: number }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/me");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load wallet and orders");
        if (active) {
          setWallet(data.wallet);
          setOrders(data.orders);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load wallet and orders");
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  return (
    <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
      <div className="border-b border-white/10 bg-gradient-to-br from-slate-900 to-emerald-950 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Campus wallet</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-bold">{wallet ? `Rs ${wallet.balance}` : "—"}</p>
            <p className="mt-1 text-sm text-slate-300">{wallet?.name ?? "Loading student..."}</p>
          </div>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">SRM</span>
        </div>
      </div>

      <div className="p-5">
        <h2 className="text-base font-semibold">My orders today</h2>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        {!error && orders.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">No orders yet today. Ask the agent to find something tasty.</p>
        )}
        <ul className="mt-3 divide-y divide-white/10">
          {orders.map((order) => (
            <li key={order.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Order #{order.id}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[order.status] ?? "bg-slate-700 text-slate-200"}`}>
                  {order.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Pickup at {order.pickup_time}</p>
              <p className="mt-2 text-sm text-slate-200">{order.items.join(", ")}</p>
              <p className="mt-1 text-right text-sm font-semibold">Rs {order.total}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
