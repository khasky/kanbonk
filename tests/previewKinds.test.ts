import { describe, expect, it } from "vitest";
import { previewKind, previewMimeType } from "../src/card/previewKinds";

describe("attachment preview", () => {
  it("recognises previewable files by type and, for untyped files, by extension", () => {
    expect(previewKind("photo.png", "image/png")).toBe("image");
    expect(previewKind("logo.svg", "application/octet-stream")).toBe("image");
    expect(previewKind("spec.pdf", "application/pdf")).toBe("pdf");
    expect(previewKind("SPEC.PDF", "")).toBe("pdf");
    expect(previewKind("notes.md", "application/octet-stream")).toBe("markdown");
    expect(previewKind("notes.txt", "text/markdown")).toBe("markdown");
    expect(previewKind("comment.txt", "text/plain")).toBe("text");
    expect(previewKind("data.json", "application/json")).toBe("text");
    expect(previewKind("main.rs", "")).toBe("text");
    expect(previewKind("clip.mp4", "video/mp4")).toBe("video");
    expect(previewKind("song.mp3", "")).toBe("audio");
    expect(previewKind("archive.zip", "application/zip")).toBeUndefined();
    expect(previewKind("Makefile", "application/octet-stream")).toBeUndefined();
    expect(previewKind("photo.tiff", "image/tiff")).toBeUndefined();
  });

  it("gives untyped PDFs and SVGs the type the browser needs to render them", () => {
    expect(previewMimeType("pdf", "spec.pdf", "application/octet-stream")).toBe("application/pdf");
    expect(previewMimeType("image", "logo.svg", "")).toBe("image/svg+xml");
    expect(previewMimeType("image", "photo.png", "image/png")).toBe("image/png");
  });
});
