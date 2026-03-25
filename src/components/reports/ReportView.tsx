/**
 * ReportView — Read-only, printable medical report view
 * 
 * Displays a finalized or draft report in a clean, structured layout.
 * Print-friendly: uses @media print styles via Tailwind's print: prefix.
 */

import { MedicalReport, reportTypeLabels, reportStatusLabels } from "@/types/medical-reports";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Edit } from "lucide-react";

interface ReportViewProps {
  report: MedicalReport;
  onBack: () => void;
  onEdit?: () => void;
}

export default function ReportView({ report, onBack, onEdit }: ReportViewProps) {
  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* Actions bar — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="flex gap-2">
          {report.status === "draft" && onEdit && (
            <Button variant="outline" onClick={onEdit} className="gap-2">
              <Edit className="w-4 h-4" />
              Editar
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Report document */}
      <div className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-foreground">
            {reportTypeLabels[report.type]}
          </h1>
          <p className="text-sm text-muted-foreground">ID: {report.id}</p>
          <Badge variant={report.status === "draft" ? "outline" : "default"} className={report.status === "finalized" ? "bg-accent text-accent-foreground" : ""}>
            {reportStatusLabels[report.status]}
          </Badge>
        </div>

        <Separator />

        {/* Patient & Doctor info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Paciente</h3>
            <p className="font-medium text-foreground">{report.patientName}</p>
            <p className="text-sm text-muted-foreground">ID: {report.patientId}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Médico</h3>
            <p className="font-medium text-foreground">{report.doctorName}</p>
            <p className="text-sm text-muted-foreground">{report.doctorSpecialty}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Criado em:</span>{" "}
            <span className="font-medium">{new Date(report.createdAt).toLocaleDateString("pt-PT")} {new Date(report.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Atualizado:</span>{" "}
            <span className="font-medium">{new Date(report.updatedAt).toLocaleDateString("pt-PT")} {new Date(report.updatedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {report.finalizedAt && (
            <div>
              <span className="text-muted-foreground">Finalizado:</span>{" "}
              <span className="font-medium">{new Date(report.finalizedAt).toLocaleDateString("pt-PT")} {new Date(report.finalizedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Clinical sections */}
        <Section title="Sintomas / Queixas" content={report.symptoms} />
        <Section title="Diagnóstico" content={report.diagnosis} />
        <Section title="Observações Clínicas" content={report.observations} />
        <Section title="Tratamento Prescrito" content={report.treatment} />
        {report.notes && <Section title="Notas Adicionais" content={report.notes} />}

        {/* Signature area (print) */}
        <div className="hidden print:block pt-12 space-y-8">
          <Separator />
          <div className="flex justify-between">
            <div className="text-center">
              <div className="border-t border-foreground w-48 pt-2">
                <p className="text-sm font-medium">{report.doctorName}</p>
                <p className="text-xs text-muted-foreground">{report.doctorSpecialty}</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Data: {report.finalizedAt ? new Date(report.finalizedAt).toLocaleDateString("pt-PT") : "___/___/______"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  if (!content) return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground italic">Não preenchido</p>
    </div>
  );

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}
