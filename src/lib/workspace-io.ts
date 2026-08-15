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

const HANDLE_DATABASE = "cavwic-solutions-lab";
const HANDLE_STORE = "workspace-handles";
const ACTIVE_HANDLE_KEY = "active-workspace";

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

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HANDLE_STORE)) request.result.createObjectStore(HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistWorkspaceDirectory(handle: DirectoryHandleLike): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const database = await openHandleDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(HANDLE_STORE, "readwrite");
      transaction.objectStore(HANDLE_STORE).put(handle, ACTIVE_HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    // Directory access remains usable for this session when handle persistence is unavailable.
  }
}

export async function restoreWorkspaceDirectory(): Promise<DirectoryHandleLike | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openHandleDatabase();
  const handle = await new Promise<DirectoryHandleLike | undefined>((resolve, reject) => {
    const request = database.transaction(HANDLE_STORE, "readonly").objectStore(HANDLE_STORE).get(ACTIVE_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result as DirectoryHandleLike | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (!handle) return null;
  const permission = await handle.queryPermission?.({ mode: "readwrite" });
  return permission === "granted" || permission === undefined ? handle : null;
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

async function getProjectDirectory(handle: DirectoryHandleLike, project: ProjectManifest): Promise<DirectoryHandleLike> {
  const projects = await handle.getDirectoryHandle("projects", { create: true });
  return projects.getDirectoryHandle(project.id, { create: true });
}

async function getProjectDirectories(handle: DirectoryHandleLike, project: ProjectManifest) {
  const library = await handle.getDirectoryHandle("library", { create: true });
  const projectDirectory = await getProjectDirectory(handle, project);
  return {
    library,
    projectDirectory,
    sources: await projectDirectory.getDirectoryHandle("sources", { create: true }),
    work: await projectDirectory.getDirectoryHandle("work", { create: true }),
    templates: await projectDirectory.getDirectoryHandle("templates", { create: true }),
    outputs: await projectDirectory.getDirectoryHandle("outputs", { create: true }),
  };
}

export async function saveProjectStateToDirectory(handle: DirectoryHandleLike, project: ProjectManifest, sourceFiles: Map<string, File> = new Map()): Promise<void> {
  await ensureWritePermission(handle);
  const { library, projectDirectory, sources, work, templates } = await getProjectDirectories(handle, project);

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
}

export async function saveGeneratedFileToDirectory(handle: DirectoryHandleLike, project: ProjectManifest, name: string, content: Blob | string | ArrayBuffer): Promise<void> {
  await ensureWritePermission(handle);
  const projectDirectory = await getProjectDirectory(handle, project);
  const outputs = await projectDirectory.getDirectoryHandle("outputs", { create: true });
  await writeFile(outputs, name, content);
}

export async function saveProjectToDirectory(handle: DirectoryHandleLike, project: ProjectManifest, sourceFiles: Map<string, File> = new Map()): Promise<void> {
  await saveProjectStateToDirectory(handle, project, sourceFiles);

  await saveGeneratedFileToDirectory(handle, project, `${project.id}.md`, projectToMarkdown(project));
  await saveGeneratedFileToDirectory(handle, project, `${project.id}-requirements.csv`, projectToCsv(project));
  await saveGeneratedFileToDirectory(handle, project, `${project.id}.docx`, await projectToDocx(project));
  await saveGeneratedFileToDirectory(handle, project, `${project.id}.xlsx`, await projectToXlsx(project));
  await saveGeneratedFileToDirectory(handle, project, `${project.id}.pptx`, await projectToPptx(project));
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
