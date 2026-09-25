import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listReceptionQueue, checkInAppointment, callReceptionQueueEntry,
} from "@/lib/clinicflow-api";

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });
describe("CF-R01 reception HTTP client", () => {
  it("reads only tenant-scoped operational queue data", async () => {
    sessionStorage.setItem("clinicflow:tenant", "tenant-a");
    const mock=vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => [],
    } as Response);
    vi.stubGlobal("fetch", mock);
    await listReceptionQueue("2026-09-25", "unit-a");
    expect(mock.mock.calls[0][0]).toContain(
      "date=2026-09-25&unitId=unit-a");
    expect(mock.mock.calls[0][1]).toEqual(expect.objectContaining({
      credentials: "same-origin",
      headers: { "X-Clinicflow-Tenant": "tenant-a" },
    }));
  });
  it("mutates arrival and call with session CSRF and optimistic versions", async () => {
    sessionStorage.setItem("clinicflow:tenant", "tenant-a");
    const ok=(data: unknown) => ({
      ok: true, status: 200, json: async () => data,
    }) as Response;
    const mock=vi.fn()
      .mockResolvedValueOnce(ok({ header: "X-XSRF-TOKEN", token: "csrf" }))
      .mockResolvedValueOnce(ok({ id: "queue-a", queueVersion: 0 }))
      .mockResolvedValueOnce(ok({ id: "queue-a", queueVersion: 1 }));
    vi.stubGlobal("fetch", mock);
    await checkInAppointment("appointment-a", 3);
    await callReceptionQueueEntry("queue-a", 0);
    expect(mock.mock.calls[1][0]).toBe("/api/v1/reception/check-ins");
    expect(mock.mock.calls[1][1]).toEqual(expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ appointmentId: "appointment-a", appointmentVersion: 3 }),
      headers: expect.objectContaining({
        "X-Clinicflow-Tenant": "tenant-a", "X-XSRF-TOKEN": "csrf",
      }),
    }));
    expect(mock.mock.calls[2][0]).toBe("/api/v1/reception/queue/queue-a/call");
    expect(mock.mock.calls[2][1]).toEqual(expect.objectContaining({
      method: "POST", body: JSON.stringify({ version: 0 }),
    }));
  });
});
