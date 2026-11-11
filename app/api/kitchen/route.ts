import { NextResponse } from "next/server";
import { z } from "zod";
import { formatSlot } from "@/lib/campusbite";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateOrderStatusSchema = z.object({
  order_id: z.number().int().positive(),
  status: z.enum(["placed", "preparing", "ready", "collected", "cancelled"]),
});

function firstRelated<T extends object>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from("orders")
    .select("id, status, total, created_at, wallets(name), pickup_slots(slot_time), order_items(quantity, menu_items(name))")
    .in("status", ["placed", "preparing", "ready"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/kitchen]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = data.map((order) => {
    const student = firstRelated(order.wallets);
    const pickupSlot = firstRelated(order.pickup_slots);
    if (!student) throw new Error(`Student missing for order ${order.id}.`);
    if (!pickupSlot) throw new Error(`Pickup slot missing for order ${order.id}.`);

    return {
      id: order.id,
      status: order.status,
      total: order.total,
      created_at: order.created_at,
      student_name: student.name,
      pickup_time: formatSlot(pickupSlot.slot_time),
      items: order.order_items.map((item) => {
        const menuItem = firstRelated(item.menu_items);
        if (!menuItem) throw new Error(`Menu item missing for order ${order.id}.`);
        return { name: menuItem.name, quantity: item.quantity };
      }),
    };
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order status update", details: parsed.error.issues }, { status: 400 });
  }

  const { order_id, status } = parsed.data;
  const { data: currentOrder, error: lookupError } = await getSupabase()
    .from("orders")
    .select("status")
    .eq("id", order_id)
    .maybeSingle();

  if (lookupError) {
    console.error("[POST /api/kitchen lookup]", lookupError.message);
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!currentOrder) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const nextStatus: Record<string, string> = {
    placed: "preparing",
    preparing: "ready",
    ready: "collected",
  };
  if (nextStatus[currentOrder.status] !== status) {
    return NextResponse.json({ error: "Order status can only move to the next step." }, { status: 409 });
  }

  const { data, error } = await getSupabase()
    .from("orders")
    .update({ status })
    .eq("id", order_id)
    .eq("status", currentOrder.status)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("[POST /api/kitchen update]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Order status changed before this update could be applied." }, { status: 409 });
  }

  return NextResponse.json({ order: data });
}
