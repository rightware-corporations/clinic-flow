/**
 * MedicalReportsPage — Main reports hub
 * 
 * Accessible to doctors and admins.
 * Shows all reports with full filter/sort/search capabilities.
 * Routes to create, edit, and view actions.
 */

import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ReportList from "@/components/reports/ReportList";
import ReportForm from "@/components/reports/ReportForm";
import ReportView from "@/components/reports/ReportView";
import {
  getReports,
  getPatients,
  saveReport,
  generateReportId,
} from "@/data/medical-reports-store";
import { MedicalReport } from "@/types/medical-reports";
import { toast } from "sonner";

type ViewMode = "list" | "create" | "edit" | "view";

export default function MedicalReportsPage() {
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reports = getReports();
  const patients = getPatients();

  // Read current user from localStorage for doctor info
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : { id: "M001", name: "Médico", role: "profissional" };

  // Pre-select patient if coming from patient profile
  const preselectedPatientId = searchParams.get("patient") || "";

  const handleCreate = useCallback(() => {
    setSelectedReport(null);
    setViewMode("create");
  }, []);

  const handleView = useCallback((report: MedicalReport) => {
    setSelectedReport(report);
    setViewMode("view");
  }, []);

  const handleEdit = useCallback((report: MedicalReport) => {
    setSelectedReport(report);
    setViewMode("edit");
  }, []);

  const handleSave = useCallback((data: Partial<MedicalReport>, finalize: boolean) => {
    const isNew = !data.id;
    const report: MedicalReport = {
      id: data.id || generateReportId(),
      type: data.type || "consultation",
      status: finalize ? "finalized" : "draft",
      patientId: data.patientId || "",
      patientName: data.patientName || "",
      doctorId: user.id,
      doctorName: user.name,
      doctorSpecialty: "Medicina Geral", // Would come from doctor profile
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finalizedAt: finalize ? new Date().toISOString() : undefined,
      symptoms: data.symptoms || "",
      diagnosis: data.diagnosis || "",
      observations: data.observations || "",
      treatment: data.treatment || "",
      notes: data.notes || "",
    };

    saveReport(report);
    setRefreshKey((k) => k + 1);

    if (finalize) {
      toast.success("Relatório finalizado com sucesso", { description: `ID: ${report.id}` });
    } else {
      toast.success(isNew ? "Rascunho criado" : "Rascunho atualizado", { description: `ID: ${report.id}` });
    }

    setViewMode("list");
    setSelectedReport(null);
  }, [user]);

  const handleBack = useCallback(() => {
    setViewMode("list");
    setSelectedReport(null);
  }, []);

  return (
    <Layout>
      <div className="container py-8 md:py-12" key={refreshKey}>
        {viewMode === "list" && (
          <ReportList
            reports={reports}
            onView={handleView}
            onEdit={handleEdit}
            onCreate={handleCreate}
          />
        )}

        {viewMode === "create" && (
          <ReportForm
            report={preselectedPatientId ? { patientId: preselectedPatientId } : undefined}
            patients={patients}
            onSave={handleSave}
            onCancel={handleBack}
          />
        )}

        {viewMode === "edit" && selectedReport && (
          <ReportForm
            report={selectedReport}
            patients={patients}
            onSave={handleSave}
            onCancel={handleBack}
            isEditing
          />
        )}

        {viewMode === "view" && selectedReport && (
          <ReportView
            report={selectedReport}
            onBack={handleBack}
            onEdit={selectedReport.status === "draft" ? () => handleEdit(selectedReport) : undefined}
          />
        )}
      </div>
    </Layout>
  );
}
