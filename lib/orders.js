// lib/orders.js
//
// This is our "mock database" — in a real company this would be a call to
// an actual database or order-management API. For this assignment, a plain
// JS object is enough, and it's easy for an evaluator to read and verify.

export const ORDERS = {
  "ORD-101": {
    order_id: "ORD-101",
    customer: "Priya Sharma",
    product: "Vitamin C Serum (30ml)",
    value: "₹699",
    status: "Out for Delivery",
    notes: "BlueDart — BD-982103. Expected by 6 PM today",
    cancellable: false,
  },
  "ORD-102": {
    order_id: "ORD-102",
    customer: "Rahul Verma",
    product: "Hydrating Sunscreen SPF 50",
    value: "₹499",
    status: "Delivered",
    notes: "Delhivery — DL-441029. Delivered 14 days ago",
    cancellable: false,
  },
  "ORD-103": {
    order_id: "ORD-103",
    customer: "Ananya Patel",
    product: "Green Tea Face Wash + Toner",
    value: "₹850",
    status: "Processing",
    notes: "Ordered 3 hours ago. Eligible for cancellation",
    cancellable: true,
  },
};

// This is the ACTUAL function that runs when the AI "calls the tool".
// The AI itself never touches this code directly — it just asks
// (via a structured message) "please run get_order_details with ORD-101",
// and our own JavaScript runs this function and sends the result back.
export function getOrderDetails(orderId) {
  const id = (orderId || "").trim().toUpperCase();
  const order = ORDERS[id];

  if (!order) {
    // Graceful failure — this is what the assignment calls
    // "graceful degradation" instead of hallucinating an answer.
    return {
      found: false,
      message: `No order found with ID ${id}. Please check the order ID and try again.`,
    };
  }

  return { found: true, order };
}

// The "shape" (schema) we describe to the AI so it knows this tool exists,
// what it's called, and what input it needs. This matches Google Gemini's
// functionDeclarations format (an OpenAPI-style schema, no wrapping "type").
export const orderFunctionDeclaration = {
  name: "get_order_details",
  description:
    "Look up an Aura Skincare order by its order ID to get status, product, and delivery details.",
  parameters: {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description: "The order ID, e.g. ORD-101",
      },
    },
    required: ["order_id"],
  },
};
