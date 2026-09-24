import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listClinicalReports,listEligibleClinicalEncounters,createClinicalAddendum,
} from "@/lib/clinicflow-api";

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});

describe("clinical report API transport",()=>{
  it("scopes private list and eligible encounters to the selected tenant",async()=>{
    sessionStorage.setItem("clinicflow:tenant","clinic-1");
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({items:[],total:0,page:0,size:30}),
    } as Response);
    vi.stubGlobal("fetch",fetchMock);
    await listClinicalReports(2);
    await listEligibleClinicalEncounters();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/clinical-reports?page=2");
    expect(fetchMock.mock.calls[1][0])
      .toBe("/api/v1/clinical-reports/eligible-appointments");
    for(const call of fetchMock.mock.calls){
      expect(call[1]).toEqual(expect.objectContaining({
        headers:{"X-Clinicflow-Tenant":"clinic-1"},
      }));
    }
  });
  it("sends an explicit idempotency key for permanent addenda",async()=>{
    sessionStorage.setItem("clinicflow:tenant","clinic-1");
    const response=(body:unknown)=>({ok:true,status:200,json:async()=>body}) as Response;
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(response({header:"X-XSRF-TOKEN",token:"csrf-token"}))
      .mockResolvedValueOnce(response({id:"addendum-id"}));
    vi.stubGlobal("fetch",fetchMock);
    await createClinicalAddendum(
      "report-id","  Correcção permanente  ","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const request=fetchMock.mock.calls[1][1];
    expect(request.headers).toEqual(expect.objectContaining({
      "X-Clinicflow-Tenant":"clinic-1","X-XSRF-TOKEN":"csrf-token",
      "Idempotency-Key":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }));
    expect(request.body).toBe(JSON.stringify({content:"Correcção permanente"}));
  });
});
