import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminDashboard from "@/pages/AdminDashboard";
import StaffDashboard from "@/pages/StaffDashboard";
import PractitionerDashboard from "@/pages/PractitionerDashboard";
import PatientDashboard from "@/pages/PatientDashboard";
import InternDashboard from "@/pages/InternDashboard";
import {
  listAppointments, listPatients, listClinicServices,
  listProfessionals, listClinicalReports, listMyPatientArrivals, me,
} from "@/lib/clinicflow-api";

vi.mock("@/components/layout/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/clinicflow-api", () => ({
  activeTenantId: () => "tenant-a",
  listAppointments: vi.fn(),
  listPatients: vi.fn(),
  listClinicServices: vi.fn(),
  listProfessionals: vi.fn(),
  listClinicalReports: vi.fn(),
  listMyPatientArrivals: vi.fn(),
  me: vi.fn(),
}));
function renderPage(page: React.ReactElement, route = "/dashboard") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={route} element={page} />
        <Route path="/marcacoes" element={<span>Agenda autenticada</span>} />
        <Route path="/relatorios" element={<span>Relatórios próprios</span>} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}
const appointment = {
  id: "appointment-1", patientId: "patient-1", practitionerUserId: "doctor-1",
  unitId: "unit-1", serviceId: "service-1",
  startsAt: "2026-09-24T09:00:00", endsAt: "2026-09-24T09:30:00",
  status: "CONFIRMED" as const, version: 0,
  patientName: "Paciente da API", practitionerName: "Profissional da API",
  unitName: "Clínica Central", serviceName: "Consulta Geral",
};
const session = {
  id: "user-1", displayName: "Utilizador Validado",
  email: "validated@example.invalid",
  memberships: [{ tenantId: "tenant-a", clinicName: "Clínica", role: "PATIENT" as const }],
};

beforeEach(() => {
  vi.mocked(listAppointments).mockReset().mockResolvedValue([]);
  vi.mocked(listPatients).mockReset().mockResolvedValue({
    items: [], total: 7, page: 0, size: 1,
  });
  vi.mocked(listClinicServices).mockReset().mockResolvedValue([]);
  vi.mocked(listProfessionals).mockReset().mockResolvedValue([]);
  vi.mocked(listMyPatientArrivals).mockReset().mockResolvedValue([]);
  vi.mocked(listClinicalReports).mockReset().mockResolvedValue({
    items: [], total: 0, page: 0, size: 30,
  });
  vi.mocked(me).mockReset().mockResolvedValue(session);
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); });

describe("CF-B8 operational dashboards", () => {
  it("admin shows only API metrics and authorized appointments, not legacy clinical reports", async () => {
    localStorage.setItem("medical_reports", JSON.stringify([
      { patientName: "Paciente Clínico de localStorage", diagnosis: "confidential" },
    ]));
    vi.mocked(listAppointments).mockResolvedValue([appointment]);
    renderPage(<AdminDashboard />);
    expect(await screen.findByText("Paciente da API")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("Paciente Clínico de localStorage")).not.toBeInTheDocument();
    expect(screen.queryByText("24")).not.toBeInTheDocument();
    expect(listPatients).toHaveBeenCalledWith("", 0, 1);
    expect(listAppointments).toHaveBeenCalledTimes(1);
  });

  it("staff searches through the authorized backend rather than mock patients", async () => {
    renderPage(<StaffDashboard />);
    await screen.findByText("Nenhuma marcação para hoje.");
    expect(listPatients).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Pesquisar paciente" }),
      { target: { value: "Ana" } });
    await waitFor(() => expect(listPatients).toHaveBeenCalledWith("Ana", 0, 10));
    expect(screen.queryByText("João Silva")).toBeNull();
  });

  it("practitioner sees only API appointments and their report index", async () => {
    vi.mocked(listAppointments).mockResolvedValue([appointment]);
    vi.mocked(listClinicalReports).mockResolvedValue({
      items: [], total: 3, page: 0, size: 30,
    });
    localStorage.setItem("medical_reports", JSON.stringify([
      { patientName: "Relatório forjado" },
    ]));
    renderPage(<PractitionerDashboard />);
    expect(await screen.findByText("Paciente da API")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("Relatório forjado")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir agenda" }));
    expect(await screen.findByText("Agenda autenticada")).toBeInTheDocument();
  });

  it("clinician sees a reception call for an assigned appointment", async () => {
    vi.mocked(listAppointments).mockResolvedValue([appointment]);
    vi.mocked(listMyPatientArrivals).mockResolvedValue([
      { appointmentId: appointment.id, queueStatus: "CALLED",
        arrivedAt: "2026-09-24T08:50:00+02:00", calledAt: "2026-09-24T08:55:00+02:00" },
    ]);
    renderPage(<PractitionerDashboard />);
    expect(await screen.findByText("Chamado pela recepção")).toBeInTheDocument();
    expect(listMyPatientArrivals).toHaveBeenCalledWith(expect.any(String));
    expect(screen.queryByText("Sem chegada registada")).not.toBeInTheDocument();
  });

  it("an arrivals outage never hides the doctor's agenda or invents a nonarrival", async () => {
    vi.mocked(listAppointments).mockResolvedValue([appointment]);
    vi.mocked(listMyPatientArrivals).mockRejectedValue(new Error("unavailable"));
    renderPage(<PractitionerDashboard />);
    expect(await screen.findByText("Paciente da API")).toBeInTheDocument();
    expect(await screen.findByText("Estado de chegada indisponível.")).toBeInTheDocument();
    expect(screen.queryByText("Sem chegada registada")).not.toBeInTheDocument();
  });

  it("patient portal does not invent consultations before identity binding exists", async () => {
    renderPage(<PatientDashboard />);
    expect(await screen.findByText("Bem-vindo, Utilizador Validado")).toBeInTheDocument();
    expect(screen.getByText(/Ainda não está implementada a associação verificada/))
      .toBeInTheDocument();
    expect(screen.queryByText("Dra. Ana Mendes")).toBeNull();
    expect(listAppointments).not.toHaveBeenCalled();
  });

  it("intern cannot read patients or reports without approved supervision policy", async () => {
    renderPage(<InternDashboard />);
    expect(await screen.findByText("Bem-vindo, Utilizador Validado")).toBeInTheDocument();
    expect(screen.getByText("Acesso clínico supervisionado pendente")).toBeInTheDocument();
    expect(listPatients).not.toHaveBeenCalled();
    expect(listClinicalReports).not.toHaveBeenCalled();
  });
});
