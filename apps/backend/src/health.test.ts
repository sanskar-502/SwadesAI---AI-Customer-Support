import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("health route", () => {
  it("returns ok status and timestamp", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status?: string; timestamp?: string };
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });
});
