import { afterEach,describe,expect,it,vi } from "vitest";
import { listMyNursingUnits,listNursingArrivals,listNursingTeam,setNursingUnits }
  from "@/lib/clinicflow-api";

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
const ok=(data:unknown)=>({ok:true,status:200,json:async()=>data}) as Response;
describe("CF-N01 tenant-scoped nursing transport",()=>{
  it("separates nurse operational API from administrative team API",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-a");
    const fetchMock=vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal("fetch",fetchMock);
    await listMyNursingUnits();
    await listNursingArrivals("2026-09-25");
    await listNursingTeam();
    const expected=[
      "/api/v1/nursing/units",
      "/api/v1/nursing/arrivals?date=2026-09-25",
      "/api/v1/admin/nursing-team",
    ];
    expect(fetchMock.mock.calls.map(c=>c[0])).toEqual(expected);
    for(const [,opts] of fetchMock.mock.calls){
      expect(opts).toEqual(expect.objectContaining({
        credentials:"same-origin",
        headers:{"X-Clinicflow-Tenant":"tenant-a"},
      }));
    }
  });
  it("posts explicit unit IDs and current assignment version with CSRF",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-b");
    const fetchMock=vi.fn().mockImplementation(async(path:string)=>
      path==="/api/v1/auth/csrf"
        ?ok({header:"X-XSRF-TOKEN",token:"csrf-test"}):ok({version:6,units:[]}));
    vi.stubGlobal("fetch",fetchMock);
    await setNursingUnits("nurse-a",5,["unit-1"]);
    const put=fetchMock.mock.calls.find(c=>
      c[0]==="/api/v1/admin/nursing-team/nurse-a/units");
    expect(put).toBeDefined();
    expect(put![1]).toEqual(expect.objectContaining({
      method:"PUT",body:JSON.stringify({version:5,unitIds:["unit-1"]}),
      headers:expect.objectContaining({
        "X-Clinicflow-Tenant":"tenant-b",
        "Content-Type":"application/json",
      }),
    }));
    expect(typeof put![1].headers["X-XSRF-TOKEN"]).toBe("string");
  });
});
