import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppointment, listAppointments, getSlotPreview } from "@/lib/clinicflow-api";

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
describe("Internal booking client",()=>{
  it("submits tenant, CSRF and stable idempotency key",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-a");
    const ok=(body:unknown)=>({ok:true,status:200,json:async()=>body}) as Response;
    const record={id:"appt-1",status:"REQUESTED",version:0};
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(ok({header:"X-XSRF-TOKEN",token:"token"}))
      .mockResolvedValueOnce(ok(record));
    vi.stubGlobal("fetch",fetchMock);
    const draft={patientId:"patient",practitionerUserId:"doctor",
      unitId:"unit",serviceId:"service",startsAt:"2026-10-01T09:00:00"};
    expect(await createAppointment(draft,"11111111-1111-4111-8111-111111111111"))
      .toEqual(record);
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({
      method:"POST",body:JSON.stringify(draft),
      headers:expect.objectContaining({
        "X-Clinicflow-Tenant":"tenant-a",
        "Idempotency-Key":"11111111-1111-4111-8111-111111111111",
        "X-XSRF-TOKEN":"token",
      }),
    }));
  });
  it("queries tenant-scoped calendar and slot preview",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-a");
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>[],
    } as Response);
    vi.stubGlobal("fetch",fetchMock);
    await listAppointments("2026-10-01","2026-10-07");
    await getSlotPreview("doctor","service","2026-10-01");
    expect(fetchMock.mock.calls[0][0]).toContain("from=2026-10-01");
    expect(fetchMock.mock.calls[1][0]).toContain("practitionerUserId=doctor");
    expect(fetchMock.mock.calls[1][1].headers["X-Clinicflow-Tenant"])
      .toBe("tenant-a");
  });
});
