import type { AuthoringProject, ProjectSummary } from "./types";

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
  return row?.project ? structuredClone(row.project) : null;
}

export async function saveProject(project: AuthoringProject): Promise<void> {
  await transact<IDBValidKey>("readwrite", (store) => store.put({ id: project.id, title: project.title, updatedAt: Date.now(), project }));
}

export async function removeProject(id: string): Promise<void> {
  await transact<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
}
