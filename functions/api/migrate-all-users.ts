import { auth } from "../../src/lib/auth.ts";
import { db } from "../../src/lib/db.ts";
import { users } from "../../src/db/schema.ts";

export const onRequestPost = async () => {
  try {
    const existingUsers = await db.select().from(users);

    const results = [];

    for (const u of existingUsers) {
      try {
        const password =
          "Temp@" + crypto.randomUUID().slice(0, 8);

        const result = await auth.api.signUpEmail({
          body: {
            email: u.email!,
            password,
            name: u.email!.split("@")[0],
            role: u.role || "staff",
            department:
              u.department || "Ground Operations",
          },
        });

        results.push({
          email: u.email,
          success: true,
          password,
        });
      } catch (e: any) {
        results.push({
          email: u.email,
          success: false,
          error: JSON.stringify(
            e,
            Object.getOwnPropertyNames(e),
            2
          ),
        });
      }
    }

    return Response.json(results);
  } catch (e: any) {
    return Response.json(
      {
        error: String(e),
      },
      {
        status: 500,
      }
    );
  }
};