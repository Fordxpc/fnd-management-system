import { auth } from "../../src/lib/auth.ts";
import { db } from "../../src/lib/db.ts";
import { users } from "../../src/db/schema.ts";
import { eq } from "drizzle-orm";

export const onRequestPost = async (ctx: any) => {
  const { email } = await ctx.request.json();

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existing) {
    return Response.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const randomPassword =
    "Temp@" + crypto.randomUUID().slice(0, 8);

  const result = await auth.api.signUpEmail({
    body: {
      email: existing.email!,
      password: randomPassword,
      name: existing.email!.split("@")[0],
      role: existing.role || "staff",
      department:
        existing.department || "Ground Operations",
    },
  });

  return Response.json({
    success: true,
    email: existing.email,
    tempPassword: randomPassword,
    result,
  });
};