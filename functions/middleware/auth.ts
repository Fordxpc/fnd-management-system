import { eq, sql } from "drizzle-orm";
import { db } from "../../src/lib/db.js";
import { users } from "../../src/db/schema.js";

export interface AuthUser {
  email: string;
  role: string;
}

export async function requireAuth(
  request: Request,
  env: any
): Promise<AuthUser> {

  const email = request.headers.get("x-user-email");

  if (!email) {
    throw new Error("Unauthorized");
  }

  const [user] = await db
    .select({
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(
      sql`LOWER(${users.email}) = LOWER(${email})`
    )
    .limit(1);

  if (!user) {
    throw new Error("Unauthorized");
  }

  return {
    email: user.email!,
    role: user.role || "",
  };
}