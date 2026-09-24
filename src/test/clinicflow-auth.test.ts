import { afterEach, describe, expect, it, vi } from "vitest";
import { login } from "@/lib/clinicflow-api";

afterEach(() => vi.unstubAllGlobals());

describe("real ClinicFlow login API", () => {
  it("obtains CSRF, authenticates, refreshes CSRF and loads verified memberships", async () => {
    const fakeUser = {
      id: "001", email: "admin@example.test", displayName: "Admin",
      memberships: [{ tenantId: "clinic-1", clinicName: "Demo", role: "CLINIC_ADMIN" }],
    };
    const response = (body: unknown) =>
      ({ ok: true, status: 200, json: async () => body }) as Response;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ header: "X-XSRF-TOKEN", token: "a" }))
      .mockResolvedValueOnce(response({ authenticated: true }))
      .mockResolvedValueOnce(response({ header: "X-XSRF-TOKEN", token: "b" }))
      .mockResolvedValueOnce(response(fakeUser));
    vi.stubGlobal("fetch", fetchMock);

    expect(await login("admin@example.test", "secret")).toEqual(fakeUser);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/csrf");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/login");
    expect(fetchMock.mock.calls[1][1].headers["X-XSRF-TOKEN"]).toBe("a");
    expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/auth/csrf");
    expect(fetchMock.mock.calls[3][0]).toBe("/api/v1/me");
  });
});
