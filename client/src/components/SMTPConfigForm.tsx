import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ShieldCheck, Server } from "lucide-react";

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

  const handleSave = () => {
    localStorage.setItem("smtp_config", JSON.stringify(config));
    toast.success("Configurações de SMTP salvas localmente");
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

        <Button onClick={handleSave} className="w-full">
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  );
}
