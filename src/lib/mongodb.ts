import { MongoClient, type Collection } from "mongodb";
import type { UserDocument } from "@/types/user";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "SmartExamPractice";
const collectionName = process.env.MONGODB_COLLECTION || "users";

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise() {
  if (!uri) {
    throw new Error("MongoDB is not configured");
  }

  if (!global.mongoClientPromise) {
    const client = new MongoClient(uri);
    global.mongoClientPromise = client.connect().catch((error: unknown) => {
      global.mongoClientPromise = undefined;
      throw error;
    });
  }

  return global.mongoClientPromise;
}

export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const client = await getClientPromise();
  return client.db(dbName).collection<UserDocument>(collectionName);
}