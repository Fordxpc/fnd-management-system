import { requireAuth } from "../middleware/auth.js";
import { requireManager, requireSMT } from "../middleware/authorization.js";
import { getAuth } from "../../src/lib/auth.js";
import { getDb } from "../../src/lib/db.js";
import {
  user, session, account, users, staff, holidays, flights, leaveRequests, overtimeEntries,
  rosterEntries, birdCounts, rampInspections, tempAccess, settings,
  userPresets, timesheets, opsGroundHistory, opsRunwayHistory, fodCollections,
  lightsInspectors, rwyLights, savedReports, rampLiveDraft, opsChecks,
  passwordResetRequests // <-- NEW IMPORT
} from "../../src/db/schema.js";
import { eq, and, inArray, sql, asc, or } from "drizzle-orm";

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const db = getDb(env);
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-email"
  };

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  if (method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ==========================================
    // PASSWORD RESET REQUESTS (NEW)
    // ==========================================
    if (pathname.startsWith("/api/password-reset-requests/") && pathname.endsWith("/approve") && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      
      const id = pathname.split("/")[3];
      const [reqData] = await db.select().from(passwordResetRequests).where(eq(passwordResetRequests.id, id)).limit(1);
      if (!reqData) return json({ message: "Request not found" }, 404);

      const targetUser = await db.select().from(user).where(eq(user.email, reqData.email)).limit(1);
      if (targetUser.length === 0) return json({ message: "User not found" }, 404);

      const userId = targetUser[0].id;

      try {
        // 1. Delete old auth records
        await db.delete(session).where(eq(session.userId, userId));
        await db.delete(account).where(eq(account.userId, userId));
        await db.delete(user).where(eq(user.id, userId));

        // 2. Re-create the user with the default password
        await getAuth(env).api.signUpEmail({
          body: { 
            email: reqData.email, 
            password: "Fnd@2026", 
            name: targetUser[0].name || "Staff Member" 
          }
        });

        // 3. Mark request as resolved
        await db.update(passwordResetRequests).set({ status: "resolved" }).where(eq(passwordResetRequests.id, id));
        
        return json({ success: true, message: "Password reset to Fnd@2026" });
      } catch (err: any) {
        return json({ message: "Failed to reset password: " + err.message }, 500);
      }
    }

    // ==========================================
    // AUTO-SYNC BETTER AUTH USER → users TABLE
    // ==========================================
    if (pathname === "/api/users/me/sync" && method === "POST") {
      const session = await getAuth(env).api.getSession({ headers: request.headers });
      if (!session?.user) return json({ message: "Unauthorized" }, 401);

      const email = session.user.email.toLowerCase();
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (existing.length === 0) {
        const snPart = email.split('@')[0];
        const staffRec = await db.select().from(staff).where(
          or(eq(staff.email, email), eq(staff.sn, snPart), eq(staff.sn, snPart.replace('sn-', '')))
        ).limit(1);

        let role = "user"; let dept = "";

        if (staffRec.length > 0) {
          role = staffRec[0].isSmt ? "smt" : "staff";
          dept = staffRec[0].department || "";
        } else {
          const preset = await db.select().from(userPresets).where(eq(userPresets.email, email)).limit(1);
          if (preset.length > 0) { role = preset[0].role || "user"; dept = preset[0].department || ""; }
        }

        await db.insert(users).values({
          id: session.user.id, email, role, department: dept, createdAt: new Date().toISOString(),
        });
      }
      return json({ success: true });
    }

    // ==========================================
    // STAFF MODULE
    // ==========================================
    if (pathname === "/api/staff" && method === "GET") {
      const results = await db.select().from(staff).orderBy(asc(staff.orderIndex));
      return json(results);
    }

    if (pathname === "/api/staff" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await db.insert(staff).values({
        id, sn: body.sn || "", name: body.name, email: body.email,
        personalEmail: body.personalEmail || "", nid: body.nid || "", joinDate: body.joinDate || "",
        phone: body.phone || "", gender: body.gender || "", department: body.department,
        position: body.position || "", isSmt: !!body.isSMT, isIncharge: !!body.isIncharge,
        balanceVisible: !!body.balanceVisible, tempDeptAccess: !!body.tempDeptAccess,
        rampsheetEditAccess: !!body.rampsheetEditAccess, rwyLightEditAccess: !!body.rwyLightEditAccess,
        birdCountEditAccess: !!body.birdCountEditAccess, opsBoardAccess: !!body.opsBoardAccess,
        tempDeptTarget: body.tempDeptTarget || "", notes: body.notes || "",
        basicSalary: body.basicSalary || 0, dailyAllowance: body.dailyAllowance || 0,
        holidayAllowanceRate: body.holidayAllowanceRate || 0, bankAccount: body.bankAccount || "",
        status: "active", orderIndex: 9999, createdAt,
      });
      return json({ success: true, id });
    }

    if (pathname === "/api/staff/reorder" && method === "PUT") {
      const body: any = await request.json();
      await Promise.all(body.orderedIds.map((id: string, index: number) => db.update(staff).set({ orderIndex: index }).where(eq(staff.id, id))));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/staff/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date().toISOString();

      const updateData: any = { updatedAt };
      const allowedFields = ['sn', 'name', 'email', 'personalEmail', 'nid', 'joinDate', 'phone', 'gender', 'department', 'position', 'isSmt', 'isIncharge', 'balanceVisible', 'tempDeptAccess', 'rampsheetEditAccess', 'rwyLightEditAccess', 'birdCountEditAccess', 'opsBoardAccess', 'tempDeptTarget', 'notes', 'basicSalary', 'dailyAllowance', 'holidayAllowanceRate', 'bankAccount'];
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          const dbField = field === 'isSMT' ? 'isSmt' : field;
          updateData[dbField] = body[field];
        }
      }

      await db.update(staff).set(updateData).where(eq(staff.id, id!));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/staff/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      await db.delete(staff).where(eq(staff.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // CHECKLIST MODULE
    // ==========================================
    if (pathname === "/api/checklist" && method === "GET") {
      const results = await db.select().from(opsChecks).orderBy(asc(opsChecks.date));
      return json(results);
    }
    if (pathname === "/api/checklist" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(opsChecks).values({
        id, date: body.date, time: body.time, category: body.category,
        status: body.status, remarks: body.remarks, checkedBy: body.checkedBy, createdAt: new Date().toISOString(),
      });
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/checklist/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await db.delete(opsChecks).where(eq(opsChecks.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // HOLIDAYS MODULE
    // ==========================================
    if (pathname === "/api/holidays" && method === "GET") {
      const results = await db.select().from(holidays).orderBy(asc(holidays.date));
      return json(results);
    }
    if (pathname === "/api/holidays" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(holidays).values({ id, date: body.date, name: body.name, createdAt: new Date().toISOString() });
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/holidays/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      await db.delete(holidays).where(eq(holidays.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // LEAVE REQUESTS MODULE
    // ==========================================
    if (pathname === "/api/leave-requests" && method === "GET") {
      const results = await db.select().from(leaveRequests).orderBy(asc(leaveRequests.startDate));
      return json(results);
    }
    if (pathname === "/api/leave-requests" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const existingLeave = await db.select().from(leaveRequests).where(and(eq(leaveRequests.staffId, body.staffId), eq(leaveRequests.startDate, body.startDate), eq(leaveRequests.endDate, body.endDate))).limit(1);

      if (existingLeave.length > 0) return json({ message: "A leave request for these exact dates already exists." }, 400);

      try {
        await db.insert(leaveRequests).values({
          id, staffId: body.staffId, staffName: body.staffName, staffDepartment: body.staffDepartment,
          staffSn: body.staffSN || "", staffGender: body.staffGender || "", leaveType: body.leaveType,
          startDate: body.startDate, endDate: body.endDate, days: body.days, reason: body.reason || "",
          status: body.status || "pending", requestedBy: body.requestedBy || "", requestedAt: new Date().toISOString(),
        });
        return json({ success: true, id });
      } catch (err: any) { return json({ message: "Failed to create leave request." }, 400); }
    }

    if (url.pathname.startsWith("/api/leave-requests/") && url.pathname.endsWith("/approve") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);
      const id = pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date().toISOString();

      const [reqData] = await db.update(leaveRequests).set({ status: "approved", reviewedBy: body.reviewedBy, reviewedAt }).where(eq(leaveRequests.id, id!)).returning();

      if (reqData) {
        const [staffRec] = await db.select().from(staff).where(eq(staff.name, reqData.staffName!)).limit(1);
        const actualStaffId = staffRec ? staffRec.id : reqData.staffId;
        if (!actualStaffId) return json({ message: "Staff ID not found" }, 400);

        const start = new Date(reqData.startDate + "T00:00:00");
        const end = new Date(reqData.endDate + "T00:00:00");
        const dateStrings: string[] = [];
        const entriesToInsert: any[] = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split("T")[0];
          dateStrings.push(dateStr);
          entriesToInsert.push({
            id: crypto.randomUUID(), staffId: actualStaffId, staffName: reqData.staffName,
            staffDepartment: reqData.staffDepartment, date: dateStr, shiftTime: "",
            status: reqData.leaveType, leaveRequestId: id, createdAt: new Date().toISOString(),
          });
        }

        if (dateStrings.length > 0) {
          await db.delete(rosterEntries).where(and(eq(rosterEntries.staffId, actualStaffId), inArray(rosterEntries.date, dateStrings)));
          await db.insert(rosterEntries).values(entriesToInsert);
        }
      }
      return json({ success: true });
    }

    if (url.pathname.startsWith("/api/leave-requests/") && url.pathname.endsWith("/reject") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);
      const id = pathname.split("/")[3];
      const body: any = await request.json();
      await db.update(leaveRequests).set({ status: "rejected", reviewedBy: body.reviewedBy, reviewedAt: new Date().toISOString(), reviewNotes: body.reviewNotes || "" }).where(eq(leaveRequests.id, id!));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/leave-requests/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await db.delete(leaveRequests).where(eq(leaveRequests.id, id!));
      await db.delete(rosterEntries).where(eq(rosterEntries.leaveRequestId, id!));
      return json({ success: true });
    }

    // ==========================================
    // ROSTER MODULE
    // ==========================================
    if (pathname === "/api/roster" && method === "GET") {
      const results = await db.select().from(rosterEntries).orderBy(asc(rosterEntries.date), asc(rosterEntries.staffName));
      return json(results);
    }

    if (pathname === "/api/roster" && method === "POST") {
      const body: any = await request.json();
      const existing = await db.select().from(rosterEntries).where(and(eq(rosterEntries.staffId, body.staffId), eq(rosterEntries.date, body.date))).limit(1);

      if (existing.length > 0 && existing[0].leaveRequestId) return json({ message: "Cannot overwrite approved leave." }, 400);

      const id = existing.length > 0 ? existing[0].id : crypto.randomUUID();
      const createdAt = new Date().toISOString();

      if (existing.length > 0) await db.delete(rosterEntries).where(eq(rosterEntries.id, id));

      if (body.status !== "clear") {
        try {
          await db.insert(rosterEntries).values({
            id, staffId: body.staffId, staffName: body.staffName, staffDepartment: body.staffDepartment,
            date: body.date, shiftTime: body.shiftTime || "", status: body.status, createdAt,
          });
        } catch (err: any) { return json({ message: "This staff member already has a duty on this day." }, 400); }
      }
      return json({ success: true, id });
    }

    if (pathname === "/api/roster/bulk" && method === "POST") {
      const body: any = await request.json();
      const values = body.entries.map((entry: any) => ({
        id: crypto.randomUUID(), staffId: entry.staffId, staffName: entry.staffName,
        staffDepartment: entry.staffDepartment, date: entry.date, shiftTime: entry.shiftTime || "",
        status: entry.status, createdAt: new Date().toISOString(),
      }));
      if (values.length > 0) {
        try { await db.insert(rosterEntries).values(values); } catch (err: any) { return json({ message: "Some entries violate rules." }, 400); }
      }
      return json({ success: true });
    }

    // ==========================================
    // FLIGHTS MODULE
    // ==========================================
    if (pathname === "/api/flights" && method === "GET") {
      const results = await db.select().from(flights).orderBy(asc(flights.date), asc(flights.departureTime));
      return json(results);
    }
    if (pathname === "/api/flights" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(flights).values({
        id, date: body.date, flightNo: body.flightNo, type: body.type, aircraft: body.aircraft,
        bookedFigure: body.bookedFigure || "", checkInTime: body.checkInTime || "", arrivalTime: body.arrivalTime || "",
        departureTime: body.departureTime || "", route: body.route || "", originDepTime: body.originDepTime || "",
        eta: body.eta || null, ata: body.ata || null, atd: body.atd || null, status: body.status,
        remarks: body.remarks || "", createdAt: new Date().toISOString(),
      });
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/flights/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      await db.update(flights).set({
        date: body.date, flightNo: body.flightNo, type: body.type, aircraft: body.aircraft,
        bookedFigure: body.bookedFigure || "", checkInTime: body.checkInTime || "", arrivalTime: body.arrivalTime || "",
        departureTime: body.departureTime || "", route: body.route || "", originDepTime: body.originDepTime || "",
        eta: body.eta || null, ata: body.ata || null, atd: body.atd || null, status: body.status,
        remarks: body.remarks || "", updatedAt: new Date().toISOString(),
      }).where(eq(flights.id, id!));
      return json({ success: true });
    }
    if (pathname.startsWith("/api/flights/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      await db.delete(flights).where(eq(flights.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // SETTINGS
    // ==========================================
    if (pathname === "/api/settings/ot_rules" && method === "GET") {
      const rule: any = (await db.select().from(settings)).find((r: any) => r.id === "ot_rules");
      if (rule) rule.deductLeaves = JSON.parse(rule.deductLeaves || "[]");
      return json(rule || { adminHours: 40, regularHours: 48, deductLeaves: [] });
    }
    if (pathname === "/api/settings/ot_rules" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const deductLeavesStr = JSON.stringify(body.deductLeaves);
      await db.insert(settings).values({
        id: "ot_rules", adminHours: body.adminHours, regularHours: body.regularHours, deductLeaves: deductLeavesStr,
      }).onConflictDoUpdate({ target: settings.id, set: { adminHours: body.adminHours, regularHours: body.regularHours, deductLeaves: deductLeavesStr } });
      return json({ success: true });
    }

    // ==========================================
    // USERS
    // ==========================================
    if (pathname === "/api/users" && method === "GET") {
      try {
        const results = await db.select().from(users).orderBy(asc(users.email));
        return json(results);
      } catch (error: any) { return json({ message: error?.message, cause: error?.cause }, 500); }
    }

    if (pathname === "/api/users/sync" && method === "POST") {
      try {
        const body: any = await request.json();
        await db.insert(users).values({
          id: body.uid, email: body.email.toLowerCase(), role: body.role || "user", department: body.department || "", createdAt: new Date().toISOString(),
        }).onConflictDoUpdate({ target: users.email, set: { role: body.role || "user", department: body.department || "" } });
        return json({ success: true });
      } catch (error) { return json({ success: false, error: String(error) }, 500); }
    }

    if (url.pathname.startsWith("/api/users/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      await db.update(users).set({ role: body.role, department: body.department }).where(eq(users.id, id!));
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
    // CREATE AUTH USER
    // ==========================================
    if (url.pathname === "/api/users/create-auth" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const { email, role, department, name, position, password } = body;

      if (!email || !password) return json({ message: "Email and password are required" }, 400);
      const activeUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (activeUser.length > 0) return json({ message: "This user already exists." }, 400);

      try {
        await getAuth(env).api.signUpEmail({ body: { email, password, name: name || "New User" } });
      } catch (err: any) { return json({ message: "Failed to create auth account: " + err.message }, 400); }

      const id = crypto.randomUUID();
      await db.insert(userPresets).values({
        id, email, role: role || "staff", department: department || "", name: name || "", position: position || "", createdAt: new Date().toISOString(),
      }).onConflictDoNothing();

      return json({ success: true, message: "User created and pre-registered." });
    }

    // ==========================================
    // USER PRESETS
    // ==========================================
    if (pathname === "/api/user-presets" && method === "GET") {
      const results = await db.select().from(userPresets).orderBy(asc(userPresets.email));
      return json(results);
    }
    if (pathname === "/api/user-presets" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(userPresets).values({
        id, email: body.email, role: body.role, department: body.department, name: body.name || "", position: body.position || "", createdAt: new Date().toISOString(),
      }).onConflictDoNothing();
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/user-presets/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      await db.update(userPresets).set({ role: body.role, department: body.department, name: body.name || "", position: body.position || "" }).where(eq(userPresets.id, id!));
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
    // SAVE MONTHLY REPORT
    // ==========================================
    if (pathname === "/api/reports/save-monthly" && method === "POST") {
      try {
        const currentUser = await requireAuth(request, env);
        requireManager(currentUser.role);
        const body: any = await request.json();
        const id = crypto.randomUUID();
        await db.insert(savedReports).values({
          id, month: body.month, dateFrom: body.dateFrom, dateTo: body.dateTo, type: body.type, createdBy: body.createdBy || "System", createdAt: new Date().toISOString(),
        });
        return json({ success: true, id });
      } catch (err: any) { return json({ error: err.message, stack: err.stack }, 500); }
    }

    // ==========================================
    // OVERTIME MODULE
    // ==========================================
    if (pathname === "/api/overtime" && method === "GET") {
      const results = await db.select().from(overtimeEntries).orderBy(asc(overtimeEntries.date));
      return json(results);
    }
    if (pathname === "/api/overtime" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const existingOvertime = await db.select().from(overtimeEntries).where(and(eq(overtimeEntries.staffId, body.staffId), eq(overtimeEntries.date, body.date), eq(overtimeEntries.startTime, body.startTime))).limit(1);
      if (existingOvertime.length > 0) return json({ message: "Overtime logged for this exact time already." }, 400);

      try {
        await db.insert(overtimeEntries).values({
          id, staffId: body.staffId, staffName: body.staffName, staffSn: body.staffSN || "", staffDepartment: body.staffDepartment,
          date: body.date, startTime: body.startTime, endTime: body.endTime, hours: body.hours, notes: body.notes || "",
          status: "pending", createdBy: body.createdBy || "", createdAt: new Date().toISOString(),
        });
        return json({ success: true, id });
      } catch (err: any) { return json({ message: "Failed to create overtime." }, 400); }
    }
    if (pathname.startsWith("/api/overtime/") && method === "PUT" && !pathname.endsWith("/approve") && !pathname.endsWith("/reject")) {
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      await db.update(overtimeEntries).set({ date: body.date, startTime: body.startTime, endTime: body.endTime, hours: body.hours, notes: body.notes || "" }).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }
    if (url.pathname.startsWith("/api/overtime/") && url.pathname.endsWith("/approve") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);
      const id = pathname.split("/")[3];
      const body: any = await request.json();
      await db.update(overtimeEntries).set({ status: "approved", reviewedBy: body.reviewedBy, reviewedAt: new Date().toISOString() }).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }
    if (url.pathname.startsWith("/api/overtime/") && url.pathname.endsWith("/reject") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);
      const id = pathname.split("/")[3];
      const body: any = await request.json();
      await db.update(overtimeEntries).set({ status: "rejected", reviewedBy: body.reviewedBy, reviewedAt: new Date().toISOString() }).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }
    if (pathname.startsWith("/api/overtime/") && method === "DELETE") {
      const id = pathname.split("/").pop();
      await db.delete(overtimeEntries).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // OPS RUNWAY & GROUND, FOD, WILDLIFE, RAMP DRAFT, REPORTS, TIMESHEETS, TEMP ACCESS, INSPECTORS, LIGHTS
    // ==========================================
    // (These routes remain unchanged, I have omitted them for brevity in this response but you should keep them in your file!)
    
    // Note: Make sure you copy your existing routes for:
    // /api/ops/runway, /api/ops/ground, /api/fod, /api/wildlife, /api/ramp/draft
    // /api/ramp/reports, /api/timesheets, /api/temp-access, /api/lights-inspectors, /api/lights

    return json({ message: "Not Found", pathname, method }, 404);
  } catch (err: any) {
    return json({ message: err.message, stack: err.stack }, 500);
  }
};