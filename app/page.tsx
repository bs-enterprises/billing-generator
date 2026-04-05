"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  PlusCircle, Trash2, Download, Building2, User, Package, CreditCard,
  FileText, Receipt, ChevronDown, ChevronRight, Eye, Pencil,
  Smartphone, Banknote, Wallet, Sun, Moon, RotateCcw,
  CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface LineItem {
  id: string;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
}

interface InvoiceData {
  // Seller
  sellerName: string;
  sellerAddress: string;
  sellerCity: string;
  sellerState: string;
  sellerPincode: string;
  sellerGSTIN: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerPAN: string;
  // Buyer
  buyerName: string;
  buyerAddress: string;
  buyerCity: string;
  buyerState: string;
  buyerPincode: string;
  buyerGSTIN: string;
  buyerPhone: string;
  buyerEmail: string;
  // Invoice
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  placeOfSupply: string;
  // Items
  items: LineItem[];
  // Bank
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  // Payment
  paymentModes: string[];
  upiId: string;
  upiName: string;
  chequePayableTo: string;
  paymentStatus: "unpaid" | "paid" | "partial";
  paymentReference: string;
  amountPaid: number;
  // Notes
  notes: string;
  termsAndConditions: string;
}

interface GSTBreakdown {
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

interface Calculations {
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  isIntraState: boolean;
  breakdown: GSTBreakdown[];
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Lakshadweep", "Puducherry", "Ladakh", "Jammu and Kashmir",
];

const GST_RATES = [0, 5, 12, 18, 28];

const UNITS = [
  "Nos", "Pcs", "Kg", "Gm", "Ltr", "Ml",
  "Mtr", "Cm", "Sqm", "Sqft", "Hrs", "Days", "Months", "Box", "Set",
];

const PAYMENT_METHODS = [
  { id: "upi",    label: "UPI",            sub: "Google Pay / PhonePe / Paytm / BHIM" },
  { id: "neft",   label: "NEFT",           sub: "National Electronic Funds Transfer" },
  { id: "rtgs",   label: "RTGS",           sub: "Real Time Gross Settlement" },
  { id: "imps",   label: "IMPS",           sub: "Immediate Payment Service" },
  { id: "cheque", label: "Cheque / DD",    sub: "Account Payee Cheque or Demand Draft" },
  { id: "cash",   label: "Cash",           sub: "In-person cash payment" },
  { id: "wallet", label: "Digital Wallet", sub: "Paytm Wallet / Mobikwik / Amazon Pay" },
  { id: "upi_cc", label: "UPI + CC",       sub: "Rupay Credit Card on UPI" },
];

const THEMES = [
  { id: "default", label: "Default", dot: "#64748b" },
  { id: "blue",    label: "Blue",    dot: "#1d4ed8" },
  { id: "green",   label: "Green",   dot: "#15803d" },
];

// Fields saved to localStorage as "profile" (business identity, reused across invoices)
const PROFILE_KEYS: (keyof InvoiceData)[] = [
  "sellerName", "sellerAddress", "sellerCity", "sellerState", "sellerPincode",
  "sellerGSTIN", "sellerPhone", "sellerEmail", "sellerPAN",
  "bankName", "accountHolderName", "accountNumber", "ifscCode", "branchName",
  "paymentModes", "upiId", "upiName", "chequePayableTo",
  "notes", "termsAndConditions",
];

const STORAGE_KEY = "invoice_profile_v3";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).substring(2, 9);
const todayISO = () => new Date().toISOString().split("T")[0];
const dueISO = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (s: string) => {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

function numToWords(num: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (num === 0) return "Zero Rupees Only";
  const intPart = Math.floor(num);
  const paisa = Math.round((num - intPart) * 100);
  const u100 = (n: number): string =>
    n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  const u1000 = (n: number): string =>
    n < 100 ? u100(n) : ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + u100(n % 100) : "");
  let result = "", rem = intPart;
  if (rem >= 10_000_000) { result += u1000(Math.floor(rem / 10_000_000)) + " Crore "; rem %= 10_000_000; }
  if (rem >= 100_000)    { result += u1000(Math.floor(rem / 100_000)) + " Lakh ";   rem %= 100_000; }
  if (rem >= 1_000)      { result += u1000(Math.floor(rem / 1_000)) + " Thousand "; rem %= 1_000; }
  if (rem > 0)             result += u1000(rem);
  result = result.trim() + " Rupees";
  if (paisa > 0) result += " and " + u100(paisa) + " Paise";
  return result + " Only";
}

function incrInvoiceNum(n: string): string {
  const m = n.match(/^(.*?)(\d+)$/);
  if (!m) return n + "-2";
  return m[1] + String(parseInt(m[2]) + 1).padStart(m[2].length, "0");
}

// ─────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────
const INIT: InvoiceData = {
  sellerName: "", sellerAddress: "", sellerCity: "",
  sellerState: "Maharashtra", sellerPincode: "", sellerGSTIN: "",
  sellerPhone: "", sellerEmail: "", sellerPAN: "",
  buyerName: "", buyerAddress: "", buyerCity: "",
  buyerState: "Maharashtra", buyerPincode: "", buyerGSTIN: "",
  buyerPhone: "", buyerEmail: "",
  invoiceNumber: `INV-${new Date().getFullYear()}-001`,
  invoiceDate: todayISO(), dueDate: dueISO(),
  placeOfSupply: "Maharashtra",
  items: [{ id: uid(), description: "", hsnSac: "", quantity: 1, unit: "Nos", rate: 0, gstRate: 18 }],
  bankName: "", accountHolderName: "", accountNumber: "", ifscCode: "", branchName: "",
  paymentModes: ["neft", "rtgs"],
  upiId: "", upiName: "", chequePayableTo: "",
  paymentStatus: "unpaid", paymentReference: "", amountPaid: 0,
  notes: "Thank you for your business!",
  termsAndConditions:
    "1. Payment is due within 30 days of invoice date.\n2. Please include the invoice number in your payment reference.\n3. Goods once sold will not be taken back.\n4. All disputes subject to local jurisdiction.",
};

