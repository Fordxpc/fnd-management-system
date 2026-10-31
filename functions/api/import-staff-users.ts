import { db } from "../../src/lib/db.js";
import { staff, users } from "../../src/db/schema.js";

export const onRequestPost = async () => {
  try {
    const staffRows = await db.select().from(staff);

    const records = staffRows
      .filter((s: any) => s.email)
      .map((s: any) => ({
        id: crypto.randomUUID(),
        email: s.email.toLowerCase(),
        role: s.isSMT
          ? "smt"
          : (s.position || "").toLowerCase().includes("manager")
          ? "manager"
          : "staff",
        department: s.department || "Ground Operations",
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