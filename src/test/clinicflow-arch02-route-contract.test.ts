import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/** Frozen ARCH-02 baseline: URLs, role restrictions and page bindings from main@51be21c. */
const expected = [
  "/||Index",
  "/servicos||ServicesPage",
  "/servicos/:slug||ServiceDetailPage",
  "/categoria/:slug||CategoryPage",
  "/agendar||BookingPage",
  "/sobre||AboutPage",
  "/contacto||ContactPage",
  "/login||LoginPage",
  "/convite||AcceptInvitationPage",
  "/perfil||ProfilePage",
  "/paciente|paciente|PatientDashboard",
  "/profissional|profissional|PractitionerDashboard",
  "/admin|admin|AdminDashboard",
  "/super|platform|SuperDashboard",
  "/staff|staff|StaffDashboard",
  "/recepcao/fila|staff,admin|ReceptionQueuePage",
  "/interno|interno|InternDashboard",
  "/enfermagem|enfermagem|NursingDashboardPage",
  "/enfermagem/historico|enfermagem|NursingHistoryPage",
  "/enfermagem/historico/:appointmentId|enfermagem|NursingHistoryDetailPage",
  "/enfermagem/observacoes/:appointmentId|enfermagem|NursingObservationPage",
  "/profissional/observacoes-enfermagem/:appointmentId|profissional|PractitionerNursingObservationPage",
  "/equipa/enfermagem|admin|AdminNursingAssignmentsPage",
  "/relatorios|profissional|MedicalReportsPage",
  "/pacientes|admin,staff|PatientsListPage",
  "/profissionais|admin|AdminProfessionalsPage",
  "/equipa|admin|AdminTeamPage",
  "/catalogo|admin|AdminCatalogPage",
  "/marcacoes|admin,staff,profissional|InternalAppointmentsPage",
  "/pacientes/:id|admin,staff|PatientProfilePage",
  "*||NotFound"
];

function routeContracts(source: string): string[] {
  return source.split("\n").filter(line => line.includes("<Route path=")).map(line => {
    const path = line.match(/<Route path="([^"]+)"/)?.[1];
    const roles = line.match(/allowedRoles=\{\[([^\]]+)\]\\}/)?.[1]
      ?.replace(/"/g, "").replace(/,\s*/g, ",") ?? "";
    const component = line.match(/<([A-Z]\w+)\s*\/><\/(?:PageTransition|ProtectedRoute)>/)?.[1] ?? "";
    return [path, roles, component].join("|");
  });
}

describe("ARCH-02 route extraction contract", () => {
  it("preserves every URL, role boundary and bound page from the audited baseline", () => {
    const source = readFileSync(new URL("../app/routes/AnimatedRoutes.tsx", import.meta.url), "utf8");
    expect(routeContracts(source)).toEqual(expected);
  });

  it("keeps verified role guards on every non-public route", () => {
    const source = readFileSync(new URL("../app/routes/AnimatedRoutes.tsx", import.meta.url), "utf8");
    const guarded = source.split("\n").filter(line => line.includes("<Route path=") && line.includes("ProtectedRoute"));
    expect(guarded).toHaveLength(21);
    expect(guarded.every(line => line.includes("<ProtectedRoute"))).toBe(true);
  });
});
