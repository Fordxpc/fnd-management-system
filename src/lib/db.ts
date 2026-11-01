import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

declare const process: any;

export function getDb(env: any) {
  const sql = neon(env?.DATABASE_URL || process.env.DATABASE_URL);
  return drizzle(sql, { schema });
}

const defaultSql = neon(process.env.DATABASE_URL || "postgresql://placeholder");
export const db = drizzle(defaultSql, { schema });