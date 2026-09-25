import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NursingDashboardPage from "@/pages/NursingDashboardPage";
import AdminNursingAssignmentsPage from "@/pages/AdminNursingAssignmentsPage";
import {
  listMyNursingUnits,listNursingArrivals,listNursingTeam,listClinicUnits,setNursingUnits,
} from "@/lib/clinicflow-api";

vi.mock("@/components/layout/DashboardLayout",()=>({
  default:({children}:{children:React.ReactNode})=><>{children}</>,
}));
vi.mock("@/lib/clinicflow-api",()=>({
  activeTenantId:()=> "tenant-a",
  listMyNursingUnits:vi.fn(),listNursingArrivals:vi.fn(),
  listNursingTeam:vi.fn(),listClinicUnits:vi.fn(),setNursingUnits:vi.fn(),
}));
const unit={id:"unit-1",name:"Central"};
const arrival={
  appointmentId:"appointment-1",patientName:"Paciente validado",
  unitId:"unit-1",unitName:"Central",serviceName:"Consulta",
  startsAt:"2026-09-25T09:00:00",appointmentStatus:"CONFIRMED" as const,
  queueStatus:"WAITING" as const,arrivedAt:"2026-09-25T08:55:00+02:00",
  calledAt:null,
};
function mount(page:React.ReactElement){
  const client=new QueryClient({defaultOptions:{
    queries:{retry:false},mutations:{retry:false},
  }});
  return render(<QueryClientProvider client={client}>
    <MemoryRouter>{page}</MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(()=>{
  vi.mocked(listMyNursingUnits).mockReset().mockResolvedValue([unit]);
  vi.mocked(listNursingArrivals).mockReset().mockResolvedValue([arrival]);
  vi.mocked(listNursingTeam).mockReset().mockResolvedValue([{
    userId:"nurse-1",displayName:"Enfermeira autorizada",
    email:"nurse@example.invalid",version:2,units:[],
  }]);
  vi.mocked(listClinicUnits).mockReset().mockResolvedValue([
    {...unit,address:null,active:true},
    {id:"inactive",name:"Inactiva",address:null,active:false},
  ]);
  vi.mocked(setNursingUnits).mockReset().mockResolvedValue({
    userId:"nurse-1",displayName:"Enfermeira autorizada",
    email:"nurse@example.invalid",version:3,units:[unit],
  });
});
afterEach(()=>vi.clearAllMocks());

describe("CF-N01 nursing workbench",()=>{
  it("shows only API arrivals after server-supplied unit assignment",async()=>{
    mount(<NursingDashboardPage/>);
    expect(await screen.findByText("Paciente validado")).toBeInTheDocument();
    expect(screen.getByText("Em espera")).toBeInTheDocument();
    expect(listMyNursingUnits).toHaveBeenCalledTimes(1);
    expect(listNursingArrivals).toHaveBeenCalledWith(expect.any(String));
    expect(screen.queryByText("Diagnóstico")).not.toBeInTheDocument();
    expect(screen.queryByText("Relatórios")).not.toBeInTheDocument();
  });
  it("never fetches arrivals when no units are assigned",async()=>{
    vi.mocked(listMyNursingUnits).mockResolvedValue([]);
    mount(<NursingDashboardPage/>);
    expect(await screen.findByText("Sem unidades atribuídas")).toBeInTheDocument();
    expect(listNursingArrivals).not.toHaveBeenCalled();
    expect(screen.queryByText("Paciente validado")).not.toBeInTheDocument();
  });
  it("hides all patient information on assignment lookup failure",async()=>{
    vi.mocked(listMyNursingUnits).mockRejectedValue(new Error("offline"));
    mount(<NursingDashboardPage/>);
    expect(await screen.findByText(/Não foi possível verificar as suas unidades/))
      .toBeInTheDocument();
    expect(listNursingArrivals).not.toHaveBeenCalled();
  });
  it("does not invent zero arrivals when the server request fails",async()=>{
    vi.mocked(listNursingArrivals).mockRejectedValue(new Error("offline"));
    mount(<NursingDashboardPage/>);
    expect(await screen.findByText(/O estado dos pacientes está indisponível/))
      .toBeInTheDocument();
    expect(screen.queryByText("Não existem chegadas registadas nas unidades seleccionadas."))
      .not.toBeInTheDocument();
  });
});

describe("CF-N01 admin foundation: explicit unit grants",()=>{
  it("requires unit selection and sends an optimistic version to the backend",async()=>{
    mount(<AdminNursingAssignmentsPage/>);
    expect(await screen.findByText("Enfermeira autorizada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Editar unidades"}));
    expect(screen.queryByLabelText("Inactiva")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Central"));
    fireEvent.click(screen.getByRole("button",{name:"Guardar unidades"}));
    await waitFor(()=>expect(setNursingUnits).toHaveBeenCalledWith("nurse-1",2,["unit-1"]));
  });
  it("disables all edits if the authorized unit catalog is unavailable",async()=>{
    vi.mocked(listClinicUnits).mockRejectedValue(new Error("offline"));
    mount(<AdminNursingAssignmentsPage/>);
    expect(await screen.findByText(/Não foi possível validar a equipa ou as unidades/))
      .toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Editar unidades"})).not.toBeInTheDocument();
    expect(setNursingUnits).not.toHaveBeenCalled();
  });
});
