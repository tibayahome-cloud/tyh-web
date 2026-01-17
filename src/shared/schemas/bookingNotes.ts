/**
 * Booking Notes types and mappers
 */
import { coerceBoolean, coerceDate, coerceId, coerceString, toObject } from "./helpers";
import type { BookingParty } from "./booking";

// Note types matching API
export const NOTE_TYPES = [
    "observation",
    "action",
    "recommendation",
    "continuity",
    "checklist",
    "internal"
] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export type NoteAttachment = {
    id: string;
    url: string;
    type: string;
    uploadedAt: string | null;
    caption: string | null;
};

export type BookingNote = {
    id: string;
    bookingId: string;
    authorUserId: string;
    noteType: NoteType;
    content: string;
    isFlagged: boolean;
    carryForward: boolean;
    attachments: NoteAttachment[];
    recordedAt: string | null;
    templateId: string | null;
    sourceNoteId: string | null;
    author: BookingParty | null;
};

export type NoteTemplate = {
    id: string;
    serviceId: string;
    name: string;
    noteType: NoteType;
    contentTemplate: string;
    isActive: boolean;
    displayOrder: number;
};

// Input types for API calls
export type CreateNoteInput = {
    content: string;
    noteType?: NoteType;
    isFlagged?: boolean;
    carryForward?: boolean;
    attachments?: { url: string; type?: string; caption?: string }[];
    templateId?: string;
};

export type UpdateNoteInput = {
    content?: string;
    noteType?: NoteType;
    isFlagged?: boolean;
    carryForward?: boolean;
    attachments?: NoteAttachment[];
};

export type AddAttachmentInput = {
    url: string;
    type?: string;
    caption?: string;
};

// Mapper for user party (reuse from booking.ts pattern)
const mapUserParty = (payload: unknown): BookingParty | null => {
    if (!payload) return null;
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;
    return {
        id,
        fullName: coerceString(raw.full_name) ?? coerceString(raw.fullName) ?? "",
        avatarUrl: coerceString(raw.avatar_url) ?? coerceString(raw.avatarUrl),
        email: coerceString(raw.email),
        phone: coerceString(raw.phone)
    };
};

export const mapNoteAttachment = (payload: unknown): NoteAttachment | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;
    return {
        id,
        url: coerceString(raw.url) ?? "",
        type: coerceString(raw.type) ?? "image/jpeg",
        uploadedAt: coerceDate(raw.uploaded_at) ?? coerceDate(raw.uploadedAt),
        caption: coerceString(raw.caption)
    };
};

export const mapBookingNote = (payload: unknown): BookingNote | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;

    const noteTypeRaw = coerceString(raw.note_type) ?? coerceString(raw.noteType) ?? "observation";
    const noteType: NoteType = NOTE_TYPES.includes(noteTypeRaw as NoteType)
        ? (noteTypeRaw as NoteType)
        : "observation";

    const attachmentsRaw = Array.isArray(raw.attachments) ? raw.attachments : [];
    const attachments = attachmentsRaw
        .map((a) => mapNoteAttachment(a))
        .filter((a): a is NoteAttachment => Boolean(a));

    return {
        id,
        bookingId: coerceId(raw.booking_id) ?? coerceId(raw.bookingId) ?? "",
        authorUserId: coerceId(raw.author_user_id) ?? coerceId(raw.authorUserId) ?? "",
        noteType,
        content: coerceString(raw.content) ?? "",
        isFlagged: coerceBoolean(raw.is_flagged) ?? coerceBoolean(raw.isFlagged) ?? false,
        carryForward: coerceBoolean(raw.carry_forward) ?? coerceBoolean(raw.carryForward) ?? false,
        attachments,
        recordedAt: coerceDate(raw.recorded_at) ?? coerceDate(raw.recordedAt),
        templateId: coerceId(raw.template_id) ?? coerceId(raw.templateId) ?? null,
        sourceNoteId: coerceId(raw.source_note_id) ?? coerceId(raw.sourceNoteId) ?? null,
        author: mapUserParty(raw.author)
    };
};

export const mapBookingNotes = (payload: unknown): BookingNote[] => {
    if (!Array.isArray(payload)) return [];
    return payload
        .map((entry) => mapBookingNote(entry))
        .filter((entry): entry is BookingNote => Boolean(entry));
};

export const mapNoteTemplate = (payload: unknown): NoteTemplate | null => {
    const raw = toObject(payload);
    const id = coerceId(raw.id);
    if (!id) return null;

    const noteTypeRaw = coerceString(raw.note_type) ?? coerceString(raw.noteType) ?? "observation";
    const noteType: NoteType = NOTE_TYPES.includes(noteTypeRaw as NoteType)
        ? (noteTypeRaw as NoteType)
        : "observation";

    return {
        id,
        serviceId: coerceId(raw.service_id) ?? coerceId(raw.serviceId) ?? "",
        name: coerceString(raw.name) ?? "",
        noteType,
        contentTemplate: coerceString(raw.content_template) ?? coerceString(raw.contentTemplate) ?? "",
        isActive: coerceBoolean(raw.is_active) ?? coerceBoolean(raw.isActive) ?? true,
        displayOrder: parseInt(String(raw.display_order ?? raw.displayOrder ?? 0), 10) || 0
    };
};

export const mapNoteTemplates = (payload: unknown): NoteTemplate[] => {
    if (!Array.isArray(payload)) return [];
    return payload
        .map((entry) => mapNoteTemplate(entry))
        .filter((entry): entry is NoteTemplate => Boolean(entry));
};
