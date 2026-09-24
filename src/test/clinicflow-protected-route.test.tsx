import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { me } from "@/lib/clinicflow-api";

vi.mock("@/lib/clinicflow-api", () => ({ me: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(me).mockReset();
});

describe("verified route authorization", () => {
  it("rejects a forged localStorage admin role when server membership is PATIENT", async () => {
    localStorage.setItem("user", JSON.stringify({ role: "admin", name: "Forged" }));
    vi.mocked(me).mockResolvedValue({
      id: "patient-1", email: "patient@example.test", displayName: "Patient",
      memberships: [{ tenantId: "tenant-1", clinicName: "Clinic", role: "PATIENT" }],
    });
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}>
            <span>Protected Admin Screen</span>
          </ProtectedRoute>} />
          <Route path="/paciente" element={<span>Patient Screen</span>} />
          <Route path="/login" element={<span>Login</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Patient Screen")).toBeInTheDocument();
    expect(screen.queryByText("Protected Admin Screen")).toBeNull();
  });
});
