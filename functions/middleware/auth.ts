import { getAuth } from "../../src/lib/auth.js";
import { getDb } from "../../src/lib/db.js";
import { users } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";

export async function requireAuth(request: Request, env: any) {
  const session = await getAuth(env).api.getSession({ 
    headers: request.headers,
  });

  if (!session?.user) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  const email = session.user.email?.toLowerCase() || "";

  // Get DB instance inside the function using env
  const db = getDb(env); 

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return {
    id: session.user.id,
    email: email,
    name: session.user.name || "",
    role: userRecord?.role || "user",
    department: userRecord?.department || "",
  };
}