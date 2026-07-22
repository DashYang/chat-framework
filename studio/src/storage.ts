import type { AuthoringProject, ProjectSummary } from "./types";
import { normalizeAuthoringProject } from "../../src/format-sdk.js";

const DB_NAME = "chat-framework-studio";
const DB_VERSION = 1;
const STORE = "projects";

interface StoredProject { id: string; title: string; updatedAt: number; project: AuthoringProject }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  }));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await transact<StoredProject[]>("readonly", (store) => store.getAll());
  return rows.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<AuthoringProject | null> {
  const row = await transact<StoredProject | undefined>("readonly", (store) => store.get(id));
  return row?.project ? normalizeAuthoringProject(row.project) as AuthoringProject : null;
}

export async function saveProject(project: AuthoringProject): Promise<void> {
  const normalized = normalizeAuthoringProject(project) as AuthoringProject;
  await transact<IDBValidKey>("readwrite", (store) => store.put({ id: normalized.id, title: normalized.title, updatedAt: Date.now(), project: normalized }));
}

export async function syncBuiltinProject(project: AuthoringProject): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.get(project.id) as IDBRequest<StoredProject | undefined>;
    request.onsuccess = () => {
      const current = request.result;
      store.put({
        id: project.id,
        title: project.title,
        updatedAt: current?.updatedAt ?? Date.now(),
        project
      });
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function removeProject(id: string): Promise<void> {
  await transact<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
}
