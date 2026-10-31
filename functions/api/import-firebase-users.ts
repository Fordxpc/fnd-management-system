import { db } from "../../src/lib/db.js";
import { users } from "../../src/db/schema.js";

export const onRequestPost = async ({ request }: any) => {
  try {
    const body = await request.json();

    const records = body.users.map((u: any) => ({
      id: u.uid,
      email: u.email.toLowerCase(),
      role: "staff",
      department: "Ground Operations",
      createdAt: new Date(),
    }));

    if (records.length > 0) {
      await db.insert(users).values(records).onConflictDoNothing();
    }

    return Response.json({
      success: true,
      imported: records.length,
    });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
};