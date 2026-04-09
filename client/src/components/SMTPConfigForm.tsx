import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ShieldCheck, Server, Loader2 } from "lucide-react";
import { generateEmailHtml } from "@/lib/emailTemplate";

export interface SMTPConfig {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  ccEmail?: string;
}

const DEFAULT_CONFIG: SMTPConfig = {
  host: "",
  port: "587",
  secure: false,
  user: "",
  pass: "",
  fromName: "RH - Folha de Ponto",
  ccEmail: "",
};

export function SMTPConfigForm() {
  const [config, setConfig] = useState<SMTPConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const saved = localStorage.getItem("smtp_config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar SMTP config", e);
      }
    }
  }, []);

  const [isTesting, setIsTesting] = useState(false);

  const handleSave = () => {
    localStorage.setItem("smtp_config", JSON.stringify(config));
    toast.success("Configurações de SMTP salvas localmente");
  };

  const handleTest = async () => {
    if (!config.user || !config.host) {
      toast.error("Preencha o e-mail e o host para testar.");
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpConfig: config,
          emailData: {
            to: config.user,
            cc: config.ccEmail,
            replyTo: config.ccEmail,
            subject: "Teste de Configuração SMTP - Sistema de Ponto",
            html: generateEmailHtml({
              title: "Teste de Conexão Bem-sucedido!",
              description: "Olá, este é um e-mail de teste enviado pelo Sistema de Gestão de Ponto da FATTO. Se você recebeu esta mensagem, suas configurações de SMTP estão funcionando corretamente.",
              boxes: [
                {
                  title: "Detalhes da Configuração",
                  items: [
                    { label: "Servidor", value: config.host },
                    { label: "Porta", value: config.port },
                    { label: "Usuário", value: config.user },
                    { label: "Data do Teste", value: new Date().toLocaleString('pt-BR') },
                    ...(config.ccEmail ? [{ label: "E-mail em Cópia (CC)", value: config.ccEmail }] : [])
                  ]
                }
              ]
            })
          }
        })
      });

      const res = await response.json();
      if (res.success) {
        toast.success("E-mail de teste enviado com sucesso! Verifique sua caixa de entrada e spam.");
      } else {
        toast.error("Erro ao enviar teste: " + (res.error || "Verifique as configurações."));
      }
    } catch (e: any) {
      toast.error("Erro de conexão: " + e.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          Configuração de E-mail (SMTP)
        </CardTitle>
        <CardDescription>
          Estes dados ficam salvos apenas no seu navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Servidor SMTP (Host)</Label>
            <Input
              placeholder="smtp.exemplo.com"
              value={config.host}
              onChange={e => setConfig({...config, host: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label>Porta</Label>
            <Input
              placeholder="587"
              value={config.port}
              onChange={e => setConfig({...config, port: e.target.value})}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="secure"
            checked={config.secure}
            onCheckedChange={checked => setConfig({...config, secure: checked})}
          />
          <Label htmlFor="secure" className="flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" /> SSL/TLS (Porta 465)
          </Label>
        </div>

        <div className="space-y-2">
          <Label>Usuário / E-mail</Label>
          <Input
            placeholder="seu-email@dominio.com"
            value={config.user}
            onChange={e => setConfig({...config, user: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <Label>Senha</Label>
          <Input
            type="password"
            placeholder="Sua senha ou senha de app"
            value={config.pass}
            onChange={e => setConfig({...config, pass: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <Label>Nome do Remetente</Label>
          <Input
            placeholder="RH Empresa"
            value={config.fromName}
            onChange={e => setConfig({...config, fromName: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <Label>E-mail em Cópia (CC)</Label>
          <Input
            placeholder="copia-rh@empresa.com"
            value={config.ccEmail}
            onChange={e => setConfig({...config, ccEmail: e.target.value})}
          />
          <p className="text-[10px] text-slate-500">Este e-mail receberá uma cópia de todos os envios.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={isTesting} className="flex-1">
            {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Testar Conexão
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
