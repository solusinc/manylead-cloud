"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@manylead/ui/alert-dialog";

interface AccessDeniedModalContextType {
  showAccessDeniedModal: () => void;
}

const AccessDeniedModalContext = createContext<AccessDeniedModalContextType | null>(null);

export function useAccessDeniedModal() {
  const context = useContext(AccessDeniedModalContext);
  if (!context) {
    throw new Error("useAccessDeniedModal must be used within AccessDeniedModalProvider");
  }
  return context;
}

export function AccessDeniedModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const showAccessDeniedModal = () => {
    console.log("[AccessDeniedModal] 🚫 Mostrando modal global");
    setIsOpen(true);
    // Redirecionar imediatamente para /chats
    router.replace("/chats");
  };

  return (
    <AccessDeniedModalContext.Provider value={{ showAccessDeniedModal }}>
      {children}

      {/* Modal Global de Acesso Negado */}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="z-[9999]">
          <AlertDialogHeader className="items-center">
            <AlertCircle className="mb-4 h-12 w-12" />
            <AlertDialogTitle className="sr-only">Acesso Negado</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Esse chat já está sendo atendido por outro usuário ou você não tem
              acesso a esse recurso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsOpen(false)}>
              Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccessDeniedModalContext.Provider>
  );
}
