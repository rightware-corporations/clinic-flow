import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MedicalReportsPage from "@/pages/MedicalReportsPage";
import {
  listClinicalReports, listEligibleClinicalEncounters, getClinicalReport,
  type ClinicalReportPage,
} from "@/lib/clinicflow-api";

vi.mock("@/components/layout/DashboardLayout",()=>({
  default: ({children}:{children:React.ReactNode})=><>{children}</>,
}));
vi.mock("@/lib/clinicflow-api",()=>({
  activeTenantId: ()=>"tenant-a",
  listClinicalReports:vi.fn(),
  listEligibleClinicalEncounters:vi.fn(),
  getClinicalReport:vi.fn(),
  createClinicalReport:vi.fn(),
  updateClinicalReport:vi.fn(),
  finalizeClinicalReport:vi.fn(),
  createClinicalAddendum:vi.fn(),
}));
const summary={
  id:"11111111-1111-4111-8111-111111111111",
  appointmentId:"22222222-2222-4222-8222-222222222222",
  patientId:"33333333-3333-4333-8333-333333333333",
  patientName:"Paciente Sintético Autorizado",
  reportType:"CONSULTATION" as const,status:"DRAFT" as const,version:0,
  createdAt:"2026-09-24T10:00:00Z",updatedAt:"2026-09-24T11:00:00Z",finalizedAt:null,
};
function renderPage(){
  const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
  return render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={["/relatorios"]}><MedicalReportsPage/></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(()=>{
  vi.mocked(listClinicalReports).mockReset();
  vi.mocked(listEligibleClinicalEncounters).mockReset();
  vi.mocked(getClinicalReport).mockReset();
  localStorage.clear();
});
afterEach(()=>{localStorage.clear();vi.clearAllMocks();});

describe("clinical reports screen",()=>{
  it("renders only server-authorized reports, not old localStorage mock content",async()=>{
    localStorage.setItem("medical_reports",JSON.stringify([
      {id:"RPT-FAKE",patientName:"Paciente de localStorage",diagnosis:"stale"},
    ]));
    const page:ClinicalReportPage={items:[summary],total:1,page:0,size:30};
    vi.mocked(listClinicalReports).mockResolvedValue(page);
    renderPage();
    expect(await screen.findByText("Paciente Sintético Autorizado")).toBeInTheDocument();
    expect(screen.queryByText("Paciente de localStorage")).not.toBeInTheDocument();
    expect(listClinicalReports).toHaveBeenCalledWith(0);
    expect(JSON.parse(localStorage.getItem("medical_reports")!)).toHaveLength(1);
  });
  it("only shows assigned started or completed appointments for new reports",async()=>{
    vi.mocked(listClinicalReports).mockResolvedValue({
      items:[],total:0,page:0,size:30,
    });
    vi.mocked(listEligibleClinicalEncounters).mockResolvedValue([
      {id:"44444444-4444-4444-8444-444444444444",
       patientId:"55555555-5555-4555-8555-555555555555",
       patientName:"Consulta Sintética",startsAt:"2026-09-24T09:00:00",
       status:"IN_PROGRESS",serviceName:"Consulta"},
    ]);
    const {getByRole}=renderPage();
    await screen.findByText("Nenhum relatório encontrado nesta página.");
    getByRole("button",{name:"Novo relatório"}).click();
    expect(await screen.findByText(/Consulta Sintética/)).toBeInTheDocument();
    expect(listEligibleClinicalEncounters).toHaveBeenCalledTimes(1);
  });
});
