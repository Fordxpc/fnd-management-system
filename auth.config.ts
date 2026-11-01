declare const process: any;
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./src/db/schema";

// For CLI usage only. Use placeholder values if env vars aren't set locally.
const sql = neon(process.env.DATABASE_URL || "postgresql://placeholder");
const db = drizzle(sql, { schema });

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || "temp-cli-secret",
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