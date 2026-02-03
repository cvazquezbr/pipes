/**
 * Componente para exibição de dados extraídos em tabela
 * Permite edição manual, visualização de erros e exportação
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, Download, Eye, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ExtractedInvoice } from '@/lib/types';

interface ResultsTableProps {
  invoices: ExtractedInvoice[];
  onInvoiceUpdate?: (index: number, invoice: ExtractedInvoice) => void;
  onInvoiceDelete?: (index: number) => void;
  onExport?: (format: 'csv' | 'json' | 'xlsx' | 'zoho-excel') => void;
  isLoading?: boolean;
}

function formatCurrency(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function ResultsTable({
  invoices,
  onInvoiceUpdate,
  onInvoiceDelete,
  onExport,
  isLoading = false,
}: ResultsTableProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);

  if (invoices.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhuma nota fiscal processada ainda</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const successCount = invoices.filter((inv) => (inv.extractionErrors?.length || 0) === 0).length;
  const errorCount = invoices.length - successCount;

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resultados do Processamento</CardTitle>
              <CardDescription>
                {successCount} sucesso • {errorCount} com erros
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport?.('csv')}
                disabled={isLoading}
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport?.('xlsx')}
                disabled={isLoading}
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport?.('json')}
                disabled={isLoading}
              >
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => onExport?.('zoho-excel')}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                <Download className="mr-2 h-4 w-4" />
                ZOHO Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden flex flex-col max-h-[65vh]">
        <div className="overflow-auto flex-1">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="w-32 bg-slate-50">Arquivo</TableHead>
              <TableHead className="w-24">NFS-e</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-40">Emitente</TableHead>
              <TableHead className="w-40">Tomador</TableHead>
              <TableHead className="w-28">Valor Líquido</TableHead>
              <TableHead className="w-20">Confiança</TableHead>
              <TableHead className="w-24 text-right bg-slate-50">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice, idx) => (
              <TableRow key={idx} className={invoice.extractionErrors?.length ? 'bg-destructive/5' : ''}>
                <TableCell className="text-xs truncate">{invoice.filename}</TableCell>
                <TableCell className="font-mono text-sm">{invoice.nfsNumber || '-'}</TableCell>
                <TableCell className="text-xs">
                  {invoice.isCancelled ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                      Void
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                      Draft
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs truncate">{invoice.issuerName || '-'}</TableCell>
                <TableCell className="text-xs truncate">{invoice.takerName || '-'}</TableCell>
                <TableCell className="font-mono text-sm">
                  {formatCurrency(invoice.netValue)}
                </TableCell>
                <TableCell className="text-xs">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      invoice.extractionConfidence >= 0.8
                        ? 'bg-green-100 text-green-800'
                        : invoice.extractionConfidence >= 0.5
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {(invoice.extractionConfidence * 100).toFixed(0)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedInvoice(idx)}
                      disabled={isLoading}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onInvoiceDelete?.(idx)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>

      {selectedInvoice !== null && (
        <InvoiceDetailDialog
          invoice={invoices[selectedInvoice]}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

interface InvoiceDetailDialogProps {
  invoice: ExtractedInvoice;
  onClose: () => void;
}

function InvoiceDetailDialog({ invoice, onClose }: InvoiceDetailDialogProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Nota Fiscal</DialogTitle>
          <DialogDescription>{invoice.filename}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {invoice.extractionErrors && invoice.extractionErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Erros na extração:</p>
                  <ul className="list-disc list-inside text-sm">
                    {invoice.extractionErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-4 gap-4">
            <DetailField label="Número NFS-e" value={invoice.nfsNumber} />
            <DetailField label="Série" value={invoice.seriesNumber} />
            <DetailField label="Data Emissão" value={invoice.emissionDate} />
            <DetailField label="Hora Emissão" value={invoice.emissionTime} />
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Emitente (Prestador)</h3>
            <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
              <DetailField label="Nome" value={invoice.issuerName} />
              <DetailField label="CNPJ" value={invoice.issuerCNPJ} />
              <DetailField label="Telefone" value={invoice.issuerPhone} />
              <DetailField label="Endereço" value={invoice.issuerAddress} />
              <DetailField label="Cidade" value={invoice.issuerCity} />
              <DetailField label="Estado" value={invoice.issuerState} />
              <DetailField label="CEP" value={invoice.issuerCEP} />
              <DetailField label="E-mail" value={invoice.issuerEmail} />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Tomador (Cliente)</h3>
            <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
              <DetailField label="Nome" value={invoice.takerName} />
              <DetailField label="CNPJ" value={invoice.takerCNPJ} />
              <DetailField label="Endereço" value={invoice.takerAddress} />
              <DetailField label="Cidade" value={invoice.takerCity} />
              <DetailField label="Estado" value={invoice.takerState} />
              <DetailField label="CEP" value={invoice.takerCEP} />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Serviço</h3>
            <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
              <DetailField label="Código" value={invoice.serviceCode} />
              <DetailField label="Descrição" value={invoice.serviceDescription} className="col-span-2" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Valores e Impostos</h3>
            <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
              <DetailField label="Valor Serviço" value={formatCurrency(invoice.serviceValue)} />
              <DetailField label="Deduções" value={formatCurrency(invoice.deductions)} />
              <DetailField label="IRRF" value={formatCurrency(invoice.irrf)} />
              <DetailField label="PIS" value={formatCurrency(invoice.pis)} />
              <DetailField label="COFINS" value={formatCurrency(invoice.cofins)} />
              <DetailField label="CSLL" value={formatCurrency(invoice.csll)} />
              <DetailField label="Total Impostos" value={formatCurrency(invoice.totalTaxes)} className="font-semibold" />
              <DetailField
                label="Valor Líquido"
                value={formatCurrency(invoice.netValue)}
                className="font-semibold col-span-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">ISSQN - Detalhes</h3>
            <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-blue-500 bg-blue-50 p-4 rounded">
              <DetailField label="Base de Cálculo" value={formatCurrency(invoice.issqnBase)} />
              <DetailField label="ISSQN Apurado" value={formatCurrency(invoice.issqnApurado)} className="font-semibold" />
              <DetailField label="Alíquota Aplicada" value={invoice.issqnAliquota} />
              <DetailField label="Suspensão da Exigibilidade" value={invoice.issqnSuspensao} />
              <DetailField label="Município de Incidência" value={invoice.issqnMunicipio} />
              <DetailField label="Tributação do ISSQN" value={invoice.issqnTributacao} />
              <DetailField label="ISSQN Retido" value={formatCurrency(invoice.issqnRetido)} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DetailFieldProps {
  label: string;
  value: string | number | undefined;
  className?: string;
}

function DetailField({ label, value, className = '' }: DetailFieldProps) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || '-'}</p>
    </div>
  );
}
