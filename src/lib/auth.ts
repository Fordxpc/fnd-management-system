import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

declare const process: any;

export function getAuth(env: any) {
  const sql = neon(env?.DATABASE_URL || process.env.DATABASE_URL || "");
  const db = drizzle(sql, { schema });

  const APP_URL = env?.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "https://management.funadhooairport.com";
  const AUTH_SECRET = env?.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET || "lvbme4++789LX827t+nxsRmpjbzfEEpTI4BMtvQr304=";

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