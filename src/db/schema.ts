import {
  pgTable,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  role: text("role"),
  department: text("department"),

  createdAt: timestamp("created_at"),
});

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),

  sn: text("sn"),
  name: text("name"),

  email: text("email").unique(),

  department: text("department"),
  position: text("position"),

  isSMT: boolean("is_smt"),
  balanceVisible: boolean("balance_visible"),
});