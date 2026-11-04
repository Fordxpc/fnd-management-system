import { requireAuth } from "../middleware/auth.js";
import { requireManager, requireSMT } from "../middleware/authorization.js";
import { getAuth } from "../../src/lib/auth.js";
import { getDb } from "../../src/lib/db.js";
import {
  user, session, account, users, staff, holidays, flights, leaveRequests, overtimeEntries,
  rosterEntries, birdCounts, rampInspections, tempAccess, settings,
  userPresets, timesheets, opsGroundHistory, opsRunwayHistory, fodCollections,
  lightsInspectors, rwyLights, savedReports, rampLiveDraft, opsChecks,
  passwordResetRequests, chatGroups, chatGroupMembers, chatMessages
} from "../../src/db/schema.js";
import { eq, and, inArray, sql, asc, desc, or, count, gte, lte } from "drizzle-orm";
import {
  requireFlightsEdit,
  requireRampEdit,
  requireBirdEdit,
  requireRWYEdit,
  requireOpsBoardView,
  requireOpsBoardEdit,
  requireRosterEdit,
  requireLeaveEdit,
  requireOvertimeEdit,
  requireLeaveApproval,
  requireOTApproval
} from "../../src/lib/permission-check.js";

const isManagerRole = (role: string | undefined | null) =>
  ['developer', 'manager', 'admin', 'owner'].includes(role || '');

