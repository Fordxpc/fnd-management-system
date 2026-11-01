import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

// This tells TypeScript to ignore the red line
declare const process: any; 

const sql = neon(process.env.DATABASE_URL as string);

export const db = drizzle(sql, { schema });