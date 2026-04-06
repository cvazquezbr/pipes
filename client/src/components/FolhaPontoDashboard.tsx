import { useState } from "react";
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
  Search
} from "lucide-react";
import { toast } from "sonner";
import type { FolhaPontoResult } from "@/lib/folhaPonto";

interface FolhaPontoDashboardProps {
  results: FolhaPontoResult[];
  onClear: () => void;
}

export function FolhaPontoDashboard({ results, onClear }: FolhaPontoDashboardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [logs, setLogs] = useState<{ cpf: string; status: "success" | "error"; message: string }[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === results.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(results.map(r => r.cpf));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSendEmails = async () => {
    const smtpConfigStr = localStorage.getItem("smtp_config");
    if (!smtpConfigStr) {
      toast.error("Configure o SMTP primeiro!");
      return;
    }
    const smtpConfig = JSON.parse(smtpConfigStr);

    const toSend = results.filter(r => selectedIds.includes(r.cpf) && r.email);
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

        const subject = `Seu Espelho de Ponto - ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;

        let criticasHtml = "";
        if (worker.criticas.length > 0) {
          criticasHtml = `
            <div style="background-color: #fff4f4; border: 1px solid #ffcdd2; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="color: #d32f2f; font-weight: bold; margin-top: 0;">Atenção: Nosso sistema identificou as seguintes pendências que precisam de sua revisão:</p>
              <ul style="color: #5d4037;">
                ${worker.criticas.map(c => `<li>${c.mensagem}</li>`).join('')}
              </ul>
              <p style="font-size: 0.9em; color: #795548;">Por favor, verifique e procure o RH para as devidas justificativas.</p>
            </div>
          `;
        }

        const html = `
          <div style="font-family: sans-serif; color: #333;">
            <p>Olá, <strong>${worker.nome}</strong>,</p>
            <p>Segue em anexo o seu espelho de ponto referente ao último período.</p>
            ${criticasHtml}
            <p>Em caso de dúvidas, estamos à disposição.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 0.8em; color: #999;">Esta é uma mensagem automática, favor não responder.</p>
          </div>
        `;

        const response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            smtpConfig,
            emailData: {
              to: worker.email,
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Resumo do Processamento</h2>
          <p className="text-sm text-slate-500">
            {results.length} registros encontrados • {selectedIds.length} selecionados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClear} className="text-destructive border-destructive/20 hover:bg-destructive/5">
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Dados
          </Button>
          <Button
            onClick={handleSendEmails}
            disabled={isSending || selectedIds.length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Enviar E-mails Selecionados
          </Button>
        </div>
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
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedIds.length === results.length && results.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Status Casamento</TableHead>
              <TableHead>Críticas</TableHead>
              <TableHead className="w-[150px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((res) => {
              const log = logs.find(l => l.cpf === res.cpf);

              return (
                <TableRow key={res.cpf} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(res.cpf)}
                      onCheckedChange={() => toggleSelect(res.cpf)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{res.nome}</div>
                    <div className="text-xs text-slate-500">{res.email || "Sem e-mail"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{res.cpf}</TableCell>
                  <TableCell>
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
                        res.criticas.map((c, i) => (
                          <div key={i} className={`text-[10px] leading-tight ${c.tipo === 'erro' ? 'text-red-600' : 'text-amber-600'} font-medium`}>
                            • {c.mensagem}
                          </div>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <Dialog>
                          <DialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver texto bruto">
                                <Search className="h-4 w-4" />
                             </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                             <DialogHeader>
                                <DialogTitle>Texto Extraído - {res.nome || res.cpf}</DialogTitle>
                                <DialogDescription>Conteúdo bruto obtido do PDF para análise.</DialogDescription>
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
  );
}
