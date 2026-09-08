import { describe, expect, it } from "vitest";

import { attachmentNote, kindOf } from "./media";

/**
 * What this transport reads OFF an attachment: its kind in the core's
 * vocabulary, or nothing for a file the core cannot read — which the mirrored
 * text then names instead.
 */

describe("kindOf", () => {
  it("classifies pictures, clips, audio and text-like files", () => {
    expect(kindOf({ contentType: "image/png", name: "a.png" })).toBe("photo");
    expect(kindOf({ contentType: "image/gif", name: "a.gif" })).toBe("animation");
    expect(kindOf({ contentType: "video/mp4", name: "a.mp4" })).toBe("video");
    expect(kindOf({ contentType: "audio/ogg", name: "a.ogg" })).toBe("voice");
    expect(kindOf({ contentType: "text/csv", name: "watchlist.csv" })).toBe("document");
    // The name wins over a loose content type.
    expect(kindOf({ contentType: "application/octet-stream", name: "sheet.xlsx" })).toBe("document");
  });

  it("is null for a file the core cannot read", () => {
    expect(kindOf({ contentType: "application/pdf", name: "paper.pdf" })).toBeNull();
    expect(kindOf({ contentType: "application/zip", name: "a.zip" })).toBeNull();
  });
});

describe("attachmentNote", () => {
  const message = (files: { name: string; contentType: string | null }[]) =>
    ({ attachments: new Map(files.map((f, i) => [String(i), f])) }) as never;

  it("says nothing for one readable attachment — it travels as media", () => {
    expect(attachmentNote(message([{ name: "a.png", contentType: "image/png" }]))).toBeNull();
    expect(attachmentNote(message([{ name: "list.csv", contentType: "text/csv" }]))).toBeNull();
  });

  it("names a lone unreadable file, and every file when there are several", () => {
    expect(attachmentNote(message([{ name: "paper.pdf", contentType: "application/pdf" }]))).toBe(
      "(attachments: paper.pdf)",
    );
    expect(
      attachmentNote(
        message([
          { name: "a.png", contentType: "image/png" },
          { name: "b.csv", contentType: "text/csv" },
        ]),
      ),
    ).toBe("(attachments: a.png, b.csv)");
  });

  it("says nothing for no attachments", () => {
    expect(attachmentNote(message([]))).toBeNull();
  });
});
