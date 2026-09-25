import {afterEach,describe,expect,it,vi} from "vitest";
import {
  acknowledgeNursingCorrection,createNursingCorrection,
  getOwnNursingHistoryDetail,listOwnNursingCorrections,
  listOwnNursingHistory,listPractitionerNursingCorrections,refreshCsrf,
} from "@/lib/clinicflow-api";

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
const ok=(body:unknown)=>({ok:true,status:200,json:async()=>body}) as Response;

describe("CF-N03 nursing continuity transport",()=>{
  it("isolates history and correction reads by tenant and role endpoint",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-n03");
    const fetchMock=vi.fn().mockResolvedValue(ok({items:[],total:0,page:0,size:20}));
    vi.stubGlobal("fetch",fetchMock);
    await listOwnNursingHistory(2);
    await getOwnNursingHistoryDetail("appt-01");
    await listOwnNursingCorrections("appt-01",1);
    await listPractitionerNursingCorrections("appt-01",3);
    expect(fetchMock.mock.calls.map(c=>c[0])).toEqual([
      "/api/v1/nursing/observations/history?page=2",
      "/api/v1/nursing/observations/history/appt-01",
      "/api/v1/nursing/observations/appt-01/addenda?page=1",
      "/api/v1/practitioner/nursing-observations/appt-01/addenda?page=3",
    ]);
    for(const [,config] of fetchMock.mock.calls){
      expect(config).toEqual(expect.objectContaining({
        credentials:"same-origin",
        headers:{"X-Clinicflow-Tenant":"tenant-n03"},
      }));
    }
  });

  it("uses explicit correction idempotency key and independent CSRF-protected receipt",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-n03");
    const fetchMock=vi.fn().mockImplementation(async(path:string)=>
      path==="/api/v1/auth/csrf"
        ?ok({header:"X-XSRF-TOKEN",token:"csrf-n03"})
        :ok({id:"correction-1"}));
    vi.stubGlobal("fetch",fetchMock);
    await refreshCsrf();
    await createNursingCorrection("appt-01","  Correcção sintética  ","key-01");
    await acknowledgeNursingCorrection("appt-01","correction-1");
    const requests=fetchMock.mock.calls.slice(1);
    expect(requests[0][0]).toBe("/api/v1/nursing/observations/appt-01/addenda");
    expect(requests[0][1]).toEqual(expect.objectContaining({
      method:"POST",body:JSON.stringify({content:"Correcção sintética"}),
      headers:expect.objectContaining({
        "X-Clinicflow-Tenant":"tenant-n03",
        "Idempotency-Key":"key-01",
        "X-XSRF-TOKEN":"csrf-n03",
      }),
    }));
    expect(requests[1][0]).toBe(
      "/api/v1/practitioner/nursing-observations/appt-01/addenda/correction-1/acknowledge");
    expect(requests[1][1]).toEqual(expect.objectContaining({
      method:"POST",
      headers:expect.objectContaining({
        "X-Clinicflow-Tenant":"tenant-n03",
        "X-XSRF-TOKEN":"csrf-n03",
      }),
    }));
  });
});
