import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("chat validation", () => {
  it("rejects invalid body for /api/chat/sync", async () => {
    const res = await app.request("/api/chat/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Invalid request body");
  });
});
