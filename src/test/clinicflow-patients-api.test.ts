import { afterEach, describe, expect, it, vi } from "vitest";
import { archivePatient, listPatients } from "@/lib/clinicflow-api";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("patient registry API client", () => {
  it("scopes patient reads to the active tenant", async () => {
    sessionStorage.setItem("clinicflow:tenant", "tenant-a");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({items:[], total:0, page:0, size:50}),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);
    await listPatients("Ana");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/patients?"),
      expect.objectContaining({headers:{"X-Clinicflow-Tenant":"tenant-a"}}),
    );
  });

  it("sends the optimistic version when archiving", async () => {
    sessionStorage.setItem("clinicflow:tenant", "tenant-a");
    const response = (body: unknown) => ({ok:true,status:200,json:async()=>body}) as Response;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({header:"X-XSRF-TOKEN",token:"csrf"}))
      .mockResolvedValueOnce(response({archived:true}));
    vi.stubGlobal("fetch", fetchMock);
    await archivePatient("patient-1", 7);
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({version:7}));
    expect(fetchMock.mock.calls[1][1].headers["X-Clinicflow-Tenant"]).toBe("tenant-a");
  });
});
