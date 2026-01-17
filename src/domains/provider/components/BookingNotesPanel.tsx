/**
 * BookingNotesPanel - Provider notes management for a booking
 */
import { useState, useCallback } from "react";
import {
    FileText,
    Plus,
    Flag,
    RefreshCw,
    Trash2,
    Image,
    ChevronDown,
    ChevronUp,
    Clock,
    User,
    AlertCircle
} from "lucide-react";
import classNames from "classnames";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { Spinner } from "../../../shared/components/Spinner";
import {
    fetchBookingNotes,
    createBookingNote,
    updateBookingNote,
    deleteBookingNote,
    fetchNoteTemplates
} from "../../../shared/libs/bookings";
import type {
    BookingNote,
    NoteTemplate,
    NoteType,
    CreateNoteInput
} from "../../../shared/schemas/bookingNotes";
import { NOTE_TYPES } from "../../../shared/schemas/bookingNotes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
    observation: "Observation",
    action: "Action Taken",
    recommendation: "Recommendation",
    continuity: "Continuity",
    checklist: "Checklist",
    internal: "Internal"
};

const NOTE_TYPE_COLORS: Record<NoteType, string> = {
    observation: "bg-blue-100 text-blue-700",
    action: "bg-emerald-100 text-emerald-700",
    recommendation: "bg-amber-100 text-amber-700",
    continuity: "bg-purple-100 text-purple-700",
    checklist: "bg-slate-100 text-slate-700",
    internal: "bg-rose-100 text-rose-700"
};

interface BookingNotesPanelProps {
    bookingId: string;
    serviceId?: string;
    isProvider?: boolean;
}

export const BookingNotesPanel = ({
    bookingId,
    serviceId,
    isProvider = true
}: BookingNotesPanelProps) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const queryClient = useQueryClient();

    // Fetch notes
    const {
        data: notes = [],
        isLoading,
        error
    } = useQuery({
        queryKey: ["bookingNotes", bookingId],
        queryFn: () => fetchBookingNotes(bookingId),
        staleTime: 30000
    });

    // Fetch templates if serviceId provided
    const { data: templates = [] } = useQuery({
        queryKey: ["noteTemplates", serviceId],
        queryFn: () => (serviceId ? fetchNoteTemplates(serviceId) : Promise.resolve([])),
        enabled: !!serviceId,
        staleTime: 60000
    });

    // Create note mutation
    const createMutation = useMutation({
        mutationFn: (input: CreateNoteInput) => createBookingNote(bookingId, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookingNotes", bookingId] });
            setShowAddForm(false);
        }
    });

    // Delete note mutation
    const deleteMutation = useMutation({
        mutationFn: (noteId: string) => deleteBookingNote(bookingId, noteId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookingNotes", bookingId] });
        }
    });

    // Toggle flag mutation
    const toggleFlagMutation = useMutation({
        mutationFn: ({ noteId, isFlagged }: { noteId: string; isFlagged: boolean }) =>
            updateBookingNote(bookingId, noteId, { isFlagged }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookingNotes", bookingId] });
        }
    });

    if (isLoading) {
        return (
            <Card className="p-4 border-none bg-white/80 backdrop-blur-sm shadow-sm">
                <div className="flex items-center justify-center py-8">
                    <Spinner />
                </div>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="p-4 border-none bg-rose-50 shadow-sm">
                <div className="flex items-center gap-2 text-rose-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Failed to load notes</span>
                </div>
            </Card>
        );
    }

    return (
        <Card className="border-none bg-white/90 backdrop-blur-sm shadow-sm ring-1 ring-slate-100 overflow-hidden">
            {/* Header */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-bold text-slate-900">Service Notes</h3>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                            {notes.length} note{notes.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
                {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
            </button>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="border-t border-slate-100">
                    {/* Notes List */}
                    {notes.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {notes.map((note) => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    onToggleFlag={() =>
                                        toggleFlagMutation.mutate({
                                            noteId: note.id,
                                            isFlagged: !note.isFlagged
                                        })
                                    }
                                    onDelete={() => deleteMutation.mutate(note.id)}
                                    isProvider={isProvider}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center">
                            <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500">No notes yet</p>
                            <p className="text-xs text-slate-400">
                                Add notes to document your service
                            </p>
                        </div>
                    )}

                    {/* Add Note Form */}
                    {showAddForm ? (
                        <AddNoteForm
                            templates={templates}
                            onSubmit={(input) => createMutation.mutate(input)}
                            onCancel={() => setShowAddForm(false)}
                            isSubmitting={createMutation.isPending}
                        />
                    ) : (
                        isProvider && (
                            <div className="p-4 border-t border-slate-100">
                                <Button
                                    variant="ghost"
                                    className="w-full h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-xs"
                                    onClick={() => setShowAddForm(true)}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Note
                                </Button>
                            </div>
                        )
                    )}
                </div>
            )}
        </Card>
    );
};

