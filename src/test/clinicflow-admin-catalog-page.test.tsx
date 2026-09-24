import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminCatalogPage from "@/pages/AdminCatalogPage";
import {
  listClinicUnits, listClinicServices, createClinicUnit,
} from "@/lib/clinicflow-api";

vi.mock("@/components/layout/DashboardLayout",()=>({
  default:({children}:{children:React.ReactNode})=><>{children}</>,
}));
vi.mock("@/lib/clinicflow-api",()=>({
  activeTenantId:()=> "clinic-a",
  listClinicUnits:vi.fn(),
  listClinicServices:vi.fn(),
  createClinicUnit:vi.fn(),
  updateClinicUnit:vi.fn(),
  setClinicUnitActive:vi.fn(),
  createClinicService:vi.fn(),
  updateClinicService:vi.fn(),
  setClinicServiceActive:vi.fn(),
}));

beforeEach(()=>{
  vi.mocked(listClinicUnits).mockReset().mockResolvedValue([
    {id:"unit-1",name:"Unidade Confirmada pela API",address:"Maputo",active:true},
  ]);
  vi.mocked(listClinicServices).mockReset().mockResolvedValue([
    {id:"service-1",name:"Consulta Confirmada pela API",slug:"consulta-api",
      durationMinutes:45,price:500,currencyCode:"MZN",active:true},
  ]);
  vi.mocked(createClinicUnit).mockReset().mockResolvedValue({
    id:"unit-2",name:"Nova Unidade",address:null,active:true,
  });
  localStorage.clear();
});

function renderPage(){
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  return render(<QueryClientProvider client={client}>
    <MemoryRouter><AdminCatalogPage/></MemoryRouter>
  </QueryClientProvider>);
}

describe("clinic catalog admin page",()=>{
  it("uses tenant-backed units/services and never displays demo catalog",async()=>{
    localStorage.setItem("fake-services","João Silva's simulated clinic");
    renderPage();
    expect(await screen.findByText("Unidade Confirmada pela API")).toBeInTheDocument();
    const serviceTab=screen.getByRole("tab",{name:/Serviços/});
    fireEvent.mouseDown(serviceTab,{button:0,ctrlKey:false});
    expect(await screen.findByText("Consulta Confirmada pela API")).toBeInTheDocument();
    expect(screen.queryByText("João Silva's simulated clinic")).not.toBeInTheDocument();
    expect(listClinicUnits).toHaveBeenCalledTimes(1);
    expect(listClinicServices).toHaveBeenCalledTimes(1);
  });

  it("creates a unit through the real client rather than browser storage",async()=>{
    renderPage();
    await screen.findByText("Unidade Confirmada pela API");
    fireEvent.click(screen.getByRole("button",{name:"Nova unidade"}));
    fireEvent.change(screen.getByLabelText("Nome da unidade"),{
      target:{value:"Nova Unidade"},
    });
    fireEvent.click(screen.getByRole("button",{name:"Guardar unidade"}));
    await waitFor(()=>expect(createClinicUnit).toHaveBeenCalledWith({
      name:"Nova Unidade",address:null,
    }));
  });
});
