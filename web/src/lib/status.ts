// One vocabulary for every status, document type and issue the screen shows. Each entry
// carries an icon and a label, so colour never carries meaning on its own.
import {
  Ban,
  BadgeCheck,
  CircleCheckBig,
  CircleDashed,
  CircleX,
  ClipboardList,
  Copy,
  FileQuestion,
  FileText,
  Hourglass,
  Layers,
  type LucideIcon,
  Package,
  Receipt,
  ReceiptText,
  Route,
  ScanSearch,
  Send,
  ShieldAlert,
  Sparkles,
  Truck,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import type { DocStatus, PackStatus, Priority } from "./types";

export interface Tone {
  label: string;
  icon: LucideIcon;
  /** pill classes: tinted fill, readable text in both themes, hairline ring */
  pill: string;
  /** solid colour for bars and dots */
  color: string;
}

export const PACK_STATUS: Record<PackStatus, Tone> = {
  awaiting_approval: {
    label: "Waiting for your approval",
    icon: UserRoundCheck,
    pill: "bg-amber-400/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
    color: "#f59e0b",
  },
  needs_review: {
    label: "Needs a person",
    icon: ShieldAlert,
    pill: "bg-blue-400/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
    color: "#ec4899",
  },
  investigating: {
    label: "Agent investigating",
    icon: ScanSearch,
    pill: "bg-blue-400/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
    color: "#8b5cf6",
  },
  open: {
    label: "Being checked",
    icon: CircleDashed,
    pill: "bg-blue-400/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
    color: "#6366f1",
  },
  waiting_for_invoice: {
    label: "Waiting for invoice",
    icon: Hourglass,
    pill: "bg-slate-400/15 text-slate-700 ring-slate-500/30 dark:text-slate-300",
    color: "#94a3b8",
  },
  auto_approved: {
    label: "Approved automatically",
    icon: Sparkles,
    pill: "bg-emerald-400/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
    color: "#10b981",
  },
  approved: {
    label: "Approved",
    icon: CircleCheckBig,
    pill: "bg-blue-400/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
    color: "#14b8a6",
  },
  exported: {
    label: "Exported to ERP",
    icon: Send,
    pill: "bg-blue-400/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
    color: "#0ea5e9",
  },
  rejected: {
    label: "Rejected",
    icon: Ban,
    pill: "bg-amber-400/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
    color: "#f97316",
  },
  failed: {
    label: "Failed",
    icon: CircleX,
    pill: "bg-red-400/15 text-red-700 ring-red-500/30 dark:text-red-300",
    color: "#ef4444",
  },
};

export const ATTENTION: PackStatus[] = ["awaiting_approval", "needs_review"];

export function packTone(status: string): Tone {
  return PACK_STATUS[status as PackStatus] ?? PACK_STATUS.open;
}

/** Document stages in pipeline order, for the stacked progress bar. */
export const DOC_STAGES: { key: DocStatus; label: string; color: string }[] = [
  { key: "queued", label: "Queued", color: "#64748b" },
  { key: "reading", label: "Reading", color: "#0ea5e9" },
  { key: "read", label: "Read", color: "#06b6d4" },
  { key: "classifying", label: "Classifying", color: "#6366f1" },
  { key: "ready", label: "Ready", color: "#8b5cf6" },
  { key: "extracting", label: "Extracting", color: "#d946ef" },
  { key: "extracted", label: "Extracted", color: "#10b981" },
  { key: "split", label: "Split bundle", color: "#14b8a6" },
  { key: "duplicate_file", label: "Duplicate file", color: "#f59e0b" },
  { key: "failed", label: "Failed", color: "#ef4444" },
];

export const DONE_STAGES: DocStatus[] = ["extracted", "split", "failed", "duplicate_file"];

export const DOC_TYPES: Record<string, { label: string; icon: LucideIcon; gradient: string }> = {
  invoice: { label: "Invoice", icon: Receipt, gradient: "from-blue-700 to-blue-700" },
  packing_list: { label: "Packing list", icon: Package, gradient: "from-blue-700 to-blue-700" },
  lorry_receipt: { label: "Lorry receipt", icon: Truck, gradient: "from-blue-700 to-blue-700" },
  eway_bill: { label: "E-way bill", icon: Route, gradient: "from-blue-700 to-blue-700" },
  quality_certificate: { label: "Quality certificate", icon: BadgeCheck, gradient: "from-blue-700 to-blue-700" },
  credit_note: { label: "Credit note", icon: ReceiptText, gradient: "from-blue-700 to-blue-700" },
  debit_note: { label: "Debit note", icon: ClipboardList, gradient: "from-blue-700 to-blue-700" },
  other: { label: "Other", icon: FileQuestion, gradient: "from-blue-700 to-blue-700" },
};

export function docType(type: string | null | undefined) {
  return DOC_TYPES[type ?? ""] ?? { label: type ? type : "Unknown", icon: FileText, gradient: "from-blue-700 to-blue-700" };
}

export const PRIORITIES: Record<Priority, { label: string; hint: string; icon: LucideIcon; pill: string; active: string }> = {
  urgent: {
    label: "Urgent",
    hint: "Jumps ahead of the month-end backlog",
    icon: Zap,
    pill: "bg-rose-400/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
    active: "from-blue-700 to-blue-700",
  },
  normal: {
    label: "Normal",
    hint: "The everyday lane",
    icon: Layers,
    pill: "bg-blue-400/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
    active: "from-blue-700 to-blue-700",
  },
  bulk: {
    label: "Bulk",
    hint: "Runs when there is spare capacity",
    icon: Copy,
    pill: "bg-blue-400/15 text-blue-700 ring-blue-500/30 dark:text-blue-300",
    active: "from-blue-700 to-blue-700",
  },
};

/** Issue codes grouped so related problems share a colour family in chips. */
const ISSUE_FAMILY: Record<string, string> = {
  SHORT_SHIPMENT: "qty",
  LR_QTY_MISMATCH: "qty",
  PACKING_QTY_MISMATCH: "qty",
  OVER_ORDER_QTY: "qty",
  PRICE_MISMATCH: "money",
  TAX_RATE_MISMATCH: "money",
  EWAY_VALUE_MISMATCH: "money",
  POSSIBLE_DUPLICATE: "risk",
  SUSPICIOUS_CONTENT: "risk",
  LOW_CONFIDENCE: "risk",
  COA_FAILED: "quality",
  COA_BATCH_MISMATCH: "quality",
  MISSING_COA: "quality",
  SHORT_SHELF_LIFE: "quality",
};

const FAMILY_PILL: Record<string, string> = {
  qty: "bg-amber-400/12 text-amber-800 ring-amber-500/25 dark:text-amber-200",
  money: "bg-rose-400/12 text-rose-800 ring-rose-500/25 dark:text-rose-200",
  risk: "bg-red-500/12 text-red-800 ring-red-500/30 dark:text-red-200",
  quality: "bg-blue-400/12 text-blue-800 ring-blue-500/25 dark:text-blue-200",
  other: "bg-blue-400/12 text-blue-800 ring-blue-500/25 dark:text-blue-200",
};

export function issuePill(code: string): string {
  return FAMILY_PILL[ISSUE_FAMILY[code] ?? "other"];
}

