/** Which files a provider can upload as a document, and the check made in the browser before anything is sent. */

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const PHOTO_ACCEPT = "image/jpeg,image/png";

export const DOCUMENT_HINT = "PDF, JPG or PNG, up to 10 MB";

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);

/** A plain sentence saying what is wrong with the file, or null when it can be sent. The server checks again. */
export const documentFileProblem = (file: { name: string; type: string; size: number }): string | null => {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  const typeOk = file.type ? ALLOWED_TYPES.has(file.type.toLowerCase()) : ALLOWED_EXTENSIONS.has(extension);
  if (!typeOk || (extension && !ALLOWED_EXTENSIONS.has(extension))) {
    return "That file type is not accepted. Upload a PDF, JPG or PNG.";
  }
  if (file.size <= 0) return "That file is empty. Choose another one.";
  if (file.size > MAX_DOCUMENT_BYTES) return "That file is larger than 10 MB. Use a smaller file, or take a photo instead.";
  return null;
};
