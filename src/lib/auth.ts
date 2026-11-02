import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins"; // <-- IMPORT THIS
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

export function getAuth(env: any) {
  const dbUrl = env?.DATABASE_URL;
  const sql = neon(dbUrl || "");
  const db = drizzle(sql, { schema });

  const APP_URL = env?.BETTER_AUTH_URL || "https://management.funadhooairport.com";
  const AUTH_SECRET = env?.BETTER_AUTH_SECRET; 

  return betterAuth({
    baseURL: APP_URL,
    secret: AUTH_SECRET,
    trustedOrigins: [APP_URL],
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: { type: "string", required: false },
        department: { type: "string", required: false },
      },
    },
  });
}