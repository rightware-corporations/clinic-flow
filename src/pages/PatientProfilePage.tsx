import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArrowLeft, Calendar, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  archivePatient, getPatientRecord, updatePatient,
  type PatientGender, type PatientRecord,
} from "@/lib/clinicflow-api";

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [draft, setDraft] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPatientRecord(id).then(value => { setPatient(value); setDraft(value); })
      .catch(() => toast.error("Paciente não encontrado ou sem acesso"))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !draft) return;
    setSaving(true);
    try {
      const updated = await updatePatient(id, {
        name: draft.name, dateOfBirth: draft.dateOfBirth, gender: draft.gender,
        phone: draft.phone, email: draft.email, address: draft.address,
        nationalId: draft.nationalId, healthNumber: draft.healthNumber,
        version: draft.version,
      });
      setPatient(updated); setDraft(updated); setEditing(false);
      toast.success("Paciente actualizado");
    } catch (error) {
      toast.error(error instanceof Error && error.message.includes("409")
        ? "Este registo foi alterado noutro lugar. Recarregue antes de guardar."
        : "Não foi possível actualizar o paciente");
    } finally { setSaving(false); }
  };

  const archive = async () => {
    if (!id || !patient) return;
    try {
      await archivePatient(id, patient.version);
      toast.success("Paciente arquivado");
      navigate("/pacientes", { replace: true });
    } catch {
      toast.error("Não foi possível arquivar o paciente");
    }
  };

  if (loading) return <DashboardLayout><div className="p-8">A carregar paciente...</div></DashboardLayout>;
  if (!patient || !draft) return <DashboardLayout><div className="p-8">
    <Button variant="outline" onClick={() => navigate("/pacientes")}>Voltar aos pacientes</Button>
  </div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-6">
        <Button variant="ghost" onClick={() => navigate("/pacientes")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Pacientes
        </Button>

        <div className="bg-card border rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 grid place-items-center">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{patient.name}</h1>
                <p className="text-sm text-muted-foreground">Registo {patient.id}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex gap-1 items-center"><Calendar className="w-3.5 h-3.5" />{patient.dateOfBirth}</span>
                  <span className="flex gap-1 items-center"><Phone className="w-3.5 h-3.5" />{patient.phone || "—"}</span>
                  <span className="flex gap-1 items-center"><Mail className="w-3.5 h-3.5" />{patient.email || "—"}</span>
                  <span className="flex gap-1 items-center"><MapPin className="w-3.5 h-3.5" />{patient.address || "—"}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setEditing(value => !value)}>
                <Pencil className="w-4 h-4" /> {editing ? "Cancelar edição" : "Editar"}
              </Button>
              <Button variant="destructive" className="gap-2" onClick={() => setArchiveOpen(true)}>
                <Archive className="w-4 h-4" /> Arquivar
              </Button>
            </div>
          </div>
        </div>

        {editing ? (
          <form onSubmit={save} className="bg-card border rounded-xl p-6 grid md:grid-cols-2 gap-4">
            <Field label="Nome"><Input required value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Data de nascimento"><Input required type="date" value={draft.dateOfBirth}
              onChange={e => setDraft({ ...draft, dateOfBirth: e.target.value })} /></Field>
            <Field label="Género"><Select value={draft.gender}
              onValueChange={value => setDraft({ ...draft, gender: value as PatientGender })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="NOT_DISCLOSED">Não indicado</SelectItem>
                <SelectItem value="F">Feminino</SelectItem><SelectItem value="M">Masculino</SelectItem>
                <SelectItem value="OTHER">Outro</SelectItem></SelectContent>
            </Select></Field>
            <Field label="Telefone"><Input value={draft.phone || ""}
              onChange={e => setDraft({ ...draft, phone: e.target.value || null })} /></Field>
            <Field label="Email"><Input type="email" value={draft.email || ""}
              onChange={e => setDraft({ ...draft, email: e.target.value || null })} /></Field>
            <Field label="Nº de saúde"><Input value={draft.healthNumber || ""}
              onChange={e => setDraft({ ...draft, healthNumber: e.target.value || null })} /></Field>
            <Field label="Documento de identificação"><Input value={draft.nationalId || ""}
              onChange={e => setDraft({ ...draft, nationalId: e.target.value || null })} /></Field>
            <Field label="Morada"><Input value={draft.address || ""}
              onChange={e => setDraft({ ...draft, address: e.target.value || null })} /></Field>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? "A guardar..." : "Guardar alterações"}</Button>
            </div>
          </form>
        ) : (
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold mb-3">Identificação operacional</h2>
            <dl className="grid md:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-muted-foreground">Nº de saúde</dt><dd>{patient.healthNumber || "Não indicado"}</dd></div>
              <div><dt className="text-muted-foreground">Documento</dt><dd>{patient.nationalId || "Não indicado"}</dd></div>
            </dl>
            <div className="mt-6 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Consultas e relatórios clínicos continuarão separados deste registo demográfico
              até os respectivos engines e regras de acesso clínico serem implementados.
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Arquivar paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              O registo deixará de aparecer na lista activa. Não é uma eliminação física.
            </AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={archive}>Arquivar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