// ─────────────────────────────────────────────────────────────────
// GST calculation
// ─────────────────────────────────────────────────────────────────
function calcGST(data: InvoiceData): Calculations {
  const isIntraState = data.sellerState === data.placeOfSupply;
  const groups: Record<number, number> = {};
  let subtotal = 0;
  data.items.forEach((item) => {
    const t = item.quantity * item.rate;
    subtotal += t;
    groups[item.gstRate] = (groups[item.gstRate] ?? 0) + t;
  });
  const breakdown = Object.entries(groups)
    .map(([rate, taxableAmount]) => {
      const r = parseFloat(rate);
      const gst = taxableAmount * (r / 100);
      return {
        rate: r, taxableAmount,
        cgst: isIntraState ? gst / 2 : 0,
        sgst: isIntraState ? gst / 2 : 0,
        igst: !isIntraState ? gst : 0,
      };
    })
    .sort((a, b) => a.rate - b.rate);
  const cgstTotal = breakdown.reduce((s, g) => s + g.cgst, 0);
  const sgstTotal = breakdown.reduce((s, g) => s + g.sgst, 0);
  const igstTotal = breakdown.reduce((s, g) => s + g.igst, 0);
  return {
    subtotal, cgstTotal, sgstTotal, igstTotal,
    grandTotal: subtotal + cgstTotal + sgstTotal + igstTotal,
    isIntraState, breakdown,
  };
}

// ─────────────────────────────────────────────────────────────────
// Theme hook (palette + dark mode, persisted to localStorage)
// ─────────────────────────────────────────────────────────────────
function useAppTheme() {
  const [palette, setPaletteState] = useState("default");
  const [dark, setDarkState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("invoice_theme");
      if (saved) {
        const { palette: p, dark: d } = JSON.parse(saved);
        setPaletteState(p ?? "default");
        setDarkState(d ?? false);
      }
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    // Palette attribute drives color-palette CSS selectors
    if (palette === "default") html.removeAttribute("data-palette");
    else html.setAttribute("data-palette", palette);
    // Dark class
    if (dark) html.classList.add("dark");
    else html.classList.remove("dark");
    try {
      localStorage.setItem("invoice_theme", JSON.stringify({ palette, dark }));
    } catch { /* ignore */ }
  }, [palette, dark, mounted]);

  const setPalette = useCallback((p: string) => setPaletteState(p), []);
  const toggleDark = useCallback(() => setDarkState((d) => !d), []);

  return { palette, setPalette, dark, toggleDark, mounted };
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────
function Section({
  title, icon: Icon, children, defaultOpen = true,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border border-border shadow-none">
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none hover:bg-muted/40 transition-colors rounded-t-lg"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
          <span className="ml-auto text-muted-foreground">
            {open
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />}
          </span>
        </CardTitle>
      </CardHeader>
      {open && (
        <>
          <Separator />
          <CardContent className="pt-4 pb-5 px-4">{children}</CardContent>
        </>
      )}
    </Card>
  );
}

