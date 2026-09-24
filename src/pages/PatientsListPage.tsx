import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, Plus, Search, User } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createPatient, listPatients, type PatientGender, type PatientRecord,
} from "@/lib/clinicflow-api";

type Draft = {
  name: string; dateOfBirth: string; gender: PatientGender; phone: string;
  email: string; address: string; nationalId: string; healthNumber: string;
};
const blank: Draft = {
  name: "", dateOfBirth: "", gender: "NOT_DISCLOSED", phone: "",
  email: "", address: "", nationalId: "", healthNumber: "",
};

export default function PatientsListPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const page = await listPatients(search);
      setPatients(page.items);
      setTotal(page.total);
    } catch {
      toast.error("Não foi possível carregar os pacientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(query), 250);
    return () => window.clearTimeout(handle);
  }, [load, query]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const patient = await createPatient({
        name: draft.name, dateOfBirth: draft.dateOfBirth, gender: draft.gender,
        phone: draft.phone || null, email: draft.email || null,
        address: draft.address || null, nationalId: draft.nationalId || null,
        healthNumber: draft.healthNumber || null,
      });
      toast.success("Paciente registado");
      setDraft(blank);
      setCreateOpen(false);
      await load(query);
      navigate(`/pacientes/${patient.id}`);
    } catch {
      toast.error("Não foi possível registar o paciente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Pacientes</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "A carregar..." : `${total} paciente(s) activo(s)`}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo paciente
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar por nome, telefone ou nº de saúde" className="pl-9" />
        </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Nascimento</TableHead>
              <TableHead>Telefone</TableHead><TableHead>Nº de saúde</TableHead>
              <TableHead className="text-right">Acções</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {patients.map((patient, index) => (
                <motion.tr key={patient.id} initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}
                  className="border-b hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/pacientes/${patient.id}`)}>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell>{new Date(patient.dateOfBirth + "T00:00:00").toLocaleDateString("pt-PT")}</TableCell>
                  <TableCell>{patient.phone || "—"}</TableCell>
                  <TableCell>{patient.healthNumber || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Abrir paciente"
                      onClick={e => { e.stopPropagation(); navigate(`/pacientes/${patient.id}`); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden space-y-3">
          {patients.map(patient => (
            <button key={patient.id} type="button" onClick={() => navigate(`/pacientes/${patient.id}`)}
              className="w-full text-left bg-card border rounded-lg p-4 hover:border-primary/30">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 grid place-items-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div><p className="font-medium">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {patient.phone || "Sem telefone"} · {patient.healthNumber || "Sem nº de saúde"}
                  </p></div>
              </div>
            </button>
          ))}
        </div>

        {!loading && patients.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum paciente encontrado</p>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo paciente</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
            <Field label="Nome completo"><Input required maxLength={160} value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Data de nascimento"><Input required type="date" value={draft.dateOfBirth}
              onChange={e => setDraft({ ...draft, dateOfBirth: e.target.value })} /></Field>
            <Field label="Género">
              <Select value={draft.gender} onValueChange={value => setDraft({ ...draft, gender: value as PatientGender })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_DISCLOSED">Não indicado</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="OTHER">Outro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Telefone"><Input maxLength={40} value={draft.phone}
              onChange={e => setDraft({ ...draft, phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" maxLength={254} value={draft.email}
              onChange={e => setDraft({ ...draft, email: e.target.value })} /></Field>
            <Field label="Nº de saúde"><Input maxLength={100} value={draft.healthNumber}
              onChange={e => setDraft({ ...draft, healthNumber: e.target.value })} /></Field>
            <Field label="Documento de identificação"><Input maxLength={100} value={draft.nationalId}
              onChange={e => setDraft({ ...draft, nationalId: e.target.value })} /></Field>
            <Field label="Morada"><Input maxLength={500} value={draft.address}
              onChange={e => setDraft({ ...draft, address: e.target.value })} /></Field>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "A guardar..." : "Registar paciente"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
