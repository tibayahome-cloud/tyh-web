import React from "react";
import { Copy, PhoneCall, CheckCircle2 } from "lucide-react";
import classNames from "classnames";
import { useToast } from "./ToastProvider";

interface MpesaPaymentInstructionsProps {
    amountCents: number;
    accountNumber: string;
    paybillNumber?: string;
    className?: string;
}

export const MpesaPaymentInstructions: React.FC<MpesaPaymentInstructionsProps> = ({
    amountCents,
    accountNumber,
    paybillNumber = import.meta.env.VITE_MPESA_PAYBILL || "174379",
    className
}) => {
    const toast = useToast();
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

    return (
        <div className={classNames("space-y-4 rounded-3xl bg-slate-50 p-6 border border-slate-100", className)}>
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00A34D] text-white font-bold text-lg shadow-lg">
                    M
                </div>
                <div>
                    <h4 className="text-sm font-bold text-slate-900">M-Pesa Instructions</h4>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Lipa na M-Pesa PayBill</p>
                </div>
            </div>

            <div className="space-y-4 pt-2">
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

                <div className="rounded-2xl bg-white p-4 border border-slate-100 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Enter Amount</p>
                    <p className="text-xl font-bold text-slate-900">KES {amount}</p>
                </div>

                <InstructionStep number={3} label="Enter your M-Pesa PIN and complete" />

                <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-blue-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <p className="text-[10px] font-bold leading-tight uppercase tracking-tight">System will automatically detect your payment</p>
                </div>
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
        className="flex flex-col items-center justify-center rounded-2xl bg-white p-3 border border-slate-100 hover:border-brand-200 transition-colors group relative"
    >
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-900 group-hover:text-brand-600">{value}</p>
        <div className="absolute top-2 right-2 text-slate-300 group-hover:text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <Copy className="h-3 w-3" />
        </div>
    </button>
);
