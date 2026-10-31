import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon("postgresql://neondb_owner:npg_nB8vaQVjS3Ch@ep-wispy-bread-aoe2biqc-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

export const db = drizzle(sql);