import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, AlertCircle, ArrowRight, Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import Layout from "@/components/layout/Layout";
import { services, categoryLabels, type ServiceCategory } from "@/data/services";
import { cn } from "@/lib/utils";

const allCategories = Object.keys(categoryLabels) as ServiceCategory[];

// Build combobox options from all services
const serviceOptions = services.map((s) => ({
  value: s.id,
  label: s.name,
  category: s.category,
  slug: s.slug,
}));

export default function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("cat") as ServiceCategory | null;
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = services;
    if (activeCategory) list = list.filter((s) => s.category === activeCategory);
    if (selectedServiceId) list = list.filter((s) => s.id === selectedServiceId);
    return list;
  }, [activeCategory, selectedServiceId]);

  const selectedLabel = selectedServiceId
    ? services.find((s) => s.id === selectedServiceId)?.name
    : null;

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl md:text-4xl font-bold mb-2">Catálogo de Serviços</h1>
          <p className="text-muted-foreground">Explore a nossa oferta completa de cuidados de saúde.</p>
        </motion.div>

        {/* Combobox Search */}
        <div className="flex items-center gap-3 mb-6 max-w-md">
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="w-full justify-between font-normal text-sm h-10"
              >
                {selectedLabel ? (
                  <span className="truncate">{selectedLabel}</span>
                ) : (
                  <span className="text-muted-foreground">Pesquisar serviço...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Escreva para filtrar..." />
                <CommandList>
                  <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                  {allCategories.map((cat) => {
                    const catServices = serviceOptions.filter((s) => s.category === cat);
                    if (catServices.length === 0) return null;
                    return (
                      <CommandGroup key={cat} heading={categoryLabels[cat]}>
                        {catServices.map((s) => (
                          <CommandItem
                            key={s.value}
                            value={s.label}
                            onSelect={() => {
                              setSelectedServiceId(selectedServiceId === s.value ? null : s.value);
                              setComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedServiceId === s.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {s.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    );
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedServiceId && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-10 w-10"
              onClick={() => setSelectedServiceId(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Badge
            variant={!activeCategory ? "default" : "outline"}
            className={`cursor-pointer transition-colors ${!activeCategory ? "medical-gradient border-0 text-primary-foreground" : ""}`}
            onClick={() => { setSearchParams({}); setSelectedServiceId(null); }}
          >
            Todos
          </Badge>
          {allCategories.map((cat) => (
            <Badge
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              className={`cursor-pointer transition-colors ${activeCategory === cat ? "medical-gradient border-0 text-primary-foreground" : ""}`}
              onClick={() => { setSearchParams({ cat }); setSelectedServiceId(null); }}
            >
              {categoryLabels[cat]}
            </Badge>
          ))}
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold mb-1">Sem resultados</h3>
            <p className="text-sm text-muted-foreground">Tente outra pesquisa ou categoria.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((service, i) => (
                <motion.div
                  key={service.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="medical-card overflow-hidden h-full flex flex-col">
                    <div className="p-5 flex-1 flex flex-col">
                      <Badge variant="secondary" className="self-start mb-3 text-xs">
                        {categoryLabels[service.category]}
                      </Badge>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-foreground leading-snug">{service.name}</h3>
                        {service.price !== undefined && service.price > 0 && (
                          <span className="shrink-0 text-sm font-bold text-primary">{service.price}€</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{service.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                        {service.duration > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {service.duration} min
                          </span>
                        )}
                        {service.requiresPreparation && (
                          <span className="flex items-center gap-1 text-warning">
                            <AlertCircle className="w-3.5 h-3.5" /> Preparação
                          </span>
                        )}
                        <span className="text-muted-foreground/60">{service.unit}</span>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/servicos/${service.slug}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full gap-1">
                            Detalhes <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Link to={`/agendar?service=${service.id}`} className="flex-1">
                          <Button size="sm" className="w-full medical-gradient border-0">Agendar</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Layout>
  );
}