const requireRoleAssignment = (currentRole: string, requestedRole: string | undefined) => {
  if (requestedRole === "developer" && currentRole !== "developer") {
    const err: any = new Error("Only a developer can assign the developer role");
    err.status = 403;
    throw err;
  }
};

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
    const isPublicRequest =
      (pathname === "/api/request-password-reset" && method === "POST") ||
      (pathname === "/api/ramp/draft" && method === "GET");

    // Every API route is private unless it is explicitly listed above.
    // Individual handlers still perform their finer-grained role checks.
    if (!isPublicRequest) {
      await requireAuth(request, env);
    }

    // ==========================================
    // CHAT SYSTEM
    // ==========================================
    if (pathname === "/api/chat/groups" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      const allGroups = await db.select().from(chatGroups);
      const myMemberships = await db.select().from(chatGroupMembers).where(eq(chatGroupMembers.staffId, currentUser.id));
      const myGroupIds = myMemberships.map((m: any) => m.groupId);

      const isDevOrManager = ['developer', 'manager', 'admin'].includes(currentUser.role);

      const filteredGroups = allGroups.filter((g: any) => 
        myGroupIds.includes(g.id) || 
        (isDevOrManager && g.createdBy === currentUser.email) ||
        (g.department === currentUser.department) ||
        g.department === null
      );

      return json(filteredGroups);
    }

    if (pathname === "/api/chat/groups" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const id = crypto.randomUUID();

      await db.insert(chatGroups).values({
        id, name: body.name, description: body.description || "", department: body.department || null,
        createdBy: currentUser.email, createdAt: new Date().toISOString(),
      });

      await db.insert(chatGroupMembers).values({
        id: crypto.randomUUID(), groupId: id, staffId: currentUser.id, role: 'admin', createdAt: new Date().toISOString()
      });

      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/chat/groups/") && pathname.endsWith("/messages") && method === "GET") {
      const groupId = pathname.split("/")[4];

      const currentUser = await requireAuth(
        request,
        env
      );

      const membership = await db
        .select()
        .from(chatGroupMembers)
        .where(
          and(
            eq(chatGroupMembers.groupId, groupId),
            eq(chatGroupMembers.staffId, currentUser.id)
          )
        )
        .limit(1);

      if (
        membership.length === 0 &&
        !["developer","manager","admin"].includes(currentUser.role)
      ) {
        return json(
          { message: "Access denied" },
          403
        );
      }

      const messages = await db.select().from(chatMessages)
        .where(eq(chatMessages.groupId, groupId))
        .orderBy(asc(chatMessages.createdAt));
      return json(messages);
    }

    if (pathname.startsWith("/api/chat/groups/") && pathname.endsWith("/messages") && method === "POST") {
      const currentUser = await requireAuth(request, env);
      const groupId = pathname.split("/")[4];

      const membership = await db
        .select()
        .from(chatGroupMembers)
        .where(
          and(
            eq(chatGroupMembers.groupId, groupId),
            eq(chatGroupMembers.staffId, currentUser.id)
          )
        )
        .limit(1);

      if (
        membership.length === 0 &&
        !["developer","manager","admin"].includes(currentUser.role)
      ) {
        return json(
          { message: "Access denied" },
          403
        );
      }

      const body: any = await request.json();
      
      await db.insert(chatMessages).values({
        id: crypto.randomUUID(), groupId, senderId: currentUser.id, senderName: currentUser.name,
        message: body.message || "", imageUrl: body.imageUrl || null, createdAt: new Date().toISOString(),
      });
      return json({ success: true });
    }

    if (pathname.startsWith("/api/chat/groups/") && pathname.endsWith("/members") && method === "POST") {
      const currentUser = await requireAuth(request, env);
      const groupId = pathname.split("/")[4];
      const body: any = await request.json();
      
      const isGroupAdmin = await db.select().from(chatGroupMembers).where(and(
        eq(chatGroupMembers.groupId, groupId), 
        eq(chatGroupMembers.staffId, currentUser.id), 
        eq(chatGroupMembers.role, 'admin')
      )).limit(1);

      if (isGroupAdmin.length === 0 && !['developer', 'manager', 'admin'].includes(currentUser.role)) {
        return json({ message: "Unauthorized to add members" }, 403);
      }

      await db.insert(chatGroupMembers).values({
        id: crypto.randomUUID(), groupId, staffId: body.staffId, role: 'member', createdAt: new Date().toISOString()
      }).onConflictDoNothing();

      return json({ success: true });
    }

    // ==========================================
    // PASSWORD RESET REQUESTS
    // ==========================================
    if (pathname === "/api/request-password-reset" && method === "POST") {
      const body: any = await request.json();
      if (!body.email) return json({ message: "Email required" }, 400);

      const existingUser = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
      if (existingUser.length === 0) {
         return json({ message: "If an account exists, a request was sent." });
      }

      const id = crypto.randomUUID();
      await db.insert(passwordResetRequests).values({
        id, email: body.email.toLowerCase(), status: "pending", requestedAt: new Date().toISOString(),
      });

      return json({ success: true, message: "Request sent to Admin." });
    }

    if (pathname === "/api/password-reset-requests" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const results = await db.select().from(passwordResetRequests).where(eq(passwordResetRequests.status, "pending"));
      return json(results);
    }

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
        await db.delete(session).where(eq(session.userId, userId));
        await db.delete(account).where(eq(account.userId, userId));
        await db.delete(user).where(eq(user.id, userId));

        const temporaryPassword = `Fnd!${crypto.randomUUID()}`;
        await getAuth(env).api.signUpEmail({
          body: { email: reqData.email, password: temporaryPassword, name: targetUser[0].name || "Staff Member" }
        });

        await db.update(passwordResetRequests).set({ status: "resolved" }).where(eq(passwordResetRequests.id, id));
        return json({ success: true, message: "Password reset completed", temporaryPassword });
      } catch (err: any) {
        console.error("Failed to reset password", err);
        return json({ message: "Failed to reset password" }, 500);
      }
    }

    // ==========================================
    // AUTO-SYNC BETTER AUTH USER → users TABLE
    // ==========================================
    if (pathname === "/api/users/me/sync" && method === "POST") {

      const sessionData =
        await getAuth(env).api.getSession({
          headers: request.headers
        });

      if (!sessionData?.user) {
        return json(
          { message: "Unauthorized" },
          401
        );
      }

      const email =
        sessionData.user.email.toLowerCase();

      const existing =
        await db
          .select()
          .from(users)
          .where(
            eq(
              users.email,
              email
            )
          )
          .limit(1);

      const snPart =
        email.split("@")[0];

      const staffRec =
        await db
          .select()
          .from(staff)
          .where(
            or(
              eq(staff.email, email),
              eq(staff.sn, snPart),
              eq(
                staff.sn,
                snPart.replace(
                  "sn-",
                  ""
                )
              )
            )
          )
          .limit(1);

      let role = "user";
      let dept = "";

      const existingRole = existing[0]?.role;

      if (
        existingRole &&
        ["developer", "admin", "manager"].includes(existingRole)
      ) {
        role = existingRole;
        dept = existing[0]?.department || staffRec[0]?.department || "";
      } else if (staffRec.length > 0) {
        if (staffRec[0].isIncharge || staffRec[0].isSmt) {
          role = "smt";
        } else {
          role = "staff";
        }
        dept = staffRec[0].department || "";
      } else {
        const preset =
          await db
            .select()
            .from(userPresets)
            .where(
              eq(
                userPresets.email,
                email
              )
            )
            .limit(1);

        if (preset.length > 0) {
          role = preset[0].role || "user";
          dept = preset[0].department || "";
        }
      }

      if (existing.length === 0) {

        await db
          .insert(users)
          .values({
            id: sessionData.user.id,
            email,
            role,
            department: dept,
            createdAt:
              new Date().toISOString(),
          });

      } else {

        await db
          .update(users)
          .set({
            role,
            department: dept,
          })
          .where(
            eq(
              users.email,
              email
            )
          );

      }

      return json({
        success: true,
        role,
        department: dept,
        matchedStaff:
          staffRec.length > 0
      });
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
        isSmt: !!body.isSMT, 
        isIncharge: !!body.isIncharge,
        balanceVisible: !!body.balanceVisible, 
        tempDeptAccess: !!body.tempDeptAccess,
        
        // View/Edit Permissions
        rampsheetViewAccess: !!body.rampsheetViewAccess,
        rampsheetEditAccess: !!body.rampsheetEditAccess,
        rwyLightViewAccess: !!body.rwyLightViewAccess,
        rwyLightEditAccess: !!body.rwyLightEditAccess,
        birdCountViewAccess: !!body.birdCountViewAccess,
        birdCountEditAccess: !!body.birdCountEditAccess,
        opsBoardViewAccess: !!body.opsBoardViewAccess,
        opsBoardEditAccess: !!body.opsBoardEditAccess,
        flightsViewAccess: !!body.flightsViewAccess,
        flightsEditAccess: !!body.flightsEditAccess,
        rosterViewAccess: !!body.rosterViewAccess,
        rosterEditAccess: !!body.rosterEditAccess,
        leaveViewAccess: !!body.leaveViewAccess,
        leaveEditAccess: !!body.leaveEditAccess,
        overtimeViewAccess: !!body.overtimeViewAccess,
        overtimeEditAccess: !!body.overtimeEditAccess,
        reportsViewAccess: !!body.reportsViewAccess,
        reportsEditAccess: !!body.reportsEditAccess,
        staffViewAccess: !!body.staffViewAccess,
        staffEditAccess: !!body.staffEditAccess,
        settingsViewAccess: !!body.settingsViewAccess,
        settingsEditAccess: !!body.settingsEditAccess,
        
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
      return json({ success: true, id });
    }

    if (pathname === "/api/staff/reorder" && method === "PUT") {
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      requireManager(currentUser.role);
      
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
      const allowedFields = [
        'sn', 'name', 'email', 'personalEmail', 'nid', 'joinDate', 'phone', 'gender',
        'department', 'position', 'isSmt', 'isIncharge', 'balanceVisible', 'tempDeptAccess',
        'rampsheetViewAccess', 'rampsheetEditAccess',
        'rwyLightViewAccess', 'rwyLightEditAccess',
        'birdCountViewAccess', 'birdCountEditAccess',
        'opsBoardViewAccess', 'opsBoardEditAccess',
        'flightsViewAccess', 'flightsEditAccess',
        'rosterViewAccess', 'rosterEditAccess',
        'leaveViewAccess', 'leaveEditAccess',
        'overtimeViewAccess', 'overtimeEditAccess',
        'reportsViewAccess', 'reportsEditAccess',
        'staffViewAccess', 'staffEditAccess',
        'settingsViewAccess', 'settingsEditAccess',
        'tempDeptTarget', 'notes', 'basicSalary', 'dailyAllowance', 'holidayAllowanceRate', 'bankAccount'
      ];
      
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
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      await requireOpsBoardEdit(
        env,
        currentUser
      );
      
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(opsChecks).values({
        id, date: body.date, time: body.time, category: body.category,
        status: body.status, remarks: body.remarks, checkedBy: body.checkedBy, createdAt: new Date().toISOString(),
      });
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/checklist/") && method === "DELETE") {
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      await requireOpsBoardEdit(
        env,
        currentUser
      );
      
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
      const existingLeave = await db.select().from(leaveRequests).where(and(
        eq(leaveRequests.staffId, body.staffId), 
        eq(leaveRequests.startDate, body.startDate), 
        eq(leaveRequests.endDate, body.endDate)
      )).limit(1);

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
      const id = pathname.split("/")[3];
      const leaveRows = await db
        .select()
        .from(leaveRequests)
        .where(
          eq(
            leaveRequests.id,
            id!
          )
        )
        .limit(1);

      if (
        leaveRows.length === 0
      ) {
        return json(
          { message: "Request not found" },
          404
        );
      }

      const leaveRow =
        leaveRows[0] as any;

      const staffRows =
        await db
          .select()
          .from(staff)
          .where(
            eq(
              staff.id,
              String(
                leaveRow.staffId
              )
            )
          )
          .limit(1);

      const targetStaff =
        staffRows[0] as any;

      if (targetStaff) {

        await requireLeaveApproval(
          env,
          currentUser.email,
          targetStaff.email
        );

      }

      const body: any = await request.json();
      const reviewedAt = new Date().toISOString();

      const [reqData] = await db.update(leaveRequests).set({ 
        status: "approved", reviewedBy: body.reviewedBy, reviewedAt 
      }).where(eq(leaveRequests.id, id!)).returning();

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
      const id = pathname.split("/")[3];

      const leaveRows = await db
        .select()
        .from(leaveRequests)
        .where(
          eq(
            leaveRequests.id,
            id!
          )
        )
        .limit(1);

      if (
        leaveRows.length === 0
      ) {
        return json(
          { message: "Request not found" },
          404
        );
      }

      const leaveRow =
        leaveRows[0] as any;

      const staffRows =
        await db
          .select()
          .from(staff)
          .where(
            eq(
              staff.id,
              String(
                leaveRow.staffId
              )
            )
          )
          .limit(1);

      const targetStaff =
        staffRows[0] as any;

      if (targetStaff) {

        await requireLeaveApproval(
          env,
          currentUser.email,
          targetStaff.email
        );

      }

      const body: any = await request.json();
      await db.update(leaveRequests).set({ 
        status: "rejected", reviewedBy: body.reviewedBy, reviewedAt: new Date().toISOString(), 
        reviewNotes: body.reviewNotes || "" 
      }).where(eq(leaveRequests.id, id!));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/leave-requests/") && method === "DELETE") {
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      await requireLeaveEdit(
        env,
        currentUser
      );
      
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
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      await requireRosterEdit(
        env,
        currentUser
      );
      
      const body: any = await request.json();
      const existing = await db.select().from(rosterEntries).where(and(
        eq(rosterEntries.staffId, body.staffId), 
        eq(rosterEntries.date, body.date)
      )).limit(1);

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
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      await requireRosterEdit(
        env,
        currentUser
      );
      
      const body: any = await request.json();
      const values = body.entries.map((entry: any) => ({
        id: crypto.randomUUID(), staffId: entry.staffId, staffName: entry.staffName,
        staffDepartment: entry.staffDepartment, date: entry.date, shiftTime: entry.shiftTime || "",
        status: entry.status, createdAt: new Date().toISOString(),
      }));
      if (values.length > 0) {
        try { await db.insert(rosterEntries).values(values); } 
        catch (err: any) { return json({ message: "Some entries violate rules." }, 400); }
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

      await requireFlightsEdit(
        env,
        currentUser
      );
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

      await requireFlightsEdit(
        env,
        currentUser
      );
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

      await requireFlightsEdit(
        env,
        currentUser
      );
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
      }).onConflictDoUpdate({ 
        target: settings.id, 
        set: { adminHours: body.adminHours, regularHours: body.regularHours, deductLeaves: deductLeavesStr } 
      });
      return json({ success: true });
    }

    // ==========================================
    // USERS
    // ==========================================
    if (pathname === "/api/users" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const results = await db.select().from(users).orderBy(asc(users.email));
      return json(results);
    }

    if (pathname === "/api/users/sync" && method === "POST") {
      try {
        const currentUser = await requireAuth(request, env);
        requireManager(currentUser.role);
        const body: any = await request.json();
        requireRoleAssignment(currentUser.role, body.role);
        await db.insert(users).values({
          id: body.uid, email: body.email.toLowerCase(), role: body.role || "user", 
          department: body.department || "", createdAt: new Date().toISOString(),
        }).onConflictDoUpdate({ 
          target: users.email, 
          set: { role: body.role || "user", department: body.department || "" } 
        });
        return json({ success: true });
      } catch (error) {
        console.error("Failed to sync user", error);
        return json({ success: false, message: "Failed to sync user" }, 500);
      }
    }

    if (url.pathname.startsWith("/api/users/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();

      try {
        // Protect developer accounts
        const existingRows = await db.select().from(users).where(eq(users.id, id!)).limit(1);
        const existingUser = existingRows[0];

        if (
          existingUser.role === "developer" &&
          currentUser.role !== "developer"
        ) {
          return json(
            { message: "Cannot modify developer account" },
            403
          );
        }

        if (
          body.role === "developer" &&
          currentUser.role !== "developer"
        ) {
          return json(
            { message: "Cannot assign developer role" },
            403
          );
        }

        // 1. Update your legacy app table
        await db
          .update(users)
          .set({ role: body.role, department: body.department })
          .where(eq(users.id, id!));

        // 2. Update the Better Auth user table to keep them in sync
        await db
          .update(user) 
          .set({ role: body.role, department: body.department })
          .where(eq(user.id, id!));

        return json({ success: true });
      } catch (err: any) {
        console.error("Failed to update role:", err);
        return json({ message: "Failed to update role" }, 500);
      }
    }

    if (url.pathname.startsWith("/api/users/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = url.pathname.split("/").pop();
      const [existingUser] = await db.select().from(users).where(eq(users.id, id!)).limit(1);
      if (existingUser?.role === "developer" && currentUser.role !== "developer") {
        return json({ message: "Cannot delete developer account" }, 403);
      }
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
      requireRoleAssignment(currentUser.role, role);

      if (!email || !password) return json({ message: "Email and password are required" }, 400);
      const activeUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (activeUser.length > 0) return json({ message: "This user already exists." }, 400);

      try {
        await getAuth(env).api.signUpEmail({ body: { email, password, name: name || "New User" } });
      } catch (err: any) {
        console.error("Failed to create auth account", err);
        return json({ message: "Failed to create auth account" }, 400);
      }

      const id = crypto.randomUUID();
      await db.insert(userPresets).values({
        id, email, role: role || "staff", department: department || "", 
        name: name || "", position: position || "", createdAt: new Date().toISOString(),
      }).onConflictDoNothing();

      return json({ success: true, message: "User created and pre-registered." });
    }

    // ==========================================
    // USER PRESETS
    // ==========================================
    if (pathname === "/api/user-presets" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const results = await db.select().from(userPresets).orderBy(asc(userPresets.email));
      return json(results);
    }
    if (pathname === "/api/user-presets" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      requireRoleAssignment(currentUser.role, body.role);
      const id = crypto.randomUUID();
      await db.insert(userPresets).values({
        id, email: body.email, role: body.role, department: body.department, 
        name: body.name || "", position: body.position || "", createdAt: new Date().toISOString(),
      }).onConflictDoNothing();
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/user-presets/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      requireRoleAssignment(currentUser.role, body.role);
      await db.update(userPresets).set({ 
        role: body.role, department: body.department, name: body.name || "", position: body.position || "" 
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
    // SAVE MONTHLY REPORT
    // ==========================================
    if (pathname === "/api/reports/save-monthly" && method === "POST") {
      try {
        const currentUser = await requireAuth(request, env);
        requireManager(currentUser.role);
        const body: any = await request.json();
        const id = crypto.randomUUID();
        await db.insert(savedReports).values({
          id, month: body.month, dateFrom: body.dateFrom, dateTo: body.dateTo, 
          type: body.type, createdBy: body.createdBy || "System", createdAt: new Date().toISOString(),
        });
        return json({ success: true, id });
      } catch (err: any) {
        console.error("Failed to save monthly report", err);
        return json({ message: "Failed to save monthly report" }, 500);
      }
    }

    // ==========================================
    // OVERTIME MODULE
    // ==========================================
    if (pathname === "/api/overtime" && method === "GET") {
      const results = await db.select().from(overtimeEntries).orderBy(asc(overtimeEntries.date));
      return json(results);
    }
    if (pathname === "/api/overtime" && method === "POST") {
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      await requireOvertimeEdit(
        env,
        currentUser
      );
      
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const existingOvertime = await db.select().from(overtimeEntries).where(and(
        eq(overtimeEntries.staffId, body.staffId), 
        eq(overtimeEntries.date, body.date), 
        eq(overtimeEntries.startTime, body.startTime)
      )).limit(1);
      if (existingOvertime.length > 0) return json({ message: "Overtime logged for this exact time already." }, 400);

      try {
        await db.insert(overtimeEntries).values({
          id, staffId: body.staffId, staffName: body.staffName, staffSn: body.staffSN || "", 
          staffDepartment: body.staffDepartment, date: body.date, startTime: body.startTime, 
          endTime: body.endTime, hours: body.hours, notes: body.notes || "",
          status: "pending", createdBy: body.createdBy || "", createdAt: new Date().toISOString(),
        });
        return json({ success: true, id });
      } catch (err: any) { return json({ message: "Failed to create overtime." }, 400); }
    }
    if (
      pathname.startsWith("/api/overtime/") &&
      method === "PUT" &&
      !pathname.endsWith("/approve") &&
      !pathname.endsWith("/reject")
    ) {
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      await requireOvertimeEdit(
        env,
        currentUser
      );
      
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      await db.update(overtimeEntries).set({ 
        date: body.date, startTime: body.startTime, endTime: body.endTime, 
        hours: body.hours, notes: body.notes || "" 
      }).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }
    if (url.pathname.startsWith("/api/overtime/") && url.pathname.endsWith("/approve") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      const id = pathname.split("/")[3];

      const overtimeRows =
        await db
          .select()
          .from(overtimeEntries)
          .where(
            eq(
              overtimeEntries.id,
              id!
            )
          )
          .limit(1);

      if (
        overtimeRows.length === 0
      ) {
        return json(
          { message: "Overtime not found" },
          404
        );
      }

      const overtimeRow =
        overtimeRows[0] as any;

      const staffRows =
        await db
          .select()
          .from(staff)
          .where(
            eq(
              staff.id,
              String(
                overtimeRow.staffId
              )
            )
          )
          .limit(1);

      const targetStaff =
        staffRows[0] as any;

      if (targetStaff) {

        await requireOTApproval(
          env,
          currentUser.email,
          targetStaff.email
        );

      }

      const body: any = await request.json();
      await db.update(overtimeEntries).set({ 
        status: "approved", reviewedBy: body.reviewedBy, reviewedAt: new Date().toISOString() 
      }).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }
    if (url.pathname.startsWith("/api/overtime/") && url.pathname.endsWith("/reject") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      const id = pathname.split("/")[3];

      const overtimeRows =
        await db
          .select()
          .from(overtimeEntries)
          .where(
            eq(
              overtimeEntries.id,
              id!
            )
          )
          .limit(1);

      if (
        overtimeRows.length === 0
      ) {
        return json(
          { message: "Overtime not found" },
          404
        );
      }

      const overtimeRow =
        overtimeRows[0] as any;

      const staffRows =
        await db
          .select()
          .from(staff)
          .where(
            eq(
              staff.id,
              String(
                overtimeRow.staffId
              )
            )
          )
          .limit(1);

      const targetStaff =
        staffRows[0] as any;

      if (targetStaff) {

        await requireOTApproval(
          env,
          currentUser.email,
          targetStaff.email
        );

      }

      const body: any = await request.json();
      await db.update(overtimeEntries).set({ 
        status: "rejected", reviewedBy: body.reviewedBy, reviewedAt: new Date().toISOString() 
      }).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }
    if (pathname.startsWith("/api/overtime/") && method === "DELETE") {
      
      const currentUser = await requireAuth(
        request,
        env
      );
      
      await requireOvertimeEdit(
        env,
        currentUser
      );
      
      const id = pathname.split("/").pop();
      await db.delete(overtimeEntries).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // OPS RUNWAY
    // ==========================================
    if (pathname === "/api/ops/runway" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardView(env, currentUser);
      const results = await db.select().from(opsRunwayHistory).orderBy(desc(opsRunwayHistory.date));
      return json(results.map((row: any) => ({
        ...row,
        rwy19: typeof row.rwy19 === "string" ? JSON.parse(row.rwy19) : row.rwy19,
        rwy01: typeof row.rwy01 === "string" ? JSON.parse(row.rwy01) : row.rwy01,
        lights: typeof row.lights === "string" ? JSON.parse(row.lights) : row.lights,
      })));
    }
    if (pathname === "/api/ops/runway" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardEdit(env, currentUser);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(opsRunwayHistory).values({
        id, date: body.date, time: body.time, createdAt: new Date().toISOString(),
        rwy19: JSON.stringify(body.rwy19), rwy01: JSON.stringify(body.rwy01), lights: JSON.stringify(body.lights),
      });
      return json({ success: true, id });
    }

    // ==========================================
    // OPS GROUND
    // ==========================================
    if (pathname === "/api/ops/ground" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardView(env, currentUser);
      const results = await db.select().from(opsGroundHistory).orderBy(desc(opsGroundHistory.date));
      return json(results.map((row: any) => ({
        ...row,
        assignments: typeof row.assignments === "string" ? JSON.parse(row.assignments) : row.assignments,
      })));
    }
    if (pathname === "/api/ops/ground" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardEdit(env, currentUser);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(opsGroundHistory).values({
        id, date: body.date, time: body.time, createdAt: new Date().toISOString(),
        assignments: JSON.stringify(body.assignments),
      });
      return json({ success: true, id });
    }

    // ==========================================
    // FOD
    // ==========================================
    if (pathname === "/api/fod" && method === "GET") {
      const results = await db.select().from(fodCollections).orderBy(desc(fodCollections.date));
      return json(results);
    }
    if (pathname === "/api/fod" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(fodCollections).values({
        id, date: body.date, grams: body.grams, remarks: body.remarks,
        loggedBy: body.loggedBy || "", createdAt: new Date().toISOString(),
      });
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/fod/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);
      const id = pathname.split("/").pop();
      await db.delete(fodCollections).where(eq(fodCollections.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // WILDLIFE
    // ==========================================
    if (pathname === "/api/wildlife" && method === "GET") {
      const results = await db.select().from(birdCounts).orderBy(desc(birdCounts.date));
      return json(results.map((row: any) => ({ 
        ...row, 
        rows: typeof row.rows === "string" ? JSON.parse(row.rows) : row.rows 
      })));
    }
    if (pathname === "/api/wildlife" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireBirdEdit(env, currentUser);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(birdCounts).values({ 
        id, date: body.date, refNo: body.refNo, observer: body.observer || "", 
        rows: JSON.stringify(body.rows), createdAt: new Date().toISOString() 
      });
      return json({ success: true, id });
    }
    if (url.pathname.startsWith("/api/wildlife/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      await requireBirdEdit(env, currentUser);
      const id = url.pathname.split("/").pop();
      await db.delete(birdCounts).where(eq(birdCounts.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // RAMP DRAFT & REPORTS
    // ==========================================
    if (pathname === "/api/ramp/draft" && method === "GET") {
      const rows = await db.select().from(rampLiveDraft).limit(1);
      return json(rows.length > 0 ? JSON.parse(rows[0].payload || "{}") : {});
    }
    if (pathname === "/api/ramp/draft" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireRampEdit(env, currentUser);
      const body: any = await request.json();
      const payloadStr = JSON.stringify(body);
      await db.insert(rampLiveDraft).values({ id: "current", payload: payloadStr })
        .onConflictDoUpdate({ target: rampLiveDraft.id, set: { payload: payloadStr } });
      return json({ success: true });
    }
    if (pathname === "/api/ramp/reports" && method === "GET") {
      const results = await db.select().from(rampInspections)
        .orderBy(desc(rampInspections.date), desc(rampInspections.createdAt));
      return json(results.map((row: any) => ({ 
        ...JSON.parse(row.payload || "{}"), 
        id: row.id, date: row.date, fltNo: row.fltNo, acReg: row.acReg, 
        createdAt: row.createdAt, updatedAt: row.updatedAt 
      })));
    }
    if (pathname === "/api/ramp/reports" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireRampEdit(
        env,
        currentUser
);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(rampInspections).values({ 
        id, date: body.date || "", fltNo: body.fltNo || "", acReg: body.acReg || "", 
        payload: JSON.stringify(body), createdAt: new Date().toISOString() 
      });

      if (body.fltNo && body.date) {
        const newStatus = body.atd ? "Departed" : body.ata ? "Landed" : body.eta ? "Departed (Origin)" : "Scheduled";
        await db.update(flights).set({ 
          status: newStatus, eta: body.eta || null, ata: body.ata || null, atd: body.atd || null 
        }).where(and(
          sql`TRIM(UPPER(${flights.flightNo})) = TRIM(UPPER(${body.fltNo}))`, 
          eq(flights.date, body.date)
        ));
      }
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/ramp/reports/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      await requireRampEdit(
        env,
        currentUser
      );
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      await db.update(rampInspections).set({ 
        date: body.date || "", fltNo: body.fltNo || "", acReg: body.acReg || "", 
        payload: JSON.stringify(body), updatedAt: new Date().toISOString() 
      }).where(eq(rampInspections.id, id!));

      if (body.fltNo && body.date) {
        const newStatus = body.atd ? "Departed" : body.ata ? "Landed" : body.eta ? "Departed (Origin)" : "Scheduled";
        await db.update(flights).set({ 
          status: newStatus, eta: body.eta || null, ata: body.ata || null, atd: body.atd || null 
        }).where(and(
          sql`TRIM(UPPER(${flights.flightNo})) = TRIM(UPPER(${body.fltNo}))`, 
          eq(flights.date, body.date)
        ));
      }
      return json({ success: true });
    }
    if (pathname.startsWith("/api/ramp/reports/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      await requireRampEdit(
        env,
        currentUser
      );
      const id = pathname.split("/").pop();
      await db.delete(rampInspections).where(eq(rampInspections.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // TIMESHEET
    // ==========================================
    if (pathname === "/api/timesheets" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const results = await db.select().from(timesheets).orderBy(asc(timesheets.date));
      return json(results);
    }
    if (pathname === "/api/timesheets" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const existing = await db.select().from(timesheets).where(and(
        eq(timesheets.staffId, body.staffId), 
        eq(timesheets.date, body.date)
      )).limit(1);

      if (existing.length > 0) {
        await db.update(timesheets).set({ 
          clockIn: body.clockIn, clockOut: body.clockOut, status: body.status, notes: body.notes || "" 
        }).where(eq(timesheets.id, existing[0].id));
        return json({ success: true, id: existing[0].id });
      }
      const id = crypto.randomUUID();
      await db.insert(timesheets).values({ 
        id, staffId: body.staffId, staffName: body.staffName, staffDepartment: body.staffDepartment, 
        date: body.date, clockIn: body.clockIn || "", clockOut: body.clockOut || "", 
        status: body.status || "Present", notes: body.notes || "", createdAt: new Date().toISOString() 
      });
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/timesheets/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      await db.delete(timesheets).where(eq(timesheets.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // TEMPORARY ACCESS
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
        id, email: body.email, targetDept: body.targetDept, 
        startDate: body.startDate, endDate: body.endDate 
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
    // LIGHTS INSPECTORS
    // ==========================================
    if (pathname === "/api/lights-inspectors" && method === "GET") {
      const results = await db.select().from(lightsInspectors);
      return json(results);
    }
    if (pathname === "/api/lights-inspectors" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireRWYEdit(env, currentUser);
      const body: any = await request.json();
      await db.insert(lightsInspectors).values({ 
        staffId: body.staffId, staffName: body.staffName, staffSn: body.staffSN || "" 
      }).onConflictDoUpdate({ 
        target: lightsInspectors.staffId, 
        set: { staffName: body.staffName, staffSn: body.staffSN || "" } 
      });
      return json({ success: true });
    }
    if (pathname.startsWith("/api/lights-inspectors/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      await requireRWYEdit(env, currentUser);
      const id = pathname.split("/").pop();
      await db.delete(lightsInspectors).where(eq(lightsInspectors.staffId, id!));
      return json({ success: true });
    }

    // ==========================================
    // RUNWAY LIGHTS
    // ==========================================
    if (pathname === "/api/lights" && method === "GET") {
      const results = await db.select().from(rwyLights).orderBy(desc(rwyLights.date));
      return json(results.map((row: any) => ({ 
        ...row, 
        data: typeof row.data === "string" ? JSON.parse(row.data) : row.data 
      })));
    }
    if (pathname === "/api/lights" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireRWYEdit(env, currentUser);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(rwyLights).values({ 
        id, date: body.date, time: body.time || "", weather: body.weather || "", 
        inspectorName: body.inspectorName, data: JSON.stringify(body.data), 
        remarks: body.remarks || "", createdAt: new Date().toISOString() 
      });
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/lights/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      await requireRWYEdit(env, currentUser);
      const id = pathname.split("/").pop();
      await db.delete(rwyLights).where(eq(rwyLights.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // DASHBOARD
    // ==========================================

    if (
      pathname === "/api/dashboard" &&
      method === "GET"
    ) {

      const currentUser =
        await requireAuth(
          request,
          env
        );

      const today =
        new Date()
          .toISOString()
          .split("T")[0];

      const staffList =
        await db
          .select()
          .from(staff);

      const leaveList =
        await db
          .select()
          .from(leaveRequests);

      const roster =
        await db
          .select()
          .from(rosterEntries);

      const flightList =
        await db
          .select()
          .from(flights);

      const birdData =
        await db
          .select()
          .from(birdCounts);

      const fodData =
        await db
          .select()
          .from(fodCollections);

      const lightsData =
        await db
          .select()
          .from(rwyLights);

      const rampData =
        await db
          .select()
          .from(rampInspections);

      const myStaff =
        staffList.find(
          s =>
            (
              s.email || ""
            ).toLowerCase()
            ===
            (
              currentUser.email || ""
            ).toLowerCase()
        );

      const dept =
        myStaff?.department || "";

      const nextFlight =
        flightList
          .filter(
            (f: any) => f.date >= today
          )
          .sort(
            (a: any, b: any) =>
              (a.date || "").localeCompare(
                b.date || ""
              )
          )[0] || null;

      const onDutyToday =
        roster.filter(r => {

          if (
            r.date !== today
          ) {
            return false;
          }

          if (
            isManagerRole(
              currentUser.role
            )
          ) {
            return true;
          }

          return (
            r.staffDepartment === dept
          );
        });

      const onLeaveToday =
        leaveList.filter(l => {

          const active =
            l.status === "approved" &&
            (l.startDate || "") <= today &&
            (l.endDate || "") >= today;

          if (
            !active
          ) {
            return false;
          }

          if (
            isManagerRole(
              currentUser.role
            )
          ) {
            return true;
          }

          return (
            l.staffDepartment === dept
          );
        });

      let pendingLeave: any[] = [];
      let pendingOT: any[] = [];

      if (
        myStaff?.isIncharge === true ||
        myStaff?.isSmt === true ||
        isManagerRole(
          currentUser.role
        )
      ) {

        pendingLeave =
          leaveList.filter(
            l =>
              l.status === "pending" &&
              (
                isManagerRole(
                  currentUser.role
                ) ||
                l.staffDepartment === dept
              )
          );

        pendingOT =
          (
            await db
              .select()
              .from(overtimeEntries)
          ).filter(
            o =>
              o.status === "pending" &&
              (
                isManagerRole(
                  currentUser.role
                ) ||
                o.staffDepartment === dept
              )
          );
      }
      else {

        pendingLeave =
          leaveList.filter(
            l =>
              l.requestedBy ===
                currentUser.email &&
              l.status === "pending"
          );

        pendingOT =
          (
            await db
              .select()
              .from(overtimeEntries)
          ).filter(
            o =>
              o.createdBy ===
                currentUser.email &&
              o.status === "pending"
          );
      }

      return json({

        nextFlight,

        operations: {
          birdCountToday:
            birdData.filter(
              b => b.date === today
            ).length,

          fodToday:
            fodData.filter(
              f => f.date === today
            ).length,

          rampReportsToday:
            rampData.filter(
              r => r.date === today
            ).length,

          rwyInspectionsToday:
            lightsData.filter(
              l => l.date === today
            ).length
        },

        onDutyToday,

        onLeaveToday,

        pendingLeave,

        pendingOT
      });
    }

    return json({ message: "Not Found", pathname, method }, 404);
  } catch (err: any) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    const message = status >= 500 ? "Internal server error" : err?.message || "Request failed";
    console.error("API request failed", { pathname, method, status, error: err });
    return json({ message }, status);
  }
};