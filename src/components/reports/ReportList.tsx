/**
 * ReportList — Filterable, sortable list of medical reports
 * 
 * Features:
 * - Filter by status (draft/finalized), type, patient
 * - Sort by date
 * - Click to view/edit
 */

import { useState, useMemo } from "react";
import { MedicalReport, ReportType, ReportStatus, reportTypeLabels, reportStatusLabels } from "@/types/medical-reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, Plus, Eye, Edit, ArrowUpDown } from "lucide-react";
import { motion } from "framer-motion";

interface ReportListProps {
  reports: MedicalReport[];
  onView: (report: MedicalReport) => void;
  onEdit: (report: MedicalReport) => void;
  onCreate: () => void;
  title?: string;
  showPatient?: boolean;
}

export default function ReportList({ reports, onView, onEdit, onCreate, title = "Relatórios Médicos", showPatient = true }: ReportListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = useMemo(() => {
    let result = [...reports];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.doctorName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.diagnosis.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((r) => r.type === typeFilter);
    }

    result.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortDesc ? db - da : da - db;
    });

    return result;
  }, [reports, search, statusFilter, typeFilter, sortDesc]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Relatório
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por paciente, médico, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="finalized">Finalizado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(reportTypeLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum relatório encontrado</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  {showPatient && <TableHead>Paciente</TableHead>}
                  <TableHead>Médico</TableHead>
                  <TableHead>
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setSortDesc(!sortDesc)}>
                      Data <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((report, i) => (
                  <motion.tr
                    key={report.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="font-mono text-xs">{report.id}</TableCell>
                    <TableCell className="text-sm">{reportTypeLabels[report.type]}</TableCell>
                    {showPatient && <TableCell className="font-medium">{report.patientName}</TableCell>}
                    <TableCell className="text-sm">{report.doctorName}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(report.createdAt).toLocaleDateString("pt-PT")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={report.status === "draft" ? "outline" : "default"} className={report.status === "finalized" ? "bg-accent text-accent-foreground text-xs" : "text-xs"}>
                        {reportStatusLabels[report.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(report)} title="Ver">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {report.status === "draft" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(report)} title="Editar">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((report, i) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{report.id}</span>
                  <Badge variant={report.status === "draft" ? "outline" : "default"} className={report.status === "finalized" ? "bg-accent text-accent-foreground text-xs" : "text-xs"}>
                    {reportStatusLabels[report.status]}
                  </Badge>
                </div>
                <p className="font-medium text-sm">{reportTypeLabels[report.type]}</p>
                {showPatient && <p className="text-sm text-muted-foreground">Paciente: {report.patientName}</p>}
                <p className="text-sm text-muted-foreground">{report.doctorName} · {new Date(report.createdAt).toLocaleDateString("pt-PT")}</p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => onView(report)} className="gap-1 flex-1">
                    <Eye className="w-3 h-3" /> Ver
                  </Button>
                  {report.status === "draft" && (
                    <Button variant="outline" size="sm" onClick={() => onEdit(report)} className="gap-1 flex-1">
                      <Edit className="w-3 h-3" /> Editar
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
