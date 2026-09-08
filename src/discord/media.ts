import {
  DOCUMENT_MAX_BYTES,
  isDocumentFile,
  normalizeImageForChat,
  type TransportMedia,
} from "@assistants-swarm-hub/transport-sdk";
import type { Attachment, Message } from "discord.js";

/**
 * Media on an inbound message: what kind it is, and the bytes the core's
 * vision and voice passes need.
 *
 * Discord is kinder here than most platforms — an attachment arrives with a
 * public CDN URL, its own content type and its size, so there is no file-id
 * round trip and no token on the download. What this module still owns is the
 * judgement: which attachment is worth reading, and what to call it.
 *
 * The core keeps ONE media item per message, so a message with several
 * attachments contributes its first readable one; the rest are named in the
 * text the core mirrors and are not lost, just not read. A text-like file (the
 * contract's `isDocumentFile`) is forwarded whole as a `document`; any
 * other file is named in the text and forwarded as nothing — the core could
 * not read it, and a row saying "unavailable" would only look like a failure.
 */

/** What the core can read, in its vocabulary — or null for a file it cannot. */
export type MediaKind = "photo" | "sticker" | "animation" | "video" | "voice" | "document";

/** How much of an attachment this transport is willing to pull into memory. */
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

/** The kind an attachment is read as, or null when the core cannot read it. */
export function kindOf(attachment: Pick<Attachment, "contentType" | "name">): MediaKind | null {
  const type = attachment.contentType ?? "";
  if (type.startsWith("image/gif")) return "animation";
  if (type.startsWith("image/")) return "photo";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "voice";
  if (isDocumentFile({ filename: attachment.name, mimeType: attachment.contentType })) return "document";
  return null;
}

/** The attachment worth reading: the first image, else the first readable one. */
function pickAttachment(message: Message): Attachment | null {
  const all = [...message.attachments.values()].filter((a) => kindOf(a) !== null);
  if (all.length === 0) return null;
  return all.find((a) => (a.contentType ?? "").startsWith("image/")) ?? all[0];
}

async function download(url: string, maxBytes = MAX_DOWNLOAD_BYTES): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > maxBytes ? null : buf;
  } catch {
    return null;
  }
}

/**
 * Media for one message, with bytes attached, or null when there is nothing
 * to read. A payload that could not be fetched is still reported —
 * `unavailable: true`, no frames — because the core must record that the
 * message HAD media rather than silently treating it as text.
 */
export async function loadMessageMedia(message: Message): Promise<TransportMedia | null> {
  const sticker = message.stickers.first();
  if (sticker) {
    // A sticker is an image with a name worth keeping: it is often the whole
    // message, and the name is the only text the model would otherwise see.
    const bytes = await download(sticker.url);
    const normalized = bytes ? await normalizeImage(bytes) : null;
    return {
      kind: "sticker",
      fileId: sticker.id,
      fileUniqueId: null,
      mimeType: "image/png",
      visionHint: `a sticker named "${sticker.name}"`,
      frames: normalized ? [normalized] : [],
      unavailable: normalized === null,
    };
  }

  const attachment = pickAttachment(message);
  if (!attachment) return null;

  const kind = kindOf(attachment)!;
  // A document's cap is the contract's, checked on Discord's declared size so
  // an oversize file is never pulled in; everything else has this transport's
  // own memory ceiling.
  const isDocument = kind === "document";
  const bytes =
    isDocument && attachment.size > DOCUMENT_MAX_BYTES
      ? null
      : await download(attachment.url, isDocument ? DOCUMENT_MAX_BYTES : MAX_DOWNLOAD_BYTES);

  // Only still images are normalized for the vision endpoints. A video, an
  // audio blob or a document rides as-is; the core decides what it can do
  // with it, and a transport that guessed here would be inventing policy.
  const frames: string[] = [];
  if (bytes) {
    if (kind === "photo" || kind === "animation") {
      const normalized = await normalizeImage(bytes);
      if (normalized) frames.push(normalized);
    } else {
      frames.push(bytes.toString("base64"));
    }
  }

  return {
    kind,
    fileId: attachment.id,
    fileUniqueId: null,
    mimeType: attachment.contentType,
    filename: attachment.name,
    visionHint: attachment.description ?? null,
    frames,
    unavailable: frames.length === 0,
  };
}

async function normalizeImage(bytes: Buffer): Promise<string | null> {
  try {
    const { base64 } = await normalizeImageForChat(bytes.toString("base64"));
    return base64;
  } catch {
    return null;
  }
}

/**
 * How the mirrored text names the attachments the model does not get as
 * media: every one when there are several (only the first readable one is
 * forwarded), and a lone one the core could not read (a PDF, an archive).
 */
export function attachmentNote(message: Message): string | null {
  const all = [...message.attachments.values()];
  if (all.length === 0) return null;
  if (all.length === 1 && kindOf(all[0]) !== null) return null;
  return `(attachments: ${all.map((a) => a.name).join(", ")})`;
}
