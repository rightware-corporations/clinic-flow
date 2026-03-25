/**
 * ReportForm — Structured medical report form
 * 
 * Used for both creating and editing reports.
 * Sections: Patient, Type, Symptoms, Diagnosis, Treatment, Observations, Notes.
 * Supports save as draft and finalize actions.
 * 
 * State flow:
 * - Parent passes initial data + onSave callback
 * - Form manages local state for each field
 * - onSave receives the complete report data
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, FileText, Stethoscope, Pill, ClipboardList, MessageSquare } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MedicalReport,
  ReportType,
  reportTypeLabels,
  reportStatusLabels,
} from "@/types/medical-reports";
import { Patient } from "@/types/medical-reports";

interface ReportFormProps {
  report?: Partial<MedicalReport>;
  patients: Patient[];
  onSave: (report: Partial<MedicalReport>, finalize: boolean) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export default function ReportForm({ report, patients, onSave, onCancel, isEditing }: ReportFormProps) {
  const [type, setType] = useState<ReportType>(report?.type || "consultation");
  const [patientId, setPatientId] = useState(report?.patientId || "");
  const [symptoms, setSymptoms] = useState(report?.symptoms || "");
  const [diagnosis, setDiagnosis] = useState(report?.diagnosis || "");
  const [observations, setObservations] = useState(report?.observations || "");
  const [treatment, setTreatment] = useState(report?.treatment || "");
  const [notes, setNotes] = useState(report?.notes || "");
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const selectedPatient = patients.find((p) => p.id === patientId);
  const isFinalized = report?.status === "finalized";

  const buildReport = (): Partial<MedicalReport> => ({
    ...report,
    type,
    patientId,
    patientName: selectedPatient?.name || report?.patientName || "",
    symptoms,
    diagnosis,
    observations,
    treatment,
    notes,
  });

  const canFinalize = patientId && symptoms && diagnosis && treatment;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {isEditing ? "Editar Relatório" : "Novo Relatório Médico"}
          </h2>
          {report?.id && (
            <p className="text-sm text-muted-foreground">ID: {report.id}</p>
          )}
        </div>
        {report?.status && (
          <Badge variant={report.status === "draft" ? "outline" : "default"} className={report.status === "finalized" ? "bg-accent text-accent-foreground" : ""}>
            {reportStatusLabels[report.status]}
          </Badge>
        )}
      </div>

      {/* Section 1: Report Type & Patient */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Informação Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={type} onValueChange={(v) => setType(v as ReportType)} disabled={isFinalized}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reportTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paciente</Label>
              <Select value={patientId} onValueChange={setPatientId} disabled={isFinalized}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar paciente..." />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedPatient && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="font-medium">Data de Nascimento:</span> {new Date(selectedPatient.dateOfBirth).toLocaleDateString("pt-PT")}</p>
              <p><span className="font-medium">SNS:</span> {selectedPatient.sns}</p>
              <p><span className="font-medium">Telefone:</span> {selectedPatient.phone}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Symptoms */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            Sintomas / Queixas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Descreva os sintomas apresentados pelo paciente..."
            className="min-h-[100px]"
            disabled={isFinalized}
          />
        </CardContent>
      </Card>

      {/* Section 3: Diagnosis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Diagnóstico clínico..."
            className="min-h-[100px]"
            disabled={isFinalized}
          />
        </CardContent>
      </Card>

      {/* Section 4: Observations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Observações Clínicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Exame objetivo, resultados de exames, observações relevantes..."
            className="min-h-[100px]"
            disabled={isFinalized}
          />
        </CardContent>
      </Card>

      {/* Section 5: Treatment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" />
            Tratamento Prescrito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            placeholder="Medicação, terapêuticas, recomendações..."
            className="min-h-[100px]"
            disabled={isFinalized}
          />
        </CardContent>
      </Card>

      {/* Section 6: Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Notas Adicionais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas internas, follow-up, lembretes..."
            className="min-h-[80px]"
            disabled={isFinalized}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      {!isFinalized && (
        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => onSave(buildReport(), false)}
            disabled={!patientId}
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar Rascunho
          </Button>
          <Button
            onClick={() => setFinalizeOpen(true)}
            disabled={!canFinalize}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Finalizar Relatório
          </Button>
        </div>
      )}

      {/* Finalize confirmation */}
      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Após finalização, o relatório não poderá ser editado. Confirma que todos os dados estão corretos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onSave(buildReport(), true); setFinalizeOpen(false); }}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Confirmar e Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
