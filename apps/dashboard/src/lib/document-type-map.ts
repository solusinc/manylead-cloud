/**
 * Document type mapping
 * Maps MIME types to document metadata following DRY and SOLID principles
 * Easily extensible for new document types
 */

import { PdfIcon, WordIcon, DocumentIcon } from "~/components/chat/input/document-icons";

export interface DocumentTypeConfig {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  color: string;
}

/**
 * Document type registry
 * Single source of truth for document type configuration
 */
export const DOCUMENT_TYPE_MAP: Record<string, DocumentTypeConfig> = {
  // PDF
  "application/pdf": {
    icon: PdfIcon,
    label: "PDF",
    color: "#dd2025",
  },

  // Microsoft Word
  "application/msword": {
    icon: WordIcon,
    label: "Word",
    color: "#2368c4",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    icon: WordIcon,
    label: "Word",
    color: "#2368c4",
  },

  // Microsoft Excel
  "application/vnd.ms-excel": {
    icon: DocumentIcon, // Placeholder - add ExcelIcon later
    label: "Excel",
    color: "#1d6f42",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    icon: DocumentIcon, // Placeholder - add ExcelIcon later
    label: "Excel",
    color: "#1d6f42",
  },

  // Plain text
  "text/plain": {
    icon: DocumentIcon,
    label: "Texto",
    color: "#6b7280",
  },

  // CSV
  "text/csv": {
    icon: DocumentIcon,
    label: "CSV",
    color: "#10b981",
  },
};

/**
 * Get document type configuration by MIME type
 * Returns default config if type not found (Open/Closed Principle)
 */
export function getDocumentType(mimeType: string): DocumentTypeConfig {
  return (
    DOCUMENT_TYPE_MAP[mimeType] ?? {
      icon: DocumentIcon,
      label: "Documento",
      color: "#6b7280",
    }
  );
}

/**
 * Get document icon component by MIME type
 */
export function getDocumentIcon(mimeType: string) {
  return getDocumentType(mimeType).icon;
}

/**
 * Get document label by MIME type
 */
export function getDocumentLabel(mimeType: string) {
  return getDocumentType(mimeType).label;
}

/**
 * Get document color by MIME type
 */
export function getDocumentColor(mimeType: string) {
  return getDocumentType(mimeType).color;
}
