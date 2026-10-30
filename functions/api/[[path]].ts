// functions/api/[[path]].ts

import { requireAuth } from "../middleware/auth.js";
import {
  requireManager,
  requireSMT
} from "../middleware/authorization.js";

export interface Env {
  DB: D1Database;
}

// ---------------------------------------------------------------
// Firebase / Firestore config (single source of truth)
// ---------------------------------------------------------------
const FIREBASE_PROJECT_ID = "fnd-ops-management";
const FIREBASE_API_KEY = "AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU";
const FIRESTORE_BASE =
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function backupToFirebase(
  collectionName: string,
  docId: string,
  data: Record<string, any>
) {
  const url = `${FIRESTORE_BASE}/${collectionName}/${docId}?key=${FIREBASE_API_KEY}`;

  const fields = Object.keys(data).reduce(
    (acc: Record<string, any>, key: string) => {
      const val = data[key];
      if (val === null || val === undefined) return acc;
      if (typeof val === "string") acc[key] = { stringValue: val };
      else if (typeof val === "number") acc[key] = { doubleValue: val };
      else if (typeof val === "boolean") acc[key] = { booleanValue: val };
      return acc;
    },
    {}
  );

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    });
    if (!res.ok) {
      console.error(
        `Firebase backup failed [${collectionName}/${docId}]:`,
        res.status,
        await res.text()
      );
    }
  } catch (err) {
    console.error("Firebase backup failed:", err);
  }
}

