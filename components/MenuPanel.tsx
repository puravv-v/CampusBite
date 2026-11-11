"use client";

import { useEffect, useState } from "react";

type MenuItem = {
  id: number;
  name: string;
  category: "meal" | "snack" | "sweet" | "drink";
  price: number;
  is_veg: boolean;
  stock: number;
};

const categories: { key: MenuItem["category"]; label: string }[] = [
  { key: "meal", label: "Meals" },
  { key: "snack", label: "Snacks" },
  { key: "sweet", label: "Sweets" },
  { key: "drink", label: "Drinks" },
];

export default function MenuPanel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/menu");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load menu");
        if (active) {
          setItems(data.items);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load menu");
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">Today&apos;s menu</h2>
          <p className="mt-0.5 text-xs text-slate-500">Fresh from the canteen kitchen</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Live menu</span>
      </div>
      {error ? (
        <p className="p-5 text-sm text-red-600">{error}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {categories.map(({ key, label }) => {
            const group = items.filter((item) => item.category === key);
            return (
              <div key={key} className="px-5 py-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</h3>
                {group.length === 0 ? (
                  <p className="py-1 text-sm text-slate-400">No items listed</p>
                ) : (
                  <ul className="space-y-2">
                    {group.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
                        <span
                          aria-label={item.is_veg ? "Vegetarian" : "Non-vegetarian"}
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.is_veg ? "bg-emerald-500" : "bg-red-500"}`}
                        />
                        <span className="min-w-0 flex-1 text-slate-800">{item.name}</span>
                        {item.stock === 0 ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">Sold out</span>
                        ) : item.stock <= 3 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            Only {item.stock} left
                          </span>
                        ) : null}
                        <span className="w-14 shrink-0 text-right font-semibold text-slate-900">Rs {item.price}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
