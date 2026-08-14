import { projectToCsv, projectToDocx, projectToMarkdown, projectToPptx, projectToXlsx, presentationMarkdown } from "./exporters";
import { projectManifestSchema, SCHEMA_VERSION, workspaceManifestSchema, type ProjectManifest } from "./workspace-schema";

type WritableLike = { write(data: Blob | string | ArrayBuffer): Promise<void>; close(): Promise<void> };
type FileHandleLike = { getFile(): Promise<File>; createWritable(): Promise<WritableLike> };
export type DirectoryHandleLike = {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  queryPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
  }
}

async function writeFile(directory: DirectoryHandleLike, name: string, content: Blob | string | ArrayBuffer): Promise<void> {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function readJson(directory: DirectoryHandleLike, name: string): Promise<unknown> {
  const handle = await directory.getFileHandle(name);
  const file = await handle.getFile();
  return JSON.parse(await file.text());
}

export function supportsDirectoryAccess(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function chooseWorkspaceDirectory(): Promise<DirectoryHandleLike> {
  if (!window.showDirectoryPicker) throw new Error("Directory access is not available in this browser.");
  return window.showDirectoryPicker({ mode: "readwrite" });
}

async function ensureWritePermission(handle: DirectoryHandleLike): Promise<void> {
  const current = await handle.queryPermission?.({ mode: "readwrite" });
  if (current === "granted" || current === undefined) return;
  const requested = await handle.requestPermission?.({ mode: "readwrite" });
  if (requested !== "granted") throw new Error("Workspace write permission was not granted.");
}

export async function saveProjectToDirectory(handle: DirectoryHandleLike, project: ProjectManifest, sourceFiles: Map<string, File> = new Map()): Promise<void> {
  await ensureWritePermission(handle);
  const library = await handle.getDirectoryHandle("library", { create: true });
  const projects = await handle.getDirectoryHandle("projects", { create: true });
  const projectDirectory = await projects.getDirectoryHandle(project.id, { create: true });
  const sources = await projectDirectory.getDirectoryHandle("sources", { create: true });
  const work = await projectDirectory.getDirectoryHandle("work", { create: true });
  const templates = await projectDirectory.getDirectoryHandle("templates", { create: true });
  const outputs = await projectDirectory.getDirectoryHandle("outputs", { create: true });

  const workspace = workspaceManifestSchema.parse({ schemaVersion: SCHEMA_VERSION, activeProjectId: project.id, projects: [{ id: project.id, name: project.name, updatedAt: project.updatedAt }] });
  await writeFile(handle, "workspace.json", JSON.stringify(workspace, null, 2));
  await writeFile(projectDirectory, "project.json", JSON.stringify(project, null, 2));
  await writeFile(library, "library.json", JSON.stringify({ schemaVersion: SCHEMA_VERSION, evidence: project.evidence }, null, 2));
  await writeFile(work, "requirements.csv", projectToCsv(project));
  await writeFile(work, "solution-draft.md", projectToMarkdown(project));
  await writeFile(work, "presentation.md", presentationMarkdown(project));
  await writeFile(templates, "template-guidance.txt", "Place a standard .pptx company template in this folder. The local technical-bid-package Skill maps layouts and placeholders before rendering. Macros, OLE objects, and complex animations are outside the supported scope.\n");

  for (const source of project.sources) {
    const file = sourceFiles.get(source.id);
    if (file) await writeFile(sources, source.name, file);
  }

  await writeFile(outputs, `${project.id}.md`, projectToMarkdown(project));
  await writeFile(outputs, `${project.id}-requirements.csv`, projectToCsv(project));
  await writeFile(outputs, `${project.id}.docx`, await projectToDocx(project));
  await writeFile(outputs, `${project.id}.xlsx`, await projectToXlsx(project));
  await writeFile(outputs, `${project.id}.pptx`, await projectToPptx(project));
}

export async function loadActiveProject(handle: DirectoryHandleLike): Promise<ProjectManifest> {
  const workspace = workspaceManifestSchema.parse(await readJson(handle, "workspace.json"));
  const projects = await handle.getDirectoryHandle("projects");
  const projectDirectory = await projects.getDirectoryHandle(workspace.activeProjectId);
  return projectManifestSchema.parse(await readJson(projectDirectory, "project.json"));
}

export async function importProjectArchive(file: File): Promise<{ project: ProjectManifest; sourceFiles: Map<string, File> }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const projectEntry = Object.values(zip.files).find((entry) => /^outputs\/[^/]+\.json$/.test(entry.name) && !entry.name.endsWith("output-manifest.json"));
  if (!projectEntry) throw new Error("Project JSON was not found in the archive.");
  const project = projectManifestSchema.parse(JSON.parse(await projectEntry.async("string")));
  const sourceFiles = new Map<string, File>();
  for (const source of project.sources) {
    const entry = zip.file(`sources/${source.name}`);
    if (!entry) continue;
    sourceFiles.set(source.id, new File([await entry.async("blob")], source.name));
  }
  return { project, sourceFiles };
}
