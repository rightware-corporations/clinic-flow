import { afterEach, describe, expect, it, vi } from "vitest";
import { listMyPatientArrivals } from "@/lib/clinicflow-api";

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
describe("CF-C01 clinician arrival client",()=>{
  it("requests a tenant-scoped own-arrivals endpoint, not the reception queue",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-a");
    const item={appointmentId:"appointment-1",queueStatus:"WAITING",
      arrivedAt:"2026-09-25T08:59:00+02:00",calledAt:null};
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>[item],
    } as Response);
    vi.stubGlobal("fetch",fetchMock);
    expect(await listMyPatientArrivals("2026-09-25")).toEqual([item]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/practitioner/arrivals?date=2026-09-25",
      expect.objectContaining({credentials:"same-origin",
        headers:{"X-Clinicflow-Tenant":"tenant-a"}}),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
