import {afterEach, describe, expect, it, vi} from "vitest";
import {listProfessionals, listEligibleProfessionals} from "@/lib/clinicflow-api";

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
describe("admin professional catalog API",()=>{
  it("uses active clinic tenant for profile and eligible member requests",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-a");
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>[],
    } as Response);
    vi.stubGlobal("fetch",fetchMock);
    await listProfessionals();
    await listEligibleProfessionals();
    expect(fetchMock.mock.calls.map(args=>args[0])).toEqual([
      "/api/v1/practitioners","/api/v1/practitioners/eligible-members",
    ]);
    expect(fetchMock.mock.calls.every(args=>
      args[1].headers["X-Clinicflow-Tenant"]==="tenant-a")).toBe(true);
  });
});
