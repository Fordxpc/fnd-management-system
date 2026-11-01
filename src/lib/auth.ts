import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "../db/schema";

const APP_URL = "https://fnd-management-system.workers.dev"; // Change to your custom domain if you have one

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