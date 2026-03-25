import { motion } from "framer-motion";
import { Building2, Users, CalendarDays, ShieldCheck, Globe, Activity, Lock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";

const globalStats = [
  { label: "Unidades", value: "3", icon: Building2 },
  { label: "Total Profissionais", value: "30", icon: Users },
  { label: "Marcações (mês)", value: "2,847", icon: CalendarDays },
  { label: "Pacientes Ativos", value: "4,521", icon: Activity },
];

const units = [
  { name: "Unidade Central", location: "Lisboa", practitioners: 12, todayAppts: 34 },
  { name: "Unidade Norte", location: "Porto", practitioners: 10, todayAppts: 28 },
  { name: "Unidade Sul", location: "Faro", practitioners: 8, todayAppts: 18 },
];

export default function SuperDashboard() {
  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Painel Super Admin</h1>
            <p className="text-muted-foreground text-sm">Visão global multi-unidade</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1"><Lock className="w-4 h-4" /> Permissões</Button>
        </div>

        {/* Global Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {globalStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="medical-card p-5"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="units" className="space-y-6">
          <TabsList>
            <TabsTrigger value="units">Unidades</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
          </TabsList>

          <TabsContent value="units">
            <div className="grid md:grid-cols-3 gap-4">
              {units.map((unit, i) => (
                <motion.div
                  key={unit.name}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="medical-card p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">{unit.name}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Localização</span>
                      <span className="font-medium">{unit.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Profissionais</span>
                      <span className="font-medium">{unit.practitioners}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Marcações hoje</span>
                      <span className="font-medium">{unit.todayAppts}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4">Ver detalhes</Button>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <div className="text-center py-16">
              <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-1">Registo de Auditoria</h3>
              <p className="text-sm text-muted-foreground">Log de ações disponível em breve.</p>
            </div>
          </TabsContent>

          <TabsContent value="permissions">
            <div className="text-center py-16">
              <Lock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-1">Gestão de Permissões</h3>
              <p className="text-sm text-muted-foreground">Painel de permissões disponível em breve.</p>
            </div>
          </TabsContent>

          <TabsContent value="metrics">
            <div className="text-center py-16">
              <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-1">Métricas Globais</h3>
              <p className="text-sm text-muted-foreground">Dashboard de métricas disponível em breve.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
