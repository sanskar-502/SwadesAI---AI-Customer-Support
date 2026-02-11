type AgentInfo = {
  id: string;
  name: string;
  description: string;
  tools: string[];
};

const agents: AgentInfo[] = [
  {
    id: "router",
    name: "Router Agent",
    description:
      "Routes user requests to order, billing, or support tools based on intent.",
    tools: [
      "getOrderDetails",
      "checkDeliveryStatus",
      "getInvoiceDetails",
      "checkRefundStatus",
      "searchProducts",
      "searchConversationHistory",
    ],
  },
  {
    id: "order",
    name: "Order Agent",
    description: "Handles order lookups and delivery status queries.",
    tools: ["getOrderDetails", "checkDeliveryStatus"],
  },
  {
    id: "billing",
    name: "Billing Agent",
    description: "Handles invoice lookups and refund status checks.",
    tools: ["getInvoiceDetails", "checkRefundStatus"],
  },
  {
    id: "support",
    name: "Support Agent",
    description: "Handles FAQs and conversation history searches.",
    tools: ["searchProducts", "searchConversationHistory"],
  },
];

export const agentsService = {
  listAgents: () => agents,
  getAgent: (id: string) => agents.find((agent) => agent.id === id) ?? null,
};

export type { AgentInfo };
