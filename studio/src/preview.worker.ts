/// <reference lib="webworker" />
import { compileFolderProject } from "../../src/compiler.js";
import { projectFilesToSource, serializeAuthoringProject } from "../../src/format-sdk.js";
import type { AuthoringProject } from "./types";

self.onmessage = (event: MessageEvent<{ requestId: number; project: AuthoringProject }>) => {
  const { requestId, project } = event.data;
  try {
    const serialized = serializeAuthoringProject(project, { assetMode: "inline" });
    if (serialized.diagnostics.length) {
      self.postMessage({ requestId, diagnostics: serialized.diagnostics, files: serialized.files });
      return;
    }
    const result = compileFolderProject({ source: projectFilesToSource(serialized.files), inputDir: serialized.entryPath, title: project.title });
    self.postMessage({ requestId, html: "html" in result ? result.html : undefined, diagnostics: result.diagnostics, files: serialized.files });
  } catch (error) {
    self.postMessage({ requestId, diagnostics: [{ severity: "error", code: "PREVIEW_FAILED", message: error instanceof Error ? error.message : String(error) }] });
  }
};
