import { getAuth } from "../../src/lib/auth.js";
import { getDb } from "../../src/lib/db.js";
import { users, staff } from "../../src/db/schema.js";
import { eq, or, sql } from "drizzle-orm";

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

  const staffNumber = email.split('@')[0].replace(/^sn-/i, '').toUpperCase();
  const [staffRecord] = await db.select({status:staff.status}).from(staff)
    .where(or(sql`lower(${staff.email}) = ${email}`,sql`upper(${staff.sn}) = ${`SN-${staffNumber}`}`)).limit(1);
  if (['resigned', 'archived'].includes(String(staffRecord?.status || '').toLowerCase())) {
    const err: any = new Error('This staff account has been deactivated. Contact Administration.');
    err.status = 403;
    throw err;
  }

  return {
    id: session.user.id,
    email: email,
    name: session.user.name || "",
    role: userRecord?.role || "user",
    department: userRecord?.department || "",
  };
}