// Note Card Component
interface NoteCardProps {
    note: BookingNote;
    onToggleFlag: () => void;
    onDelete: () => void;
    isProvider: boolean;
}

const NoteCard = ({ note, onToggleFlag, onDelete, isProvider }: NoteCardProps) => {
    const formattedDate = note.recordedAt
        ? new Date(note.recordedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        })
        : null;

    return (
        <div className="p-4 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className={classNames(
                                "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                NOTE_TYPE_COLORS[note.noteType] || NOTE_TYPE_COLORS.observation
                            )}
                        >
                            {NOTE_TYPE_LABELS[note.noteType] || note.noteType}
                        </span>
                        {note.isFlagged && (
                            <Flag className="h-3 w-3 text-rose-500 fill-rose-500" />
                        )}
                        {note.carryForward && (
                            <RefreshCw className="h-3 w-3 text-purple-500" />
                        )}
                        {note.sourceNoteId && (
                            <span className="text-[9px] font-medium text-purple-500 uppercase">
                                From Previous
                            </span>
                        )}
                    </div>

                    {/* Content */}
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {note.content}
                    </p>

                    {/* Attachments */}
                    {note.attachments.length > 0 && (
                        <div className="flex gap-2 mt-3">
                            {note.attachments.map((attachment) => (
                                <a
                                    key={attachment.id}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs hover:bg-slate-200 transition-colors"
                                >
                                    <Image className="h-3 w-3" />
                                    <span>{attachment.caption || "Photo"}</span>
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400">
                        {note.author && (
                            <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {note.author.fullName}
                            </span>
                        )}
                        {formattedDate && (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formattedDate}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {isProvider && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onToggleFlag}
                            className={classNames(
                                "p-1.5 rounded-lg transition-colors",
                                note.isFlagged
                                    ? "text-rose-500 bg-rose-50 hover:bg-rose-100"
                                    : "text-slate-400 hover:text-rose-500 hover:bg-slate-100"
                            )}
                            title={note.isFlagged ? "Remove flag" : "Flag for attention"}
                        >
                            <Flag className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 transition-colors"
                            title="Delete note"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Add Note Form Component
interface AddNoteFormProps {
    templates: NoteTemplate[];
    onSubmit: (input: CreateNoteInput) => void;
    onCancel: () => void;
    isSubmitting: boolean;
}

const AddNoteForm = ({
    templates,
    onSubmit,
    onCancel,
    isSubmitting
}: AddNoteFormProps) => {
    const [content, setContent] = useState("");
    const [noteType, setNoteType] = useState<NoteType>("observation");
    const [carryForward, setCarryForward] = useState(false);
    const [isFlagged, setIsFlagged] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim()) return;
        onSubmit({
            content: content.trim(),
            noteType,
            carryForward,
            isFlagged
        });
    };

    const handleTemplateSelect = (template: NoteTemplate) => {
        setContent(template.contentTemplate);
        setNoteType(template.noteType);
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 bg-slate-50">
            {/* Template Quick Select */}
            {templates.length > 0 && (
                <div className="mb-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Quick Templates
                    </label>
                    <div className="flex flex-wrap gap-1">
                        {templates.slice(0, 5).map((template) => (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => handleTemplateSelect(template)}
                                className="px-2 py-1 rounded-lg bg-white text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-600 transition-colors ring-1 ring-slate-200"
                            >
                                {template.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Note Type Select */}
            <div className="mb-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Note Type
                </label>
                <div className="flex flex-wrap gap-1">
                    {NOTE_TYPES.map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setNoteType(type)}
                            className={classNames(
                                "px-2 py-1 rounded-lg text-xs font-medium transition-colors",
                                noteType === type
                                    ? NOTE_TYPE_COLORS[type]
                                    : "bg-white text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200"
                            )}
                        >
                            {NOTE_TYPE_LABELS[type]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Textarea */}
            <div className="mb-3">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter your note..."
                    className="w-full h-24 px-3 py-2 rounded-xl text-sm bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                    autoFocus
                />
            </div>

            {/* Options */}
            <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={carryForward}
                        onChange={(e) => setCarryForward(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Carry to next visit
                    </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isFlagged}
                        onChange={(e) => setIsFlagged(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        Flag for attention
                    </span>
                </label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <Button
                    type="submit"
                    disabled={!content.trim() || isSubmitting}
                    className="flex-1 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs"
                >
                    {isSubmitting ? <Spinner className="h-4 w-4" /> : "Save Note"}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="h-10 px-4 rounded-xl text-slate-600 font-semibold text-xs"
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
};

export default BookingNotesPanel;
