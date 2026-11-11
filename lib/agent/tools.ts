import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import { getSupabase } from "../supabase";
import { CURRENT_STUDENT_ID, formatSlot } from "../campusbite";

function firstRelated<T extends object>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

const getMenu = defineTool({
  name: "getMenu",
  description: "Use this when the user wants to browse available canteen food or filter menu items.",
  schema: z.object({
    category: z.enum(["meal", "snack", "drink", "sweet"]).optional().describe("Menu category to filter by."),
    veg_only: z.boolean().optional().describe("Set to true to return vegetarian items only."),
    max_price: z.number().int().nonnegative().optional().describe("Maximum price in whole rupees."),
  }),
  run: async ({ category, veg_only, max_price }) => {
    let query = getSupabase()
      .from("menu_items")
      .select("id, name, category, price, is_veg, stock, description")
      .gt("stock", 0)
      .order("category")
      .order("price");
    if (category) query = query.eq("category", category);
    if (veg_only) query = query.eq("is_veg", true);
    if (max_price !== undefined) query = query.lte("price", max_price);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { items: data };
  },
});

const getWalletBalance = defineTool({
  name: "getWalletBalance",
  description: "Use this when the user wants to check their canteen wallet balance.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("wallets")
      .select("name, balance")
      .eq("student_id", CURRENT_STUDENT_ID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Wallet not found for the current student.");
    return data;
  },
});

const getPickupSlots = defineTool({
  name: "getPickupSlots",
  description: "Use this when the user wants to see available canteen pickup times.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("pickup_slots")
      .select("id, slot_time, capacity, booked")
      .order("slot_time");
    if (error) throw new Error(error.message);
    return {
      slots: data
        .map((slot) => ({
          slot_id: slot.id,
          time: formatSlot(slot.slot_time),
          free: slot.capacity - slot.booked,
        }))
        .filter((slot) => slot.free > 0),
    };
  },
});

const getMyOrders = defineTool({
  name: "getMyOrders",
  description: "Use this when the user wants to check the status or details of their recent canteen orders.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("orders")
      .select("id, status, total, pickup_slots(slot_time), order_items(menu_items(name))")
      .eq("student_id", CURRENT_STUDENT_ID)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    return {
      orders: data.map((order) => {
        const pickupSlot = firstRelated(order.pickup_slots);
        if (!pickupSlot) throw new Error(`Pickup slot missing for order ${order.id}.`);
        return {
          id: order.id,
          status: order.status,
          total: order.total,
          pickup_time: formatSlot(pickupSlot.slot_time),
          items: order.order_items.map((item) => {
            const menuItem = firstRelated(item.menu_items);
            if (!menuItem) throw new Error(`Menu item missing for order ${order.id}.`);
            return menuItem.name;
          }),
        };
      }),
    };
  },
});

const placeOrder = defineTool({
  name: "placeOrder",
  description: "Use this when the user confirms they want to place a canteen order.",
  writes: true,
  schema: z.object({
    items: z
      .array(
        z.object({
          menu_item_id: z.number().int().positive().describe("The menu item ID."),
          quantity: z.number().int().min(1).max(5).describe("Quantity of this menu item, from 1 to 5."),
        })
      )
      .min(1)
      .describe("At least one menu item and its quantity."),
    slot_id: z.number().int().positive().describe("The selected pickup slot ID."),
  }),
  run: async ({ items, slot_id }) => {
    const { data, error } = await getSupabase().rpc("place_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_slot_id: slot_id,
      p_items: items,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

const cancelOrder = defineTool({
  name: "cancelOrder",
  description: "Use this when the user asks to cancel one of their canteen orders.",
  writes: true,
  schema: z.object({
    order_id: z.number().int().positive().describe("The ID of the order to cancel."),
  }),
  run: async ({ order_id }) => {
    const { data, error } = await getSupabase().rpc("cancel_order", {
      p_student_id: CURRENT_STUDENT_ID,
      p_order_id: order_id,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

export const tools: AgentTool[] = [
  getMenu,
  getWalletBalance,
  getPickupSlots,
  getMyOrders,
  placeOrder,
  cancelOrder,
];
