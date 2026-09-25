import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import NursingHistoryPage from "@/pages/NursingHistoryPage";
import NursingHistoryDetailPage from "@/pages/NursingHistoryDetailPage";
import PractitionerCorrections from "@/components/nursing/PractitionerCorrections";
import {
  acknowledgeNursingCorrection,createNursingCorrection,
  getNursingObservation,getOwnNursingHistoryDetail,
  listOwnNursingCorrections,listOwnNursingHistory,
  listPractitionerNursingCorrections,
} from "@/lib/clinicflow-api";

vi.mock("@/components/layout/DashboardLayout",()=>({
  default:({children}:{children:React.ReactNode})=><>{children}</>,
}));
vi.mock("@/lib/clinicflow-api",async(importOriginal)=>{
  const real=await importOriginal<typeof import("@/lib/clinicflow-api")>();
  return {
    ...real,activeTenantId:()=>"tenant-n03",
    listOwnNursingHistory:vi.fn(),getOwnNursingHistoryDetail:vi.fn(),
    getNursingObservation:vi.fn(),listOwnNursingCorrections:vi.fn(),
    createNursingCorrection:vi.fn(),listPractitionerNursingCorrections:vi.fn(),
    acknowledgeNursingCorrection:vi.fn(),
  };
});

const summary={
  observationId:"note-n03",appointmentId:"appt-n03",
  patientName:"Paciente sintético",unitName:"Unidade autorizada",
  serviceName:"Consulta",startsAt:"2026-09-24T10:00:00",
  status:"ACKNOWLEDGED" as const,
  createdAt:"2026-09-24T10:03:00+02:00",
  submittedAt:"2026-09-24T10:05:00+02:00",
  acknowledgedAt:"2026-09-24T10:06:00+02:00",correctionCount:1,
};
const original={
  id:"note-n03",appointmentId:"appt-n03",status:"ACKNOWLEDGED" as const,
  presentingConcern:"Motivo sintético",observationNotes:"Original sintético",
  measurements:{
    temperatureC:null,heartRate:null,respiratoryRate:null,
    spo2Percent:null,systolicMmhg:null,diastolicMmhg:null,
  },measuredAt:null,version:2,
  submittedAt:summary.submittedAt,acknowledgedAt:summary.acknowledgedAt,
  acknowledgedBy:"doctor-n03",createdAt:summary.createdAt,updatedAt:summary.createdAt,
};
const correction={
  id:"addendum-n03",observationId:"note-n03",authorId:"nurse-n03",
  content:"Clarificação sintética",createdAt:"2026-09-24T11:00:00+02:00",
  acknowledgedAt:null,acknowledgedBy:null,
};

function mountHistory(){
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  return render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={["/enfermagem/historico"]}>
      <Routes>
        <Route path="/enfermagem/historico" element={<NursingHistoryPage/>}/>
        <Route path="/enfermagem/historico/:appointmentId"
          element={<p>Detalhe do histórico aberto</p>}/>
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}
function mountDetail(){
  return render(<MemoryRouter initialEntries={["/enfermagem/historico/appt-n03"]}>
    <Routes><Route path="/enfermagem/historico/:appointmentId"
      element={<NursingHistoryDetailPage/>}/></Routes>
  </MemoryRouter>);
}
function mountDoctor(){
  return render(<MemoryRouter>
    <PractitionerCorrections appointmentId="appt-n03" tenant="tenant-n03"/>
  </MemoryRouter>);
}

beforeEach(()=>{
  vi.mocked(listOwnNursingHistory).mockReset().mockResolvedValue({
    items:[summary],total:1,page:0,size:20,
  });
  vi.mocked(getOwnNursingHistoryDetail).mockReset().mockResolvedValue(summary);
  vi.mocked(getNursingObservation).mockReset().mockResolvedValue(original);
  vi.mocked(listOwnNursingCorrections).mockReset().mockResolvedValue({
    items:[correction],total:1,page:0,size:20,
  });
  vi.mocked(createNursingCorrection).mockReset().mockResolvedValue(correction);
  vi.mocked(listPractitionerNursingCorrections).mockReset().mockResolvedValue({
    items:[correction],total:1,page:0,size:20,
  });
  vi.mocked(acknowledgeNursingCorrection).mockReset().mockResolvedValue({
    ...correction,acknowledgedAt:"2026-09-24T11:10:00+02:00",acknowledgedBy:"doctor-n03",
  });
});
afterEach(()=>vi.clearAllMocks());

describe("CF-N03 own historical observations",()=>{
  it("shows only server-provided history and opens its detail route",async()=>{
    mountHistory();
    expect(await screen.findByText("Paciente sintético")).toBeInTheDocument();
    expect(screen.getByText(/1 correcção/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Abrir registo"}));
    expect(await screen.findByText("Detalhe do histórico aberto")).toBeInTheDocument();
  });

  it("does not show patients when history authorization fails",async()=>{
    vi.mocked(listOwnNursingHistory).mockRejectedValue(new Error("offline"));
    mountHistory();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível verificar o histórico autorizado/);
    expect(screen.queryByText("Paciente sintético")).not.toBeInTheDocument();
  });

  it("shows original and correction with independent receipt state",async()=>{
    mountDetail();
    expect(await screen.findByText("Paciente sintético")).toBeInTheDocument();
    expect(screen.getByText("Original sintético")).toBeInTheDocument();
    expect(screen.getByText("Clarificação sintética")).toBeInTheDocument();
    expect(screen.getByText("Aguarda recepção")).toBeInTheDocument();
    expect(listOwnNursingCorrections).toHaveBeenCalledWith("appt-n03",0);
  });

  it("does not show a partial original if the correction API is unavailable",async()=>{
    vi.mocked(listOwnNursingCorrections).mockRejectedValue(new Error("offline"));
    mountDetail();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível carregar o registo completo/);
    expect(screen.queryByText("Original sintético")).not.toBeInTheDocument();
  });
});

describe("CF-N03 independent clinician correction receipt",()=>{
  it("records receipt on a particular correction, not on the original",async()=>{
    mountDoctor();
    expect(await screen.findByText("Clarificação sintética")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{
      name:"Confirmar recepção desta correcção",
    }));
    await waitFor(()=>expect(acknowledgeNursingCorrection)
      .toHaveBeenCalledWith("appt-n03","addendum-n03"));
    expect(await screen.findByText(/Recepção desta correcção confirmada/)).toBeInTheDocument();
  });
  it("reports unavailability rather than falsely reporting no corrections",async()=>{
    vi.mocked(listPractitionerNursingCorrections).mockRejectedValue(new Error("offline"));
    mountDoctor();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /O estado das correcções está indisponível/);
    expect(screen.queryByText("Sem correcções posteriores registadas."))
      .not.toBeInTheDocument();
  });
});
