import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptInvitation, inspectInvitation, listInvitations,
} from "@/lib/clinicflow-api";

afterEach(()=>{
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("secure invitation transport",()=>{
  it("keeps the raw invitation token out of API URLs",async()=>{
    const token="raw-secret-invitation-token-1234567890";
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>({
        displayName:"Synthetic User",email:"synthetic@example.invalid",
        role:"PRACTITIONER",clinicName:"Clinic",expiresAt:"2026-10-01T00:00:00Z",
        existingAccount:false,
      }),
    } as Response);
    vi.stubGlobal("fetch",fetchMock);

    await inspectInvitation(token);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/invitations/current");
    expect(fetchMock.mock.calls[0][0]).not.toContain(token);
    expect(fetchMock.mock.calls[0][1].headers["X-Clinicflow-Invitation"]).toBe(token);
  });

  it("accepts through CSRF plus invitation header without tenant selection",async()=>{
    const token="another-secret-invitation-token-123456";
    const response=(body:unknown)=>({ok:true,status:200,json:async()=>body}) as Response;
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(response({header:"X-XSRF-TOKEN",token:"csrf"}))
      .mockResolvedValueOnce(response({userId:"u",tenantId:"t",role:"RECEPTION"}));
    vi.stubGlobal("fetch",fetchMock);

    await acceptInvitation(token,{password:"Long-Password-For-Test-2026"});

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/csrf");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/invitations/current/accept");
    expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({
      "X-Clinicflow-Invitation":token,
      "X-XSRF-TOKEN":"csrf",
    }));
    expect(fetchMock.mock.calls[1][1].headers["X-Clinicflow-Tenant"]).toBeUndefined();
  });

  it("tenant-scopes the administrator invitation list",async()=>{
    sessionStorage.setItem("clinicflow:tenant","tenant-a");
    const fetchMock=vi.fn().mockResolvedValue({
      ok:true,status:200,json:async()=>[],
    } as Response);
    vi.stubGlobal("fetch",fetchMock);

    await listInvitations();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/invitations",
      expect.objectContaining({headers:{"X-Clinicflow-Tenant":"tenant-a"}}),
    );
  });
});
