import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReceptionQueuePage from "@/pages/ReceptionQueuePage";
import {
  listAppointments, listReceptionQueue, checkInAppointment, callReceptionQueueEntry,
} from "@/lib/clinicflow-api";

vi.mock("@/components/layout/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/clinicflow-api", () => ({
  activeTenantId: () => "tenant-a",
  listAppointments: vi.fn(),
  listReceptionQueue: vi.fn(),
  checkInAppointment: vi.fn(),
  callReceptionQueueEntry: vi.fn(),
}));
const booking = {
  id: "appt-a", patientId: "patient-a", practitionerUserId: "doctor-a",
  unitId: "unit-a", serviceId: "service-a", startsAt: "2026-09-25T09:00:00",
  endsAt: "2026-09-25T09:30:00", status: "CONFIRMED" as const, version: 2,
  patientName: "Paciente do servidor", practitionerName: "Profissional do servidor",
  unitName: "Unidade real", serviceName: "Consulta geral",
};
const entry = {
  id: "arrival-a", appointmentId: "appt-a", arrivedAt: "2026-09-25T09:03:00+02:00",
  queueStatus: "WAITING" as const, queueVersion: 0, calledAt: null,
  appointmentStatus: "CONFIRMED" as const, appointmentVersion: 2,
  startsAt: booking.startsAt, unitId: booking.unitId,
  patientName: booking.patientName, practitionerName: booking.practitionerName,
  unitName: booking.unitName, serviceName: booking.serviceName,
};
function mount() {
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false }, mutations: { retry: false },
  } });
  return render(<QueryClientProvider client={client}>
    <MemoryRouter><ReceptionQueuePage /></MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => {
  vi.mocked(listAppointments).mockReset().mockResolvedValue([booking]);
  vi.mocked(listReceptionQueue).mockReset().mockResolvedValue([]);
  vi.mocked(checkInAppointment).mockReset().mockResolvedValue(entry);
  vi.mocked(callReceptionQueueEntry).mockReset().mockResolvedValue({
    ...entry, queueStatus: "CALLED", queueVersion: 1,
    calledAt: "2026-09-25T09:07:00+02:00",
  });
  sessionStorage.clear();
});
afterEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });
describe("CF-R01 reception workbench", () => {
  it("confirms patient identity before server-side check-in", async () => {
    mount();
    expect(await screen.findByText("Paciente do servidor")).toBeInTheDocument();
    expect(screen.getByText("Por chegar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registar chegada" }));
    expect(screen.getByText("Confirmar chegada presencial?")).toBeInTheDocument();
    expect(checkInAppointment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar chegada" }));
    await waitFor(() => expect(checkInAppointment).toHaveBeenCalledWith("appt-a", 2));
  });
  it("does not offer duplicate arrival, and calls only waiting patients", async () => {
    vi.mocked(listReceptionQueue).mockResolvedValue([entry]);
    mount();
    expect(await screen.findByRole("button", { name: /Chamar/ })).toBeInTheDocument();
    expect(await screen.findByText("Paciente do servidor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registar chegada" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Chamar/ }));
    await waitFor(() => expect(callReceptionQueueEntry).toHaveBeenCalledWith("arrival-a", 0));
    expect(screen.queryByText("diagnosis")).not.toBeInTheDocument();
  });
  it("hides arrival actions if the server queue cannot be verified", async () => {
    vi.mocked(listReceptionQueue).mockRejectedValue(new Error("unavailable"));
    mount();
    expect(await screen.findByText(/Fila indisponível/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registar chegada" })).not.toBeInTheDocument();
  });
});
