import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

declare const process: any;

export function getDb(env: any) {
  const dbUrl = env?.DATABASE_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("DATABASE_URL IS MISSING IN DB.TS!");
  }

  const sql = neon(dbUrl || "postgresql://placeholder");
  return drizzle(sql, { schema });
}

// Keep this for local scripts if needed
const defaultSql = neon(process.env.DATABASE_URL || "postgresql://placeholder");
export const db = drizzle(defaultSql, { schema });