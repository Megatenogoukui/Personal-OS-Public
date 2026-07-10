import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { MongoClient } from "mongodb";

await loadEnvironment([".env.local", ".env.development.local", ".env.migration.local", "apps/web/.env.local", "apps/web/.env.development.local"]);

const uri = requiredEnvironment("MONGODB_URI");
const databaseName = process.env.MONGODB_DB?.trim() || "personal_os";
const collectionName = process.env.MONGODB_COLLECTION?.trim() || "app_store";
const storeKey = process.env.PERSONAL_OS_STORE_KEY?.trim() || "default";
const client = new MongoClient(uri, { appName: "personal-os-backup", serverSelectionTimeoutMS: 15_000 });

try {
  await client.connect();
  const document = await client.db(databaseName).collection(collectionName).findOne({ _id: storeKey });
  if (!document?.data) throw new Error(`Store ${databaseName}.${collectionName}/${storeKey} was not found.`);

  const directory = path.resolve(".local-data", "private-backups");
  await fs.mkdir(directory, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const destination = path.join(directory, `mongodb-${storeKey}-${timestamp}.json`);
  await fs.writeFile(destination, JSON.stringify(document.data, null, 2), { mode: 0o600 });

  const checksum = createHash("sha256").update(canonicalJson(document.data)).digest("hex");
  const records = Object.fromEntries(Object.entries(document.data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
  console.log(`Backup: ${destination}`);
  console.log(`Checksum: ${checksum}`);
  console.log(`Records: ${JSON.stringify(records)}`);
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
