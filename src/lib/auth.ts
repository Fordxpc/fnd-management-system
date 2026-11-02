import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

export function getAuth(env: any) {
  const dbUrl = env?.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("CRITICAL ERROR: DATABASE_URL is missing in Cloudflare Secrets!");
  }

  const sql = neon(dbUrl || "");
  const db = drizzle(sql, { schema });

  const APP_URL = env?.BETTER_AUTH_URL || "https://management.funadhooairport.com";
  const AUTH_SECRET = env?.BETTER_AUTH_SECRET;

  if (!AUTH_SECRET) {
    console.error("CRITICAL ERROR: BETTER_AUTH_SECRET is missing in Cloudflare Secrets!");
  }

  return betterAuth({
    baseURL: APP_URL,
    secret: AUTH_SECRET,
    trustedOrigins: [APP_URL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false },
        department: { type: "string", required: false },
      },
    },
  });
}