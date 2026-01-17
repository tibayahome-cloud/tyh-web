import { useState } from "react";
import { StarIcon } from "lucide-react";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { Button } from "./Button";
import { useCreateFeedbackMutation } from "../hooks/useBookings";
import { useToast } from "./ToastProvider";

interface BookingFeedbackDialogProps {
    open: boolean;
    bookingId: string | null;
    targetName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export const BookingFeedbackDialog = ({
    open,
    bookingId,
    targetName,
    onClose,
    onSuccess
}: BookingFeedbackDialogProps) => {
    const [score, setScore] = useState(5);
    const [comment, setComment] = useState("");
    const toast = useToast();
    const createFeedbackMutation = useCreateFeedbackMutation();

    const handleSubmit = async () => {
        if (!bookingId) return;
        try {
            await createFeedbackMutation.mutateAsync({
                bookingId,
                score,
                comment: comment || undefined
            });
            toast.showToast({ title: "Feedback submitted", variant: "success" });
            onSuccess?.();
            onClose();
        } catch (err: any) {
            toast.showToast({ title: "Error", description: err.message, variant: "error" });
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{ className: "rounded-3xl p-2 w-full max-w-sm" }}
        >
            <DialogTitle className="text-center font-bold text-slate-900 border-b border-slate-50 pb-4">
                Rate your Experience
            </DialogTitle>
            <DialogContent className="pt-6">
                <p className="text-center text-sm text-slate-500 mb-6">
                    How was your service for <span className="font-bold text-slate-900">{targetName}</span>?
                </p>

                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <button
                            key={s}
                            onClick={() => setScore(s)}
                            className="transition-transform active:scale-90"
                        >
                            <StarIcon
                                className={`h-10 w-10 ${s <= score ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                            />
                        </button>
                    ))}
                </div>

                <textarea
                    placeholder="Tell us more (optional)..."
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 min-h-[100px]"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />
            </DialogContent>
            <DialogActions className="p-6 flex flex-col gap-2">
                <Button
                    onClick={handleSubmit}
                    loading={createFeedbackMutation.isPending}
                    className="h-12 rounded-2xl w-full"
                >
                    Submit Review
                </Button>
                <Button
                    variant="ghost"
                    onClick={onClose}
                    className="h-12 rounded-2xl text-slate-400 w-full"
                >
                    Maybe Later
                </Button>
            </DialogActions>
        </Dialog>
    );
};
