import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function findExistingPath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function ensurePrismaClient(): void {
  const schemaPath = findExistingPath([
    path.resolve(process.cwd(), "apps", "backend", "prisma", "schema.prisma"),
    path.resolve(process.cwd(), "prisma", "schema.prisma"),
  ]);

  if (!schemaPath) {
    throw new Error(
      "schema.prisma not found. Run this from the repo root or apps/backend."
    );
  }

  const prismaDir = path.dirname(schemaPath);
  const backendDir = path.resolve(prismaDir, "..");
  const repoRoot = path.resolve(backendDir, "..", "..");

  const clientDir = findExistingPath([
    path.resolve(process.cwd(), "node_modules", ".prisma", "client"),
    path.resolve(repoRoot, "node_modules", ".prisma", "client"),
    path.resolve(backendDir, "node_modules", ".prisma", "client"),
  ]);

  if (clientDir) {
    return;
  }

  const prismaCli = findExistingPath([
    path.resolve(process.cwd(), "node_modules", "prisma", "build", "index.js"),
    path.resolve(repoRoot, "node_modules", "prisma", "build", "index.js"),
    path.resolve(backendDir, "node_modules", "prisma", "build", "index.js"),
  ]);

  if (!prismaCli) {
    throw new Error(
      "Prisma CLI not found. Run npm install from the repo root or apps/backend."
    );
  }

  execFileSync(process.execPath, [prismaCli, "generate", "--schema", schemaPath], {
    stdio: "inherit",
  });
}

async function main() {
  ensurePrismaClient();

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const userEmail = "jane.doe@example.com";

  try {
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: { name: "Jane Doe" },
      create: { email: userEmail, name: "Jane Doe" },
    });

    await prisma.productFaq.createMany({
      data: [
        {
          question: "How do I reset my password?",
          answer: "Go to Settings > Security and click 'Reset Password'.",
          category: "Account",
        },
        {
          question: "What is your return policy?",
          answer:
            "You can return items within 30 days in original condition. Start a return from your Orders page.",
          category: "Returns",
        },
        {
          question: "Where can I see my invoices?",
          answer: "Open Billing in your dashboard to view all invoices.",
          category: "Billing",
        },
        {
          question: "What is the delivery timeline for standard shipping?",
          answer: "Standard shipping typically takes 3-5 business days.",
          category: "Shipping",
        },
      ],
      skipDuplicates: true,
    });

    await prisma.order.upsert({
      where: { orderNumber: "ORD-1001" },
      update: {
        status: "DELIVERED",
        deliveryDate: new Date("2026-01-15"),
        items: [
          { sku: "SKU-MOUSE-1", name: "Wireless Mouse", qty: 1, price: 29.99 },
          { sku: "SKU-PAD-1", name: "Mouse Pad", qty: 1, price: 9.99 },
        ],
      },
      create: {
        userId: user.id,
        orderNumber: "ORD-1001",
        status: "DELIVERED",
        deliveryDate: new Date("2026-01-15"),
        items: [
          { sku: "SKU-MOUSE-1", name: "Wireless Mouse", qty: 1, price: 29.99 },
          { sku: "SKU-PAD-1", name: "Mouse Pad", qty: 1, price: 9.99 },
        ],
      },
    });

    await prisma.order.upsert({
      where: { orderNumber: "ORD-1002" },
      update: {
        status: "SHIPPED",
        deliveryDate: new Date("2026-02-20"),
        items: [
          {
            sku: "SKU-KB-1",
            name: "Mechanical Keyboard",
            qty: 1,
            price: 89.99,
          },
        ],
      },
      create: {
        userId: user.id,
        orderNumber: "ORD-1002",
        status: "SHIPPED",
        deliveryDate: new Date("2026-02-20"),
        items: [
          {
            sku: "SKU-KB-1",
            name: "Mechanical Keyboard",
            qty: 1,
            price: 89.99,
          },
        ],
      },
    });

    await prisma.order.upsert({
      where: { orderNumber: "ORD-1003" },
      update: {
        status: "PENDING",
        deliveryDate: null,
        items: [
          {
            sku: "SKU-HEAD-1",
            name: "Noise-Canceling Headphones",
            qty: 1,
            price: 199.99,
          },
        ],
      },
      create: {
        userId: user.id,
        orderNumber: "ORD-1003",
        status: "PENDING",
        deliveryDate: null,
        items: [
          {
            sku: "SKU-HEAD-1",
            name: "Noise-Canceling Headphones",
            qty: 1,
            price: 199.99,
          },
        ],
      },
    });

    await prisma.invoice.upsert({
      where: { invoiceNo: "INV-2001" },
      update: {
        amount: "199.99",
        status: "PAID",
        dueDate: new Date("2026-02-01"),
      },
      create: {
        userId: user.id,
        invoiceNo: "INV-2001",
        amount: "199.99",
        status: "PAID",
        dueDate: new Date("2026-02-01"),
      },
    });

    await prisma.invoice.upsert({
      where: { invoiceNo: "INV-2002" },
      update: {
        amount: "49.99",
        status: "REFUNDED",
        dueDate: new Date("2026-02-05"),
      },
      create: {
        userId: user.id,
        invoiceNo: "INV-2002",
        amount: "49.99",
        status: "REFUNDED",
        dueDate: new Date("2026-02-05"),
      },
    });

    await prisma.conversation.create({
      data: {
        userId: user.id,
        messages: {
          create: [
            {
              role: "SYSTEM",
              content: "You are the AI support assistant. Be concise and helpful.",
            },
            {
              role: "USER",
              content: "Where can I find my invoice for the last order?",
            },
            {
              role: "ASSISTANT",
              content:
                "You can find invoices under Billing in your dashboard. I can also email it to you if you'd like.",
            },
            {
              role: "USER",
              content: "Please email it to me.",
            },
          ],
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
