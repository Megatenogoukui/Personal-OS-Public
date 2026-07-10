import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { emptyStoredData, type AppNotification, type DailyPlan, type ManualModule, type ManualRecord, type StoredData, type WeeklyReview, type WorkTask } from "@personal-os/core";
import { hasMongoConfig, readMongoStore, writeMongoStore } from "./mongodb";

const storePath = process.env.VERCEL
  ? path.join("/tmp", "personal-os-store.json")
  : path.join(process.cwd(), ".local-data", "store.json");
const storeKey = process.env.PERSONAL_OS_STORE_KEY || "default";
const blobPath = `app-store/${storeKey}.json`;

export function getStoreInfo() {
  const driver = selectedStoreDriver();
  if (driver === "mongodb") {
    return {
      driver,
      key: storeKey,
      database: process.env.MONGODB_DB?.trim() || "personal_os",
      collection: process.env.MONGODB_COLLECTION?.trim() || "app_store",
    };
  }
  return { driver, key: storeKey };
}

export async function readStore(): Promise<StoredData> {
  const driver = selectedStoreDriver();
  if (driver === "mongodb") return mergeStore(await readMongoStore(storeKey));
  if (driver === "blob") return mergeStore(await readBlobStore(true));
  if (driver === "local") return readLocalStore();

  const blobStore = await readBlobStore();
  if (blobStore) return mergeStore(blobStore);

  return readLocalStore();
}

async function readLocalStore(): Promise<StoredData> {
  try {
    const content = await fs.readFile(storePath, "utf8");
    return mergeStore(JSON.parse(content) as Partial<StoredData>);
  } catch {
    return emptyStoredData;
  }
}

export async function writeStore(data: StoredData): Promise<StoredData> {
  const driver = selectedStoreDriver();
  if (driver === "mongodb") return writeMongoStore(storeKey, data);
  if (driver === "blob") return requiredWrite("Vercel Blob", writeBlobStore(data, true));
  if (driver === "local") return writeLocalStore(data);

  const blobSaved = await writeBlobStore(data);
  if (blobSaved) return blobSaved;

  return writeLocalStore(data);
}

async function writeLocalStore(data: StoredData): Promise<StoredData> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(data, null, 2));
  return data;
}

async function readBlobStore(required = false): Promise<StoredData | null> {
  if (!required && !shouldUseBlobStore()) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN must be configured when PERSONAL_OS_STORE_DRIVER=blob.");

  try {
    const result = await get(blobPath, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const content = await new Response(result.stream).text();
    return { ...emptyStoredData, ...(JSON.parse(content) as Partial<StoredData>) };
  } catch (caught) {
    if (required) throw caught;
    console.warn("blob_store_read_failed", caught instanceof Error ? caught.message : "Unknown blob store error.");
    return null;
  }
}

async function writeBlobStore(data: StoredData, required = false): Promise<StoredData | null> {
  if (!required && !shouldUseBlobStore()) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN must be configured when PERSONAL_OS_STORE_DRIVER=blob.");

  try {
    await put(blobPath, JSON.stringify(data, null, 2), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return data;
  } catch (caught) {
    if (required) throw caught;
    console.error("blob_store_write_failed", caught instanceof Error ? caught.message : "Unknown blob store error.");
    return null;
  }
}

function shouldUseBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && (process.env.VERCEL || process.env.PERSONAL_OS_STORE_DRIVER === "blob"));
}

type StoreDriver = "auto" | "mongodb" | "blob" | "local";

function selectedStoreDriver(): StoreDriver {
  const configured = process.env.PERSONAL_OS_STORE_DRIVER?.trim().toLowerCase();
  if (!configured) return hasMongoConfig() ? "mongodb" : "auto";
  if (["auto", "mongodb", "blob", "local"].includes(configured)) return configured as StoreDriver;
  throw new Error(`Unsupported PERSONAL_OS_STORE_DRIVER: ${configured}`);
}

function mergeStore(data: Partial<StoredData> | null): StoredData {
  return { ...emptyStoredData, ...(data ?? {}) };
}

async function requiredWrite(label: string, operation: Promise<StoredData | null>): Promise<StoredData> {
  const result = await operation;
  if (!result) throw new Error(`${label} did not persist the Personal OS store.`);
  return result;
}

export async function upsertWorkTasks(tasks: WorkTask[]): Promise<WorkTask[]> {
  const store = await readStore();
  const byId = new Map(store.workTasks.map((task) => [task.id, task]));
  for (const task of tasks) byId.set(task.id, { ...(byId.get(task.id) ?? {}), ...task });
  const workTasks = [...byId.values()];
  await writeStore({ ...store, workTasks });
  return workTasks;
}

export async function addManualRecord(input: Omit<ManualRecord, "id" | "createdAt" | "updatedAt">): Promise<ManualRecord> {
  const store = await readStore();
  const now = new Date().toISOString();
  const record: ManualRecord = {
    ...input,
    id: `${input.module}:${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };
  await writeStore({ ...store, manualRecords: [record, ...store.manualRecords] });
  return record;
}

export async function listManualRecords(module?: ManualModule): Promise<ManualRecord[]> {
  const store = await readStore();
  return module ? store.manualRecords.filter((record) => record.module === module) : store.manualRecords;
}

export async function saveDailyPlan(plan: DailyPlan): Promise<DailyPlan> {
  const store = await readStore();
  await writeStore({ ...store, dailyPlans: [plan, ...store.dailyPlans.filter((item) => item.date !== plan.date)] });
  return plan;
}

export async function saveWeeklyReview(review: WeeklyReview): Promise<WeeklyReview> {
  const store = await readStore();
  await writeStore({
    ...store,
    weeklyReviews: [review, ...store.weeklyReviews.filter((item) => item.weekStart !== review.weekStart)],
  });
  return review;
}

export async function addNotification(notification: Omit<AppNotification, "id" | "createdAt">): Promise<AppNotification> {
  const store = await readStore();
  const created: AppNotification = {
    ...notification,
    id: `note:${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
  await writeStore({ ...store, notifications: [created, ...store.notifications] });
  return created;
}
