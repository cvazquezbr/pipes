import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  FileWarning,
  Loader2,
  Trash2,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Printer,
  Users,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PDFDocument } from "pdf-lib";
import type { FolhaPontoResult } from "@/lib/folhaPonto";
import { CRITICA_CATEGORIES } from "@/lib/folhaPonto";
import { generateEmailHtml } from "@/lib/emailTemplate";

interface FolhaPontoDashboardProps {
  results: FolhaPontoResult[];
  teamChiefs: Record<string, string>;
  onClear: () => void;
}

export function FolhaPontoDashboard({ results, teamChiefs, onClear }: FolhaPontoDashboardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [logs, setLogs] = useState<{ cpf: string; status: "success" | "error"; message: string }[]>([]);

  // Estados de filtro
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const teams = useMemo(() => {
    return Array.from(new Set(results.map(r => r.equipe || "Sem Equipe"))).sort();
  }, [results]);

  const categories = Object.values(CRITICA_CATEGORIES);

  const filteredResults = useMemo(() => {
    return results.filter(res => {
      // Filtro de Equipe
      if (selectedTeams.length > 0 && !selectedTeams.includes(res.equipe || "Sem Equipe")) {
        return false;
      }

      // Filtro de Status de Cruzamento
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(res.matchStatus)) {
        return false;
      }

      // Filtro de Categorias de Crítica (Pontos de Atenção)
      if (selectedCategories.length > 0) {
        const hasSelectedCategory = res.criticas.some(c => c.categoria && selectedCategories.includes(c.categoria));
        if (!hasSelectedCategory) return false;
      }

      return true;
    });
  }, [results, selectedTeams, selectedCategories, selectedStatuses]);

  const visibleSelectedIds = selectedIds.filter(id =>
    filteredResults.some(r => r.cpf === id)
  );

  const toggleSelectAll = () => {
    if (visibleSelectedIds.length === filteredResults.length) {
      // Deselecionar apenas os que estão visíveis
      setSelectedIds(prev => prev.filter(id => !filteredResults.some(r => r.cpf === id)));
    } else {
      // Adicionar todos os visíveis aos selecionados (evitando duplicatas)
      const newVisibleIds = filteredResults.map(r => r.cpf);
      setSelectedIds(prev => Array.from(new Set([...prev, ...newVisibleIds])));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setExpandedRows(filteredResults.map(r => r.cpf));
  };

  const collapseAll = () => {
    setExpandedRows([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Texto copiado para a área de transferência!");
  };

  const handleSendToChiefs = async () => {
    const smtpConfigStr = localStorage.getItem("smtp_config");
    if (!smtpConfigStr) {
      toast.error("Configure o SMTP primeiro!");
      return;
    }
    const smtpConfig = JSON.parse(smtpConfigStr);

    // Agrupar resultados por equipe
    const teamsMap = new Map<string, FolhaPontoResult[]>();
    results.forEach(res => {
      // Incluir se tiver crítica OU se a folha estiver ausente
      if (res.criticas.length === 0 && res.matchStatus !== "folha_ausente") return;
      const team = res.equipe || "Sem Equipe";
      if (!teamsMap.has(team)) teamsMap.set(team, []);
      teamsMap.get(team)!.push(res);
    });

    const teams = Array.from(teamsMap.keys());
    if (teams.length === 0) {
      toast.error("Nenhuma crítica ou folha ausente encontrada para enviar.");
      return;
    }

    // Validar se todos os chefes existem
    const missingChiefs = teams.filter(t => !teamChiefs[t]);
    if (missingChiefs.length > 0) {
      toast.error(`Chefes não encontrados para as equipes: ${missingChiefs.join(", ")}. Verifique a planilha.`);
      return;
    }

    setIsSending(true);
    setSendProgress(0);
    setLogs([]);

    const totalTeams = teams.length;

    for (let i = 0; i < totalTeams; i++) {
       const teamName = teams[i];
       const chiefEmail = teamChiefs[teamName];
       const teamResults = teamsMap.get(teamName)!;

       // Ordenar alfabeticamente
       teamResults.sort((a, b) => a.nome.localeCompare(b.nome));

       try {
          const subject = `Relatório de Críticas de Ponto - Equipe: ${teamName}`;

          // Concatenar PDFs da equipe
          const mergedPdf = await PDFDocument.create();
          let hasAttachments = false;

          for (const res of teamResults) {
            if (res.pdfBuffer) {
              const doc = await PDFDocument.load(res.pdfBuffer);
              const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
              copiedPages.forEach((page) => mergedPdf.addPage(page));
              hasAttachments = true;
            }
          }

          let attachments = [];
          if (hasAttachments) {
            const mergedPdfBytes = await mergedPdf.save();
            const base64Content = btoa(
              new Uint8Array(mergedPdfBytes)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            attachments.push({
              filename: `Espelhos_de_Ponto_Equipe_${teamName.replace(/\s+/g, '_')}.pdf`,
              content: base64Content
            });
          }

          const teamBoxes = teamResults.map(res => {
            const items = [];
            if (res.matchStatus === "folha_ausente") {
              items.push({ label: "Status", value: "Folha de ponto não encontrada no PDF" });
            }
            res.criticas.forEach(c => {
              items.push({ label: c.tipo === 'erro' ? "Crítica" : "Alerta", value: c.mensagem });
            });

            return {
              title: res.nome,
              items
            };
          });

          const teamHtml = generateEmailHtml({
            title: `Relatório de Críticas - Equipe ${teamName}`,
            description: `Olá. Identificamos pendências nos espelhos de ponto dos colaboradores da sua equipe. Por favor, verifique os detalhes abaixo e as folhas em anexo.`,
            boxes: teamBoxes
          });

          const response = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              smtpConfig,
              emailData: {
                to: chiefEmail,
                cc: smtpConfig.ccEmail,
                replyTo: smtpConfig.ccEmail,
                subject,
                html: teamHtml,
                attachments
              }
            })
          });

          const res = await response.json();
          if (!res.success) {
            toast.error(`Erro ao enviar para chefe da equipe ${teamName}: ${res.error}`);
          }
       } catch (e: any) {
         toast.error(`Erro ao processar envio para ${teamName}: ${e.message}`);
         console.error(e);
       }
       setSendProgress(Math.round(((i + 1) / totalTeams) * 100));
    }

    setIsSending(false);
    toast.success("Envio para chefes finalizado.");
  };

  const handleSendEmails = async () => {
    const smtpConfigStr = localStorage.getItem("smtp_config");
    if (!smtpConfigStr) {
      toast.error("Configure o SMTP primeiro!");
      return;
    }
    const smtpConfig = JSON.parse(smtpConfigStr);

    const toSend = filteredResults.filter(r => selectedIds.includes(r.cpf) && r.email);
    if (toSend.length === 0) {
      toast.error("Selecione funcionários com e-mail cadastrado.");
      return;
    }

    setIsSending(true);
    setSendProgress(0);
    setLogs([]);

    for (let i = 0; i < toSend.length; i++) {
      const worker = toSend[i];
      try {
        // Converter buffer para base64 para o anexo
        let attachments = [];
        if (worker.pdfBuffer) {
           const base64Content = btoa(
             new Uint8Array(worker.pdfBuffer)
               .reduce((data, byte) => data + String.fromCharCode(byte), '')
           );
           attachments.push({
             filename: `Espelho_Ponto_${worker.cpf}.pdf`,
             content: base64Content
           });
        }

        const monthYear = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const subject = `Seu Espelho de Ponto - ${monthYear.charAt(0).toUpperCase() + monthYear.slice(1)}`;

        const boxes = [
          {
            title: "Dados do Colaborador",
            items: [
              { label: "Nome", value: worker.nome },
              { label: "CPF", value: worker.cpf },
              { label: "Período", value: monthYear }
            ]
          }
        ];

        if (worker.criticas.length > 0) {
          boxes.push({
            title: "Pontos de Atenção",
            items: worker.criticas.map(c => ({
              label: c.tipo === 'erro' ? "Crítica" : "Alerta",
              value: c.mensagem
            }))
          });
        }

        const html = generateEmailHtml({
          title: "Espelho de Ponto Disponível",
          description: `Olá, ${worker.nome.split(' ')[0]}. Identificamos que seu espelho de ponto já está disponível para conferência. Por favor, verifique o documento em anexo e os detalhes abaixo.`,
          boxes
        });

        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            smtpConfig,
            emailData: {
              to: worker.email,
              cc: smtpConfig.ccEmail,
              replyTo: smtpConfig.ccEmail,
              subject,
              html,
              attachments
            }
          })
        });

        const res = await response.json();
        if (res.success) {
          setLogs(prev => [...prev, { cpf: worker.cpf, status: "success", message: "Enviado com sucesso" }]);
        } else {
          setLogs(prev => [...prev, { cpf: worker.cpf, status: "error", message: res.error || "Erro desconhecido" }]);
        }
      } catch (e: any) {
        setLogs(prev => [...prev, { cpf: worker.cpf, status: "error", message: e.message }]);
      }
      setSendProgress(Math.round(((i + 1) / toSend.length) * 100));
    }

    setIsSending(false);
    toast.success("Processo de envio finalizado.");
  };

  const resultsByTeam = filteredResults.reduce((acc, res) => {
     const team = res.equipe || "Sem Equipe";
     if (!acc[team]) acc[team] = [];
     acc[team].push(res);
     return acc;
  }, {} as Record<string, FolhaPontoResult[]>);

  const sortedTeams = Object.keys(resultsByTeam).sort();

  return (
    <div className="space-y-4">
      {/* Visualização de Impressão (Oculta na Web) */}
      <div className="hidden print:block space-y-8 p-4">
         {sortedTeams.map((team, tIdx) => (
            <div key={team} className={tIdx > 0 ? "page-break-before" : ""}>
               <div style={{ pageBreakBefore: tIdx > 0 ? 'always' : 'auto' }}>
                  <div className="border-b-2 border-slate-900 pb-2 mb-4 flex justify-between items-end">
                     <div>
                        <h1 className="text-2xl font-bold uppercase">Relatório de Críticas de Ponto</h1>
                        <p className="text-sm font-semibold">Equipe: {team}</p>
                     </div>
                     <div className="text-right text-[10px]">
                        <p>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                        <p>Chefia: {teamChiefs[team] || "Não cadastrada"}</p>
                     </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px] border border-slate-300">Funcionário</TableHead>
                        <TableHead className="border border-slate-300">Detalhamento das Críticas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultsByTeam[team].map((res) => (
                        <TableRow key={res.cpf}>
                          <TableCell className="font-bold border border-slate-300 align-top">
                            {res.nome}
                            <div className="text-[9px] font-normal text-slate-500">CPF: {res.cpf}</div>
                          </TableCell>
                          <TableCell className="border border-slate-300">
                             {res.criticas.length === 0 ? (
                               <span className="text-green-600 text-[10px]">Sem pendências</span>
                             ) : (
                               <ul className="list-disc list-inside space-y-1">
                                 {res.criticas.map((c, i) => (
                                   <li key={i} className="text-[10px] text-slate-800">
                                     {c.mensagem}
                                   </li>
                                 ))}
                               </ul>
                             )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                     Documento gerado para conferência interna.
                  </div>
               </div>
            </div>
         ))}
      </div>

      {/* Visualização Web */}
      <div className="print:hidden space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Resumo do Processamento</h2>
          <p className="text-sm text-slate-500">
            {filteredResults.length} de {results.length} registros exibidos • {visibleSelectedIds.length} selecionados
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 relative">
                <Filter className="h-4 w-4" />
                Filtros
                {(selectedTeams.length > 0 || selectedCategories.length > 0 || selectedStatuses.length > 0) && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center">
                    {selectedTeams.length + selectedCategories.length + selectedStatuses.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
                <SheetDescription>
                  Refine a lista de funcionários exibida.
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
                <div className="space-y-6">
                  {/* Status do Cruzamento */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Status do Cruzamento</h3>
                    <div className="space-y-2">
                      {[
                        { id: "encontrado", label: "Match" },
                        { id: "folha_ausente", label: "Folha Ausente" },
                        { id: "cpf_extra", label: "CPF Extra" },
                      ].map((status) => (
                        <div key={status.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${status.id}`}
                            checked={selectedStatuses.includes(status.id)}
                            onCheckedChange={(checked) => {
                              setSelectedStatuses(prev =>
                                checked ? [...prev, status.id] : prev.filter(s => s !== status.id)
                              );
                            }}
                          />
                          <label htmlFor={`status-${status.id}`} className="text-sm font-medium leading-none cursor-pointer">
                            {status.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Pontos de Atenção */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Pontos de Atenção</h3>
                    <div className="space-y-2">
                      {categories.map((cat) => (
                        <div key={cat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`cat-${cat}`}
                            checked={selectedCategories.includes(cat)}
                            onCheckedChange={(checked) => {
                              setSelectedCategories(prev =>
                                checked ? [...prev, cat] : prev.filter(c => c !== cat)
                              );
                            }}
                          />
                          <label htmlFor={`cat-${cat}`} className="text-sm font-medium leading-none cursor-pointer">
                            {cat}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Equipes */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Equipes</h3>
                    <div className="space-y-2">
                      {teams.map((team) => (
                        <div key={team} className="flex items-center space-x-2">
                          <Checkbox
                            id={`team-${team}`}
                            checked={selectedTeams.includes(team)}
                            onCheckedChange={(checked) => {
                              setSelectedTeams(prev =>
                                checked ? [...prev, team] : prev.filter(t => t !== team)
                              );
                            }}
                          />
                          <label htmlFor={`team-${team}`} className="text-sm font-medium leading-none cursor-pointer">
                            {team}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="mt-auto pt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedTeams([]);
                    setSelectedCategories([]);
                    setSelectedStatuses([]);
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir Relatório
          </Button>
          <Button variant="outline" onClick={onClear} className="text-destructive border-destructive/20 hover:bg-destructive/5">
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Dados
          </Button>
          <Button
            onClick={handleSendToChiefs}
            disabled={isSending}
            variant="secondary"
            className="gap-2"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Enviar p/ Chefes
          </Button>
          <Button
            onClick={handleSendEmails}
            disabled={isSending || visibleSelectedIds.length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Enviar Selecionados
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-8">
           Expandir Tudo
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-8">
           Colapsar Tudo
        </Button>
      </div>

      {isSending && (
        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Enviando e-mails...</span>
            <span>{sendProgress}%</span>
          </div>
          <Progress value={sendProgress} />
        </div>
      )}

      <div className="rounded-md border bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="w-[50px] print:hidden">
                <Checkbox
                  checked={filteredResults.length > 0 && visibleSelectedIds.length === filteredResults.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead className="print:hidden">CPF</TableHead>
              <TableHead className="print:hidden">Equipe</TableHead>
              <TableHead className="print:hidden">Status</TableHead>
              <TableHead>Críticas</TableHead>
              <TableHead className="w-[150px] print:hidden">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.map((res) => {
              const log = logs.find(l => l.cpf === res.cpf);
              const isExpanded = expandedRows.includes(res.cpf);
              const erros = res.criticas.filter(c => c.tipo === 'erro').length;
              const alertas = res.criticas.filter(c => c.tipo === 'alerta').length;

              return (
                <TableRow key={res.cpf} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="print:hidden">
                    <Checkbox
                      checked={selectedIds.includes(res.cpf)}
                      onCheckedChange={() => toggleSelect(res.cpf)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{res.nome}</div>
                    <div className={`text-xs print:hidden ${res.email ? "text-slate-500" : "text-red-500 font-bold flex items-center gap-1"}`}>
                      {res.email || (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          Sem e-mail cadastrado
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs print:hidden">{res.cpf}</TableCell>
                  <TableCell className="text-xs print:hidden">
                    <Badge variant="secondary" className="font-normal">{res.equipe}</Badge>
                  </TableCell>
                  <TableCell className="print:hidden">
                    {res.matchStatus === "encontrado" ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Match
                      </Badge>
                    ) : res.matchStatus === "folha_ausente" ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                        <FileWarning className="h-3 w-3" /> Folha Ausente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                        <AlertCircle className="h-3 w-3" /> CPF Extra
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {res.criticas.length === 0 ? (
                        <span className="text-green-600 text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Tudo certo
                        </span>
                      ) : (
                        <div className="space-y-2">
                           <button
                             onClick={() => toggleRow(res.cpf)}
                             className="flex items-center gap-2 text-xs font-semibold hover:opacity-70 transition-opacity print:hidden"
                           >
                             {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                             <span className={erros > 0 ? "text-red-600" : "text-amber-600"}>
                                {erros > 0 && `${erros} ${erros === 1 ? 'Erro' : 'Erros'}`}
                                {erros > 0 && alertas > 0 && " / "}
                                {alertas > 0 && `${alertas} ${alertas === 1 ? 'Alerta' : 'Alertas'}`}
                             </span>
                           </button>

                           {(isExpanded || window.location.search.includes('print')) && (
                             <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200 print:block">
                               {res.criticas.map((c, i) => (
                                 <div key={i} className={`text-[10px] leading-tight ${c.tipo === 'erro' ? 'text-red-600' : 'text-amber-600'} font-medium`}>
                                   • {c.mensagem}
                                 </div>
                               ))}
                             </div>
                           )}

                           <div className="hidden print:block space-y-1">
                              {res.criticas.map((c, i) => (
                                <div key={i} className="text-[10px] leading-tight text-slate-800">
                                  • {c.mensagem}
                                </div>
                              ))}
                           </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="print:hidden">
                    <div className="flex items-center gap-2">
                       <Dialog>
                          <DialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver texto bruto">
                                <Search className="h-4 w-4" />
                             </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                             <DialogHeader className="flex flex-row items-center justify-between">
                                <div>
                                   <DialogTitle>Texto Extraído - {res.nome || res.cpf}</DialogTitle>
                                   <DialogDescription>Conteúdo bruto obtido do PDF para análise.</DialogDescription>
                                </div>
                                <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => copyToClipboard(res.rawText)}
                                   className="h-8"
                                >
                                   <Copy className="h-4 w-4 mr-2" />
                                   Copiar Texto
                                </Button>
                             </DialogHeader>
                             <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-md font-mono text-[10px] whitespace-pre-wrap border">
                                {res.rawText || "Nenhum texto extraído."}
                             </div>
                          </DialogContent>
                       </Dialog>

                      {log && (
                        <div className={`text-[10px] font-bold ${log.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {log.message}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
