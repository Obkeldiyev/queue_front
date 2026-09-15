export type ChatAttachment = {
  name: string;
  data: string;
  mime_type?: string;
  size_bytes?: number;
};

const MAX_CHAT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_CHAT_ATTACHMENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function isImageAttachment(attachment?: ChatAttachment | null) {
  return Boolean(attachment?.mime_type?.startsWith("image/") || attachment?.data?.startsWith("data:image/"));
}

export function attachmentLabel(attachment?: ChatAttachment | null) {
  if (!attachment) return "";
  const size = Number(attachment.size_bytes || 0);
  const readable = size > 0 ? ` · ${size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`}` : "";
  return `${attachment.name || "attachment"}${readable}`;
}

export async function readChatAttachment(file: File): Promise<ChatAttachment> {
  if (file.size <= 0 || file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error("File must be between 1 byte and 5 MB");
  }
  if (!ALLOWED_CHAT_ATTACHMENT_TYPES.has(file.type)) {
    throw new Error("Use an image, PDF, text, CSV, Word, or Excel file");
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this file"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  return { name: file.name, data, mime_type: file.type, size_bytes: file.size };
}