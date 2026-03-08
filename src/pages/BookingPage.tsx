import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  MapPin,
  User,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/layout/Layout";
import { services, categoryLabels, type Service } from "@/data/services";
import { practitioners, getPractitionersByCategory, type Practitioner } from "@/data/practitioners";
import { generateSlots, type TimeSlot } from "@/data/slots";

const STEPS = ["Serviço", "Profissional", "Data", "Horário", "Dados", "Confirmação"];

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get("service");

  const [step, setStep] = useState(preselectedService ? 1 : 0);
  const [selectedService, setSelectedService] = useState<Service | null>(
    preselectedService ? services.find((s) => s.id === preselectedService) || null : null
  );
  const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
  const [anyPractitioner, setAnyPractitioner] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [patientData, setPatientData] = useState({ name: "", email: "", phone: "", notes: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");

  // Generate dates for next 14 days
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() !== 0) dates.push(d); // skip Sundays
    }
    return dates;
  }, []);

  const slots = useMemo(() => {
    if (!selectedDate || !selectedService) return [];
    return generateSlots(selectedDate, selectedService.duration);
  }, [selectedDate, selectedService]);

  const availablePractitioners = useMemo(() => {
    if (!selectedService?.practitionerCategory) return [];
    return getPractitionersByCategory(selectedService.practitionerCategory);
  }, [selectedService]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services;
    const q = serviceSearch.toLowerCase();
    return services.filter((s) => s.name.toLowerCase().includes(q) || categoryLabels[s.category].toLowerCase().includes(q));
  }, [serviceSearch]);

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedService;
      case 1: return !!selectedPractitioner || anyPractitioner;
      case 2: return !!selectedDate;
      case 3: return !!selectedSlot;
      case 4: return patientData.name && patientData.email && patientData.phone;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step === 5) {
      setConfirmed(true);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" });

  if (confirmed) {
    return (
      <Layout hideFooter>
        <div className="container max-w-lg py-20 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Marcação Confirmada!</h1>
            <p className="text-muted-foreground mb-6">Receberá um email de confirmação em breve.</p>
            <div className="medical-card p-5 text-left space-y-3 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviço</span>
                <span className="font-medium">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profissional</span>
                <span className="font-medium">{anyPractitioner ? "Qualquer disponível" : selectedPractitioner?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">{selectedDate && formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium">{selectedSlot?.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paciente</span>
                <span className="font-medium">{patientData.name}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Link to="/">
                <Button variant="outline">Voltar ao início</Button>
              </Link>
              <Link to="/agendar">
                <Button className="medical-gradient border-0" onClick={() => window.location.reload()}>Nova marcação</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="container py-6 md:py-10">
        {/* Stepper — compact on mobile */}
        <div className="mb-4 md:mb-8 overflow-x-auto scrollbar-none">
          <div className="flex items-center justify-center gap-0.5 md:gap-1 min-w-max mx-auto">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium transition-all ${
                    i === step
                      ? "stepper-active"
                      : i < step
                      ? "stepper-completed cursor-pointer"
                      : "stepper-pending"
                  }`}
                >
                  {i < step ? (
                    <Check className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  ) : (
                    <span className="w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center text-[8px] md:text-[10px] font-bold border-current">
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-3 md:w-6 h-px mx-0.5 md:mx-1 ${i < step ? "bg-accent" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Panel */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Step 0: Service */}
                {step === 0 && (
                  <div>
                    <h2 className="text-xl font-bold mb-1">Selecione o serviço</h2>
                    <p className="text-sm text-muted-foreground mb-5">Escolha o serviço que pretende agendar.</p>
                    <Input
                      placeholder="Pesquisar serviço..."
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      className="mb-4 max-w-sm"
                    />
                    <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                      {filteredServices.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedService(s); setSelectedPractitioner(null); setAnyPractitioner(false); }}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            selectedService?.id === s.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30 bg-card"
                          }`}
                        >
                          <p className="font-medium text-sm mb-1">{s.name}</p>
                          <p className="text-xs text-muted-foreground mb-2">{s.description.slice(0, 80)}...</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {s.duration > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration}min</span>}
                            {s.price !== undefined && s.price > 0 && <span className="font-semibold text-primary">{s.price}€</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 1: Practitioner */}
                {step === 1 && (
                  <div>
                    <h2 className="text-xl font-bold mb-1">Selecione o profissional</h2>
                    <p className="text-sm text-muted-foreground mb-5">Escolha um profissional ou deixe-nos escolher.</p>
                    <button
                      onClick={() => { setAnyPractitioner(true); setSelectedPractitioner(null); }}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all mb-3 ${
                        anyPractitioner ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 bg-card"
                      }`}
                    >
                      <p className="font-medium text-sm">Qualquer profissional disponível</p>
                      <p className="text-xs text-muted-foreground">Será atribuído o próximo profissional com disponibilidade.</p>
                    </button>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {availablePractitioners.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedPractitioner(p); setAnyPractitioner(false); }}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            selectedPractitioner?.id === p.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30 bg-card"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.specialty}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {availablePractitioners.length === 0 && !anyPractitioner && (
                      <p className="text-sm text-muted-foreground mt-4">Selecione "Qualquer profissional disponível" para continuar.</p>
                    )}
                  </div>
                )}

                {/* Step 2: Date */}
                {step === 2 && (
                  <div>
                    <h2 className="text-xl font-bold mb-1">Selecione a data</h2>
                    <p className="text-sm text-muted-foreground mb-5">Escolha uma data nos próximos 14 dias.</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {availableDates.map((d) => {
                        const isSelected = selectedDate?.toDateString() === d.toDateString();
                        const isSaturday = d.getDay() === 6;
                        return (
                          <button
                            key={d.toISOString()}
                            onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30 bg-card"
                            }`}
                          >
                            <p className="text-xs text-muted-foreground capitalize">
                              {d.toLocaleDateString("pt-PT", { weekday: "short" })}
                            </p>
                            <p className="text-lg font-bold">{d.getDate()}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.toLocaleDateString("pt-PT", { month: "short" })}
                            </p>
                            {isSaturday && <Badge variant="secondary" className="text-[9px] mt-1">Até 14h</Badge>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 3: Slots */}
                {step === 3 && (
                  <div>
                    <h2 className="text-xl font-bold mb-1">Selecione o horário</h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      Horários disponíveis para {selectedDate && formatDate(selectedDate)}.
                    </p>
                    {slots.filter((s) => s.status === "available").length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="font-semibold mb-1">Sem horários disponíveis</h3>
                        <p className="text-sm text-muted-foreground mb-4">Não existem slots para esta data.</p>
                        <Button variant="outline" onClick={() => setStep(2)}>Escolher outra data</Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {slots.map((slot) => {
                          const isSelected = selectedSlot?.id === slot.id;
                          const cls = isSelected ? "slot-selected" : slot.status === "available" ? "slot-available" : slot.status === "occupied" ? "slot-occupied" : "slot-unavailable";
                          return (
                            <button
                              key={slot.id}
                              disabled={slot.status !== "available" && !isSelected}
                              onClick={() => setSelectedSlot(isSelected ? null : slot)}
                              className={`py-2.5 px-3 rounded-lg text-sm font-medium ${cls}`}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-primary/30 bg-primary/5" /> Disponível</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-primary bg-primary" /> Selecionado</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-border bg-muted opacity-50" /> Ocupado</span>
                    </div>
                  </div>
                )}

                {/* Step 4: Patient Data */}
                {step === 4 && (
                  <div>
                    <h2 className="text-xl font-bold mb-1">Dados do paciente</h2>
                    <p className="text-sm text-muted-foreground mb-5">Preencha os seus dados para completar a marcação.</p>
                    <div className="space-y-4 max-w-md">
                      <div>
                        <Label htmlFor="name">Nome completo *</Label>
                        <Input id="name" value={patientData.name} onChange={(e) => setPatientData((d) => ({ ...d, name: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" type="email" value={patientData.email} onChange={(e) => setPatientData((d) => ({ ...d, email: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="phone">Telemóvel *</Label>
                        <Input id="phone" type="tel" value={patientData.phone} onChange={(e) => setPatientData((d) => ({ ...d, phone: e.target.value }))} />
                      </div>
                      <div>
                        <Label htmlFor="notes">Observações</Label>
                        <Input id="notes" value={patientData.notes} onChange={(e) => setPatientData((d) => ({ ...d, notes: e.target.value }))} placeholder="Informações adicionais (opcional)" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Review */}
                {step === 5 && (
                  <div>
                    <h2 className="text-xl font-bold mb-1">Confirmar marcação</h2>
                    <p className="text-sm text-muted-foreground mb-5">Reveja todos os detalhes antes de confirmar.</p>
                    <div className="medical-card p-6 space-y-4">
                      {[
                        { label: "Serviço", value: selectedService?.name },
                        { label: "Categoria", value: selectedService && categoryLabels[selectedService.category] },
                        { label: "Profissional", value: anyPractitioner ? "Qualquer disponível" : selectedPractitioner?.name },
                        { label: "Data", value: selectedDate && formatDate(selectedDate) },
                        { label: "Horário", value: selectedSlot?.time },
                        { label: "Duração", value: selectedService && `${selectedService.duration} minutos` },
                        { label: "Local", value: selectedService?.unit },
                        { label: "Paciente", value: patientData.name },
                        { label: "Email", value: patientData.email },
                        { label: "Telemóvel", value: patientData.phone },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-medium text-right">{row.value}</span>
                        </div>
                      ))}
                      {selectedService?.price !== undefined && selectedService.price > 0 && (
                        <div className="flex justify-between text-sm pt-3 border-t">
                          <span className="font-semibold">Valor</span>
                          <span className="font-bold text-primary text-lg">{selectedService.price}€</span>
                        </div>
                      )}
                    </div>

                    {selectedService?.requiresPreparation && selectedService.preparationNotes && (
                      <div className="medical-card p-4 border-warning/30 bg-warning/5 mt-4">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4 text-warning" />
                          <span className="text-sm font-semibold">Preparação</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedService.preparationNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 0}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`gap-1 ${step === 5 ? "medical-gradient border-0 shadow-primary-glow" : ""}`}
              >
                {step === 5 ? (
                  <>
                    <Check className="w-4 h-4" /> Confirmar Marcação
                  </>
                ) : (
                  <>
                    Seguinte <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Summary Panel */}
          <div className="hidden lg:block">
            <div className="sticky top-24 medical-card p-6 space-y-4">
              <h3 className="font-semibold text-sm">Resumo da Marcação</h3>
              <div className="space-y-3">
                {selectedService && (
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                    <span>{selectedService.name}</span>
                  </div>
                )}
                {(selectedPractitioner || anyPractitioner) && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <span>{anyPractitioner ? "Qualquer profissional" : selectedPractitioner?.name}</span>
                  </div>
                )}
                {selectedDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                    <span>{formatDate(selectedDate)}</span>
                  </div>
                )}
                {selectedSlot && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span>{selectedSlot.time}</span>
                  </div>
                )}
                {selectedService?.unit && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span>{selectedService.unit}</span>
                  </div>
                )}
              </div>
              {selectedService?.price !== undefined && selectedService.price > 0 && (
                <div className="pt-3 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Valor</span>
                    <span className="font-bold text-primary">{selectedService.price}€</span>
                  </div>
                </div>
              )}
              {!selectedService && (
                <p className="text-xs text-muted-foreground">Selecione um serviço para começar.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
