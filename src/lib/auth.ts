import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "../db/schema";

// This tells TypeScript to ignore the red line
declare const process: any; 

// 🔴 Make sure your custom domain is in wrangler.toml [vars], or change the fallback here
const APP_URL = process.env.BETTER_AUTH_URL || "https://management.funadhooairport.com";

export const auth = betterAuth({
  baseURL: APP_URL,
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