async function deleteFromFirebase(collectionName: string, docId: string) {
  try {
    await fetch(`${FIRESTORE_BASE}/${collectionName}/${docId}?key=${FIREBASE_API_KEY}`, {
      method: "DELETE"
    });
  } catch (err) {
    console.error("Firebase delete failed:", err);
  }
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  if (method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ==========================================
    // STAFF MODULE
    // ==========================================
    if (pathname === "/api/staff" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM staff ORDER BY orderIndex ASC, name ASC"
      ).all();
      return json(
        results.map((row: any) => ({
          ...row,
          isSMT: row.isSMT === 1,
          isIncharge: row.isIncharge === 1,
          balanceVisible: row.balanceVisible === 1,
          tempDeptAccess: row.tempDeptAccess === 1,
          rampsheetEditAccess: row.rampsheetEditAccess === 1,
          rwyLightEditAccess: row.rwyLightEditAccess === 1,
          birdCountEditAccess: row.birdCountEditAccess === 1,
          opsBoardAccess: row.opsBoardAccess === 1
        }))
      );
    }

    if (pathname === "/api/staff" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO staff (
          id, sn, name, email, personalEmail, nid, joinDate, phone, gender,
          department, position, isSMT, isIncharge, balanceVisible, notes, basicSalary,
          dailyAllowance, holidayAllowanceRate, bankAccount, status, createdAt, orderIndex,
          tempDeptAccess, tempDeptTarget, rampsheetEditAccess, rwyLightEditAccess, birdCountEditAccess, opsBoardAccess
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.sn || "", body.name, body.email, body.personalEmail || "",
        body.nid || "", body.joinDate || "", body.phone || "", body.gender || "",
        body.department, body.position || "", body.isSMT ? 1 : 0, body.isIncharge ? 1 : 0,
        body.balanceVisible ? 1 : 0, body.notes || "", body.basicSalary || 0,
        body.dailyAllowance || 0, body.holidayAllowanceRate || 0, body.bankAccount || "",
        "active", createdAt, 9999,
        body.tempDeptAccess ? 1 : 0, body.tempDeptTarget || "",
        body.rampsheetEditAccess ? 1 : 0, body.rwyLightEditAccess ? 1 : 0,
        body.birdCountEditAccess ? 1 : 0, body.opsBoardAccess ? 1 : 0
      ).run();

      context.waitUntil(backupToFirebase("staff", id, { ...body, status: "active", createdAt }));
      return json({ success: true, id });
    }

    // ⚠️ IMPORTANT: reorder MUST be handled BEFORE the generic staff/:id PUT,
    // otherwise `startsWith("/api/staff/")` swallows it.
    if (pathname === "/api/staff/reorder" && method === "PUT") {
      const body: any = await request.json();
      const stmt = env.DB.prepare("UPDATE staff SET orderIndex = ? WHERE id = ?");
      const batch = body.orderedIds.map((id: string, index: number) => stmt.bind(index, id));
      if (batch.length > 0) await env.DB.batch(batch);
      return json({ success: true });
    }

    if (pathname.startsWith("/api/staff/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date().toISOString();

      await env.DB.prepare(`
        UPDATE staff SET
          sn = ?, name = ?, email = ?, personalEmail = ?, nid = ?, joinDate = ?,
          phone = ?, gender = ?, department = ?, position = ?, isSMT = ?, isIncharge = ?,
          balanceVisible = ?, notes = ?, basicSalary = ?, dailyAllowance = ?,
          holidayAllowanceRate = ?, bankAccount = ?, updatedAt = ?,
          tempDeptAccess = ?, tempDeptTarget = ?, rampsheetEditAccess = ?,
          rwyLightEditAccess = ?, birdCountEditAccess = ?, opsBoardAccess = ?
        WHERE id = ?
      `).bind(
        body.sn || "", body.name, body.email, body.personalEmail || "",
        body.nid || "", body.joinDate || "", body.phone || "", body.gender || "",
        body.department, body.position || "", body.isSMT ? 1 : 0, body.isIncharge ? 1 : 0,
        body.balanceVisible ? 1 : 0, body.notes || "", body.basicSalary || 0,
        body.dailyAllowance || 0, body.holidayAllowanceRate || 0, body.bankAccount || "",
        updatedAt,
        body.tempDeptAccess ? 1 : 0, body.tempDeptTarget || "",
        body.rampsheetEditAccess ? 1 : 0, body.rwyLightEditAccess ? 1 : 0,
        body.birdCountEditAccess ? 1 : 0, body.opsBoardAccess ? 1 : 0,
        id
      ).run();

      context.waitUntil(backupToFirebase("staff", id!, { ...body, updatedAt }));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/staff/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("staff", id!));
      return json({ success: true });
    }

    // ==========================================
    // HOLIDAYS MODULE
    // ==========================================
    if (pathname === "/api/holidays" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM holidays ORDER BY date ASC").all();
      return json(results);
    }

    if (pathname === "/api/holidays" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await env.DB.prepare("INSERT INTO holidays (id, date, name, createdAt) VALUES (?, ?, ?, ?)")
        .bind(id, body.date, body.name, createdAt)
        .run();
      context.waitUntil(backupToFirebase("holidays", id, { date: body.date, name: body.name, createdAt }));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/holidays/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM holidays WHERE id = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("holidays", id!));
      return json({ success: true });
    }

    // ==========================================
    // LEAVE REQUESTS MODULE
    // ==========================================
    if (pathname === "/api/leave-requests" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM leave_requests ORDER BY requestedAt DESC"
      ).all();
      return json(results.map((row: any) => ({ ...row, staffIsSMT: row.staffIsSMT === 1 })));
    }

    if (pathname === "/api/leave-requests" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const requestedAt = new Date().toISOString();
      const finalStatus = body.status || "pending";

      await env.DB.prepare(`
        INSERT INTO leave_requests
          (id, staffId, staffName, staffDepartment, staffSN, staffGender, staffIsSMT,
           leaveType, startDate, endDate, days, reason, status, requestedAt, requestedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.staffId, body.staffName, body.staffDepartment, body.staffSN || "",
        body.staffGender || "", body.staffIsSMT ? 1 : 0, body.leaveType,
        body.startDate, body.endDate, body.days, body.reason || "",
        finalStatus, requestedAt, body.requestedBy || ""
      ).run();

      context.waitUntil(
        backupToFirebase("leave_requests", id, { ...body, status: finalStatus, requestedAt })
      );
      return json({ success: true, id });
    }

    if (
      url.pathname.startsWith("/api/leave-requests/") &&
      url.pathname.endsWith("/approve") &&
      method === "PUT"
    ) {
      const currentUser = await requireAuth(
        request,
        env
      );

      requireSMT(currentUser.role);

      const id = pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date().toISOString();

      await env.DB.prepare(
        "UPDATE leave_requests SET status = 'approved', reviewedBy = ?, reviewedAt = ? WHERE id = ?"
      ).bind(body.reviewedBy, reviewedAt, id).run();

      const reqData: any = await env.DB.prepare(
        "SELECT * FROM leave_requests WHERE id = ?"
      ).bind(id).first();

      if (reqData) {
        const staffRec: any = await env.DB.prepare("SELECT id FROM staff WHERE name = ?")
          .bind(reqData.staffName).first();
        const actualStaffId = staffRec ? staffRec.id : reqData.staffId;

        const start = new Date(reqData.startDate + "T00:00:00");
        const end = new Date(reqData.endDate + "T00:00:00");

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split("T")[0];
          await env.DB.prepare("DELETE FROM roster_entries WHERE staffId = ? AND date = ?")
            .bind(actualStaffId, dateStr).run();
          await env.DB.prepare(`
            INSERT INTO roster_entries
              (id, staffId, staffName, staffDepartment, date, shiftTime, status, leaveRequestId, createdAt)
            VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)
          `).bind(
            crypto.randomUUID(), actualStaffId, reqData.staffName,
            reqData.staffDepartment, dateStr, reqData.leaveType, id,
            new Date().toISOString()
          ).run();
        }
      }

      context.waitUntil(
        backupToFirebase("leave_requests", id, { status: "approved", reviewedBy: body.reviewedBy, reviewedAt })
      );
      return json({ success: true });
    }

    if (
      url.pathname.startsWith("/api/leave-requests/") &&
      url.pathname.endsWith("/reject") &&
      method === "PUT"
    ) {
      const currentUser = await requireAuth(
        request,
        env
      );

      requireSMT(currentUser.role);

      const id = pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE leave_requests SET status = 'rejected', reviewedBy = ?, reviewedAt = ?, reviewNotes = ? WHERE id = ?"
      ).bind(body.reviewedBy, reviewedAt, body.reviewNotes || "", id).run();
      context.waitUntil(
        backupToFirebase("leave_requests", id, {
          status: "rejected", reviewedBy: body.reviewedBy, reviewedAt, reviewNotes: body.reviewNotes
        })
      );
      return json({ success: true });
    }

    if (pathname.startsWith("/api/leave-requests/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM leave_requests WHERE id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM roster_entries WHERE leaveRequestId = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("leave_requests", id!));
      return json({ success: true });
    }

    // ==========================================
    // ROSTER MODULE
    // ==========================================
    if (pathname === "/api/roster" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM roster_entries").all();
      return json(results);
    }

    if (pathname === "/api/roster" && method === "POST") {
      const body: any = await request.json();
      const existing: any = await env.DB.prepare(
        "SELECT id, leaveRequestId FROM roster_entries WHERE staffId = ? AND date = ?"
      ).bind(body.staffId, body.date).first();

      if (existing && existing.leaveRequestId) {
        return json({ message: "Cannot overwrite approved leave." }, 400);
      }

      const id = existing ? existing.id : crypto.randomUUID();
      const createdAt = new Date().toISOString();
      if (existing) await env.DB.prepare("DELETE FROM roster_entries WHERE id = ?").bind(id).run();

      if (body.status !== "clear") {
        await env.DB.prepare(`
          INSERT INTO roster_entries
            (id, staffId, staffName, staffDepartment, date, shiftTime, status, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, body.staffId, body.staffName, body.staffDepartment, body.date,
          body.shiftTime || "", body.status, createdAt
        ).run();
        context.waitUntil(backupToFirebase("roster_entries", id, body));
      }
      return json({ success: true, id });
    }

    if (pathname === "/api/roster/bulk" && method === "POST") {
      const body: any = await request.json();
      const stmt = env.DB.prepare(`
        INSERT INTO roster_entries
          (id, staffId, staffName, staffDepartment, date, shiftTime, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const batch = [];
      for (const entry of body.entries) {
        const id = crypto.randomUUID();
        batch.push(
          stmt.bind(id, entry.staffId, entry.staffName, entry.staffDepartment,
            entry.date, entry.shiftTime || "", entry.status, new Date().toISOString())
        );
        context.waitUntil(backupToFirebase("roster_entries", id, entry));
      }
      if (batch.length > 0) await env.DB.batch(batch);
      return json({ success: true });
    }

    // ==========================================
    // FLIGHTS MODULE
    // ==========================================
    if (pathname === "/api/flights" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM flights").all();
      return json(results);
    }

    if (pathname === "/api/flights" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO flights
          (id, date, flightNo, type, aircraft, bookedFigure, paxAdults, paxInfants,
           checkInTime, arrivalTime, departureTime, route, originDepTime, status, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.date, body.flightNo, body.type, body.aircraft, body.bookedFigure || "",
        body.paxAdults || 0, body.paxInfants || 0, body.checkInTime || "",
        body.arrivalTime || "", body.departureTime || "", body.route || "",
        body.originDepTime || "", body.status, body.remarks || "", createdAt
      ).run();
      context.waitUntil(backupToFirebase("flights", id, { ...body, createdAt }));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/flights/") && method === "PUT") {
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date().toISOString();
      await env.DB.prepare(`
        UPDATE flights SET
          date = ?, flightNo = ?, type = ?, aircraft = ?, bookedFigure = ?,
          paxAdults = ?, paxInfants = ?, checkInTime = ?, arrivalTime = ?,
          departureTime = ?, route = ?, originDepTime = ?, status = ?, remarks = ?,
          updatedAt = ?
        WHERE id = ?
      `).bind(
        body.date, body.flightNo, body.type, body.aircraft, body.bookedFigure || "",
        body.paxAdults || 0, body.paxInfants || 0, body.checkInTime || "",
        body.arrivalTime || "", body.departureTime || "", body.route || "",
        body.originDepTime || "", body.status, body.remarks || "", updatedAt, id
      ).run();
      context.waitUntil(backupToFirebase("flights", id!, { ...body, updatedAt }));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/flights/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM flights WHERE id = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("flights", id!));
      return json({ success: true });
    }

    // ==========================================
    // SETTINGS & USERS MODULE
    // ==========================================
    if (pathname === "/api/settings/ot_rules" && method === "GET") {
      const rule: any = await env.DB.prepare("SELECT * FROM settings WHERE id = 'ot_rules'").first();
      if (rule) rule.deductLeaves = JSON.parse(rule.deductLeaves || "[]");
      return json(rule || { adminHours: 40, regularHours: 48, deductLeaves: [] });
    }

    if (pathname === "/api/settings/ot_rules" && method === "POST") {
      const body: any = await request.json();
      await env.DB.prepare(`
        INSERT INTO settings (id, adminHours, regularHours, deductLeaves)
        VALUES ('ot_rules', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          adminHours = excluded.adminHours,
          regularHours = excluded.regularHours,
          deductLeaves = excluded.deductLeaves
      `).bind(body.adminHours, body.regularHours, JSON.stringify(body.deductLeaves)).run();
      return json({ success: true });
    }

    if (pathname === "/api/users" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return json(results);
    }

    if (pathname === "/api/users/sync" && method === "POST") {
      const body: any = await request.json();
      const existing: any = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ?"
      ).bind(body.email).first();

      if (existing) {
        await env.DB.prepare(
          "UPDATE users SET role = ?, department = ?, name = ?, position = ? WHERE email = ?"
        ).bind(body.role, body.department, body.name || "", body.position || "", body.email).run();
      } else {
        await env.DB.prepare(
          "INSERT INTO users (id, email, role, department, name, position) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(body.uid, body.email, body.role, body.department, body.name || "", body.position || "").run();
      }
      return json({ success: true });
    }

    // ==========================================
    // UPDATE USER (manager only)
    // ==========================================
    if (url.pathname.startsWith("/api/users/") && method === "PUT") {
      const currentUser = await requireAuth(
        request,
        env
      );

      requireManager(currentUser.role);

      const id = url.pathname.split("/").pop();
      const body: any = await request.json();

      await env.DB.prepare(`
        UPDATE users
        SET role = ?, department = ?, name = ?, position = ?
        WHERE id = ?
      `)
        .bind(
          body.role,
          body.department,
          body.name || '',
          body.position || '',
          id
        )
        .run();

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    // ==========================================
    // DELETE USER (manager only)
    // ==========================================
    if (url.pathname.startsWith("/api/users/") && method === "DELETE") {
      const currentUser = await requireAuth(
        request,
        env
      );

      requireManager(currentUser.role);

      const id = url.pathname.split("/").pop();

      await env.DB
        .prepare(
          "DELETE FROM users WHERE id = ?"
        )
        .bind(id)
        .run();

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    if (pathname === "/api/users/create-auth" && method === "POST") {
      const body: any = await request.json();
      const { email, password, role, department, name, position } = body;

      if (!email || !password) {
        return json({ message: "Email and password are required" }, 400);
      }

      const activeUser = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ?"
      ).bind(email).first();
      if (activeUser) {
        return json({ message: "This user is already active in the system." }, 400);
      }

      const firebaseRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: false })
        }
      );
      const firebaseData: any = await firebaseRes.json();

      if (firebaseData.error) {
        if (firebaseData.error.message === "EMAIL_EXISTS") {
          const id = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT OR REPLACE INTO user_presets
              (id, email, role, department, name, position, createdAt, createdBy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id, email, role, department, name || "", position || "",
            new Date().toISOString(), "Admin Panel"
          ).run();
          return json({ success: true, message: "Existing Firebase user added to pre-registrations." });
        }

        let msg = firebaseData.error.message;
        if (msg === "WEAK_PASSWORD : Password should be at least 6 characters") {
          msg = "Password must be at least 6 characters.";
        }
        return json({ message: msg }, 400);
      }

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT OR REPLACE INTO user_presets
          (id, email, role, department, name, position, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, email, role, department, name || "", position || "",
        new Date().toISOString(), "Admin Panel"
      ).run();

      return json({ success: true, id, message: "User created and pre-registered." });
    }

    if (pathname === "/api/user-presets" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM user_presets").all();
      return json(results);
    }

    if (pathname === "/api/user-presets" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT OR REPLACE INTO user_presets
          (id, email, role, department, name, position, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.email, body.role, body.department, body.name || "",
        body.position || "", new Date().toISOString(), body.createdBy || ""
      ).run();
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/user-presets/") && method === "PUT") {
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      await env.DB.prepare(`
        UPDATE user_presets SET role = ?, department = ?, name = ?, position = ? WHERE id = ?
      `).bind(body.role, body.department, body.name || "", body.position || "", id).run();
      return json({ success: true });
    }

    if (pathname.startsWith("/api/user-presets/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM user_presets WHERE id = ?").bind(id).run();
      return json({ success: true });
    }

    // ==========================================
    // REPORTS MODULE
    // ==========================================
    if (pathname === "/api/reports/save-monthly" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO saved_reports (id, month, dateFrom, dateTo, type, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.month, body.dateFrom, body.dateTo, body.type,
        body.createdBy || "System", createdAt
      ).run();

      return json({ success: true, id, message: "Report saved." });
    }

    // ==========================================
    // OVERTIME MODULE
    // ==========================================
    if (pathname === "/api/overtime" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM overtime_entries ORDER BY date DESC"
      ).all();
      return json(results);
    }

    if (pathname === "/api/overtime" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO overtime_entries
          (id, staffId, staffName, staffSN, staffDepartment, date, startTime, endTime,
           hours, notes, status, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(
        id, body.staffId, body.staffName, body.staffSN || "", body.staffDepartment,
        body.date, body.startTime, body.endTime, body.hours, body.notes || "",
        new Date().toISOString(), body.createdBy || ""
      ).run();
      context.waitUntil(backupToFirebase("overtime_entries", id, { ...body, status: "pending" }));
      return json({ success: true, id });
    }

    if (
      pathname.startsWith("/api/overtime/") &&
      method === "PUT" &&
      !pathname.endsWith("/approve") &&
      !pathname.endsWith("/reject")
    ) {
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      await env.DB.prepare(`
        UPDATE overtime_entries SET date = ?, startTime = ?, endTime = ?, hours = ?, notes = ?
        WHERE id = ?
      `).bind(body.date, body.startTime, body.endTime, body.hours, body.notes || "", id).run();
      context.waitUntil(backupToFirebase("overtime_entries", id!, body));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/overtime/") && pathname.endsWith("/approve") && method === "PUT") {
      const id = pathname.split("/")[3];
      const body: any = await request.json();
      await env.DB.prepare(
        "UPDATE overtime_entries SET status = 'approved', reviewedBy = ?, reviewedAt = ? WHERE id = ?"
      ).bind(body.reviewedBy, new Date().toISOString(), id).run();
      context.waitUntil(
        backupToFirebase("overtime_entries", id, { status: "approved", reviewedBy: body.reviewedBy })
      );
      return json({ success: true });
    }

    if (pathname.startsWith("/api/overtime/") && pathname.endsWith("/reject") && method === "PUT") {
      const id = pathname.split("/")[3];
      const body: any = await request.json();
      await env.DB.prepare(
        "UPDATE overtime_entries SET status = 'rejected', reviewedBy = ?, reviewedAt = ? WHERE id = ?"
      ).bind(body.reviewedBy, new Date().toISOString(), id).run();
      context.waitUntil(
        backupToFirebase("overtime_entries", id, { status: "rejected", reviewedBy: body.reviewedBy })
      );
      return json({ success: true });
    }

    if (pathname.startsWith("/api/overtime/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM overtime_entries WHERE id = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("overtime_entries", id!));
      return json({ success: true });
    }

    // ==========================================
    // OPS BOARD MODULE
    // ==========================================
    if (pathname === "/api/ops/runway" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM ops_runway_history ORDER BY createdAt DESC LIMIT 200"
      ).all();
      return json(
        results.map((row: any) => ({
          ...row,
          rwy19: JSON.parse(row.rwy19 || "[]"),
          rwy01: JSON.parse(row.rwy01 || "[]"),
          lights: JSON.parse(row.lights || "[]")
        }))
      );
    }

    if (pathname === "/api/ops/runway" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO ops_runway_history (id, date, time, createdAt, rwy19, rwy01, lights)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.date, body.time, new Date().toISOString(),
        JSON.stringify(body.rwy19), JSON.stringify(body.rwy01), JSON.stringify(body.lights)
      ).run();
      context.waitUntil(backupToFirebase("ops_runway_history", id, body));
      return json({ success: true, id });
    }

    if (pathname === "/api/ops/ground" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM ops_ground_history ORDER BY createdAt DESC LIMIT 200"
      ).all();
      return json(
        results.map((row: any) => ({
          ...row,
          assignments: JSON.parse(row.assignments || "{}")
        }))
      );
    }

    if (pathname === "/api/ops/ground" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO ops_ground_history (id, date, time, createdAt, assignments)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, body.date, body.time, new Date().toISOString(), JSON.stringify(body.assignments)).run();
      context.waitUntil(backupToFirebase("ops_ground_history", id, body));
      return json({ success: true, id });
    }

    if (pathname === "/api/fod" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM fod_collections ORDER BY date DESC LIMIT 200"
      ).all();
      return json(results);
    }

    if (pathname === "/api/fod" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO fod_collections (id, date, grams, remarks, loggedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, body.date, body.grams, body.remarks, body.loggedBy || "", new Date().toISOString()).run();
      context.waitUntil(backupToFirebase("fod_collections", id, { ...body }));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/fod/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM fod_collections WHERE id = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("fod_collections", id!));
      return json({ success: true });
    }

    // ==========================================
    // WILDLIFE MODULE
    // ==========================================
    if (pathname === "/api/wildlife" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM bird_counts ORDER BY createdAt DESC"
      ).all();
      return json(results.map((row: any) => ({ ...row, rows: JSON.parse(row.rows || "[]") })));
    }

    if (pathname === "/api/wildlife" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO bird_counts
          (id, date, refNo, wind, temp, cloud, rain, startTime, endTime, rows, observer, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.date, body.refNo, body.wind || "", body.temp || "",
        body.cloud || "", body.rain || "N", body.startTime || "", body.endTime || "",
        JSON.stringify(body.rows), body.observer || "", new Date().toISOString()
      ).run();
      context.waitUntil(backupToFirebase("bird_counts", id, { ...body }));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/wildlife/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM bird_counts WHERE id = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("bird_counts", id!));
      return json({ success: true });
    }

    // ==========================================
    // RAMP CHECK MODULE
    // ==========================================
    if (pathname === "/api/ramp/draft" && method === "GET") {
      const row: any = await env.DB.prepare(
        "SELECT payload FROM ramp_live_draft WHERE id = 'current'"
      ).first();
      return json(row ? JSON.parse(row.payload) : {});
    }

    if (pathname === "/api/ramp/draft" && method === "POST") {
      const body: any = await request.json();
      await env.DB.prepare(`
        INSERT INTO ramp_live_draft (id, payload) VALUES ('current', ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
      `).bind(JSON.stringify(body)).run();
      return json({ success: true });
    }

    if (pathname === "/api/ramp/reports" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM ramp_inspections ORDER BY date DESC, createdAt DESC"
      ).all();
      return json(
        results.map((row: any) => ({
          ...JSON.parse(row.payload),
          id: row.id, date: row.date, fltNo: row.fltNo, acReg: row.acReg,
          createdAt: row.createdAt, updatedAt: row.updatedAt
        }))
      );
    }

    if (pathname === "/api/ramp/reports" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO ramp_inspections (id, date, fltNo, acReg, payload, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.date || "", body.fltNo || "", body.acReg || "",
        JSON.stringify(body), new Date().toISOString()
      ).run();

      if (body.fltNo && body.date) {
        const newStatus = body.atd ? "Departed" : body.ata ? "Landed" : body.eta ? "Departed (Origin)" : "Scheduled";
        await env.DB.prepare(`
          UPDATE flights SET status = ?, eta = ?, ata = ?, atd = ?
          WHERE TRIM(UPPER(flightNo)) = TRIM(UPPER(?)) AND date = ?
        `).bind(newStatus, body.eta || null, body.ata || null, body.atd || null, body.fltNo, body.date).run();
      }

      context.waitUntil(backupToFirebase("ramp_inspections", id, { ...body }));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/ramp/reports/") && method === "PUT") {
      const id = pathname.split("/").pop();
      const body: any = await request.json();

      await env.DB.prepare(`
        UPDATE ramp_inspections SET date = ?, fltNo = ?, acReg = ?, payload = ?, updatedAt = ?
        WHERE id = ?
      `).bind(
        body.date || "", body.fltNo || "", body.acReg || "",
        JSON.stringify(body), new Date().toISOString(), id
      ).run();

      if (body.fltNo && body.date) {
        const newStatus = body.atd ? "Departed" : body.ata ? "Landed" : body.eta ? "Departed (Origin)" : "Scheduled";
        await env.DB.prepare(`
          UPDATE flights SET status = ?, eta = ?, ata = ?, atd = ?
          WHERE TRIM(UPPER(flightNo)) = TRIM(UPPER(?)) AND date = ?
        `).bind(newStatus, body.eta || null, body.ata || null, body.atd || null, body.fltNo, body.date).run();
      }

      context.waitUntil(backupToFirebase("ramp_inspections", id!, { ...body }));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/ramp/reports/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM ramp_inspections WHERE id = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("ramp_inspections", id!));
      return json({ success: true });
    }

    // ==========================================
    // TIMESHEET / ATTENDANCE MODULE
    // ==========================================
    if (pathname === "/api/timesheets" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM timesheets ORDER BY date DESC, clockIn DESC"
      ).all();
      return json(results);
    }

    if (pathname === "/api/timesheets" && method === "POST") {
      const body: any = await request.json();
      const existing: any = await env.DB.prepare(
        "SELECT id FROM timesheets WHERE staffId = ? AND date = ?"
      ).bind(body.staffId, body.date).first();

      if (existing) {
        await env.DB.prepare(
          "UPDATE timesheets SET clockIn = ?, clockOut = ?, status = ?, notes = ? WHERE id = ?"
        ).bind(body.clockIn, body.clockOut, body.status, body.notes || "", existing.id).run();
        context.waitUntil(backupToFirebase("timesheets", existing.id, body));
        return json({ success: true, id: existing.id });
      }

      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO timesheets
          (id, staffId, staffName, staffDepartment, date, clockIn, clockOut, status, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.staffId, body.staffName, body.staffDepartment, body.date,
        body.clockIn || "", body.clockOut || "", body.status || "Present",
        body.notes || "", new Date().toISOString()
      ).run();
      context.waitUntil(backupToFirebase("timesheets", id, body));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/timesheets/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM timesheets WHERE id = ?").bind(id).run();
      context.waitUntil(deleteFromFirebase("timesheets", id!));
      return json({ success: true });
    }

    // ==========================================
    // TEMPORARY ACCESS MODULE
    // ==========================================
    if (pathname === "/api/temp-access" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM temp_access").all();
      return json(results);
    }

    // ==========================================
    // CREATE TEMP ACCESS (manager only)
    // ==========================================
    if (url.pathname === "/api/temp-access" && method === "POST") {
      const currentUser = await requireAuth(
        request,
        env
      );

      requireManager(currentUser.role);

      const body: any = await request.json();

      const id = crypto.randomUUID();

      await env.DB.prepare(`
        INSERT INTO temp_access
        (id, email, targetDept, startDate, endDate)
        VALUES (?, ?, ?, ?, ?)
      `)
        .bind(
          id,
          body.email,
          body.targetDept,
          body.startDate,
          body.endDate
        )
        .run();

      return json({ success: true, id });
    }

    // ==========================================
    // DELETE TEMP ACCESS (manager only)
    // ==========================================
    if (url.pathname.startsWith("/api/temp-access/") && method === "DELETE") {
      const currentUser = await requireAuth(
        request,
        env
      );

      requireManager(currentUser.role);

      const id = url.pathname.split("/").pop();

      await env.DB.prepare(
        "DELETE FROM temp_access WHERE id = ?"
      )
        .bind(id)
        .run();

      return json({ success: true });
    }

    // ==========================================
    // LIGHTS INSPECTORS MODULE
    // ==========================================
    if (pathname === "/api/lights-inspectors" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM lights_inspectors").all();
      return json(results);
    }

    if (pathname === "/api/lights-inspectors" && method === "POST") {
      const body: any = await request.json();
      await env.DB.prepare(
        "INSERT OR REPLACE INTO lights_inspectors (staffId, staffName, staffSN) VALUES (?, ?, ?)"
      ).bind(body.staffId, body.staffName, body.staffSN || "").run();
      return json({ success: true });
    }

    if (pathname.startsWith("/api/lights-inspectors/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM lights_inspectors WHERE staffId = ?").bind(id).run();
      return json({ success: true });
    }

    // ==========================================
    // RUNWAY LIGHTS MODULE
    // ==========================================
    if (pathname === "/api/lights" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM rwy_lights ORDER BY date DESC").all();
      return json(results.map((row: any) => ({ ...row, data: JSON.parse(row.data || "{}") })));
    }

    if (pathname === "/api/lights" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO rwy_lights (id, date, time, weather, inspectorName, data, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.date, body.time || "", body.weather || "", body.inspectorName,
        JSON.stringify(body.data), body.remarks || "", new Date().toISOString()
      ).run();
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/lights/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM rwy_lights WHERE id = ?").bind(id).run();
      return json({ success: true });
    }

    return json({ message: "Not Found" }, 404);
  } catch (err: any) {
    return json({ message: err.message, stack: err.stack }, 500);
  }
};