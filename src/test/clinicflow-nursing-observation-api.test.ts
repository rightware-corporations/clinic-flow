import { afterEach,describe,expect,it,vi } from "vitest";
import {
  acknowledgeNursingObservation, createNursingObservation,
  getNursingObservation, getPractitionerNursingObservation,
  submitNursingObservation, updateNursingObservation,
} from "@/lib/clinicflow-api";

afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
const ok=(data:unknown)=>({ok:true,status:200,json:async()=>data}) as Response;

describe("CF-N02 observation transport",()=>{
  it("keeps nurse and practitioner endpoints separate and tenant scoped",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-n02");
    const fetchMock=vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal("fetch",fetchMock);
    await getNursingObservation("appt-1");
    await getPractitionerNursingObservation("appt-1");
    expect(fetchMock.mock.calls.map(c=>c[0])).toEqual([
      "/api/v1/nursing/observations/appt-1",
      "/api/v1/practitioner/nursing-observations/appt-1",
    ]);
    for(const [,opts] of fetchMock.mock.calls){
      expect(opts).toEqual(expect.objectContaining({
        credentials:"same-origin",
        headers:{"X-Clinicflow-Tenant":"tenant-n02"},
      }));
    }
  });

  it("sends versioned nurse mutations and practitioner acknowledgement with CSRF",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-n02");
    const fetchMock=vi.fn().mockImplementation(async(path:string)=>
      path==="/api/v1/auth/csrf"
        ?ok({header:"X-XSRF-TOKEN",token:"csrf-n02"})
        :ok({id:"note-1"}));
    vi.stubGlobal("fetch",fetchMock);
    const input={
      presentingConcern:"Synthetic",
      observationNotes:"",
      measurements:{
        temperatureC:null,heartRate:null,respiratoryRate:null,
        spo2Percent:null,systolicMmhg:null,diastolicMmhg:null,
      },
      measuredAt:null,
    };
    await createNursingObservation("appt-1",input);
    await updateNursingObservation("appt-1",4,input);
    await submitNursingObservation("appt-1",5);
    await acknowledgeNursingObservation("appt-1");

    const mutations=fetchMock.mock.calls.filter(c=>c[0]!=="/api/v1/auth/csrf");
    expect(mutations[0][0]).toBe("/api/v1/nursing/observations");
    expect(JSON.parse(mutations[0][1].body)).toEqual({appointmentId:"appt-1",...input});
    expect(mutations[1][1]).toEqual(expect.objectContaining({
      method:"PUT",body:JSON.stringify({version:4,...input}),
    }));
    expect(mutations[2][1]).toEqual(expect.objectContaining({
      method:"POST",body:JSON.stringify({version:5}),
    }));
    expect(mutations[3][0]).toBe(
      "/api/v1/practitioner/nursing-observations/appt-1/acknowledge");
    for(const [,opts] of mutations){
      expect(opts.headers).toEqual(expect.objectContaining({
        "X-Clinicflow-Tenant":"tenant-n02",
        "Content-Type":"application/json",
        "X-XSRF-TOKEN":"csrf-n02",
      }));
    }
  });
});
