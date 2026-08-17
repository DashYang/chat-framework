/// <reference lib="webworker" />
import { compileDocumentProject, compileFolderProject } from "../../src/compiler.js";
import { projectFilesToSource, serializeAuthoringProject } from "../../src/format-sdk.js";
import type { AuthoringProject } from "./types";

self.onmessage = (event: MessageEvent<{ requestId: number; channel: "editor" | "player"; project: AuthoringProject; preview?: { kind: "conversation" | "message" | "article" | "social" | "library"; conversationId?: string; entityId: string } }>) => {
  const { requestId, channel, project, preview } = event.data;
  try {
    const serialized = serializeAuthoringProject(project, { assetMode: "inline" });
    if (serialized.diagnostics.length) {
      self.postMessage({ requestId, channel, diagnostics: serialized.diagnostics, files: serialized.files });
      return;
    }
    const source = projectFilesToSource(serialized.files);
    const result = preview?.kind === "library"
      ? compileDocumentProject({
        source,
        inputPath: `documents/${preview.entityId}.yml`,
        outputPath: `documents/${preview.entityId}.html`
      })
      : compileFolderProject({ source, inputDir: serialized.entryPath, title: project.title, preview, startInAccountView: channel === "player" });
    self.postMessage({ requestId, channel, html: "html" in result ? result.html : undefined, diagnostics: result.diagnostics, files: serialized.files });
  } catch (error) {
    self.postMessage({ requestId, channel, diagnostics: [{ severity: "error", code: "PREVIEW_FAILED", message: error instanceof Error ? error.message : String(error) }] });
  }
};
