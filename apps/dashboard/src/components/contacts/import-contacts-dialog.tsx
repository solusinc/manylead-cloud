"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@manylead/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@manylead/ui/dialog";
import { Switch } from "@manylead/ui/switch";
import { Label } from "@manylead/ui/label";
import { ScrollArea } from "@manylead/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@manylead/ui/alert";
import { Badge } from "@manylead/ui/badge";

import { cn } from "@manylead/ui";

import { useTRPC } from "~/lib/trpc/react";

interface ParsedContact {
  phoneNumber: string;
  name: string;
  customFields?: Record<string, string>;
  isValid: boolean;
  error?: string;
}

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PHONE_REGEX = /^\+\d{10,15}$/;
const MAX_CONTACTS = 2000;

export function ImportContactsDialog({
  open,
  onOpenChange,
}: ImportContactsDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [parsing, setParsing] = useState(false);

  const validContacts = parsedContacts.filter((c) => c.isValid);
  const invalidContacts = parsedContacts.filter((c) => !c.isValid);

  const importMutation = useMutation(
    trpc.contacts.importContacts.mutationOptions({
      onSuccess: (result) => {
        void queryClient.invalidateQueries({ queryKey: [["contacts"]] });
        toast.success(
          `Importação concluída: ${result.imported} importados, ${result.updated} atualizados, ${result.skipped} ignorados`,
        );
        handleClose();
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao importar contatos");
      },
    }),
  );

  const parseFile = useCallback(async (file: File) => {
    setParsing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        toast.error("Arquivo vazio ou inválido");
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        toast.error("Planilha não encontrada");
        return;
      }

      const jsonDataRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        blankrows: false,
        defval: "",
      });

      if (jsonDataRaw.length === 0) {
        toast.error("Nenhum dado encontrado na planilha");
        return;
      }

      // Detectar colunas de telefone e nome
      const firstRow = jsonDataRaw[0];
      if (!firstRow) {
        toast.error("Planilha vazia");
        return;
      }

      const columns = Object.keys(firstRow);
      const phoneColumn = columns.find((col) =>
        /telefone|phone|celular|número|numero|whatsapp/i.test(col),
      );
      const nameColumn = columns.find((col) => /nome|name/i.test(col));

      if (!phoneColumn) {
        toast.error(
          'Coluna de telefone não encontrada. Use "Telefone" ou "Phone" como nome da coluna.',
        );
        return;
      }

      if (!nameColumn) {
        toast.error(
          'Coluna de nome não encontrada. Use "Nome" ou "Name" como nome da coluna.',
        );
        return;
      }

      // Filtrar linhas que têm pelo menos telefone ou nome preenchido
      const jsonData = jsonDataRaw.filter((row) => {
        const phone = row[phoneColumn];
        const name = row[nameColumn];
        return (
          (phone !== undefined && phone !== null && phone !== "") ||
          (name !== undefined && name !== null && name !== "")
        );
      });

      if (jsonData.length === 0) {
        toast.error("Nenhum contato válido encontrado na planilha");
        return;
      }

      if (jsonData.length > MAX_CONTACTS) {
        toast.error(`Limite de ${MAX_CONTACTS} contatos por importação`);
        return;
      }

      // Colunas extras para customFields
      const extraColumns = columns.filter(
        (col) => col !== phoneColumn && col !== nameColumn,
      );

      const contacts: ParsedContact[] = jsonData.map((row) => {
        const phoneValue = row[phoneColumn];
        const nameValue = row[nameColumn];
        const phoneRaw = (
          phoneValue !== undefined && phoneValue !== null
            ? `${phoneValue as string | number}`
            : ""
        ).trim();
        const name = (
          nameValue !== undefined && nameValue !== null
            ? `${nameValue as string | number}`
            : ""
        ).trim();

        // Validar telefone
        const phoneNumber = phoneRaw;
        let isValid = true;
        let error: string | undefined;

        if (!phoneNumber) {
          isValid = false;
          error = "Telefone vazio";
        } else if (!phoneNumber.startsWith("+")) {
          isValid = false;
          error = "Telefone deve começar com +";
        } else if (!PHONE_REGEX.test(phoneNumber)) {
          isValid = false;
          error = "Formato inválido. Use +5511988884444";
        }

        if (!name) {
          isValid = false;
          error = error ? `${error}, Nome vazio` : "Nome vazio";
        }

        // Extrair campos extras
        const customFields: Record<string, string> = {};
        for (const col of extraColumns) {
          const value = row[col];
          if (value !== undefined && value !== null && value !== "") {
            customFields[col] = `${value as string | number}`;
          }
        }

        return {
          phoneNumber,
          name,
          customFields:
            Object.keys(customFields).length > 0 ? customFields : undefined,
          isValid,
          error,
        };
      });

      setParsedContacts(contacts);
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      toast.error("Erro ao processar arquivo");
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        setFile(file);
        void parseFile(file);
      }
    },
    [parseFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  const handleClose = () => {
    setFile(null);
    setParsedContacts([]);
    setOverwrite(false);
    onOpenChange(false);
  };

  const handleImport = () => {
    if (validContacts.length === 0) {
      toast.error("Nenhum contato válido para importar");
      return;
    }

    importMutation.mutate({
      contacts: validContacts.map((c) => ({
        phoneNumber: c.phoneNumber,
        name: c.name,
        customFields: c.customFields,
      })),
      overwrite,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Importe contatos de uma planilha CSV ou Excel (XLSX).
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={cn(
                "border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
                isDragActive && "border-primary bg-primary/5",
              )}
            >
              <input {...getInputProps()} />
              <Upload className="text-muted-foreground mb-4 h-10 w-10" />
              <p className="text-muted-foreground mb-2 text-sm">
                {isDragActive
                  ? "Solte o arquivo aqui..."
                  : "Arraste um arquivo CSV ou XLSX ou clique para selecionar"}
              </p>
              <p className="text-muted-foreground text-xs">
                Limite de {MAX_CONTACTS.toLocaleString()} contatos por importação
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Regras de importação</AlertTitle>
              <AlertDescription className="text-xs">
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>
                    O telefone precisa seguir exatamente o padrão{" "}
                    <code className="bg-muted rounded px-1">+5511988884444</code>{" "}
                    (código do país + DDD + número).
                  </li>
                  <li>
                    Após a coluna &quot;Nome&quot;, você pode inserir novas
                    colunas com informações adicionais de cada contato (exemplo:
                    CPF, email, data de nascimento).
                  </li>
                  <li>
                    O limite de importação é de{" "}
                    <strong>{MAX_CONTACTS.toLocaleString()}</strong> contatos
                    por vez.
                  </li>
                  <li>
                    Linhas com formato inválido serão removidas automaticamente.
                  </li>
                  <li>
                    A conclusão da importação pode levar vários minutos. Não é
                    necessário manter-se nessa página.
                  </li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
        ) : parsing ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="text-muted-foreground mb-4 h-8 w-8 animate-spin" />
            <p className="text-muted-foreground text-sm">
              Processando arquivo...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Arquivo selecionado */}
            <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="text-muted-foreground h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {parsedContacts.length} linhas encontradas
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setFile(null);
                  setParsedContacts([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Resumo */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  <strong>{validContacts.length}</strong> válidos
                </span>
              </div>
              {invalidContacts.length > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">
                    <strong>{invalidContacts.length}</strong> inválidos (serão
                    ignorados)
                  </span>
                </div>
              )}
            </div>

            {/* Erros */}
            {invalidContacts.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Linhas com erros</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="mt-2 h-32">
                    <ul className="space-y-1 text-xs">
                      {invalidContacts.slice(0, 20).map((c, i) => (
                        <li key={i}>
                          <strong>{c.phoneNumber || "(vazio)"}</strong>:{" "}
                          {c.error}
                        </li>
                      ))}
                      {invalidContacts.length > 20 && (
                        <li className="text-muted-foreground">
                          ...e mais {invalidContacts.length - 20} erros
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            {/* Preview */}
            {validContacts.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  Preview (primeiros 5 contatos):
                </p>
                <ScrollArea className="h-40 rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-medium">Telefone</th>
                        <th className="p-2 text-left font-medium">Nome</th>
                        <th className="p-2 text-left font-medium">
                          Campos extras
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {validContacts.slice(0, 5).map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono text-xs">
                            {c.phoneNumber}
                          </td>
                          <td className="p-2">{c.name}</td>
                          <td className="p-2">
                            {c.customFields && (
                              <div className="flex flex-wrap gap-1">
                                {Object.keys(c.customFields).map((key) => (
                                  <Badge
                                    key={key}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {key}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}

            {/* Switch de sobrescrever */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="overwrite" className="text-sm font-medium">
                  Sobrescrever contatos
                </Label>
                <p className="text-muted-foreground text-xs">
                  Substitui nomes e campos extras dos contatos já existentes
                </p>
              </div>
              <Switch
                id="overwrite"
                checked={overwrite}
                onCheckedChange={setOverwrite}
              />
            </div>

            {/* Regras */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Regras de importação</AlertTitle>
              <AlertDescription className="text-xs">
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>
                    O telefone precisa seguir exatamente o padrão{" "}
                    <code className="bg-muted rounded px-1">+5511988884444</code>{" "}
                    (código do país + DDD + número).
                  </li>
                  <li>
                    Após a coluna &quot;Nome&quot;, você pode inserir novas
                    colunas com informações adicionais de cada contato (exemplo:
                    CPF, email, data de nascimento).
                  </li>
                  <li>
                    O limite de importação é de{" "}
                    <strong>{MAX_CONTACTS.toLocaleString()}</strong> contatos
                    por vez.
                  </li>
                  <li>
                    Linhas com formato inválido serão removidas automaticamente.
                  </li>
                  <li>
                    A conclusão da importação pode levar vários minutos. Não é
                    necessário manter-se nessa página.
                  </li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !file ||
              validContacts.length === 0 ||
              importMutation.isPending ||
              parsing
            }
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>Importar {validContacts.length} contatos</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
