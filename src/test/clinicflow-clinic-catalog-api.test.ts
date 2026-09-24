import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createClinicUnit, createClinicService, setClinicServiceActive,
} from "@/lib/clinicflow-api";

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
const respond=(body:unknown)=>({
  ok:true,status:200,json:async()=>body,
}) as Response;

describe("clinic catalog API",()=>{
  it("creates a unit with verified tenant header and CSRF",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-a");
    const fetchMock=vi.fn().mockImplementation(async(path:string)=>path==="/api/v1/auth/csrf"
      ?respond({header:"X-XSRF-TOKEN",token:"csrf"})
      :respond({id:"unit-1",name:"Central",address:null,active:true}));
    vi.stubGlobal("fetch",fetchMock);
    await createClinicUnit({name:"Central",address:null});
    const post=fetchMock.mock.calls.find(call=>call[0]==="/api/v1/clinic-units")!;
    expect(post[1]).toEqual(expect.objectContaining({
      method:"POST",body:JSON.stringify({name:"Central",address:null}),
      headers:expect.objectContaining({
        "X-Clinicflow-Tenant":"tenant-a","Content-Type":"application/json",
      }),
    }));
    expect(typeof post[1].headers["X-XSRF-TOKEN"]).toBe("string");
  });

  it("never sends currency without a price and scopes deactivation",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-b");
    const fetchMock=vi.fn().mockImplementation(async(path:string)=>path==="/api/v1/auth/csrf"
      ?respond({header:"X-XSRF-TOKEN",token:"csrf"})
      :respond({id:"service-1",active:false}));
    vi.stubGlobal("fetch",fetchMock);
    await createClinicService({
      name:"Consultation",slug:"consultation",durationMinutes:30,
      price:null,currencyCode:null,
    });
    await setClinicServiceActive("service-1",false);
    const sent=fetchMock.mock.calls.filter(call=>call[0].startsWith("/api/v1/services"));
    expect(sent[0][1].body).toBe(JSON.stringify({
      name:"Consultation",slug:"consultation",durationMinutes:30,
      price:null,currencyCode:null,
    }));
    expect(sent[1][0]).toBe("/api/v1/services/service-1/deactivate");
    expect(sent[1][1].headers["X-Clinicflow-Tenant"]).toBe("tenant-b");
  });
});
