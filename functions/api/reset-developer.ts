// functions/api/reset-developer.ts

import { auth } from "../../src/lib/auth.ts";
import { db } from "../../src/lib/db.ts";
import { sql } from "drizzle-orm";

export const onRequestPost = async () => {
  const email = "developer@funadhooairport.com";
  const password = "Dev123456!";

  await db.execute(sql`
    DELETE FROM account
    WHERE user_id IN (
      SELECT id
      FROM "user"
      WHERE lower(email) = lower(${email})
    );
  `);

  await db.execute(sql`
    DELETE FROM "user"
    WHERE lower(email) = lower(${email});
  `);

  const result = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: "Developer",
      role: "developer",
      department: "Ground Operations",
    },
  });

  return Response.json({
    success: true,
    email,
    password,
    result,
  });
};