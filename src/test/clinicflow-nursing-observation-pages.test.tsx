import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { fireEvent,render,screen,waitFor } from "@testing-library/react";
import { MemoryRouter,Route,Routes } from "react-router-dom";
import NursingObservationPage from "@/pages/NursingObservationPage";
import PractitionerNursingObservationPage from "@/pages/PractitionerNursingObservationPage";
import {
  acknowledgeNursingObservation,createNursingObservation,getNursingObservation,
  getPractitionerNursingObservation,listMyNursingUnits,listNursingArrivals,
  listPractitionerNursingCorrections,
  submitNursingObservation,updateNursingObservation,
} from "@/lib/clinicflow-api";

vi.mock("@/components/layout/DashboardLayout",()=>({
  default:({children}:{children:React.ReactNode})=><>{children}</>,
}));
vi.mock("@/lib/clinicflow-api",async(importOriginal)=>{
  const actual=await importOriginal<typeof import("@/lib/clinicflow-api")>();
  return {
    ...actual,
    activeTenantId:()=> "tenant-a",
    listMyNursingUnits:vi.fn(),listNursingArrivals:vi.fn(),
    getNursingObservation:vi.fn(),createNursingObservation:vi.fn(),
    updateNursingObservation:vi.fn(),submitNursingObservation:vi.fn(),
    getPractitionerNursingObservation:vi.fn(),acknowledgeNursingObservation:vi.fn(),
    listPractitionerNursingCorrections:vi.fn(),
  };
});

const unit={id:"unit-1",name:"Central"};
const arrival={
  appointmentId:"appointment-1",patientName:"Paciente sintético",
  unitId:"unit-1",unitName:"Central",serviceName:"Consulta",
  startsAt:"2026-09-25T09:00:00",appointmentStatus:"CONFIRMED" as const,
  queueStatus:"WAITING" as const,arrivedAt:"2026-09-25T08:55:00+02:00",calledAt:null,
};
const measurements={
  temperatureC:36.5,heartRate:80,respiratoryRate:18,
  spo2Percent:98,systolicMmhg:120,diastolicMmhg:80,
};
const draft={
  id:"note-1",appointmentId:"appointment-1",status:"DRAFT" as const,
  presentingConcern:"Dor referida",observationNotes:"Observação sintética",
  measurements,measuredAt:"2026-09-25T09:02:00+02:00",version:1,
  submittedAt:null,acknowledgedAt:null,acknowledgedBy:null,
  createdAt:"2026-09-25T09:03:00+02:00",updatedAt:"2026-09-25T09:03:00+02:00",
};
const submitted={...draft,status:"SUBMITTED" as const,version:2,
  submittedAt:"2026-09-25T09:04:00+02:00"};
const acknowledged={...submitted,status:"ACKNOWLEDGED" as const,version:3,
  acknowledgedAt:"2026-09-25T09:06:00+02:00",acknowledgedBy:"doctor-1"};

function nursePage(){
  return render(<MemoryRouter initialEntries={["/enfermagem/observacoes/appointment-1"]}>
    <Routes><Route path="/enfermagem/observacoes/:appointmentId"
      element={<NursingObservationPage/>}/></Routes>
  </MemoryRouter>);
}
function doctorPage(){
  return render(<MemoryRouter initialEntries={["/profissional/observacoes-enfermagem/appointment-1"]}>
    <Routes><Route path="/profissional/observacoes-enfermagem/:appointmentId"
      element={<PractitionerNursingObservationPage/>}/></Routes>
  </MemoryRouter>);
}

beforeEach(()=>{
  vi.mocked(listMyNursingUnits).mockReset().mockResolvedValue([unit]);
  vi.mocked(listNursingArrivals).mockReset().mockResolvedValue([arrival]);
  vi.mocked(getNursingObservation).mockReset().mockResolvedValue(draft);
  vi.mocked(createNursingObservation).mockReset().mockResolvedValue(draft);
  vi.mocked(updateNursingObservation).mockReset().mockResolvedValue(draft);
  vi.mocked(submitNursingObservation).mockReset().mockResolvedValue(submitted);
  vi.mocked(getPractitionerNursingObservation).mockReset().mockResolvedValue(submitted);
  vi.mocked(acknowledgeNursingObservation).mockReset().mockResolvedValue(acknowledged);
  vi.mocked(listPractitionerNursingCorrections).mockReset().mockResolvedValue({
    items:[],total:0,page:0,size:20,
  });
});
afterEach(()=>vi.clearAllMocks());

describe("CF-N02 nurse observation screen",()=>{
  it("fails closed before requesting arrivals when the nurse has no assigned units",async()=>{
    vi.mocked(listMyNursingUnits).mockResolvedValue([]);
    nursePage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não está disponível na sua lista actual/i);
    expect(listNursingArrivals).not.toHaveBeenCalled();
    expect(getNursingObservation).not.toHaveBeenCalled();
  });

  it("loads only the assigned arrival and never displays urgency classification",async()=>{
    nursePage();
    expect(await screen.findByText("Paciente sintético")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dor referida")).toBeInTheDocument();
    expect(screen.getByDisplayValue("36.5")).toBeInTheDocument();
    expect(screen.queryByText(/prioridade|vermelho|amarelo|verde/i)).not.toBeInTheDocument();
    expect(listMyNursingUnits).toHaveBeenCalledTimes(1);
    expect(listNursingArrivals).toHaveBeenCalledTimes(1);
    expect(getNursingObservation).toHaveBeenCalledWith("appointment-1");
  });

  it("requires dirty draft to be saved before submission",async()=>{
    nursePage();
    const concern=await screen.findByLabelText("Motivo referido");
    fireEvent.change(concern,{target:{value:"Alterado"}});
    expect(screen.getByRole("button",{name:"Submeter observação"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Guardar alterações"}));
    await waitFor(()=>expect(updateNursingObservation).toHaveBeenCalled());
  });

  it("renders submitted record read-only",async()=>{
    vi.mocked(getNursingObservation).mockResolvedValue(submitted);
    nursePage();
    expect(await screen.findByText(/Registo submetido — apenas leitura/)).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Guardar alterações"})).not.toBeInTheDocument();
    expect(screen.getByText("98 %")).toBeInTheDocument();
  });
});

describe("CF-N02 practitioner hand-off screen",()=>{
  it("shows submitted nursing content and records receipt without changing content",async()=>{
    doctorPage();
    expect(await screen.findByText("Dor referida")).toBeInTheDocument();
    expect(screen.getByText("Por confirmar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Confirmar recepção"}));
    await waitFor(()=>expect(acknowledgeNursingObservation)
      .toHaveBeenCalledWith("appointment-1"));
    expect(await screen.findByText("Recepção confirmada")).toBeInTheDocument();
    expect(screen.getByText("Dor referida")).toBeInTheDocument();
  });

  it("does not fabricate absence when the observation API fails",async()=>{
    vi.mocked(getPractitionerNursingObservation).mockRejectedValue(new Error("offline"));
    doctorPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(/estado está indisponível/i);
    expect(screen.queryByText(/Não existe observação submetida/)).not.toBeInTheDocument();
  });
});
