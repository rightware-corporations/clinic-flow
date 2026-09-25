import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, Check, Clock3, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  activeTenantId, callReceptionQueueEntry, checkInAppointment,
  listAppointments, listReceptionQueue,
  type ClinicAppointment, type ReceptionQueueEntry,
} from "@/lib/clinicflow-api";

function todayOnDevice(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")].join("-");
}
function stage(entry: ReceptionQueueEntry): string {
  if (entry.appointmentStatus === "COMPLETED") return "Atendimento concluído";
  if (entry.appointmentStatus === "IN_PROGRESS") return "Em consulta";
  return entry.queueStatus === "WAITING" ? "Em espera" : "Chamado";
}
function arrivalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit" });
}

export default function ReceptionQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenant = activeTenantId();
  const today = todayOnDevice();
  const [unit, setUnit] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<ClinicAppointment | null>(null);

  const appointments = useQuery({
    queryKey: ["reception-arrivals-calendar", tenant, today],
    queryFn: () => listAppointments(today, today),
    staleTime: 10_000,
  });
  const queue = useQuery({
    queryKey: ["reception-queue", tenant, today, unit],
    queryFn: () => listReceptionQueue(today, unit || undefined),
    staleTime: 10_000,
  });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reception-queue", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["reception-arrivals-calendar", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["reception-calendar", tenant] }),
      queryClient.invalidateQueries({ queryKey: ["appointments-calendar", tenant] }),
    ]);
  };
  const arrival = useMutation({
    mutationFn: (item: ClinicAppointment) => checkInAppointment(item.id, item.version),
    onSuccess: () => {
      setPending(null);
      toast.success("Chegada registada na fila");
      void invalidate();
    },
    onError: () => {
      setPending(null);
      toast.error("Não foi possível registar a chegada. Actualize a agenda e verifique a data.");
      void invalidate();
    },
  });
  const call = useMutation({
    mutationFn: (item: ReceptionQueueEntry) =>
      callReceptionQueueEntry(item.id, item.queueVersion),
    onSuccess: () => {
      toast.success("Paciente chamado para atendimento");
      void invalidate();
    },
    onError: () => {
      toast.error("Não foi possível chamar o paciente. Actualize a fila.");
      void invalidate();
    },
  });

  const units = new Map<string, string>();
  for (const item of appointments.data ?? []) units.set(item.unitId, item.unitName);
  for (const item of queue.data ?? []) units.set(item.unitId, item.unitName);
  const checkedIn = new Set((queue.data ?? []).map(item => item.appointmentId));
  // A filtered queue is not enough to identify arrivals in another unit.
  const allArrivals = useQuery({
    queryKey: ["reception-queue", tenant, today, ""],
    queryFn: () => listReceptionQueue(today),
    enabled: Boolean(unit),
    staleTime: 10_000,
  });
  for (const item of allArrivals.data ?? []) checkedIn.add(item.appointmentId);
  const scheduled = (appointments.data ?? []).filter(item =>
    item.status === "CONFIRMED" && (!unit || item.unitId === unit));
  const waitingArrival = scheduled.filter(item => !checkedIn.has(item.id));
  const candidates = waitingArrival.filter(item =>
    item.patientName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const activeQueue = (queue.data ?? []).filter(item =>
    item.appointmentStatus !== "COMPLETED" && item.appointmentStatus !== "CANCELLED");
  const inWaiting = activeQueue.filter(item =>
    item.appointmentStatus === "CONFIRMED" && item.queueStatus === "WAITING").length;
  const inCalled = activeQueue.filter(item =>
    item.appointmentStatus === "CONFIRMED" && item.queueStatus === "CALLED").length;

  return <DashboardLayout>
    <section className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Recepção / Hoje</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Chegadas e fila</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registe a chegada, organize a espera e encaminhe os pacientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => {
            void appointments.refetch();
            void queue.refetch();
            void allArrivals.refetch();
          }}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button>
          <Button onClick={() => navigate("/marcacoes")}>
            <CalendarDays className="mr-2 h-4 w-4"/>Agenda completa
          </Button>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Data no dispositivo: <strong>{today}</strong>. O servidor valida o dia da chegada
          segundo o fuso horário configurado para a clínica.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span>Unidade</span>
          <select aria-label="Filtrar unidade" value={unit}
            onChange={event => setUnit(event.target.value)}
            className="max-w-56 rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">Todas as unidades</option>
            {[...units.entries()].sort((a,b) => a[1].localeCompare(b[1])).map(([id,name]) =>
              <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground">Por chegar</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {appointments.isSuccess && queue.isSuccess && (!unit || allArrivals.isSuccess) ? waitingArrival.length : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground">Em espera</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {queue.isSuccess ? inWaiting : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground">Chamados</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {queue.isSuccess ? inCalled : "—"}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_1fr]">
        <section aria-labelledby="checkin-title" className="overflow-hidden rounded-xl border bg-card">
          <div className="space-y-3 border-b p-5">
            <div>
              <h2 id="checkin-title" className="font-semibold">Registar chegada</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Apenas marcações confirmadas de hoje. Confira a identidade presencialmente.
              </p>
            </div>
            <Input aria-label="Pesquisar marcação de hoje" value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar pelo nome do paciente"/>
          </div>
          {appointments.isPending && <p role="status" className="p-6 text-sm">
            A consultar as marcações...
          </p>}
          {appointments.isError && <p role="alert" className="p-6 text-sm text-destructive">
            A agenda está indisponível. Não é possível registar chegadas.
          </p>}
          {unit && allArrivals.isPending && <p role="status" className="p-6 text-sm">
            A verificar chegadas noutras unidades...
          </p>}
          {unit && allArrivals.isError && <p role="alert" className="p-6 text-sm text-destructive">
            Não foi possível verificar a fila completa. Actualize antes de registar.
          </p>}
          {appointments.isSuccess && queue.isSuccess && (!unit || allArrivals.isSuccess) &&
            <div className="divide-y">
              {candidates.map(item => <div key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{item.patientName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Clock3 className="mr-1 inline h-3.5 w-3.5"/>
                    {item.startsAt.slice(11,16)} · {item.serviceName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.unitName} · {item.practitionerName}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPending(item)}
                  disabled={arrival.isPending}>
                  <Check className="mr-1.5 h-4 w-4"/>Registar chegada
                </Button>
              </div>)}
              {candidates.length === 0 && <div className="p-9 text-center">
                <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground"/>
                <p className="text-sm text-muted-foreground">
                  Nenhuma marcação confirmada por chegar corresponde ao filtro.
                </p>
              </div>}
            </div>}
        </section>

        <section aria-labelledby="queue-title" className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b p-5">
            <h2 id="queue-title" className="font-semibold">Fila de atendimento</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ordem de chegada registada. Chamar não inicia a consulta clínica.
            </p>
          </div>
          {queue.isPending && <p role="status" className="p-6 text-sm">A carregar a fila...</p>}
          {queue.isError && <p role="alert" className="p-6 text-sm text-destructive">
            Fila indisponível. Actualize e tente novamente.
          </p>}
          {queue.isSuccess && <div className="divide-y">
            {activeQueue.map((item,index) => <div key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
                  {index+1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{item.patientName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Chegada: {arrivalTime(item.arrivedAt)} · {item.unitName}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.serviceName}</p>
                  <Badge className="mt-2" variant={item.appointmentStatus === "CONFIRMED"
                    ? "secondary" : "outline"}>{stage(item)}</Badge>
                </div>
              </div>
              {item.queueStatus === "WAITING" && item.appointmentStatus === "CONFIRMED" &&
                <Button size="sm" disabled={call.isPending}
                  onClick={() => call.mutate(item)}>
                  Chamar <ArrowRight className="ml-1.5 h-4 w-4"/>
                </Button>}
            </div>)}
            {activeQueue.length === 0 && <p className="p-9 text-center text-sm text-muted-foreground">
              Nenhum paciente na fila desta unidade.
            </p>}
          </div>}
        </section>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={open => {
        if (!open && !arrival.isPending) setPending(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar chegada presencial?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.patientName} · {pending?.serviceName} · {pending?.startsAt.slice(11,16)}.
              Confirme a identidade antes de registar a presença.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={arrival.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={arrival.isPending}
              onClick={event => {
                event.preventDefault();
                if (pending) arrival.mutate(pending);
              }}>Confirmar chegada</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  </DashboardLayout>;
}
