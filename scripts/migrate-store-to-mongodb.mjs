import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { get } from "@vercel/blob";
import { MongoClient } from "mongodb";

await loadEnvironment([".env.local", ".env.migration.local"]);

const mongoUri = requiredEnvironment("MONGODB_URI");
const databaseName = process.env.MONGODB_DB?.trim() || "personal_os";
const collectionName = process.env.MONGODB_COLLECTION?.trim() || "app_store";
const sourceKey = process.env.PERSONAL_OS_SOURCE_STORE_KEY?.trim() || process.env.PERSONAL_OS_STORE_KEY?.trim() || "default";
const destinationKey = process.env.PERSONAL_OS_STORE_KEY?.trim() || "default";
const blobToken = requiredEnvironment("BLOB_READ_WRITE_TOKEN");
const blobPath = `app-store/${sourceKey}.json`;

console.log(`Reading private source store: blob/${blobPath}`);
const blob = await get(blobPath, { access: "private", useCache: false, token: blobToken });
if (!blob || blob.statusCode !== 200) throw new Error(`Vercel Blob store was not found at ${blobPath}.`);

const sourceText = await new Response(blob.stream).text();
const sourceStore = JSON.parse(sourceText);
const sourceSummary = summarizeStore(sourceStore);
const sourceChecksum = checksum(sourceStore);

const backupDirectory = path.resolve(".local-data", "private-backups");
await fs.mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replaceAll(":", "-");
const backupPath = path.join(backupDirectory, `blob-${sourceKey}-${timestamp}.json`);
await fs.writeFile(backupPath, JSON.stringify(sourceStore, null, 2), { mode: 0o600 });
console.log(`Created ignored private backup: ${backupPath}`);

const client = new MongoClient(mongoUri, {
  appName: "personal-os-migration",
  serverSelectionTimeoutMS: 15_000,
});

try {
  await client.connect();
  const collection = client.db(databaseName).collection(collectionName);
  const now = new Date();
  await collection.updateOne(
    { _id: destinationKey },
    {
      $set: {
        data: sourceStore,
        schemaVersion: 1,
        updatedAt: now,
        migration: {
          source: "vercel-blob",
          sourceKey,
          sourceChecksum,
          migratedAt: now,
        },
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const saved = await collection.findOne({ _id: destinationKey });
  if (!saved?.data) throw new Error("MongoDB write completed without a readable store document.");

  const destinationSummary = summarizeStore(saved.data);
  const destinationChecksum = checksum(saved.data);
  if (sourceChecksum !== destinationChecksum) {
    throw new Error(`Migration verification failed: source ${sourceChecksum} does not match MongoDB ${destinationChecksum}.`);
  }

  console.log(`Verified MongoDB ${databaseName}.${collectionName}/${destinationKey}`);
  console.log(`Checksum: ${sourceChecksum}`);
  console.log(`Records: ${JSON.stringify(destinationSummary)}`);
} finally {
  await client.close();
}

async function loadEnvironment(files) {
  for (const file of files) {
    const content = await fs.readFile(path.resolve(file), "utf8").catch(() => "");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function checksum(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function summarizeStore(store) {
  return Object.fromEntries(
    Object.entries(store)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => [key, value.length]),
  );
}
