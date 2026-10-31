// functions/api/[[path]].ts

import { requireAuth } from "../middleware/auth.js";
import {
  requireManager,
  requireSMT
} from "../middleware/authorization.js";

import { db } from "../../src/lib/db.js";
import {
  users,
  staff,
  holidays,
  flights,
  leaveRequests,
  overtimeEntries,
  rosterEntries,
  birdCounts,
  rampInspections,
  tempAccess,
  settings,
  userPresets,
  timesheets,
  opsGroundHistory,
  opsRunwayHistory,
  fodCollections,
  lightsInspectors,
  rwyLights,
  savedReports,
  rampLiveDraft
} from "../../src/db/schema.js";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface Env {
  DB: D1Database;  // ⚠️ ONLY used by /api/admin/migrate-d1-to-neon — delete binding after migration
}

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

const toBool = (v: any): boolean => v === 1 || v === "1" || v === true;
const toDate = (v: any): Date | null => (v ? new Date(v) : null);

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
      const results = await db.select().from(staff);
      return json(results);
    }

    if (pathname === "/api/staff" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date();

      await db.insert(staff).values({
        id,
        sn: body.sn || "",
        name: body.name,
        email: body.email,
        personalEmail: body.personalEmail || "",
        nid: body.nid || "",
        joinDate: body.joinDate || "",
        phone: body.phone || "",
        gender: body.gender || "",
        department: body.department,
        position: body.position || "",
        isSMT: !!body.isSMT,
        isIncharge: !!body.isIncharge,
        balanceVisible: !!body.balanceVisible,
        tempDeptAccess: !!body.tempDeptAccess,
        rampsheetEditAccess: !!body.rampsheetEditAccess,
        rwyLightEditAccess: !!body.rwyLightEditAccess,
        birdCountEditAccess: !!body.birdCountEditAccess,
        opsBoardAccess: !!body.opsBoardAccess,
        tempDeptTarget: body.tempDeptTarget || "",
        notes: body.notes || "",
        basicSalary: body.basicSalary || 0,
        dailyAllowance: body.dailyAllowance || 0,
        holidayAllowanceRate: body.holidayAllowanceRate || 0,
        bankAccount: body.bankAccount || "",
        status: "active",
        orderIndex: 9999,
        createdAt,
      });

      context.waitUntil(
        backupToFirebase("staff", id, {
          ...body,
          status: "active",
          createdAt: createdAt.toISOString()
        })
      );
      return json({ success: true, id });
    }

    // ==========================================
    // STAFF REORDER — Neon
    // ==========================================
    if (pathname === "/api/staff/reorder" && method === "PUT") {
      const body: any = await request.json();

      await Promise.all(
        body.orderedIds.map((id: string, index: number) =>
          db.update(staff).set({ orderIndex: index }).where(eq(staff.id, id))
        )
      );

      return json({ success: true });
    }

    if (pathname.startsWith("/api/staff/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date();

      await db
        .update(staff)
        .set({
          sn: body.sn || "",
          name: body.name,
          email: body.email,
          personalEmail: body.personalEmail || "",
          nid: body.nid || "",
          joinDate: body.joinDate || "",
          phone: body.phone || "",
          gender: body.gender || "",
          department: body.department,
          position: body.position || "",
          isSMT: !!body.isSMT,
          isIncharge: !!body.isIncharge,
          balanceVisible: !!body.balanceVisible,
          tempDeptAccess: !!body.tempDeptAccess,
          rampsheetEditAccess: !!body.rampsheetEditAccess,
          rwyLightEditAccess: !!body.rwyLightEditAccess,
          birdCountEditAccess: !!body.birdCountEditAccess,
          opsBoardAccess: !!body.opsBoardAccess,
          tempDeptTarget: body.tempDeptTarget || "",
          notes: body.notes || "",
          basicSalary: body.basicSalary || 0,
          dailyAllowance: body.dailyAllowance || 0,
          holidayAllowanceRate: body.holidayAllowanceRate || 0,
          bankAccount: body.bankAccount || "",
          updatedAt,
        })
        .where(eq(staff.id, id!));

      context.waitUntil(
        backupToFirebase("staff", id!, {
          ...body,
          updatedAt: updatedAt.toISOString()
        })
      );
      return json({ success: true });
    }

    if (pathname.startsWith("/api/staff/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = pathname.split("/").pop();

      await db.delete(staff).where(eq(staff.id, id!));

      context.waitUntil(deleteFromFirebase("staff", id!));
      return json({ success: true });
    }

    // ==========================================
    // HOLIDAYS MODULE
    // ==========================================
    if (pathname === "/api/holidays" && method === "GET") {
      const results = await db.select().from(holidays);
      return json(results);
    }

    if (pathname === "/api/holidays" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date();

      await db.insert(holidays).values({
        id,
        date: body.date,
        name: body.name,
        createdAt,
      });

      context.waitUntil(
        backupToFirebase("holidays", id, {
          date: body.date,
          name: body.name,
          createdAt: createdAt.toISOString()
        })
      );
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/holidays/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = pathname.split("/").pop();
      await db.delete(holidays).where(eq(holidays.id, id!));

      context.waitUntil(deleteFromFirebase("holidays", id!));
      return json({ success: true });
    }

    // ==========================================
    // LEAVE REQUESTS MODULE
    // ==========================================
    if (pathname === "/api/leave-requests" && method === "GET") {
      const results = await db.select().from(leaveRequests);
      return json(results);
    }

    if (pathname === "/api/leave-requests" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const finalStatus = body.status || "pending";
      const requestedAt = new Date();

      await db.insert(leaveRequests).values({
        id,
        staffId: body.staffId,
        staffName: body.staffName,
        staffDepartment: body.staffDepartment,
        staffSN: body.staffSN || "",
        staffGender: body.staffGender || "",
        leaveType: body.leaveType,
        startDate: body.startDate,
        endDate: body.endDate,
        days: body.days,
        reason: body.reason || "",
        status: finalStatus,
        requestedBy: body.requestedBy || "",
        requestedAt,
      });

      context.waitUntil(
        backupToFirebase("leave_requests", id, {
          ...body,
          status: finalStatus,
          requestedAt: requestedAt.toISOString()
        })
      );
      return json({ success: true, id });
    }

    if (
      url.pathname.startsWith("/api/leave-requests/") &&
      url.pathname.endsWith("/approve") &&
      method === "PUT"
    ) {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date();

      const [reqData] = await db
        .update(leaveRequests)
        .set({
          status: "approved",
          reviewedBy: body.reviewedBy,
          reviewedAt,
        })
        .where(eq(leaveRequests.id, id!))
        .returning();

      if (reqData) {
        const [staffRec] = await db
          .select()
          .from(staff)
          .where(eq(staff.name, reqData.staffName!))
          .limit(1);

        const actualStaffId = staffRec ? staffRec.id : reqData.staffId;

        if (!actualStaffId) {
          return json({ message: "Staff ID not found" }, 400);
        }

        const start = new Date(reqData.startDate + "T00:00:00");
        const end = new Date(reqData.endDate + "T00:00:00");

        const dateStrings: string[] = [];
        const entriesToInsert: any[] = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split("T")[0];
          dateStrings.push(dateStr);
          entriesToInsert.push({
            id: crypto.randomUUID(),
            staffId: actualStaffId,
            staffName: reqData.staffName,
            staffDepartment: reqData.staffDepartment,
            date: dateStr,
            shiftTime: "",
            status: reqData.leaveType,
            leaveRequestId: id,
            createdAt: new Date(),
          });
        }

        if (dateStrings.length > 0) {
          await db.delete(rosterEntries).where(
            and(
              eq(rosterEntries.staffId, actualStaffId),
              inArray(rosterEntries.date, dateStrings)
            )
          );
          await db.insert(rosterEntries).values(entriesToInsert);
        }
      }

      context.waitUntil(
        backupToFirebase("leave_requests", id, {
          status: "approved",
          reviewedBy: body.reviewedBy,
          reviewedAt: reviewedAt.toISOString()
        })
      );
      return json({ success: true });
    }

    if (
      url.pathname.startsWith("/api/leave-requests/") &&
      url.pathname.endsWith("/reject") &&
      method === "PUT"
    ) {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date();

      await db
        .update(leaveRequests)
        .set({
          status: "rejected",
          reviewedBy: body.reviewedBy,
          reviewedAt,
          reviewNotes: body.reviewNotes || "",
        })
        .where(eq(leaveRequests.id, id!));

      context.waitUntil(
        backupToFirebase("leave_requests", id, {
          status: "rejected",
          reviewedBy: body.reviewedBy,
          reviewedAt: reviewedAt.toISOString(),
          reviewNotes: body.reviewNotes
        })
      );
      return json({ success: true });
    }

    if (pathname.startsWith("/api/leave-requests/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await db.delete(leaveRequests).where(eq(leaveRequests.id, id!));
      await db.delete(rosterEntries).where(eq(rosterEntries.leaveRequestId, id!));
      context.waitUntil(deleteFromFirebase("leave_requests", id!));
      return json({ success: true });
    }

    // ==========================================
    // ROSTER MODULE
    // ==========================================
    if (pathname === "/api/roster" && method === "GET") {
      const results = await db.select().from(rosterEntries);
      return json(results);
    }

    if (pathname === "/api/roster" && method === "POST") {
      const body: any = await request.json();

      const existing = await db
        .select()
        .from(rosterEntries)
        .where(
          and(
            eq(rosterEntries.staffId, body.staffId),
            eq(rosterEntries.date, body.date)
          )
        )
        .limit(1);

      if (existing.length > 0 && existing[0].leaveRequestId) {
        return json({ message: "Cannot overwrite approved leave." }, 400);
      }

      const id = existing.length > 0 ? existing[0].id : crypto.randomUUID();
      const createdAt = new Date();

      if (existing.length > 0) {
        await db.delete(rosterEntries).where(eq(rosterEntries.id, id));
      }

      if (body.status !== "clear") {
        await db.insert(rosterEntries).values({
          id,
          staffId: body.staffId,
          staffName: body.staffName,
          staffDepartment: body.staffDepartment,
          date: body.date,
          shiftTime: body.shiftTime || "",
          status: body.status,
          createdAt,
        });
        context.waitUntil(backupToFirebase("roster_entries", id, body));
      }
      return json({ success: true, id });
    }

    if (pathname === "/api/roster/bulk" && method === "POST") {
      const body: any = await request.json();

      const values = body.entries.map((entry: any) => ({
        id: crypto.randomUUID(),
        staffId: entry.staffId,
        staffName: entry.staffName,
        staffDepartment: entry.staffDepartment,
        date: entry.date,
        shiftTime: entry.shiftTime || "",
        status: entry.status,
        createdAt: new Date(),
      }));

      if (values.length > 0) {
        await db.insert(rosterEntries).values(values);
        for (let i = 0; i < values.length; i++) {
          context.waitUntil(
            backupToFirebase("roster_entries", values[i].id, body.entries[i])
          );
        }
      }

      return json({ success: true });
    }

    // ==========================================
    // FLIGHTS MODULE
    // ==========================================
    if (pathname === "/api/flights" && method === "GET") {
      const results = await db.select().from(flights);
      return json(results);
    }

    if (pathname === "/api/flights" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date();

      await db.insert(flights).values({
        id,
        date: body.date,
        flightNo: body.flightNo,
        type: body.type,
        aircraft: body.aircraft,
        bookedFigure: body.bookedFigure || "",
        checkInTime: body.checkInTime || "",
        arrivalTime: body.arrivalTime || "",
        departureTime: body.departureTime || "",
        route: body.route || "",
        originDepTime: body.originDepTime || "",
        eta: body.eta || null,
        ata: body.ata || null,
        atd: body.atd || null,
        status: body.status,
        remarks: body.remarks || "",
        createdAt,
      });

      context.waitUntil(
        backupToFirebase("flights", id, {
          ...body,
          createdAt: createdAt.toISOString()
        })
      );
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/flights/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date();

      await db
        .update(flights)
        .set({
          date: body.date,
          flightNo: body.flightNo,
          type: body.type,
          aircraft: body.aircraft,
          bookedFigure: body.bookedFigure || "",
          checkInTime: body.checkInTime || "",
          arrivalTime: body.arrivalTime || "",
          departureTime: body.departureTime || "",
          route: body.route || "",
          originDepTime: body.originDepTime || "",
          eta: body.eta || null,
          ata: body.ata || null,
          atd: body.atd || null,
          status: body.status,
          remarks: body.remarks || "",
          updatedAt,
        })
        .where(eq(flights.id, id!));

      context.waitUntil(
        backupToFirebase("flights", id!, {
          ...body,
          updatedAt: updatedAt.toISOString()
        })
      );
      return json({ success: true });
    }

    if (pathname.startsWith("/api/flights/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = pathname.split("/").pop();
      await db.delete(flights).where(eq(flights.id, id!));
      context.waitUntil(deleteFromFirebase("flights", id!));
      return json({ success: true });
    }

    // ==========================================
    // SETTINGS
    // ==========================================
    if (pathname === "/api/settings/ot_rules" && method === "GET") {
      const rule: any = (
        await db.select().from(settings)
      ).find((r: any) => r.id === "ot_rules");

      if (rule) rule.deductLeaves = JSON.parse(rule.deductLeaves || "[]");
      return json(rule || { adminHours: 40, regularHours: 48, deductLeaves: [] });
    }

    if (pathname === "/api/settings/ot_rules" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const body: any = await request.json();
      const deductLeavesStr = JSON.stringify(body.deductLeaves);

      await db
        .insert(settings)
        .values({
          id: "ot_rules",
          adminHours: body.adminHours,
          regularHours: body.regularHours,
          deductLeaves: deductLeavesStr,
        })
        .onConflictDoUpdate({
          target: settings.id,
          set: {
            adminHours: body.adminHours,
            regularHours: body.regularHours,
            deductLeaves: deductLeavesStr,
          },
        });

      return json({ success: true });
    }

    // ==========================================
    // USERS (Neon)
    // ==========================================
    if (pathname === "/api/users" && method === "GET") {
      try {
        const results = await db.select().from(users);
        return json(results);
      } catch (error: any) {
        console.error("USERS ROUTE ERROR:", error);
        return json({ message: error?.message, cause: error?.cause, stack: error?.stack }, 500);
      }
    }

    if (pathname === "/api/users/sync" && method === "POST") {
      try {
        const body: any = await request.json();

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, body.email))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(users)
            .set({ role: body.role, department: body.department })
            .where(eq(users.email, body.email));
        } else {
          await db
            .insert(users)
            .values({
              id: body.uid,
              email: body.email,
              role: body.role,
              department: body.department,
              createdAt: new Date(),
            })
            .onConflictDoNothing();
        }

        return json({ success: true });
      } catch (error) {
        console.error("SYNC ERROR:", error);
        return json({ success: false, error: String(error) }, 500);
      }
    }

    if (url.pathname.startsWith("/api/users/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = url.pathname.split("/").pop();
      const body: any = await request.json();

      await db
        .update(users)
        .set({ role: body.role, department: body.department })
        .where(eq(users.id, id!));

      return json({ success: true });
    }

    if (url.pathname.startsWith("/api/users/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = url.pathname.split("/").pop();
      await db.delete(users).where(eq(users.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // CREATE AUTH USER (Neon)
    // ==========================================
    if (url.pathname === "/api/users/create-auth" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const body: any = await request.json();
      const { email, password, role, department, name, position } = body;

      if (!email || !password) {
        return json({ message: "Email and password are required" }, 400);
      }

      const activeUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (activeUser.length > 0) {
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
          await db.insert(userPresets).values({
            id,
            email,
            role,
            department,
            name: name || "",
            position: position || "",
            createdAt: new Date(),
          }).onConflictDoNothing();
          return json({ success: true, message: "Existing Firebase user added to pre-registrations." });
        }

        let msg = firebaseData.error.message;
        if (msg === "WEAK_PASSWORD : Password should be at least 6 characters") {
          msg = "Password must be at least 6 characters.";
        }
        return json({ message: msg }, 400);
      }

      const id = crypto.randomUUID();
      await db.insert(userPresets).values({
        id,
        email,
        role,
        department,
        name: name || "",
        position: position || "",
        createdAt: new Date(),
      }).onConflictDoNothing();

      return json({ success: true, id, message: "User created and pre-registered." });
    }

    // ==========================================
    // USER PRESETS
    // ==========================================
    if (pathname === "/api/user-presets" && method === "GET") {
      const results = await db.select().from(userPresets);
      return json(results);
    }

    if (pathname === "/api/user-presets" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(userPresets).values({
        id,
        email: body.email,
        role: body.role,
        department: body.department,
        name: body.name || "",
        position: body.position || "",
        createdAt: new Date(),
      }).onConflictDoNothing();

      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/user-presets/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = pathname.split("/").pop();
      const body: any = await request.json();

      await db.update(userPresets).set({
        role: body.role,
        department: body.department,
        name: body.name || "",
        position: body.position || "",
      }).where(eq(userPresets.id, id!));

      return json({ success: true });
    }

    if (pathname.startsWith("/api/user-presets/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = pathname.split("/").pop();
      await db.delete(userPresets).where(eq(userPresets.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // SAVE MONTHLY REPORT (Neon)
    // ==========================================
    if (pathname === "/api/reports/save-monthly" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date();

      await db.insert(savedReports).values({
        id,
        month: body.month,
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        type: body.type,
        createdBy: body.createdBy || "System",
        createdAt,
      });

      return json({ success: true, id, message: "Report saved." });
    }

    // ==========================================
    // OVERTIME MODULE
    // ==========================================
    if (pathname === "/api/overtime" && method === "GET") {
      const results = await db.select().from(overtimeEntries);
      return json(results);
    }

    if (pathname === "/api/overtime" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date();

      await db.insert(overtimeEntries).values({
        id,
        staffId: body.staffId,
        staffName: body.staffName,
        staffSN: body.staffSN || "",
        staffDepartment: body.staffDepartment,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        hours: body.hours,
        notes: body.notes || "",
        status: "pending",
        createdBy: body.createdBy || "",
        createdAt,
      });

      context.waitUntil(
        backupToFirebase("overtime_entries", id, {
          ...body,
          status: "pending",
          createdAt: createdAt.toISOString()
        })
      );
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

      await db
        .update(overtimeEntries)
        .set({
          date: body.date,
          startTime: body.startTime,
          endTime: body.endTime,
          hours: body.hours,
          notes: body.notes || "",
        })
        .where(eq(overtimeEntries.id, id!));

      context.waitUntil(backupToFirebase("overtime_entries", id!, body));
      return json({ success: true });
    }

    if (
      url.pathname.startsWith("/api/overtime/") &&
      url.pathname.endsWith("/approve") &&
      method === "PUT"
    ) {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date();

      await db
        .update(overtimeEntries)
        .set({ status: "approved", reviewedBy: body.reviewedBy, reviewedAt })
        .where(eq(overtimeEntries.id, id!));

      context.waitUntil(
        backupToFirebase("overtime_entries", id, {
          status: "approved",
          reviewedBy: body.reviewedBy,
          reviewedAt: reviewedAt.toISOString()
        })
      );
      return json({ success: true });
    }

    if (
      url.pathname.startsWith("/api/overtime/") &&
      url.pathname.endsWith("/reject") &&
      method === "PUT"
    ) {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date();

      await db
        .update(overtimeEntries)
        .set({ status: "rejected", reviewedBy: body.reviewedBy, reviewedAt })
        .where(eq(overtimeEntries.id, id!));

      context.waitUntil(
        backupToFirebase("overtime_entries", id, {
          status: "rejected",
          reviewedBy: body.reviewedBy,
          reviewedAt: reviewedAt.toISOString()
        })
      );
      return json({ success: true });
    }

    if (pathname.startsWith("/api/overtime/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await db.delete(overtimeEntries).where(eq(overtimeEntries.id, id!));
      context.waitUntil(deleteFromFirebase("overtime_entries", id!));
      return json({ success: true });
    }

    // ==========================================
    // OPS RUNWAY (Neon)
    // ==========================================
    if (pathname === "/api/ops/runway" && method === "GET") {
      const results = await db.select().from(opsRunwayHistory);

      return json(
        results.map((row: any) => ({
          ...row,
          rwy19: typeof row.rwy19 === "string" ? JSON.parse(row.rwy19) : row.rwy19,
          rwy01: typeof row.rwy01 === "string" ? JSON.parse(row.rwy01) : row.rwy01,
          lights: typeof row.lights === "string" ? JSON.parse(row.lights) : row.lights,
        }))
      );
    }

    if (pathname === "/api/ops/runway" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(opsRunwayHistory).values({
        id,
        date: body.date,
        time: body.time,
        createdAt: new Date(),
        rwy19: JSON.stringify(body.rwy19),
        rwy01: JSON.stringify(body.rwy01),
        lights: JSON.stringify(body.lights),
      });

      context.waitUntil(backupToFirebase("ops_runway_history", id, body));
      return json({ success: true, id });
    }

    // ==========================================
    // OPS GROUND (Neon)
    // ==========================================
    if (pathname === "/api/ops/ground" && method === "GET") {
      const results = await db.select().from(opsGroundHistory);

      return json(
        results.map((row: any) => ({
          ...row,
          assignments: typeof row.assignments === "string"
            ? JSON.parse(row.assignments)
            : row.assignments,
        }))
      );
    }

    if (pathname === "/api/ops/ground" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(opsGroundHistory).values({
        id,
        date: body.date,
        time: body.time,
        createdAt: new Date(),
        assignments: JSON.stringify(body.assignments),
      });

      context.waitUntil(backupToFirebase("ops_ground_history", id, body));
      return json({ success: true, id });
    }

    // ==========================================
    // FOD (Neon)
    // ==========================================
    if (pathname === "/api/fod" && method === "GET") {
      const results = await db.select().from(fodCollections);
      return json(results);
    }

    if (pathname === "/api/fod" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(fodCollections).values({
        id,
        date: body.date,
        grams: body.grams,
        remarks: body.remarks,
        loggedBy: body.loggedBy || "",
        createdAt: new Date(),
      });

      context.waitUntil(backupToFirebase("fod_collections", id, { ...body }));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/fod/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/").pop();
      await db.delete(fodCollections).where(eq(fodCollections.id, id!));
      context.waitUntil(deleteFromFirebase("fod_collections", id!));
      return json({ success: true });
    }

    // ==========================================
    // WILDLIFE (Neon)
    // ==========================================
    if (pathname === "/api/wildlife" && method === "GET") {
      const results = await db.select().from(birdCounts);

      return json(
        results.map((row: any) => ({
          ...row,
          rows: typeof row.rows === "string" ? JSON.parse(row.rows) : row.rows,
        }))
      );
    }

    if (pathname === "/api/wildlife" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(birdCounts).values({
        id,
        date: body.date,
        refNo: body.refNo,
        observer: body.observer || "",
        rows: JSON.stringify(body.rows),
        createdAt: new Date(),
      });

      context.waitUntil(backupToFirebase("bird_counts", id, { ...body }));
      return json({ success: true, id });
    }

    if (url.pathname.startsWith("/api/wildlife/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = url.pathname.split("/").pop();
      await db.delete(birdCounts).where(eq(birdCounts.id, id!));
      context.waitUntil(deleteFromFirebase("bird_counts", id!));
      return json({ success: true });
    }

    // ==========================================
    // RAMP DRAFT (Neon)
    // ==========================================
    if (pathname === "/api/ramp/draft" && method === "GET") {
      const rows = await db.select().from(rampLiveDraft).limit(1);
      return json(rows.length > 0 ? JSON.parse(rows[0].payload || "{}") : {});
    }

    if (pathname === "/api/ramp/draft" && method === "POST") {
      const body: any = await request.json();
      const payloadStr = JSON.stringify(body);

      await db
        .insert(rampLiveDraft)
        .values({ id: "current", payload: payloadStr })
        .onConflictDoUpdate({
          target: rampLiveDraft.id,
          set: { payload: payloadStr },
        });

      return json({ success: true });
    }

    // ==========================================
    // RAMP REPORTS (Neon)
    // ==========================================
    if (pathname === "/api/ramp/reports" && method === "GET") {
      const results = await db.select().from(rampInspections);

      return json(
        results.map((row: any) => ({
          ...JSON.parse(row.payload),
          id: row.id,
          date: row.date,
          fltNo: row.fltNo,
          acReg: row.acReg,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      );
    }

    if (pathname === "/api/ramp/reports" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(rampInspections).values({
        id,
        date: body.date || "",
        fltNo: body.fltNo || "",
        acReg: body.acReg || "",
        payload: JSON.stringify(body),
        createdAt: new Date(),
      });

      if (body.fltNo && body.date) {
        const newStatus = body.atd ? "Departed" : body.ata ? "Landed" : body.eta ? "Departed (Origin)" : "Scheduled";

        await db
          .update(flights)
          .set({
            status: newStatus,
            eta: body.eta || null,
            ata: body.ata || null,
            atd: body.atd || null,
          })
          .where(
            and(
              sql`TRIM(UPPER(${flights.flightNo})) = TRIM(UPPER(${body.fltNo}))`,
              eq(flights.date, body.date)
            )
          );
      }

      context.waitUntil(backupToFirebase("ramp_inspections", id, { ...body }));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/ramp/reports/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/").pop();
      const body: any = await request.json();

      await db
        .update(rampInspections)
        .set({
          date: body.date || "",
          fltNo: body.fltNo || "",
          acReg: body.acReg || "",
          payload: JSON.stringify(body),
          updatedAt: new Date(),
        })
        .where(eq(rampInspections.id, id!));

      if (body.fltNo && body.date) {
        const newStatus = body.atd ? "Departed" : body.ata ? "Landed" : body.eta ? "Departed (Origin)" : "Scheduled";

        await db
          .update(flights)
          .set({
            status: newStatus,
            eta: body.eta || null,
            ata: body.ata || null,
            atd: body.atd || null,
          })
          .where(
            and(
              sql`TRIM(UPPER(${flights.flightNo})) = TRIM(UPPER(${body.fltNo}))`,
              eq(flights.date, body.date)
            )
          );
      }

      context.waitUntil(backupToFirebase("ramp_inspections", id!, { ...body }));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/ramp/reports/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/").pop();
      await db.delete(rampInspections).where(eq(rampInspections.id, id!));
      context.waitUntil(deleteFromFirebase("ramp_inspections", id!));
      return json({ success: true });
    }

    // ==========================================
    // TIMESHEET / ATTENDANCE MODULE
    // ==========================================
    if (pathname === "/api/timesheets" && method === "GET") {
      const results = await db.select().from(timesheets);
      return json(results);
    }

    if (pathname === "/api/timesheets" && method === "POST") {
      const body: any = await request.json();

      const existing = await db
        .select()
        .from(timesheets)
        .where(
          and(
            eq(timesheets.staffId, body.staffId),
            eq(timesheets.date, body.date)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(timesheets)
          .set({
            clockIn: body.clockIn,
            clockOut: body.clockOut,
            status: body.status,
            notes: body.notes || "",
          })
          .where(eq(timesheets.id, existing[0].id));

        context.waitUntil(backupToFirebase("timesheets", existing[0].id, body));
        return json({ success: true, id: existing[0].id });
      }

      const id = crypto.randomUUID();
      await db.insert(timesheets).values({
        id,
        staffId: body.staffId,
        staffName: body.staffName,
        staffDepartment: body.staffDepartment,
        date: body.date,
        clockIn: body.clockIn || "",
        clockOut: body.clockOut || "",
        status: body.status || "Present",
        notes: body.notes || "",
        createdAt: new Date(),
      });

      context.waitUntil(backupToFirebase("timesheets", id, body));
      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/timesheets/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await db.delete(timesheets).where(eq(timesheets.id, id!));
      context.waitUntil(deleteFromFirebase("timesheets", id!));
      return json({ success: true });
    }

    // ==========================================
    // TEMPORARY ACCESS MODULE
    // ==========================================
    if (pathname === "/api/temp-access" && method === "GET") {
      const results = await db.select().from(tempAccess);
      return json(results);
    }

    if (url.pathname === "/api/temp-access" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(tempAccess).values({
        id,
        email: body.email,
        targetDept: body.targetDept,
        startDate: body.startDate,
        endDate: body.endDate,
      });

      return json({ success: true, id });
    }

    if (url.pathname.startsWith("/api/temp-access/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const id = url.pathname.split("/").pop();
      await db.delete(tempAccess).where(eq(tempAccess.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // LIGHTS INSPECTORS (Neon)
    // ==========================================
    if (pathname === "/api/lights-inspectors" && method === "GET") {
      const results = await db.select().from(lightsInspectors);
      return json(results);
    }

    if (pathname === "/api/lights-inspectors" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const body: any = await request.json();

      await db
        .insert(lightsInspectors)
        .values({
          staffId: body.staffId,
          staffName: body.staffName,
          staffSN: body.staffSN || "",
        })
        .onConflictDoUpdate({
          target: lightsInspectors.staffId,
          set: {
            staffName: body.staffName,
            staffSN: body.staffSN || "",
          },
        });

      return json({ success: true });
    }

    if (pathname.startsWith("/api/lights-inspectors/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/").pop();
      await db.delete(lightsInspectors).where(eq(lightsInspectors.staffId, id!));
      return json({ success: true });
    }

    // ==========================================
    // RUNWAY LIGHTS (Neon)
    // ==========================================
    if (pathname === "/api/lights" && method === "GET") {
      const results = await db.select().from(rwyLights);

      return json(
        results.map((row: any) => ({
          ...row,
          data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
        }))
      );
    }

    if (pathname === "/api/lights" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(rwyLights).values({
        id,
        date: body.date,
        time: body.time || "",
        weather: body.weather || "",
        inspectorName: body.inspectorName,
        data: JSON.stringify(body.data),
        remarks: body.remarks || "",
        createdAt: new Date(),
      });

      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/lights/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);

      const id = pathname.split("/").pop();
      await db.delete(rwyLights).where(eq(rwyLights.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // ⚠️ TEMPORARY — ONE-TIME DATA MIGRATION (D1 → Neon)
    // DELETE THIS ENTIRE BLOCK after verification + D1 binding removal
    // ==========================================
    if (pathname === "/api/admin/migrate-d1-to-neon" && method === "POST") {
      console.log("MIGRATION STARTED");

      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);

      const summary: Record<string, any> = {};

      const migrate = async (
        name: string,
        d1Sql: string,
        neonTable: any,
        transform: (r: any) => any
      ) => {
        try {
          const { results } = await env.DB.prepare(d1Sql).all();
          if (!results || results.length === 0) {
            summary[name] = { d1Rows: 0, migrated: 0 };
            return;
          }
          const transformed = results.map(transform);

          for (const row of transformed) {
            await db.insert(neonTable).values(row).onConflictDoNothing();
          }

          summary[name] = { d1Rows: transformed.length, migrated: transformed.length };
        } catch (e: any) {
          console.error("MIGRATION ERROR:", e);
          console.error("CAUSE:", e?.cause);
          summary[name] = {
            error: String(e),
            message: e?.message,
            cause: e?.cause,
            stack: e?.stack
          };
        }
      };

      await migrate("staff", "SELECT * FROM staff", staff, (r: any) => ({
        id: r.id, sn: r.sn, name: r.name, email: r.email,
        personalEmail: r.personalEmail, nid: r.nid, joinDate: r.joinDate,
        phone: r.phone, gender: r.gender, department: r.department,
        position: r.position, isSMT: toBool(r.isSMT), isIncharge: toBool(r.isIncharge),
        balanceVisible: toBool(r.balanceVisible), specialOpsAccess: toBool(r.specialOpsAccess),
        tempDeptAccess: toBool(r.tempDeptAccess), rampsheetEditAccess: toBool(r.rampsheetEditAccess),
        rwyLightEditAccess: toBool(r.rwyLightEditAccess), birdCountEditAccess: toBool(r.birdCountEditAccess),
        opsBoardAccess: toBool(r.opsBoardAccess), tempDeptTarget: r.tempDeptTarget,
        notes: r.notes, basicSalary: r.basicSalary, dailyAllowance: r.dailyAllowance,
        holidayAllowanceRate: r.holidayAllowanceRate, bankAccount: r.bankAccount,
        status: r.status, orderIndex: r.orderIndex,
        createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt),
      }));

      await migrate("holidays", "SELECT * FROM holidays", holidays, (r: any) => ({
        id: r.id, date: r.date, name: r.name, createdAt: toDate(r.createdAt),
      }));

      await migrate("flights", "SELECT * FROM flights", flights, (r: any) => ({
        id: r.id, date: r.date, flightNo: r.flightNo, type: r.type,
        aircraft: r.aircraft, bookedFigure: r.bookedFigure,
        checkInTime: r.checkInTime, arrivalTime: r.arrivalTime,
        departureTime: r.departureTime, route: r.route,
        originDepTime: r.originDepTime,
        eta: r.eta || null,
        ata: r.ata || null,
        atd: r.atd || null,
        status: r.status, remarks: r.remarks,
        createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt),
      }));

      await migrate("leave_requests", "SELECT * FROM leave_requests", leaveRequests, (r: any) => ({
        id: r.id, staffId: r.staffId, staffName: r.staffName,
        staffDepartment: r.staffDepartment, staffSN: r.staffSN, staffGender: r.staffGender,
        leaveType: r.leaveType, startDate: r.startDate, endDate: r.endDate,
        days: r.days, reason: r.reason, status: r.status,
        requestedBy: r.requestedBy, requestedAt: toDate(r.requestedAt),
        reviewedBy: r.reviewedBy, reviewedAt: toDate(r.reviewedAt), reviewNotes: r.reviewNotes,
      }));

      await migrate("overtime_entries", "SELECT * FROM overtime_entries", overtimeEntries, (r: any) => ({
        id: r.id, staffId: r.staffId, staffName: r.staffName, staffSN: r.staffSN,
        staffDepartment: r.staffDepartment, date: r.date, startTime: r.startTime,
        endTime: r.endTime, hours: r.hours, notes: r.notes, status: r.status,
        createdBy: r.createdBy, reviewedBy: r.reviewedBy,
        createdAt: toDate(r.createdAt), reviewedAt: toDate(r.reviewedAt),
      }));

      await migrate("roster_entries", "SELECT * FROM roster_entries", rosterEntries, (r: any) => ({
        id: r.id, staffId: r.staffId, staffName: r.staffName,
        staffDepartment: r.staffDepartment, date: r.date, shiftTime: r.shiftTime,
        status: r.status, leaveRequestId: r.leaveRequestId, createdAt: toDate(r.createdAt),
      }));

      await migrate("wildlife", "SELECT * FROM bird_counts", birdCounts, (r: any) => ({
        id: r.id, date: r.date, refNo: r.refNo, observer: r.observer,
        rows: r.rows, createdAt: toDate(r.createdAt),
      }));

      await migrate("ramp_inspections", "SELECT * FROM ramp_inspections", rampInspections, (r: any) => ({
        id: r.id, date: r.date, fltNo: r.fltNo, acReg: r.acReg,
        payload: r.payload, createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt),
      }));

      await migrate("temp_access", "SELECT * FROM temp_access", tempAccess, (r: any) => ({
        id: r.id, email: r.email, targetDept: r.targetDept,
        startDate: r.startDate, endDate: r.endDate,
      }));

      await migrate("settings", "SELECT * FROM settings", settings, (r: any) => ({
        id: r.id, adminHours: r.adminHours, regularHours: r.regularHours, deductLeaves: r.deductLeaves,
      }));

      await migrate("user_presets", "SELECT * FROM user_presets", userPresets, (r: any) => ({
        id: r.id, email: r.email, role: r.role, department: r.department,
        name: r.name, position: r.position, createdAt: toDate(r.createdAt),
      }));

      await migrate("timesheets", "SELECT * FROM timesheets", timesheets, (r: any) => ({
        id: r.id, staffId: r.staffId, staffName: r.staffName,
        staffDepartment: r.staffDepartment, date: r.date, clockIn: r.clockIn,
        clockOut: r.clockOut, status: r.status, notes: r.notes,
        createdAt: toDate(r.createdAt),
      }));

      await migrate("ops_ground_history", "SELECT * FROM ops_ground_history", opsGroundHistory, (r: any) => ({
        id: r.id, date: r.date, time: r.time,
        createdAt: toDate(r.createdAt), assignments: r.assignments,
      }));

      await migrate("ops_runway_history", "SELECT * FROM ops_runway_history", opsRunwayHistory, (r: any) => ({
        id: r.id, date: r.date, time: r.time, createdAt: toDate(r.createdAt),
        rwy19: r.rwy19, rwy01: r.rwy01, lights: r.lights,
      }));

      await migrate("fod_collections", "SELECT * FROM fod_collections", fodCollections, (r: any) => ({
        id: r.id, date: r.date, grams: r.grams, remarks: r.remarks,
        loggedBy: r.loggedBy, createdAt: toDate(r.createdAt),
      }));

      await migrate("lights_inspectors", "SELECT * FROM lights_inspectors", lightsInspectors, (r: any) => ({
        staffId: r.staffId, staffName: r.staffName, staffSN: r.staffSN,
      }));

      await migrate("rwy_lights", "SELECT * FROM rwy_lights", rwyLights, (r: any) => ({
        id: r.id, date: r.date, time: r.time, weather: r.weather,
        inspectorName: r.inspectorName, data: r.data, remarks: r.remarks,
        createdAt: toDate(r.createdAt),
      }));

      await migrate("saved_reports", "SELECT * FROM saved_reports", savedReports, (r: any) => ({
        id: r.id, month: r.month, dateFrom: r.dateFrom, dateTo: r.dateTo,
        type: r.type, createdBy: r.createdBy, createdAt: toDate(r.createdAt),
      }));

      await migrate("ramp_live_draft", "SELECT * FROM ramp_live_draft", rampLiveDraft, (r: any) => ({
        id: r.id, payload: r.payload,
      }));

      return json({ success: true, summary });
    }

    return json({ message: "Not Found", pathname, method }, 404);
  } catch (err: any) {
    return json({ message: err.message, stack: err.stack }, 500);
  }
};