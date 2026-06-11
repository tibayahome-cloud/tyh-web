import React, { useState } from "react";
import { Copy, CheckCircle2, Smartphone, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import classNames from "classnames";
import { useToast } from "./ToastProvider";

interface MpesaPaymentInstructionsProps {
    amountCents: number;
    accountNumber: string;
    paybillNumber?: string;
    phoneNumber?: string; // pre-filled from booking/user profile
    onStkPush?: (phone: string) => Promise<void>; // call your Flask STK push endpoint
    className?: string;
}

export const MpesaPaymentInstructions: React.FC<MpesaPaymentInstructionsProps> = ({
    amountCents,
    accountNumber,
    paybillNumber = import.meta.env.VITE_MPESA_PAYBILL || "4187425",
    phoneNumber = "",
    onStkPush,
    className
}) => {
    const toast = useToast();
    const [phone, setPhone] = useState(phoneNumber);
    const [phoneError, setPhoneError] = useState("");
    const [loading, setLoading] = useState(false);
    const [stkSent, setStkSent] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);

    const amount = (amountCents / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.showToast({
            title: "Copied!",
            description: `${label} copied to clipboard`,
            variant: "success"
        });
    };

    const validatePhone = (value: string) => {
        // Accept 07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX
        return /^(07|01)\d{8}$|^2547\d{8}$|^2541\d{8}$/.test(value.trim());
    };

    const handleStkPush = async () => {
        if (!validatePhone(phone)) {
            setPhoneError("Enter a valid Safaricom number e.g. 0712345678");
            return;
        }
        setPhoneError("");
        setLoading(true);
        try {
            await onStkPush?.(phone.trim());
            setStkSent(true);
            toast.showToast({
                title: "Request sent!",
                description: "Check your phone for the M-Pesa prompt",
                variant: "success"
            });
        } catch (err: any) {
            toast.showToast({
                title: "Failed",
                description: err?.message || "Could not send STK push. Try manual payment below.",
                variant: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = () => {
        setStkSent(false);
    };

    return (
        <div className={classNames("space-y-3 rounded-3xl bg-slate-50 p-6 border border-slate-100", className)}>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00A34D] text-white font-bold text-lg shadow-lg">
                    M
                </div>
                <div>
                    <h4 className="text-sm font-bold text-slate-900">Pay with M-Pesa</h4>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Lipa na M-Pesa</p>
                </div>
            </div>

            {/* Amount */}
            <div className="rounded-2xl bg-white p-4 border border-slate-100 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Amount Due</p>
                <p className="text-2xl font-bold text-slate-900">KES {amount}</p>
            </div>

            {/* STK Push Section */}
            <div className="rounded-2xl bg-white border border-slate-100 p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#00A34D]" />
                    <p className="text-xs font-bold text-slate-800">Send prompt to your phone</p>
                </div>

                {!stkSent ? (
                    <>
                        {/* Phone input */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                M-Pesa Phone Number
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value);
                                    setPhoneError("");
                                }}
                                placeholder="e.g. 0712345678"
                                className={classNames(
                                    "w-full rounded-xl border px-3 py-2 text-sm font-medium text-slate-900 outline-none transition-colors",
                                    "placeholder:text-slate-300 focus:border-[#00A34D] focus:ring-1 focus:ring-[#00A34D]",
                                    phoneError ? "border-red-400" : "border-slate-200"
                                )}
                            />
                            {phoneError && (
                                <p className="text-[10px] text-red-500 font-medium">{phoneError}</p>
                            )}
                        </div>

                        {/* STK Push button */}
                        <button
                            onClick={handleStkPush}
                            disabled={loading || !onStkPush}
                            className={classNames(
                                "w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
                                "bg-[#00A34D] text-white hover:bg-[#008f44] active:scale-[0.98]",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "flex items-center justify-center gap-2"
                            )}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Sending prompt…
                                </>
                            ) : (
                                "Send M-Pesa Prompt"
                            )}
                        </button>
                    </>
                ) : (
                    /* Success state */
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-green-700">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <p className="text-[10px] font-bold leading-tight uppercase tracking-tight">
                                Prompt sent to {phone} — enter your PIN to complete
                            </p>
                        </div>
                        <button
                            onClick={handleRetry}
                            className="w-full rounded-xl border border-slate-200 py-2 text-[11px] font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
                        >
                            Didn't receive it? Retry with a different number
                        </button>
                    </div>
                )}
            </div>

            {/* Manual instructions — collapsible */}
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <button
                    onClick={() => setManualOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    <span>Pay manually instead</span>
                    {manualOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {manualOpen && (
                    <div className="bg-white border-t border-slate-100 px-4 pb-4 space-y-4 pt-3">
                        <InstructionStep number={1} label="Go to M-Pesa menu and select Lipa na M-Pesa" />
                        <InstructionStep number={2} label="Select PayBill" />

                        <div className="grid grid-cols-2 gap-3">
                            <InstructionCard
                                label="Business Number"
                                value={paybillNumber}
                                onCopy={() => copyToClipboard(paybillNumber, "PayBill number")}
                            />
                            <InstructionCard
                                label="Account Number"
                                value={accountNumber}
                                onCopy={() => copyToClipboard(accountNumber, "Account number")}
                            />
                        </div>

                        <InstructionStep number={3} label="Enter your M-Pesa PIN and complete" />

                        <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-blue-700">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <p className="text-[10px] font-bold leading-tight uppercase tracking-tight">
                                System will automatically detect your payment
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const InstructionStep = ({ number, label }: { number: number; label: string }) => (
    <div className="flex gap-3 items-center">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
            {number}
        </div>
        <p className="text-xs font-medium text-slate-700">{label}</p>
    </div>
);

const InstructionCard = ({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) => (
    <button
        onClick={onCopy}
        className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-3 border border-slate-100 hover:border-brand-200 transition-colors group relative"
    >
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-900 group-hover:text-brand-600">{value}</p>
        <div className="absolute top-2 right-2 text-slate-300 group-hover:text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <Copy className="h-3 w-3" />
        </div>
    </button>
);