function Field({
  label, children, className = "",
}: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ThemeSwitcher({
  palette, setPalette, dark, toggleDark,
}: {
  palette: string; setPalette: (p: string) => void; dark: boolean; toggleDark: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-1 border border-border/60">
        {THEMES.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setPalette(t.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
              palette === t.id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.dot }} />
            {t.label}
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={toggleDark}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function PayStatusBadge({ status }: { status: InvoiceData["paymentStatus"] }) {
  if (status === "paid")
    return <Badge className="bg-green-600 text-white gap-1 text-xs"><CheckCircle2 className="h-3 w-3" />Paid</Badge>;
  if (status === "partial")
    return <Badge className="bg-amber-500 text-white gap-1 text-xs"><Clock className="h-3 w-3" />Partial</Badge>;
  return <Badge variant="destructive" className="gap-1 text-xs"><AlertCircle className="h-3 w-3" />Unpaid</Badge>;
}

// ─────────────────────────────────────────────────────────────────
// Invoice Preview — always black-white (for PDF)
// ─────────────────────────────────────────────────────────────────
const InvoicePreview = React.forwardRef<
  HTMLDivElement,
  { data: InvoiceData; calc: Calculations }
>(function InvoicePreview({ data, calc }, ref) {
  const hasBankTransfer = data.paymentModes.some((m) => ["neft", "rtgs", "imps"].includes(m));
  const hasUPI   = data.paymentModes.includes("upi") || data.paymentModes.includes("upi_cc");
  const hasCheque = data.paymentModes.includes("cheque");

  const CAP: React.CSSProperties = {
    fontSize: "8.5px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "1.4px", color: "#94a3b8", marginBottom: "5px",
  };
  const ROW: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "7px 12px", borderBottom: "1px solid #f1f5f9", fontSize: "11px",
  };

  return (
    <div
      ref={ref}
      id="invoice-preview"
      style={{ fontFamily: "'Helvetica Neue', Arial, Helvetica, sans-serif", fontSize: "12px", color: "#1a1a1a", backgroundColor: "#ffffff", width: "100%" }}
    >
      {/* ── Top accent bar ── */}
      <div style={{ height: "4px", backgroundColor: "#1e293b" }} />

      <div style={{ padding: "26px 34px 28px" }}>

        {/* ════ HEADER ════ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>

          {/* Left: company info */}
          <div style={{ display: "flex", gap: "13px", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "17px", color: "#0f172a", lineHeight: 1.2 }}>
                {data.sellerName || "Your Company Name"}
              </div>
              {(data.sellerAddress || data.sellerCity) && (
                <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "3px", lineHeight: 1.55, maxWidth: "300px" }}>
                  {[data.sellerAddress, data.sellerCity, data.sellerState, data.sellerPincode].filter(Boolean).join(", ")}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
                {data.sellerPhone && <span style={{ fontSize: "10.5px", color: "#64748b" }}>{data.sellerPhone}</span>}
                {data.sellerEmail && <span style={{ fontSize: "10.5px", color: "#64748b" }}>{data.sellerEmail}</span>}
                {data.sellerGSTIN && <span style={{ fontSize: "10.5px", color: "#64748b" }}>GSTIN: {data.sellerGSTIN}</span>}
                {data.sellerPAN   && <span style={{ fontSize: "10.5px", color: "#64748b" }}>PAN: {data.sellerPAN}</span>}
              </div>
            </div>
          </div>

          {/* Right: INVOICE title + meta */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
            <div style={{ fontSize: "30px", fontWeight: 900, letterSpacing: "6px", color: "#0f172a", lineHeight: 1 }}>
              INVOICE
            </div>
            <div style={{
              marginTop: "14px", border: "1px solid #e2e8f0", borderRadius: "6px",
              overflow: "hidden", minWidth: "210px", backgroundColor: "#f8fafc",
            }}>
              {([
                ["Invoice No",      data.invoiceNumber || "—"],
                ["Invoice Date",    fmtDate(data.invoiceDate)],
                ["Due Date",        fmtDate(data.dueDate)],
                ["Place of Supply", data.placeOfSupply],
              ] as [string, string][]).map(([label, value], i, arr) => (
                <div key={label} style={{ ...ROW, borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <span style={{ color: "#94a3b8" }}>{label}</span>
                  <strong style={{ color: "#0f172a", marginLeft: "20px" }}>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── divider ── */}
        <div style={{ height: "1px", backgroundColor: "#e2e8f0", marginBottom: "16px" }} />

        {/* ════ BILL FROM / BILL TO ════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
          {([
            {
              label: "Bill From", name: data.sellerName, address: data.sellerAddress,
              city: data.sellerCity, state: data.sellerState, pincode: data.sellerPincode,
              gstin: data.sellerGSTIN, pan: data.sellerPAN, phone: data.sellerPhone, email: data.sellerEmail,
            },
            {
              label: "Bill To", name: data.buyerName, address: data.buyerAddress,
              city: data.buyerCity, state: data.buyerState, pincode: data.buyerPincode,
              gstin: data.buyerGSTIN, pan: undefined, phone: data.buyerPhone, email: data.buyerEmail,
            },
          ]).map((p) => (
            <div key={p.label} style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "11px 14px", backgroundColor: "#f8fafc" }}>
              <div style={CAP}>{p.label}</div>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{p.name || "—"}</div>
              {p.address && (
                <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "3px", lineHeight: 1.55 }}>
                  {[p.address, p.city, p.state, p.pincode].filter(Boolean).join(", ")}
                </div>
              )}
              <div style={{ marginTop: "5px", fontSize: "10.5px", color: "#475569", lineHeight: 1.7 }}>
                {p.gstin && <div><span style={{ color: "#94a3b8" }}>GSTIN </span><strong>{p.gstin}</strong></div>}
                {p.pan   && <div><span style={{ color: "#94a3b8" }}>PAN </span><strong>{p.pan}</strong></div>}
                {p.phone && <div><span style={{ color: "#94a3b8" }}>Phone </span>{p.phone}</div>}
                {p.email && <div><span style={{ color: "#94a3b8" }}>Email </span>{p.email}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* ════ LINE ITEMS ════ */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "16px" }}>
          <thead>
            <tr style={{ backgroundColor: "#1e293b", color: "#ffffff" }}>
              {(["#", "Description", "HSN / SAC", "Qty", "Unit", "Rate (₹)", "GST %", "Amount (₹)"] as const).map((h, i) => (
                <th key={h} style={{
                  padding: "9px 11px",
                  textAlign: (i === 0 ? "center" : i >= 3 ? "right" : "left") as "left" | "right" | "center",
                  fontWeight: 600, fontSize: "10px", letterSpacing: "0.1px", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 11px", textAlign: "center", color: "#94a3b8", verticalAlign: "middle" }}>{idx + 1}</td>
                <td style={{ padding: "8px 11px", fontWeight: 500, verticalAlign: "middle" }}>{item.description || "—"}</td>
                <td style={{ padding: "8px 11px", color: "#64748b", verticalAlign: "middle" }}>{item.hsnSac || "—"}</td>
                <td style={{ padding: "8px 11px", textAlign: "right", verticalAlign: "middle" }}>{item.quantity}</td>
                <td style={{ padding: "8px 11px", color: "#64748b", verticalAlign: "middle" }}>{item.unit}</td>
                <td style={{ padding: "8px 11px", textAlign: "right", verticalAlign: "middle" }}>{fmt(item.rate)}</td>
                <td style={{ padding: "8px 11px", textAlign: "right", color: "#64748b", verticalAlign: "middle" }}>{item.gstRate}%</td>
                <td style={{ padding: "8px 11px", textAlign: "right", fontWeight: 600, verticalAlign: "middle" }}>{fmt(item.quantity * item.rate)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "#f1f5f9", borderTop: "1.5px solid #e2e8f0" }}>
              <td colSpan={7} style={{ padding: "8px 11px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: "10px" }}>
                Subtotal (before GST)
              </td>
              <td style={{ padding: "8px 11px", textAlign: "right", fontWeight: 700, fontSize: "12px" }}>
                ₹ {fmt(calc.subtotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ════ GST BREAKDOWN + TOTALS ════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px", alignItems: "start" }}>
          {/* GST table */}
          <div>
            <div style={CAP}>GST Breakdown</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5px", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9" }}>
                  {(["Rate", "Taxable (₹)", ...(calc.isIntraState ? ["CGST (₹)", "SGST (₹)"] : ["IGST (₹)"]), "Total (₹)"] as string[]).map((h, i) => (
                    <th key={h} style={{ padding: "7px 9px", textAlign: (i === 0 ? "left" : "right") as "left" | "right", color: "#64748b", fontWeight: 600, borderBottom: "1px solid #e2e8f0", verticalAlign: "middle" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calc.breakdown.map((g, i) => (
                  <tr key={g.rate} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={{ padding: "6px 9px", color: "#475569", verticalAlign: "middle" }}>{g.rate}%</td>
                    <td style={{ padding: "6px 9px", textAlign: "right", verticalAlign: "middle" }}>{fmt(g.taxableAmount)}</td>
                    {calc.isIntraState ? (
                      <>
                        <td style={{ padding: "6px 9px", textAlign: "right", verticalAlign: "middle" }}>{fmt(g.cgst)}</td>
                        <td style={{ padding: "6px 9px", textAlign: "right", verticalAlign: "middle" }}>{fmt(g.sgst)}</td>
                      </>
                    ) : (
                      <td style={{ padding: "6px 9px", textAlign: "right", verticalAlign: "middle" }}>{fmt(g.igst)}</td>
                    )}
                    <td style={{ padding: "6px 9px", textAlign: "right", fontWeight: 600, verticalAlign: "middle" }}>{fmt(g.cgst + g.sgst + g.igst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
            {[
              { label: "Taxable Amount", value: fmt(calc.subtotal) },
              ...(calc.isIntraState
                ? [{ label: "CGST", value: fmt(calc.cgstTotal) }, { label: "SGST", value: fmt(calc.sgstTotal) }]
                : [{ label: "IGST", value: fmt(calc.igstTotal) }]),
            ].map(({ label, value }) => (
              <div key={label} style={{ ...ROW, fontSize: "11px" }}>
                <span style={{ color: "#64748b" }}>{label}</span>
                <span style={{ color: "#0f172a" }}>₹ {value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px", backgroundColor: "#1e293b", color: "#ffffff" }}>
              <span style={{ fontWeight: 700, fontSize: "12px", letterSpacing: "0.4px" }}>TOTAL DUE</span>
              <span style={{ fontWeight: 900, fontSize: "15px" }}>₹ {fmt(calc.grandTotal)}</span>
            </div>
            {data.paymentStatus !== "unpaid" && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", backgroundColor: "#f0fdf4", borderTop: "1px solid #dcfce7", fontSize: "11px" }}>
                <span style={{ color: "#166534" }}>Amount Received</span>
                <span style={{ color: "#166534", fontWeight: 600 }}>₹ {fmt(data.amountPaid)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Amount in words ── */}
        <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px", padding: "8px 12px", marginBottom: "16px", fontSize: "10.5px", color: "#475569" }}>
          <strong style={{ color: "#0f172a" }}>Amount in Words: </strong>
          <span style={{ fontStyle: "italic" }}>{numToWords(calc.grandTotal)}</span>
        </div>

        {/* ── Payment status banner (only when paid/partial) ── */}
        {(data.paymentStatus !== "unpaid" || data.paymentReference) && (
          <div style={{
            backgroundColor: data.paymentStatus === "paid" ? "#f0fdf4" : "#fffbeb",
            border: `1px solid ${data.paymentStatus === "paid" ? "#bbf7d0" : "#fde68a"}`,
            borderRadius: "5px", padding: "8px 12px", marginBottom: "14px", fontSize: "11px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>
              <strong>Payment Status: </strong>
              <span style={{ fontWeight: 700, color: data.paymentStatus === "paid" ? "#16a34a" : "#d97706" }}>
                {data.paymentStatus === "paid" ? "✓ PAID IN FULL" : "◑ PARTIALLY PAID"}
              </span>
            </span>
            {data.paymentReference && (
              <span style={{ color: "#475569", fontSize: "10.5px" }}><strong>Ref/UTR: </strong>{data.paymentReference}</span>
            )}
          </div>
        )}

        {/* ════ BOTTOM SECTION: Payment info + Terms + Signature ════ */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginBottom: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: data.paymentModes.length > 0 ? "1fr 1fr" : "1fr", gap: "14px" }}>

            {/* Payment info (compact) */}
            {data.paymentModes.length > 0 && (
              <div>
                <div style={CAP}>Payment Information</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden", fontSize: "10.5px" }}>
                  {hasUPI && data.upiId && (
                    <div style={{ padding: "7px 11px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>UPI: {data.upiId}</div>
                      {data.upiName && <div style={{ color: "#64748b", marginTop: "1px" }}>{data.upiName}</div>}
                      <div style={{ color: "#94a3b8", fontSize: "9.5px", marginTop: "2px" }}>Google Pay · PhonePe · Paytm · BHIM</div>
                    </div>
                  )}
                  {hasBankTransfer && (
                    <div style={{ padding: "7px 11px", borderBottom: hasCheque ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                        Bank ({data.paymentModes.filter((m) => ["neft", "rtgs", "imps"].includes(m)).map((m) => m.toUpperCase()).join("/")}):
                      </div>
                      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "10px" }}>
                        <tbody>
                          {([
                            ["Account Name", data.accountHolderName],
                            ["Bank",         data.bankName],
                            ["Account No",   data.accountNumber],
                            ["IFSC",         data.ifscCode],
                            ["Branch",       data.branchName],
                          ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                            <tr key={k}>
                              <td style={{ color: "#94a3b8", paddingRight: "10px", paddingBottom: "1px", whiteSpace: "nowrap" }}>{k}</td>
                              <td style={{ fontWeight: k === "Account No" || k === "Account Name" ? 600 : 400, color: "#1e293b" }}>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {hasCheque && (
                    <div style={{ padding: "7px 11px", backgroundColor: "#f8fafc" }}>
                      <span style={{ color: "#64748b" }}>Cheque payable to: </span>
                      <strong>{data.chequePayableTo || data.sellerName || "—"}</strong>
                    </div>
                  )}
                  {!hasUPI && !hasBankTransfer && !hasCheque && (
                    <div style={{ padding: "7px 11px", color: "#64748b" }}>
                      {data.paymentModes.map((m) => PAYMENT_METHODS.find((pm) => pm.id === m)?.label ?? m.toUpperCase()).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Terms & Conditions */}
            <div>
              <div style={CAP}>Terms &amp; Conditions</div>
              {data.termsAndConditions ? (
                <div style={{ fontSize: "10px", color: "#64748b", lineHeight: 1.75, whiteSpace: "pre-line" }}>{data.termsAndConditions}</div>
              ) : (
                <span style={{ color: "#cbd5e1", fontSize: "10.5px" }}>—</span>
              )}
              {data.notes && (
                <div style={{ marginTop: "8px" }}>
                  <div style={CAP}>Notes</div>
                  <div style={{ fontSize: "10px", color: "#64748b", lineHeight: 1.6 }}>{data.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Signature ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
          <div style={{ textAlign: "center", minWidth: "190px" }}>
            <div style={{ height: "44px", borderBottom: "1.5px solid #94a3b8", marginBottom: "7px" }} />
            <div style={{ fontSize: "9.5px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Authorised Signatory</div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#0f172a" }}>{data.sellerName || ""}</div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ height: "1px", backgroundColor: "#e2e8f0", marginBottom: "10px" }} />
        <div style={{ textAlign: "center", fontSize: "9.5px", color: "#94a3b8" }}>
          This is a computer-generated invoice and does not require a physical signature.
          {data.sellerGSTIN && <span> · GSTIN: {data.sellerGSTIN}</span>}
        </div>

      </div>
    </div>
  );
});
export default function InvoiceGenerator() {
  const [data, setData] = useState<InvoiceData>(INIT);
  const [activeView, setActiveView] = useState<"form" | "preview">("form");
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { palette, setPalette, dark, toggleDark, mounted } = useAppTheme();
  const calc = useMemo(() => calcGST(data), [data]);

  // ── Load saved profile on mount ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const profile = JSON.parse(raw) as Partial<InvoiceData>;
        setData((d) => ({ ...d, ...profile }));
      }
    } catch { /* ignore */ }
  }, []);

  // ── Auto-save profile fields (debounced 800 ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profile: Record<string, any> = {};
        PROFILE_KEYS.forEach((k) => { profile[k] = (data as unknown as Record<string, unknown>)[k]; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        setSavedAt(
          new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        );
      } catch { /* ignore */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [data]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = useCallback((field: keyof InvoiceData, value: any) =>
    setData((d) => ({ ...d, [field]: value })), []);

  const addItem = useCallback(() =>
    setData((d) => ({
      ...d,
      items: [...d.items, { id: uid(), description: "", hsnSac: "", quantity: 1, unit: "Nos", rate: 0, gstRate: 18 }],
    })), []);

  const removeItem = useCallback((id: string) =>
    setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) })), []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateItem = useCallback((id: string, field: keyof LineItem, value: any) =>
    setData((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    })), []);

  const togglePaymentMode = useCallback((mode: string) =>
    setData((d) => ({
      ...d,
      paymentModes: d.paymentModes.includes(mode)
        ? d.paymentModes.filter((m) => m !== mode)
        : [...d.paymentModes, mode],
    })), []);

  const newInvoice = useCallback(() => {
    setData((d) => ({
      ...d,
      buyerName: "", buyerAddress: "", buyerCity: "", buyerState: "Maharashtra",
      buyerPincode: "", buyerGSTIN: "", buyerPhone: "", buyerEmail: "",
      invoiceNumber: incrInvoiceNum(d.invoiceNumber),
      invoiceDate: todayISO(), dueDate: dueISO(),
      placeOfSupply: d.sellerState,
      paymentStatus: "unpaid", paymentReference: "", amountPaid: 0,
      items: [{ id: uid(), description: "", hsnSac: "", quantity: 1, unit: "Nos", rate: 0, gstRate: 18 }],
    }));
    toast.success("New invoice started", {
      description: "Seller, bank & payment details have been retained.",
    });
  }, []);

  const generatePDF = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      setIsGenerating(true);
      toast.loading("Generating PDF…", { id: "pdf" });
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      // html2canvas 1.x can't parse oklch() (Tailwind v4) and converts them
      // to lab(), which jsPDF also rejects. Override every CSS custom property
      // on the cloned document root with plain hex equivalents before capture.
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          // Pin the invoice element to a consistent A4-proportional width so
          // the PDF layout is identical regardless of current browser viewport.
          const previewEl = clonedDoc.getElementById("invoice-preview");
          if (previewEl) {
            previewEl.style.width = "760px";
            previewEl.style.maxWidth = "760px";
          }
          const hexVars: Record<string, string> = {
            "--background": "#ffffff", "--foreground": "#111111",
            "--card": "#ffffff", "--card-foreground": "#111111",
            "--popover": "#ffffff", "--popover-foreground": "#111111",
            "--primary": "#111111", "--primary-foreground": "#ffffff",
            "--secondary": "#f5f5f5", "--secondary-foreground": "#111111",
            "--muted": "#f5f5f5", "--muted-foreground": "#737373",
            "--accent": "#f5f5f5", "--accent-foreground": "#111111",
            "--destructive": "#ef4444",
            "--border": "#e5e5e5", "--input": "#e5e5e5", "--ring": "#a3a3a3",
            "--color-background": "#ffffff", "--color-foreground": "#111111",
            "--color-card": "#ffffff", "--color-border": "#e5e5e5",
            "--color-primary": "#111111", "--color-primary-foreground": "#ffffff",
            "--color-muted": "#f5f5f5", "--color-muted-foreground": "#737373",
            "--color-accent": "#f5f5f5", "--color-ring": "#a3a3a3",
            "--color-white": "#ffffff", "--color-black": "#000000",
          };
          const root = clonedDoc.documentElement;
          Object.entries(hexVars).forEach(([k, v]) => root.style.setProperty(k, v));
        },
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const A4W = 210, A4H = 297;
      const margin = 10; // mm on all sides
      const contentW = A4W - margin * 2;
      const imgH = contentW * (canvas.height / canvas.width);
      const pageH = A4H - margin * 2;
      pdf.addImage(imgData, "PNG", margin, margin, contentW, imgH);
      let remaining = imgH - pageH, pagePos = pageH;
      while (remaining > 0) {
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, margin - pagePos, contentW, imgH);
        pagePos += pageH;
        remaining -= pageH;
      }
      const filename = `${data.invoiceNumber || "invoice"}.pdf`;
      const blobUrl = pdf.output("bloburl") as unknown as string;
      const newTab = window.open(blobUrl, "_blank");
      if (!newTab) {
        // Fallback: download if popup was blocked
        pdf.save(filename);
      }
      toast.success("PDF opened in new tab!", { id: "pdf", description: filename });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF.", { id: "pdf" });
    } finally {
      setIsGenerating(false);
    }
  }, [data.invoiceNumber]);

  const hasBankModes = data.paymentModes.some((m) => ["neft", "rtgs", "imps"].includes(m));

  return (
    <div className="min-h-screen bg-muted/40 font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Receipt className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-base tracking-tight">Invoice Generator</span>
            <Badge variant="secondary" className="text-xs hidden sm:inline-flex font-normal">
              India GST
            </Badge>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {mounted && (
              <ThemeSwitcher palette={palette} setPalette={setPalette} dark={dark} toggleDark={toggleDark} />
            )}
            {/* Mobile view toggle */}
            <div className="flex lg:hidden rounded-md overflow-hidden border border-border">
              <Button
                variant={activeView === "form" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-8 px-3"
                onClick={() => setActiveView("form")}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Form
              </Button>
              <Separator orientation="vertical" className="h-8" />
              <Button
                variant={activeView === "preview" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-8 px-3"
                onClick={() => setActiveView("preview")}
              >
                <Eye className="h-3.5 w-3.5 mr-1" /> Preview
              </Button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex" onClick={newInvoice}>
              <RotateCcw className="h-3.5 w-3.5" /> New
            </Button>
            <Button onClick={generatePDF} disabled={isGenerating} size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{isGenerating ? "Generating…" : "Generate PDF"}</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </div>

        {/* Auto-save indicator */}
        {savedAt && (
          <div className="max-w-screen-2xl mx-auto px-4 md:px-6 pb-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span className="text-[11px] text-muted-foreground">Profile auto-saved at {savedAt}</span>
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <main className="max-w-screen-2xl mx-auto p-4 md:p-6">
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 items-start">

          {/* ════ Form panel ════ */}
          <div className={`space-y-3 ${activeView === "preview" ? "hidden lg:block" : ""}`}>

            {/* Seller */}
            <Section title="Seller Information" icon={Building2}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Business / Company Name" className="sm:col-span-2">
                  <Input placeholder="e.g. Acme Technologies Pvt. Ltd."
                    value={data.sellerName} onChange={(e) => set("sellerName", e.target.value)} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Textarea rows={2} placeholder="Street / locality"
                    value={data.sellerAddress} onChange={(e) => set("sellerAddress", e.target.value)} />
                </Field>
                <Field label="City">
                  <Input placeholder="Mumbai" value={data.sellerCity}
                    onChange={(e) => set("sellerCity", e.target.value)} />
                </Field>
                <Field label="Pincode">
                  <Input placeholder="400001" maxLength={6} value={data.sellerPincode}
                    onChange={(e) => set("sellerPincode", e.target.value)} />
                </Field>
                <Field label="State">
                  <Select value={data.sellerState} onValueChange={(v) => set("sellerState", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="GSTIN">
                  <Input placeholder="27AXXXX1234D1Z5" value={data.sellerGSTIN}
                    onChange={(e) => set("sellerGSTIN", e.target.value.toUpperCase())} />
                </Field>
                <Field label="PAN">
                  <Input placeholder="AXXXX1234D" value={data.sellerPAN}
                    onChange={(e) => set("sellerPAN", e.target.value.toUpperCase())} />
                </Field>
                <Field label="Phone">
                  <Input placeholder="+91 98765 43210" value={data.sellerPhone}
                    onChange={(e) => set("sellerPhone", e.target.value)} />
                </Field>
                <Field label="Email" className="sm:col-span-2">
                  <Input type="email" placeholder="hello@yourcompany.com" value={data.sellerEmail}
                    onChange={(e) => set("sellerEmail", e.target.value)} />
                </Field>
              </div>
            </Section>

            {/* Buyer */}
            <Section title="Buyer Information" icon={User}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Buyer / Company Name" className="sm:col-span-2">
                  <Input placeholder="e.g. Client Solutions Pvt. Ltd."
                    value={data.buyerName} onChange={(e) => set("buyerName", e.target.value)} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Textarea rows={2} placeholder="Street / locality"
                    value={data.buyerAddress} onChange={(e) => set("buyerAddress", e.target.value)} />
                </Field>
                <Field label="City">
                  <Input placeholder="Delhi" value={data.buyerCity}
                    onChange={(e) => set("buyerCity", e.target.value)} />
                </Field>
                <Field label="Pincode">
                  <Input placeholder="110001" maxLength={6} value={data.buyerPincode}
                    onChange={(e) => set("buyerPincode", e.target.value)} />
                </Field>
                <Field label="State">
                  <Select value={data.buyerState} onValueChange={(v) => set("buyerState", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="GSTIN">
                  <Input placeholder="07BXXXX5678E1Z2" value={data.buyerGSTIN}
                    onChange={(e) => set("buyerGSTIN", e.target.value.toUpperCase())} />
                </Field>
                <Field label="Phone">
                  <Input placeholder="+91 87654 32109" value={data.buyerPhone}
                    onChange={(e) => set("buyerPhone", e.target.value)} />
                </Field>
                <Field label="Email" className="sm:col-span-2">
                  <Input type="email" placeholder="billing@client.com" value={data.buyerEmail}
                    onChange={(e) => set("buyerEmail", e.target.value)} />
                </Field>
              </div>
            </Section>

            {/* Invoice Details */}
            <Section title="Invoice Details" icon={FileText}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Invoice Number">
                  <Input value={data.invoiceNumber}
                    onChange={(e) => set("invoiceNumber", e.target.value)} />
                </Field>
                <Field label="Place of Supply">
                  <Select value={data.placeOfSupply} onValueChange={(v) => set("placeOfSupply", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Invoice Date">
                  <Input type="date" value={data.invoiceDate}
                    onChange={(e) => set("invoiceDate", e.target.value)} />
                </Field>
                <Field label="Due Date">
                  <Input type="date" value={data.dueDate}
                    onChange={(e) => set("dueDate", e.target.value)} />
                </Field>
              </div>
              <div className="mt-3 text-xs rounded-md px-3 py-2 bg-primary/10 text-primary font-medium">
                {data.sellerState === data.placeOfSupply
                  ? <>Intra-state supply — <strong>CGST + SGST</strong> applies</>
                  : <>Inter-state supply — <strong>IGST</strong> applies</>}
              </div>
            </Section>

            {/* Line Items */}
            <Section title="Line Items" icon={Package}>
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[2fr_1fr_0.7fr_0.8fr_1fr_0.8fr_auto] gap-2 px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Description</span>
                  <span>HSN / SAC</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span className="text-right">Rate (₹)</span>
                  <span className="text-right">GST %</span>
                  <span className="w-8" />
                </div>
                <Separator className="hidden sm:block" />

                {data.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_0.7fr_0.8fr_1fr_0.8fr_auto] gap-2 p-2.5 rounded-md border border-border/60 bg-background hover:border-primary/30 transition-colors"
                  >
                    <div className="flex gap-1 items-center">
                      <span className="text-xs text-muted-foreground w-5 shrink-0 sm:hidden font-medium">{idx + 1}.</span>
                      <Input className="text-sm" placeholder="Description of goods / service"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)} />
                    </div>
                    <Input className="text-sm" placeholder="HSN/SAC"
                      value={item.hsnSac}
                      onChange={(e) => updateItem(item.id, "hsnSac", e.target.value)} />
                    <Input className="text-sm" type="number" min={0} placeholder="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)} />
                    <Select value={item.unit} onValueChange={(v) => updateItem(item.id, "unit", v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="text-sm text-right" type="number" min={0} placeholder="0.00"
                      value={item.rate}
                      onChange={(e) => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)} />
                    <Select value={String(item.gstRate)}
                      onValueChange={(v) => updateItem(item.id, "gstRate", parseFloat(v ?? "0"))}>
                      <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between sm:justify-center gap-2">
                      <span className="text-xs font-semibold sm:hidden text-primary">
                        ₹{fmt(item.quantity * item.rate)}
                      </span>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        disabled={data.items.length === 1}
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" className="gap-1.5 mt-1 border-dashed" onClick={addItem}>
                  <PlusCircle className="h-4 w-4" /> Add Line Item
                </Button>
              </div>

              {/* Quick totals */}
              <div className="mt-4 rounded-lg overflow-hidden border border-border text-sm">
                <div className="flex justify-between px-4 py-2.5 border-b bg-muted/30">
                  <span className="text-muted-foreground">Taxable Amount</span>
                  <span className="font-medium">₹ {fmt(calc.subtotal)}</span>
                </div>
                {calc.isIntraState ? (
                  <>
                    <div className="flex justify-between px-4 py-2 border-b">
                      <span className="text-muted-foreground">CGST</span>
                      <span>₹ {fmt(calc.cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2 border-b">
                      <span className="text-muted-foreground">SGST</span>
                      <span>₹ {fmt(calc.sgstTotal)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between px-4 py-2 border-b">
                    <span className="text-muted-foreground">IGST</span>
                    <span>₹ {fmt(calc.igstTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-3 bg-primary text-primary-foreground font-semibold">
                  <span>Total Due</span>
                  <span className="text-base font-bold">₹ {fmt(calc.grandTotal)}</span>
                </div>
              </div>
            </Section>

            {/* Payment Methods */}
            <Section title="Payment Methods & Status" icon={Wallet} defaultOpen={false}>
              <div className="space-y-4">

                {/* Mode selector chips */}
                <div>
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Accepted Payment Modes
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map((pm) => {
                      const active = data.paymentModes.includes(pm.id);
                      return (
                        <button
                          key={pm.id}
                          title={pm.sub}
                          onClick={() => togglePaymentMode(pm.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-foreground border-border hover:border-primary/50 hover:text-primary"
                          }`}
                        >
                          {pm.label}
                        </button>
                      );
                    })}
                  </div>
                  {data.paymentModes.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {data.paymentModes
                        .map((m) => PAYMENT_METHODS.find((pm) => pm.id === m)?.label ?? m)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                {/* UPI sub-fields */}
                {(data.paymentModes.includes("upi") || data.paymentModes.includes("upi_cc")) && (
                  <div className="border border-border/60 rounded-lg p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Smartphone className="h-4 w-4 text-primary" /> UPI Details
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="UPI ID">
                        <Input placeholder="yourname@paytm" value={data.upiId}
                          onChange={(e) => set("upiId", e.target.value)} />
                      </Field>
                      <Field label="Registered Name">
                        <Input placeholder="Name on UPI app" value={data.upiName}
                          onChange={(e) => set("upiName", e.target.value)} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Bank sub-fields */}
                {hasBankModes && (
                  <div className="border border-border/60 rounded-lg p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Banknote className="h-4 w-4 text-primary" /> Bank Account Details
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Account Holder Name" className="sm:col-span-2">
                        <Input placeholder="As per bank records" value={data.accountHolderName}
                          onChange={(e) => set("accountHolderName", e.target.value)} />
                      </Field>
                      <Field label="Bank Name">
                        <Input placeholder="State Bank of India" value={data.bankName}
                          onChange={(e) => set("bankName", e.target.value)} />
                      </Field>
                      <Field label="Account Number">
                        <Input placeholder="XXXXXXXXXX" value={data.accountNumber}
                          onChange={(e) => set("accountNumber", e.target.value)} />
                      </Field>
                      <Field label="IFSC Code">
                        <Input placeholder="SBIN0001234" value={data.ifscCode}
                          onChange={(e) => set("ifscCode", e.target.value.toUpperCase())} />
                      </Field>
                      <Field label="Branch">
                        <Input placeholder="Mumbai Main Branch" value={data.branchName}
                          onChange={(e) => set("branchName", e.target.value)} />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Cheque sub-fields */}
                {data.paymentModes.includes("cheque") && (
                  <div className="border border-border/60 rounded-lg p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <FileText className="h-4 w-4 text-primary" /> Cheque / DD
                    </div>
                    <Field label="Cheque / DD Payable To">
                      <Input placeholder="Legal company name as on cheque"
                        value={data.chequePayableTo}
                        onChange={(e) => set("chequePayableTo", e.target.value)} />
                    </Field>
                  </div>
                )}

                {/* Payment Status + Reference */}
                <div className="border border-border/60 rounded-lg p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-4 w-4 text-primary" /> Payment Status &amp; Reference
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Payment Status">
                      <Select value={data.paymentStatus} onValueChange={(v) => set("paymentStatus", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="partial">Partially Paid</SelectItem>
                          <SelectItem value="paid">Fully Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Amount Paid (₹)">
                      <Input type="number" min={0} placeholder="0.00"
                        value={data.amountPaid || ""}
                        disabled={data.paymentStatus === "unpaid"}
                        onChange={(e) => set("amountPaid", parseFloat(e.target.value) || 0)} />
                    </Field>
                    <Field label="Reference / UTR / Transaction ID" className="sm:col-span-2">
                      <Input
                        placeholder="UTR No · UPI Ref · Cheque No · Transaction ID"
                        value={data.paymentReference}
                        onChange={(e) => set("paymentReference", e.target.value)} />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">Status on invoice:</span>
                    <PayStatusBadge status={data.paymentStatus} />
                  </div>
                </div>
              </div>
            </Section>

            {/* Bank Details (standalone, shown when no bank transfer mode selected) */}
            {!hasBankModes && (
              <Section title="Bank Details" icon={Banknote} defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Account Holder Name" className="sm:col-span-2">
                    <Input placeholder="As per bank records" value={data.accountHolderName}
                      onChange={(e) => set("accountHolderName", e.target.value)} />
                  </Field>
                  <Field label="Bank Name">
                    <Input placeholder="State Bank of India" value={data.bankName}
                      onChange={(e) => set("bankName", e.target.value)} />
                  </Field>
                  <Field label="Account Number">
                    <Input placeholder="XXXXXXXXXX" value={data.accountNumber}
                      onChange={(e) => set("accountNumber", e.target.value)} />
                  </Field>
                  <Field label="IFSC Code">
                    <Input placeholder="SBIN0001234" value={data.ifscCode}
                      onChange={(e) => set("ifscCode", e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="Branch Name">
                    <Input placeholder="Mumbai Main Branch" value={data.branchName}
                      onChange={(e) => set("branchName", e.target.value)} />
                  </Field>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tip: Enable NEFT / RTGS / IMPS in Payment Methods to manage bank details there.
                </p>
              </Section>
            )}

            {/* Notes & Terms */}
            <Section title="Notes & Terms" icon={FileText} defaultOpen={false}>
              <div className="space-y-3">
                <Field label="Notes (visible on invoice)">
                  <Textarea rows={2} placeholder="e.g. Thank you for your business!"
                    value={data.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
                <Field label="Terms & Conditions">
                  <Textarea rows={5} value={data.termsAndConditions}
                    onChange={(e) => set("termsAndConditions", e.target.value)} />
                </Field>
              </div>
            </Section>
          </div>

          {/* ════ Preview panel ════ */}
          <div className={`lg:sticky lg:top-20 ${activeView === "form" ? "hidden lg:block" : ""}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-muted-foreground">Live Preview</span>
              <div className="flex items-center gap-2">
                <PayStatusBadge status={data.paymentStatus} />
                <Badge variant="outline" className="text-xs">
                  {calc.isIntraState ? "CGST + SGST" : "IGST"}
                </Badge>
              </div>
            </div>
            <div className="border border-border rounded-xl shadow-md bg-white overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
                <div className="p-6" style={{ minWidth: "640px" }}>
                  <InvoicePreview ref={previewRef} data={data} calc={calc} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
