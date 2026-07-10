import { MongoClient, type Collection } from "mongodb";
import type { StoredData } from "@personal-os/core";

type StoreDocument = {
  _id: string;
  data: StoredData;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

const globalForMongo = globalThis as typeof globalThis & {
  personalOsMongoClient?: Promise<MongoClient>;
};

export function hasMongoConfig() {
  return Boolean(process.env.MONGODB_URI);
}

export async function readMongoStore(storeKey: string): Promise<StoredData | null> {
  const document = await storeCollection().then((collection) => collection.findOne({ _id: storeKey }));
  return document?.data ?? null;
}

export async function writeMongoStore(storeKey: string, data: StoredData): Promise<StoredData> {
  const now = new Date();
  const collection = await storeCollection();
  await collection.updateOne(
    { _id: storeKey },
    {
      $set: {
        data,
        schemaVersion: 1,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return data;
}

async function storeCollection(): Promise<Collection<StoreDocument>> {
  const client = await mongoClient();
  const databaseName = process.env.MONGODB_DB?.trim() || "personal_os";
  const collectionName = process.env.MONGODB_COLLECTION?.trim() || "app_store";
  return client.db(databaseName).collection<StoreDocument>(collectionName);
}

async function mongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI must be configured when PERSONAL_OS_STORE_DRIVER=mongodb.");

  if (!globalForMongo.personalOsMongoClient) {
    globalForMongo.personalOsMongoClient = new MongoClient(uri, {
      appName: "personal-os",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    }).connect();
  }

  return globalForMongo.personalOsMongoClient;
}
