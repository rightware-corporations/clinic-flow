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


describe("patient-registry route policy", () => {
  it("does not allow PRACTITIONER through an admin/staff patient-registry route", async () => {
    vi.mocked(me).mockResolvedValue({
      id: "practitioner-1", email: "doctor@example.test", displayName: "Doctor",
      memberships: [{ tenantId: "tenant-1", clinicName: "Clinic", role: "PRACTITIONER" }],
    });
    render(
      <MemoryRouter initialEntries={["/pacientes"]}>
        <Routes>
          <Route path="/pacientes" element={<ProtectedRoute allowedRoles={["admin", "staff"]}>
            <span>Patient Registry</span>
          </ProtectedRoute>} />
          <Route path="/profissional" element={<span>Practitioner Screen</span>} />
          <Route path="/login" element={<span>Login</span>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Practitioner Screen")).toBeInTheDocument();
    expect(screen.queryByText("Patient Registry")).toBeNull();
  });
});

describe("CF-N01 verified nursing boundaries",()=>{
  it("permits a verified nurse only into the nursing route",async()=>{
    vi.mocked(me).mockResolvedValue({
      id:"nurse-a",email:"nurse@example.invalid",displayName:"Nurse",
      memberships:[{tenantId:"tenant-1",clinicName:"Clinic",role:"NURSE"}],
    });
    render(<MemoryRouter initialEntries={["/enfermagem"]}><Routes>
      <Route path="/enfermagem" element={<ProtectedRoute allowedRoles={["enfermagem"]}>
        <span>Nursing Workbench</span>
      </ProtectedRoute>}/>
      <Route path="/login" element={<span>Login</span>}/>
    </Routes></MemoryRouter>);
    expect(await screen.findByText("Nursing Workbench")).toBeInTheDocument();
    expect(sessionStorage.getItem("clinicflow:tenant")).toBe("tenant-1");
  });

  it("does not elevate a verified nurse to clinic administration",async()=>{
    localStorage.setItem("user",JSON.stringify({role:"admin"}));
    vi.mocked(me).mockResolvedValue({
      id:"nurse-a",email:"nurse@example.invalid",displayName:"Nurse",
      memberships:[{tenantId:"tenant-1",clinicName:"Clinic",role:"NURSE"}],
    });
    render(<MemoryRouter initialEntries={["/equipa/enfermagem"]}><Routes>
      <Route path="/equipa/enfermagem" element={
        <ProtectedRoute allowedRoles={["admin"]}><span>Admin-only assignments</span></ProtectedRoute>
      }/>
      <Route path="/enfermagem" element={<span>Nursing Workbench</span>}/>
    </Routes></MemoryRouter>);
    expect(await screen.findByText("Nursing Workbench")).toBeInTheDocument();
    expect(screen.queryByText("Admin-only assignments")).not.toBeInTheDocument();
  });
});
