/**
 * PatientsListPage — Patient management
 * 
 * Searchable list of patients with quick actions.
 * Route: /pacientes
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, User, Eye, FileText, Plus } from "lucide-react";
import { getPatients } from "@/data/medical-reports-store";

export default function PatientsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const patients = getPatients();

  const filtered = useMemo(() => {
    if (!search) return patients;
    const q = search.toLowerCase();
    return patients.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.sns.includes(q) ||
      p.phone.includes(q)
    );
  }, [patients, search]);

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Pacientes</h1>
            <p className="text-sm text-muted-foreground">{patients.length} pacientes registados</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, ID, SNS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Data Nasc.</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>SNS</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((patient, i) => (
                <motion.tr
                  key={patient.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/pacientes/${patient.id}`)}
                >
                  <TableCell className="font-mono text-xs">{patient.id}</TableCell>
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell className="text-sm">{new Date(patient.dateOfBirth).toLocaleDateString("pt-PT")}</TableCell>
                  <TableCell className="text-sm">{patient.phone}</TableCell>
                  <TableCell className="text-sm">{patient.sns}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver perfil" onClick={(e) => { e.stopPropagation(); navigate(`/pacientes/${patient.id}`); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Novo relatório" onClick={(e) => { e.stopPropagation(); navigate(`/relatorios?patient=${patient.id}`); }}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {filtered.map((patient, i) => (
            <motion.div
              key={patient.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate(`/pacientes/${patient.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {patient.id} · SNS: {patient.sns}</p>
                  <p className="text-xs text-muted-foreground">{patient.phone}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum paciente encontrado</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
