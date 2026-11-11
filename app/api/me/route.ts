import { NextResponse } from "next/server";
import { CURRENT_STUDENT_ID, formatSlot } from "@/lib/campusbite";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstRelated<T extends object>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function GET() {
  const supabase = getSupabase();
  const [walletResult, ordersResult] = await Promise.all([
    supabase
      .from("wallets")
      .select("name, balance")
      .eq("student_id", CURRENT_STUDENT_ID)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, status, total, created_at, pickup_slots(slot_time), order_items(menu_items(name))")
      .eq("student_id", CURRENT_STUDENT_ID)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (walletResult.error) {
    console.error("[GET /api/me wallet]", walletResult.error.message);
    return NextResponse.json({ error: walletResult.error.message }, { status: 500 });
  }
  if (!walletResult.data) {
    return NextResponse.json({ error: "Wallet not found for the current student." }, { status: 404 });
  }
  if (ordersResult.error) {
    console.error("[GET /api/me orders]", ordersResult.error.message);
    return NextResponse.json({ error: ordersResult.error.message }, { status: 500 });
  }

  const orders = ordersResult.data.map((order) => {
    const pickupSlot = firstRelated(order.pickup_slots);
    if (!pickupSlot) throw new Error(`Pickup slot missing for order ${order.id}.`);

    return {
      id: order.id,
      status: order.status,
      total: order.total,
      created_at: order.created_at,
      pickup_time: formatSlot(pickupSlot.slot_time),
      items: order.order_items.map((item) => {
        const menuItem = firstRelated(item.menu_items);
        if (!menuItem) throw new Error(`Menu item missing for order ${order.id}.`);
        return menuItem.name;
      }),
    };
  });

  return NextResponse.json({ wallet: walletResult.data, orders });
}
