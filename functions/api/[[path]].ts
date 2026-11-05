import { requireAuth } from "../middleware/auth.js";
import { requireManager, requireSMT } from "../middleware/authorization.js";
import { getAuth } from "../../src/lib/auth.js";
import { getDb } from "../../src/lib/db.js";
import {
  user, session, account, users, staff, holidays, flights, leaveRequests, overtimeEntries,
  rosterEntries, birdCounts, safetyOccurrenceReports, rampInspections, tempAccess, settings,
  userPresets, timesheets, opsGroundHistory, opsRunwayHistory, fodCollections,
  lightsInspectors, rwyLights, savedReports, rampLiveDraft, opsChecks,
  passwordResetRequests, announcements, chatGroups, chatGroupMembers, chatMessages
} from "../../src/db/schema.js";
import { eq, and, inArray, sql, asc, desc, or } from "drizzle-orm";
import {
  requireFlightsEdit,
  requireFlightsView,
  requireRampEdit,
  requireRampView,
  requireBirdEdit,
  requireBirdView,
  requireRWYEdit,
  requireRWYView,
  requireOpsBoardView,
  requireOpsBoardEdit,
  requireRosterEdit,
  requireRosterView,
  requireLeaveEdit,
  requireOvertimeEdit,
  requireLeaveApproval,
  requireOTApproval
} from "../../src/lib/permission-check.js";

let staffPhotoColumnReady = false;

const isManagerRole = (role: string | undefined | null) =>
  ['developer', 'manager', 'admin', 'owner'].includes(role || '');

const normalizeFlightNumber = (value: any) => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
const rampFlightStatus = (draft: any, routeValue?: any) => {
  if (draft?.atd) return 'Departed';
  if (draft?.ata) return 'Landed';
  if (draft?.eta) {
    const route = String(draft.route || routeValue || '');
    const airports = route.split(/[\/>]+/).map(code => code.trim().toUpperCase()).filter(Boolean);
    const fndIndex = airports.indexOf('FND');
    const origin = fndIndex > 0 ? airports[fndIndex - 1] : '';
    return origin ? `Departed from ${origin}` : 'Departed from origin';
  }
  return 'Scheduled';
};

const requireRoleAssignment = (currentRole: string, requestedRole: string | undefined) => {
  if (requestedRole === "developer" && currentRole !== "developer") {
    const err: any = new Error("Only a developer can assign the developer role");
    err.status = 403;
    throw err;
  }
};
const ACCESS_ROLES = ["developer", "manager", "admin", "owner", "smt", "staff"];
const ACCESS_DEPARTMENTS = ["Ground Operations", "Maintenance", "Security", "Fire & Rescue", "Administration", "Safety"];
const validateAccessAssignment = (currentRole: string, requestedRole: string, department: string) => {
  requireRoleAssignment(currentRole, requestedRole);
  if (!ACCESS_ROLES.includes(requestedRole) || !ACCESS_DEPARTMENTS.includes(department)) {
    const err: any = new Error("Invalid role or department"); err.status = 400; throw err;
  }
};

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const db = getDb(env);
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  if (!staffPhotoColumnReady) {
    await db.execute(sql`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "photo_base64" text`);
    staffPhotoColumnReady = true;
  }

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

  const ensureSafetyOccurrenceTable = () => db.execute(sql`
    CREATE TABLE IF NOT EXISTS safety_occurrence_reports (
      id text PRIMARY KEY NOT NULL, report_no text, date text, time text, reporter_name text,
      contact_no text, organization text, email text, category text, occurrence_type text,
      bird_size text, place text, met_conditions text, explanation text, corrective_action text,
      submitted_by text, designation text, photo_base64 text, people_involved text,
      aircraft_info text, created_by text, created_at timestamp DEFAULT now()
    )
  `);
  const ensureAnnouncementsTable = () => db.execute(sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id text PRIMARY KEY NOT NULL, title text NOT NULL, message text NOT NULL,
      audience text NOT NULL, priority text DEFAULT 'normal', status text DEFAULT 'published',
      publish_at timestamp DEFAULT now(), expires_at timestamp, created_by text NOT NULL,
      created_by_name text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
    )
  `);
  const announcementAudiences = ['FND Staffs', 'Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Flight Operations', 'SMT & Management', 'Managers & Admins Only'];
  const canSeeAnnouncement = (announcement: any, currentUser: any, staffProfile: any) => {
    if (isManagerRole(currentUser.role)) return true;
    const audience = String(announcement.audience || '');
    const department = String(staffProfile?.department || currentUser.department || '');
    const isSmt = currentUser.role === 'smt' || staffProfile?.isSmt === true || staffProfile?.isIncharge === true;
    if (audience === 'FND Staffs') return true;
    if (audience === department) return true;
    if (audience === 'SMT & Management') return isSmt;
    if (audience === 'Flight Operations') return department === 'Ground Operations' || isSmt || staffProfile?.specialOpsAccess === true;
    return false;
  };
  const requireChatGroupAccess = async (groupId: string, currentUser: any) => {
    const [group] = await db.select().from(chatGroups).where(eq(chatGroups.id, groupId)).limit(1);
    if (!group) { const err: any = new Error("Channel not found"); err.status = 404; throw err; }
    if (isManagerRole(currentUser.role)) return group;
    const membership = await db.select().from(chatGroupMembers).where(and(
      eq(chatGroupMembers.groupId, groupId), eq(chatGroupMembers.staffId, currentUser.id)
    )).limit(1);
    if (membership.length === 0) {
      const err: any = new Error("You are not a member of this channel"); err.status = 403; throw err;
    }
    return group;
  };
  const getAuthorizedRosterStaff = async (currentUser: any, staffId: string) => {
    const [target] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
    if (!target) { const err: any = new Error("Staff member not found"); err.status = 404; throw err; }
    if (isManagerRole(currentUser.role)) return target;
    const editor = await getCurrentStaffProfile(currentUser);
    const editorDept = String(editor?.department || currentUser.department || "").trim().toLowerCase();
    const targetDept = String(target.department || "").trim().toLowerCase();
    const isDepartmentLead = currentUser.role === "smt" || editor?.isSmt === true || editor?.isIncharge === true;
    if (!isDepartmentLead || (editorDept !== targetDept && !(editorDept === "safety" && targetDept === "security"))) {
      const err: any = new Error("You can only edit your own department roster"); err.status = 403; throw err;
    }
    return target;
  };
  const getCurrentStaffProfile = async (currentUser: any) => {
    const email = String(currentUser.email || "").trim().toLowerCase();
    const snPart = email.split("@")[0].replace(/^sn-/i, "").toUpperCase();
    const [profile] = await db.select().from(staff).where(or(
      sql`lower(${staff.email}) = ${email}`,
      sql`upper(${staff.sn}) = ${snPart}`,
      sql`upper(${staff.sn}) = ${`SN-${snPart}`}`
    )).limit(1);
    return profile || null;
  };
  const getAuthorizedRequestStaff = async (currentUser: any, staffId: string) => {
    const [target] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
    if (!target) { const err: any = new Error("Staff member not found"); err.status = 404; throw err; }
    if (isManagerRole(currentUser.role)) return target;
    const profile = await getCurrentStaffProfile(currentUser);
    if (!profile) { const err: any = new Error("No staff profile found"); err.status = 403; throw err; }
    const isDepartmentLead = currentUser.role === "smt" || profile.isSmt === true || profile.isIncharge === true;
    const sameDepartment = String(profile.department || "").trim().toLowerCase() === String(target.department || "").trim().toLowerCase();
    if (profile.id !== target.id && !(isDepartmentLead && sameDepartment)) {
      const err: any = new Error("You can only submit for yourself or an authorized department member"); err.status = 403; throw err;
    }
    return target;
  };
  const rosterLeaveStatuses = new Set(["ANNUAL LEAVE", "SICK LEAVE", "SICK LEAVE / MC", "NO PAY LEAVE", "DUTY TRAVEL", "PATERNITY LEAVE", "MATERNITY LEAVE", "PRE-MATERNITY LEAVE", "FAMILY RESPONSIBILITY LEAVE (FRL)"]);
  const ensureRosterLeaveHistory = async (currentUser: any, targetStaff: any, leaveType: string, date: string) => {
    if (!rosterLeaveStatuses.has(leaveType)) return null;
    const existing = await db.select().from(leaveRequests).where(and(
      eq(leaveRequests.staffId, targetStaff.id), eq(leaveRequests.startDate, date),
      eq(leaveRequests.endDate, date), eq(leaveRequests.leaveType, leaveType)
    )).limit(1);
    const now = new Date().toISOString();
    if (existing[0]) {
      if (existing[0].status !== "approved") await db.update(leaveRequests).set({
        status: "approved", reason: existing[0].reason || "Entered from Duty Roster",
        reviewedBy: currentUser.email, reviewedAt: now,
      }).where(eq(leaveRequests.id, existing[0].id));
      return existing[0].id;
    }
    const id = crypto.randomUUID();
    await db.insert(leaveRequests).values({
      id, staffId: targetStaff.id, staffName: targetStaff.name || "", staffDepartment: targetStaff.department || "",
      staffSn: targetStaff.sn || "", staffGender: targetStaff.gender || "", leaveType,
      startDate: date, endDate: date, days: 1, reason: "Entered from Duty Roster",
      status: "approved", requestedBy: currentUser.email, requestedAt: now, reviewedBy: currentUser.email, reviewedAt: now,
    });
    return id;
  };  const scopeRequestsForUser = async (currentUser: any, rows: any[], smtCanViewAll: boolean) => {
    if (isManagerRole(currentUser.role)) return rows;
    const profile = await getCurrentStaffProfile(currentUser);
    if (!profile) return [];
    const isSmtViewer = currentUser.role === "smt" || profile.isSmt === true || profile.isIncharge === true;
    if (isSmtViewer && smtCanViewAll) return rows;
    if (isSmtViewer) {
      const department = String(profile.department || "").trim().toLowerCase();
      return rows.filter((row: any) => String(row.staffDepartment || "").trim().toLowerCase() === department);
    }
    return rows.filter((row: any) => String(row.staffId || "") === String(profile.id));
  };
  if (method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const isPublicRequest =
      pathname === "/api/request-password-reset" && method === "POST";

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
      let allGroups = await db.select().from(chatGroups);
      if (allGroups.length === 0) {
        const createdAt = new Date().toISOString();
        const coreChannels = [
          { id: crypto.randomUUID(), name: "FND Staffs", description: "Airport-wide staff conversation", department: null, createdBy: "system", createdAt },
          { id: crypto.randomUUID(), name: "Ground Operations", description: "Ground Operations department", department: "Ground Operations", createdBy: "system", createdAt },
          { id: crypto.randomUUID(), name: "Maintenance", description: "Maintenance department", department: "Maintenance", createdBy: "system", createdAt },
          { id: crypto.randomUUID(), name: "Security", description: "Security department", department: "Security", createdBy: "system", createdAt },
          { id: crypto.randomUUID(), name: "Fire & Rescue", description: "Fire & Rescue department", department: "Fire & Rescue", createdBy: "system", createdAt },
          { id: crypto.randomUUID(), name: "SMT & Management", description: "SMT and management coordination", department: "__smt__", createdBy: "system", createdAt },
          { id: crypto.randomUUID(), name: "Flight Operations", description: "Flight operations coordination", department: "__flight_ops__", createdBy: "system", createdAt },
        ];
        await db.insert(chatGroups).values(coreChannels).onConflictDoNothing();
        allGroups = await db.select().from(chatGroups);
      }
      const staffRows = await db.select().from(staff);
      const userRows = await db.select().from(users);
      const roleByEmail = new Map(userRows.map((account: any) => [String(account.email || "").toLowerCase(), String(account.role || "staff").toLowerCase()]));
      for (const group of allGroups.filter((item: any) => item.createdBy === "system")) {
        const existingMembers = await db.select().from(chatGroupMembers).where(eq(chatGroupMembers.groupId, group.id)).limit(1);
        if (existingMembers.length > 0) continue;
        const recommended = staffRows.filter((member: any) => {
          const memberRole = roleByEmail.get(String(member.email || "").toLowerCase()) || (member.isSmt ? "smt" : "staff");
          const management = ["developer", "admin", "manager", "owner"].includes(memberRole);
          if (group.name === "FND Staffs") return true;
          if (group.name === "SMT & Management") return management || memberRole === "smt" || member.isSmt === true || member.isIncharge === true;
          if (group.name === "Flight Operations") return management || memberRole === "smt" || member.isSmt === true || member.isIncharge === true || member.department === "Ground Operations";
          return group.department === member.department;
        });
        if (recommended.length > 0) await db.insert(chatGroupMembers).values(recommended.map((member: any) => ({
          id: crypto.randomUUID(), groupId: group.id, staffId: member.id, role: 'member', createdAt: new Date().toISOString()
        }))).onConflictDoNothing();
      }
      const myMemberships = await db.select().from(chatGroupMembers).where(eq(chatGroupMembers.staffId, currentUser.id));
      const myGroupIds = myMemberships.map((membership: any) => membership.groupId);
      const isDevOrManager = ['developer', 'manager', 'admin', 'owner'].includes(currentUser.role);
      return json(allGroups.filter((group: any) => isDevOrManager || myGroupIds.includes(group.id)));
    }

    if (pathname === "/api/chat/groups" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const allowedDepartments = ["Ground Operations", "Maintenance", "Security", "Fire & Rescue"];
      const department = allowedDepartments.includes(body.department) ? body.department : null;
      if (name.length < 2 || name.length > 60) return json({ message: "Channel name must contain 2 to 60 characters" }, 400);
      if (description.length > 180) return json({ message: "Description must be 180 characters or fewer" }, 400);
      const duplicate = await db.select().from(chatGroups).where(eq(chatGroups.name, name)).limit(1);
      if (duplicate.length) return json({ message: "A channel with this name already exists" }, 409);
      const id = crypto.randomUUID();

      await db.insert(chatGroups).values({
        id, name, description, department,
        createdBy: currentUser.email, createdAt: new Date().toISOString(),
      });

      await db.insert(chatGroupMembers).values({
        id: crypto.randomUUID(), groupId: id, staffId: currentUser.id, role: 'admin', createdAt: new Date().toISOString()
      });

      return json({ success: true, id });
    }

    if (pathname.startsWith("/api/chat/groups/") && pathname.endsWith("/members") && method === "GET") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const groupId = pathname.split("/")[4];
      const groupRows = await db.select().from(chatGroups).where(eq(chatGroups.id, groupId)).limit(1);
      if (!groupRows[0]) return json({ message: "Channel not found" }, 404);
      const memberRows = await db.select().from(chatGroupMembers).where(eq(chatGroupMembers.groupId, groupId));
      const memberIds = new Set(memberRows.map((membership: any) => String(membership.staffId)));
      const staffRows = await db.select().from(staff);
      const userRows = await db.select().from(users);
      const roleByEmail = new Map(userRows.map((account: any) => [String(account.email || "").toLowerCase(), String(account.role || "staff").toLowerCase()]));
      const visibleStaff = staffRows.filter((member: any) => currentUser.role === "developer" || roleByEmail.get(String(member.email || "").toLowerCase()) !== "developer");
      return json(visibleStaff.map((member: any) => ({
        staffId: member.id, name: member.name, sn: member.sn, department: member.department,
        role: roleByEmail.get(String(member.email || "").toLowerCase()) || (member.isSmt ? "smt" : "staff"),
        isMember: memberIds.has(String(member.id)),
      })).sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""))));
    }

    if (pathname.startsWith("/api/chat/groups/") && pathname.includes("/members/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const parts = pathname.split("/");
      const groupId = parts[4];
      const staffId = parts[6];
      await db.delete(chatGroupMembers).where(and(eq(chatGroupMembers.groupId, groupId), eq(chatGroupMembers.staffId, staffId)));
      return json({ success: true });
    }
    if (pathname.startsWith("/api/chat/groups/") && pathname.endsWith("/messages") && method === "GET") {
      const groupId = pathname.split("/")[4];
      const currentUser = await requireAuth(request, env);
      await requireChatGroupAccess(groupId, currentUser);
      const messages = await db.select().from(chatMessages)
        .where(eq(chatMessages.groupId, groupId))
        .orderBy(desc(chatMessages.createdAt)).limit(300);
      return json(messages.reverse());
    }

    if (pathname.startsWith("/api/chat/groups/") && pathname.endsWith("/messages") && method === "POST") {
      const currentUser = await requireAuth(request, env);
      const groupId = pathname.split("/")[4];
      await requireChatGroupAccess(groupId, currentUser);
      const body: any = await request.json();
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
      if (!message && !imageUrl) return json({ message: "A message or image is required" }, 400);
      if (message.length > 2000) return json({ message: "Message must be 2,000 characters or fewer" }, 400);
      if (imageUrl && (!imageUrl.startsWith("data:image/") || imageUrl.length > 2_900_000)) {
        return json({ message: "Attachment must be an image no larger than 2 MB" }, 400);
      }
      await db.insert(chatMessages).values({
        id: crypto.randomUUID(), groupId, senderId: currentUser.id, senderName: currentUser.name,
        message, imageUrl: imageUrl || null, createdAt: new Date().toISOString(),
      });
      return json({ success: true }, 201);
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

      if (isGroupAdmin.length === 0 && !['developer', 'manager', 'admin', 'owner'].includes(currentUser.role)) {
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

      const existingRequest = await db.select().from(passwordResetRequests).where(and(eq(passwordResetRequests.email, body.email.toLowerCase()), eq(passwordResetRequests.status, "pending"))).limit(1);
      if (existingRequest.length > 0) return json({ success: true, message: "A forgot-password request is already pending." });

      const id = crypto.randomUUID();
      await db.insert(passwordResetRequests).values({
        id, email: body.email.toLowerCase(), status: "pending", requestedAt: new Date().toISOString(),
      });

      return json({ success: true, message: "Request sent to Admin." });
    }

    if (pathname === "/api/password-reset-requests" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      requireSMT(currentUser.role);
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

        const temporaryPassword = `Fnd!${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
        await getAuth(env).api.signUpEmail({
          body: { email: reqData.email, password: temporaryPassword, name: targetUser[0].name || "Staff Member" }
        });

        await db.update(passwordResetRequests).set({ status: "resolved" }).where(eq(passwordResetRequests.id, id));
        return json({ success: true, message: "Password reset completed", temporaryPassword, userName: reqData.email, loginUrl: env?.BETTER_AUTH_URL || "https://management.funadhooairport.com" });
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
      const currentUser = await requireAuth(request, env);
      const results = await db.select().from(staff).orderBy(asc(staff.orderIndex));
      const canViewPrivateStaffData = ["developer", "manager", "admin", "owner"].includes(currentUser.role);
      const canViewInternalNotes = currentUser.role === "developer";
      const requesterEmail = String(currentUser.email || "").toLowerCase();
      const developerEmails = currentUser.role === "developer"
        ? new Set<string>()
        : new Set((await db.select({ email: users.email }).from(users).where(eq(users.role, "developer"))).map((entry: any) => String(entry.email || "").toLowerCase()));
      const visibleResults = currentUser.role === "developer"
        ? results
        : results.filter((record: any) => !developerEmails.has(String(record.email || "").toLowerCase()));

      return json(visibleResults.map((record: any) => {
        const isOwnRecord = String(record.email || "").toLowerCase() === requesterEmail;
        if (canViewPrivateStaffData || isOwnRecord) {
          return canViewInternalNotes ? record : { ...record, notes: "" };
        }
        return {
          ...record,
          personalEmail: "",
          nid: "",
          phone: "",
          notes: "",
          basicSalary: 0,
          dailyAllowance: 0,
          holidayAllowanceRate: 0,
          bankAccount: "",
        };
      }));
    }

    if (pathname === "/api/staff" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      if (body.photoBase64 && (!String(body.photoBase64).startsWith('data:image/') || String(body.photoBase64).length > 900_000)) return json({ message: 'Profile photo must be an image smaller than 650 KB' }, 400);

      await db.insert(staff).values({
        id,
        sn: body.sn || "",
        name: body.name,
        email: body.email,
        photoBase64: body.photoBase64 || "",
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
      const [targetStaff] = await db.select().from(staff).where(eq(staff.id, id!)).limit(1);
      if (!targetStaff) return json({ message: "Staff member not found" }, 404);
      const [targetUser] = targetStaff.email ? await db.select().from(users).where(eq(users.email, targetStaff.email.toLowerCase())).limit(1) : [];
      if (targetUser?.role === "developer" && currentUser.role !== "developer") return json({ message: "Developer records can only be modified by the Developer" }, 403);
      const targetIsSMT = targetStaff.isSmt === true || targetUser?.role === "smt" || body.isSMT === true;
      if (body.isIncharge === true && !targetIsSMT) return json({ message: "Only SMT members can be department in-charge" }, 400);
      if (body.specialOpsAccess === true && !["Ground Operations", "Maintenance", "Fire & Rescue"].includes(targetStaff.department || "")) {
        return json({ message: "Special Ops Access is limited to eligible operational departments" }, 400);
      }
      if (body.photoBase64 && (!String(body.photoBase64).startsWith('data:image/') || String(body.photoBase64).length > 900_000)) return json({ message: 'Profile photo must be an image smaller than 650 KB' }, 400);
      const updatedAt = new Date().toISOString();

      const updateData: any = { updatedAt };
      const allowedFields = [
        'sn', 'name', 'email', 'photoBase64', 'personalEmail', 'nid', 'joinDate', 'phone', 'gender',
        'department', 'position', 'isSMT', 'isIncharge', 'balanceVisible', 'specialOpsAccess', 'tempDeptAccess',
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
      const [targetStaff] = await db.select().from(staff).where(eq(staff.id, id!)).limit(1);
      if (!targetStaff) return json({ message: "Staff member not found" }, 404);
      const [targetUser] = targetStaff.email ? await db.select().from(users).where(eq(users.email, targetStaff.email.toLowerCase())).limit(1) : [];
      if (targetUser?.role === "developer" && currentUser.role !== "developer") return json({ message: "Developer records can only be removed by the Developer" }, 403);
      await db.delete(staff).where(eq(staff.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // CHECKLIST MODULE
    // ==========================================
    if (pathname === "/api/checklist" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardView(env, currentUser);
      const results = await db.select().from(opsChecks).orderBy(desc(opsChecks.date), asc(opsChecks.time));
      return json(results);
    }
    if (pathname === "/api/checklist" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardEdit(env, currentUser);
      const body: any = await request.json();
      const allowedCategories = ["Runway Check", "FOD Collection", "RWY Lights Inspection", "Flight Ops Task"];
      const allowedStatuses = ["Completed - OK", "Completed - Action Needed", "Pending"];
      if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !body.time || !/^\d{2}:\d{2}$/.test(body.time)) {
        return json({ message: "A valid date and time are required" }, 400);
      }
      if (!allowedCategories.includes(body.category) || !allowedStatuses.includes(body.status) || !body.remarks?.trim()) {
        return json({ message: "Complete all required check fields" }, 400);
      }
      const id = crypto.randomUUID();
      await db.insert(opsChecks).values({
        id, date: body.date, time: body.time, category: body.category,
        status: body.status, remarks: body.remarks.trim(), checkedBy: currentUser.email,
        createdAt: new Date().toISOString(),
      });
      return json({ success: true, id }, 201);
    }    if (pathname.startsWith("/api/checklist/") && method === "DELETE") {

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
    if (pathname === "/api/holidays/import" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json().catch(() => ({}));
      const year = Number(body.year || new Date().getUTCFullYear());
      if (!Number.isInteger(year) || year < 2020 || year > 2100) return json({ message: "A valid import year is required" }, 400);
      const sourceUrl = "https://calendar.google.com/calendar/ical/en.mv%23holiday%40group.v.calendar.google.com/public/basic.ics";
      let calendarText = "";
      try {
        const response = await fetch(sourceUrl, { headers: { "User-Agent": "FND-Management-System/1.0" }, signal: AbortSignal.timeout(12000) });
        if (!response.ok) return json({ message: "The online Maldives holiday calendar is temporarily unavailable. Existing saved holidays were not changed." }, 502);
        calendarText = await response.text();
      } catch {
        return json({ message: "The online Maldives holiday calendar could not be reached. Existing saved holidays were not changed." }, 502);
      }
      const unfolded = calendarText.replace(/\r?\n[ \t]/g, "");
      const importedCandidates = unfolded.split("BEGIN:VEVENT").slice(1).map(event => {
        const dateMatch = event.match(/DTSTART(?:;VALUE=DATE)?[^:]*:(\d{4})(\d{2})(\d{2})/);
        const summaryMatch = event.match(/SUMMARY(?:;[^:]*)?:(.*)/);
        if (!dateMatch || !summaryMatch) return null;
        const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        const name = summaryMatch[1].trim().replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
        return date.startsWith(`${year}-`) && name ? { date, name: name.slice(0, 100) } : null;
      }).filter(Boolean) as Array<{ date: string; name: string }>;
      const uniqueCandidates = Array.from(new Map(importedCandidates.map(item => [item.date, item])).values());
      if (uniqueCandidates.length === 0) return json({ message: `No online Maldives holidays were found for ${year}. Existing saved holidays were not changed.` }, 404);
      const saved = await db.select().from(holidays);
      const savedDates = new Set(saved.map(item => item.date));
      const additions = uniqueCandidates.filter(item => !savedDates.has(item.date));
      if (additions.length > 0) await db.insert(holidays).values(additions.map(item => ({ id: crypto.randomUUID(), date: item.date, name: item.name, createdAt: new Date().toISOString() })));
      return json({ success: true, imported: additions.length, skipped: uniqueCandidates.length - additions.length, totalOnline: uniqueCandidates.length, year, source: "Google Maldives public holiday calendar" });
    }

    if (pathname === "/api/holidays" && method === "GET") {
      const results = await db.select().from(holidays).orderBy(asc(holidays.date));
      return json(results);
    }
    if (pathname === "/api/holidays" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      const date = typeof body.date === "string" ? body.date.trim() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        return json({ message: "A valid holiday date is required" }, 400);
      }
      if (name.length < 2 || name.length > 100) {
        return json({ message: "Holiday name must be between 2 and 100 characters" }, 400);
      }
      const existing = await db.select().from(holidays).where(eq(holidays.date, date)).limit(1);
      if (existing.length > 0) return json({ message: "A holiday already exists on this date" }, 409);
      const id = crypto.randomUUID();
      await db.insert(holidays).values({ id, date, name, createdAt: new Date().toISOString() });
      return json({ success: true, id }, 201);
    }
    if (pathname.startsWith("/api/holidays/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      const body: any = await request.json();
      const date = typeof body.date === "string" ? body.date.trim() : "";
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return json({ message: "A valid holiday date is required" }, 400);
      if (name.length < 2 || name.length > 100) return json({ message: "Holiday name must be between 2 and 100 characters" }, 400);
      const record = await db.select().from(holidays).where(eq(holidays.id, id!)).limit(1);
      if (record.length === 0) return json({ message: "Holiday not found" }, 404);
      const duplicate = await db.select().from(holidays).where(eq(holidays.date, date));
      if (duplicate.some(item => item.id !== id)) return json({ message: "A holiday already exists on this date" }, 409);
      await db.update(holidays).set({ date, name }).where(eq(holidays.id, id!));
      return json({ success: true });
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
      const currentUser = await requireAuth(request, env);
      const results = await db.select().from(leaveRequests).orderBy(asc(leaveRequests.startDate));
      return json(await scopeRequestsForUser(currentUser, results, true));
    }
    if (pathname === "/api/leave-requests" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      const body: any = await request.json();
      const targetStaff = await getAuthorizedRequestStaff(currentUser, String(body.staffId || ""));
      const id = crypto.randomUUID();
      const existingLeave = await db.select().from(leaveRequests).where(and(
        eq(leaveRequests.staffId, body.staffId),
        eq(leaveRequests.startDate, body.startDate),
        eq(leaveRequests.endDate, body.endDate)
      )).limit(1);

      if (existingLeave.length > 0) return json({ message: "A leave request for these exact dates already exists." }, 400);

      try {
        await db.insert(leaveRequests).values({
          id, staffId: targetStaff.id, staffName: targetStaff.name || "", staffDepartment: targetStaff.department || "",
          staffSn: targetStaff.sn || "", staffGender: targetStaff.gender || "", leaveType: body.leaveType,
          startDate: body.startDate, endDate: body.endDate, days: body.days, reason: body.reason || "",
          status: "pending", requestedBy: currentUser.email, requestedAt: new Date().toISOString(),
        });
        return json({ success: true, id });
      } catch { return json({ message: "Failed to create leave request." }, 400); }
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

      if (!targetStaff?.email) return json({ message: "Linked staff profile not found" }, 409);
      if (targetStaff.email.toLowerCase() === currentUser.email.toLowerCase()) return json({ message: "You cannot review your own leave request" }, 403);
      await requireLeaveApproval(env, currentUser.email, targetStaff.email);

      await request.json();
      const reviewedAt = new Date().toISOString();

      const [reqData] = await db.update(leaveRequests).set({
        status: "approved", reviewedBy: currentUser.email, reviewedAt
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

      if (!targetStaff?.email) return json({ message: "Linked staff profile not found" }, 409);
      if (targetStaff.email.toLowerCase() === currentUser.email.toLowerCase()) return json({ message: "You cannot review your own leave request" }, 403);
      await requireLeaveApproval(env, currentUser.email, targetStaff.email);

      const body: any = await request.json();
      await db.update(leaveRequests).set({
        status: "rejected", reviewedBy: currentUser.email, reviewedAt: new Date().toISOString(),
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
      const currentUser = await requireAuth(request, env);
      await requireRosterView(env, currentUser);
      const results = await db.select().from(rosterEntries).orderBy(asc(rosterEntries.date), asc(rosterEntries.staffName));
      return json(results);
    }

    if (pathname === "/api/roster" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireRosterEdit(env, currentUser);
      const body: any = await request.json();
      const allowedStatuses = ["scheduled", "clear", "OFF DAY", "ABSENT", "ANNUAL LEAVE", "SICK LEAVE", "SICK LEAVE / MC", "NO PAY LEAVE", "DUTY TRAVEL", "PATERNITY LEAVE", "MATERNITY LEAVE", "PRE-MATERNITY LEAVE", "FAMILY RESPONSIBILITY LEAVE (FRL)"];
      if (!body.staffId || !/^\d{4}-\d{2}-\d{2}$/.test(body.date || "") || !allowedStatuses.includes(body.status)) {
        return json({ message: "Valid staff, date and roster status are required" }, 400);
      }
      if (body.status === "scheduled" && (!body.shiftTime || String(body.shiftTime).length > 40)) {
        return json({ message: "A valid shift time is required" }, 400);
      }
      const targetStaff = await getAuthorizedRosterStaff(currentUser, body.staffId);
      const existing = await db.select().from(rosterEntries).where(and(
        eq(rosterEntries.staffId, body.staffId), eq(rosterEntries.date, body.date)
      )).limit(1);
      if (existing.length > 0 && existing[0].leaveRequestId) return json({ message: "Cannot overwrite approved leave." }, 400);
      const id = existing.length > 0 ? existing[0].id : crypto.randomUUID();
      const rosterLeaveRequestId = await ensureRosterLeaveHistory(currentUser, targetStaff, body.status, body.date);
      if (existing.length > 0) await db.delete(rosterEntries).where(eq(rosterEntries.id, id));
      if (body.status !== "clear") {
        await db.insert(rosterEntries).values({
          id, staffId: targetStaff.id, staffName: targetStaff.name || "", staffDepartment: targetStaff.department || "",
          date: body.date, shiftTime: body.status === "scheduled" ? body.shiftTime : "", status: body.status,
          leaveRequestId: rosterLeaveRequestId, createdAt: new Date().toISOString(),
        });
      }
      return json({ success: true, id });
    }

    if (pathname === "/api/roster/bulk" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireRosterEdit(env, currentUser);
      const body: any = await request.json();
      if (!Array.isArray(body.entries) || body.entries.length === 0 || body.entries.length > 500) {
        return json({ message: "Bulk assignments must contain between 1 and 500 entries" }, 400);
      }
      const allowedStatuses = ["scheduled", "OFF DAY", "ABSENT", "ANNUAL LEAVE", "SICK LEAVE", "SICK LEAVE / MC", "NO PAY LEAVE", "DUTY TRAVEL", "PATERNITY LEAVE", "MATERNITY LEAVE", "PRE-MATERNITY LEAVE", "FAMILY RESPONSIBILITY LEAVE (FRL)"];
      const validated: any[] = [];
      const staffCache = new Map<string, any>();
      for (const entry of body.entries) {
        if (!entry.staffId || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date || "") || !allowedStatuses.includes(entry.status)) {
          return json({ message: "Bulk assignment contains an invalid entry" }, 400);
        }
        if (entry.status === "scheduled" && (!entry.shiftTime || String(entry.shiftTime).length > 40)) {
          return json({ message: "Every scheduled entry requires a valid shift" }, 400);
        }
        let targetStaff = staffCache.get(entry.staffId);
        if (!targetStaff) { targetStaff = await getAuthorizedRosterStaff(currentUser, entry.staffId); staffCache.set(entry.staffId, targetStaff); }
        const existing = await db.select().from(rosterEntries).where(and(
          eq(rosterEntries.staffId, entry.staffId), eq(rosterEntries.date, entry.date)
        )).limit(1);
        if (existing[0]?.leaveRequestId) return json({ message: `Approved leave protects ${targetStaff.name} on ${entry.date}` }, 400);
        validated.push({ entry, targetStaff, existing: existing[0] });
      }
      for (const item of validated) {
        if (item.existing) await db.delete(rosterEntries).where(eq(rosterEntries.id, item.existing.id));
        const rosterLeaveRequestId = await ensureRosterLeaveHistory(currentUser, item.targetStaff, item.entry.status, item.entry.date);
        await db.insert(rosterEntries).values({
          id: item.existing?.id || crypto.randomUUID(), staffId: item.targetStaff.id,
          staffName: item.targetStaff.name || "", staffDepartment: item.targetStaff.department || "",
          date: item.entry.date, shiftTime: item.entry.status === "scheduled" ? item.entry.shiftTime : "",
          status: item.entry.status, leaveRequestId: rosterLeaveRequestId, createdAt: new Date().toISOString(),
        });
      }
      return json({ success: true, count: validated.length });
    }
    // ==========================================
    // FLIGHTS MODULE
    // ==========================================
    if (pathname === "/api/flights" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireFlightsView(env, currentUser);
      const results = await db.select().from(flights).orderBy(asc(flights.date), asc(flights.departureTime));
      return json(results.map((flight: any) => {
        let passengerCounts = { adults: 0, infants: 0 };
        try {
          const stored = JSON.parse(flight.bookedFigure || "{}");
          passengerCounts = typeof stored === "object" && stored !== null
            ? { adults: Number(stored.adults) || 0, infants: Number(stored.infants) || 0 }
            : { adults: Number(stored) || 0, infants: 0 };
        } catch {
          passengerCounts = { adults: Number(flight.bookedFigure) || 0, infants: 0 };
        }
        return { ...flight, paxAdults: passengerCounts.adults, paxInfants: passengerCounts.infants };
      }));
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
        bookedFigure: JSON.stringify({ adults: Number(body.paxAdults) || 0, infants: Number(body.paxInfants) || 0 }), checkInTime: body.checkInTime || "", arrivalTime: body.arrivalTime || "",
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
        bookedFigure: JSON.stringify({ adults: Number(body.paxAdults) || 0, infants: Number(body.paxInfants) || 0 }), checkInTime: body.checkInTime || "", arrivalTime: body.arrivalTime || "",
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
      return json(currentUser.role === "developer" ? results : results.filter((record: any) => record.role !== "developer"));
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
      validateAccessAssignment(currentUser.role, body.role, body.department);

      try {
        // Protect developer accounts
        const existingRows = await db.select().from(users).where(eq(users.id, id!)).limit(1);
        const existingUser = existingRows[0];
        if (!existingUser) return json({ message: "User not found" }, 404);
        if (id === currentUser.id && body.role !== existingUser.role) return json({ message: "You cannot change your own role" }, 400);

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
      if (id === currentUser.id) return json({ message: "You cannot remove your own account" }, 400);
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
      const { role, department, name, position, password } = body;
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      validateAccessAssignment(currentUser.role, role, department);

      if (!/^\S+@\S+\.\S+$/.test(email) || typeof password !== "string" || password.length < 6 || password.length > 10) return json({ message: "A valid email and password of 6 to 10 characters are required" }, 400);
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
      return json(currentUser.role === "developer" ? results : results.filter((record: any) => record.role !== "developer"));
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
      const currentUser = await requireAuth(request, env);
      const results = await db.select().from(overtimeEntries).orderBy(asc(overtimeEntries.date));
      return json(await scopeRequestsForUser(currentUser, results, false));
    }
    if (pathname === "/api/overtime" && method === "POST") {

      const currentUser = await requireAuth(
        request,
        env
      );

      const body: any = await request.json();
      const targetStaff = await getAuthorizedRequestStaff(currentUser, String(body.staffId || ""));
      const id = crypto.randomUUID();
      const existingOvertime = await db.select().from(overtimeEntries).where(and(
        eq(overtimeEntries.staffId, body.staffId),
        eq(overtimeEntries.date, body.date),
        eq(overtimeEntries.startTime, body.startTime)
      )).limit(1);
      if (existingOvertime.length > 0) return json({ message: "Overtime logged for this exact time already." }, 400);

      try {
        await db.insert(overtimeEntries).values({
          id, staffId: targetStaff.id, staffName: targetStaff.name || "", staffSn: targetStaff.sn || "",
          staffDepartment: targetStaff.department || "", date: body.date, startTime: body.startTime,
          endTime: body.endTime, hours: body.hours, notes: body.notes || "",
          status: "pending", createdBy: currentUser.email, createdAt: new Date().toISOString(),
        });
        return json({ success: true, id });
      } catch { return json({ message: "Failed to create overtime." }, 400); }
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

      if (!targetStaff?.email) return json({ message: "Linked staff profile not found" }, 409);
      if (targetStaff.email.toLowerCase() === currentUser.email.toLowerCase()) return json({ message: "You cannot review your own overtime request" }, 403);
      await requireOTApproval(env, currentUser.email, targetStaff.email);

      await request.json();
      await db.update(overtimeEntries).set({
        status: "approved", reviewedBy: currentUser.email, reviewedAt: new Date().toISOString()
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

      if (!targetStaff?.email) return json({ message: "Linked staff profile not found" }, 409);
      if (targetStaff.email.toLowerCase() === currentUser.email.toLowerCase()) return json({ message: "You cannot review your own overtime request" }, 403);
      await requireOTApproval(env, currentUser.email, targetStaff.email);

      await request.json();
      await db.update(overtimeEntries).set({
        status: "rejected", reviewedBy: currentUser.email, reviewedAt: new Date().toISOString()
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
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardView(env, currentUser);
      const results = await db.select().from(fodCollections).orderBy(desc(fodCollections.date));
      return json(results);
    }
    if (pathname === "/api/fod" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardEdit(env, currentUser);
      const body: any = await request.json();
      const date = String(body.date || "").trim();
      const grams = Number(body.grams);
      const remarks = String(body.remarks || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(grams) || grams <= 0 || grams > 100000 || !remarks || remarks.length > 300) {
        return json({ message: "Enter a valid date, weight and collection details" }, 400);
      }
      const id = crypto.randomUUID();
      await db.insert(fodCollections).values({
        id, date, grams, remarks,
        loggedBy: currentUser.email, createdAt: new Date().toISOString(),
      });
      return json({ success: true, id });
    }
    if (pathname.startsWith("/api/fod/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardEdit(env, currentUser);
      const id = pathname.split("/").pop();
      await db.delete(fodCollections).where(eq(fodCollections.id, id!));
      return json({ success: true });
    }

    // ==========================================
    // SAFETY OCCURRENCE REPORTS
    // ==========================================
    if (pathname === "/api/birdstrikes" && method === "GET") {
      await ensureSafetyOccurrenceTable();
      const currentUser = await requireAuth(request, env);
      await requireBirdView(env, currentUser);
      const results = await db.select().from(safetyOccurrenceReports)
        .orderBy(desc(safetyOccurrenceReports.date), desc(safetyOccurrenceReports.createdAt));
      return json(results.map((row: any) => ({
        ...row,
        peopleInvolved: row.peopleInvolved ? JSON.parse(row.peopleInvolved) : [],
        aircraftInfo: row.aircraftInfo ? JSON.parse(row.aircraftInfo) : {},
      })));
    }
    if (pathname === "/api/birdstrikes" && method === "POST") {
      await ensureSafetyOccurrenceTable();
      const currentUser = await requireAuth(request, env);
      await requireBirdEdit(env, currentUser);
      const body: any = await request.json();
      if (!body.reporterName?.trim() || !body.date || !body.time || !body.category || !body.occurrenceType || !body.place || !body.explanation?.trim()) {
        return json({ message: "Complete all required occurrence fields" }, 400);
      }
      if (body.photoBase64 && (!body.photoBase64.startsWith("data:image/") || body.photoBase64.length > 2_900_000)) {
        return json({ message: "Attachment must be an image no larger than 2 MB" }, 400);
      }
      const id = crypto.randomUUID();
      await db.insert(safetyOccurrenceReports).values({
        id, reportNo: body.reportNo?.trim() || `SOR-${body.date.replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`,
        date: body.date, time: body.time, reporterName: body.reporterName.trim(), contactNo: body.contactNo?.trim() || "",
        organization: body.organization?.trim() || "", email: body.email?.trim() || "", category: body.category,
        occurrenceType: body.occurrenceType, birdSize: body.occurrenceType.includes("Strike") ? body.birdSize : "",
        place: body.place, metConditions: body.metConditions?.trim() || "", explanation: body.explanation.trim(),
        correctiveAction: body.correctiveAction?.trim() || "", submittedBy: body.submittedBy?.trim() || currentUser.name || "",
        designation: body.designation?.trim() || "", photoBase64: body.photoBase64 || "",
        peopleInvolved: JSON.stringify(Array.isArray(body.peopleInvolved) ? body.peopleInvolved : []),
        aircraftInfo: JSON.stringify(body.aircraftInfo || {}), createdBy: currentUser.email, createdAt: new Date().toISOString(),
      });
      return json({ success: true, id }, 201);
    }
    if (pathname.startsWith("/api/birdstrikes/") && method === "DELETE") {
      await ensureSafetyOccurrenceTable();
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const id = pathname.split("/").pop();
      await db.delete(safetyOccurrenceReports).where(eq(safetyOccurrenceReports.id, id!));
      return json({ success: true });
    }
    // ==========================================
    // WILDLIFE
    // ==========================================
    if (pathname === "/api/wildlife" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireBirdView(env, currentUser);
      const results = await db.select().from(birdCounts).orderBy(desc(birdCounts.date));
      return json(results.map((row: any) => {
        const stored = typeof row.rows === "string" ? JSON.parse(row.rows) : row.rows;
        if (Array.isArray(stored)) return { ...row, rows: stored };
        return { ...row, ...(stored || {}), rows: stored?.rows || [] };
      }));
    }
    if (pathname === "/api/wildlife" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireBirdEdit(env, currentUser);
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await db.insert(birdCounts).values({
        id, date: body.date, refNo: body.refNo, observer: body.observer || "",
        rows: JSON.stringify({
          rows: body.rows || [], wind: body.wind || "", temp: body.temp || "", cloud: body.cloud || "",
          rain: body.rain || "N", startTime: body.startTime || "", endTime: body.endTime || ""
        }), createdAt: new Date().toISOString()
      });
      return json({ success: true, id });
    }
    if (url.pathname.startsWith("/api/wildlife/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      await requireBirdEdit(env, currentUser);
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      await db.update(birdCounts).set({
        date: body.date, refNo: body.refNo, observer: body.observer || "",
        rows: JSON.stringify({
          rows: body.rows || [], wind: body.wind || "", temp: body.temp || "", cloud: body.cloud || "",
          rain: body.rain || "N", startTime: body.startTime || "", endTime: body.endTime || ""
        })
      }).where(eq(birdCounts.id, id!));
      return json({ success: true });
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
      const currentUser = await requireAuth(request, env);
      await requireRampView(env, currentUser);
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
      if (body.fltNo && body.date) {
        const normalizedFlightNo = normalizeFlightNumber(body.fltNo);
        const scheduledFlights = await db.select({ id: flights.id, flightNo: flights.flightNo, route: flights.route })
          .from(flights).where(eq(flights.date, String(body.date).trim()));
        const matchedFlight = scheduledFlights.find(flight =>
          normalizeFlightNumber(flight.flightNo) === normalizedFlightNo
        );
        if (matchedFlight) {
          const liveStatus = rampFlightStatus(body, matchedFlight.route);
          await db.update(flights).set({
            status: liveStatus, eta: body.eta || null, ata: body.ata || null, atd: body.atd || null,
            updatedAt: new Date().toISOString()
          }).where(eq(flights.id, matchedFlight.id));
        }
      }
      return json({ success: true });
    }
    if (pathname === "/api/ramp/reports" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireRampView(env, currentUser);
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
      const body: any = await request.json();      body.date = typeof body.date === "string" ? body.date.trim() : "";
      body.fltNo = typeof body.fltNo === "string" ? body.fltNo.trim().toUpperCase() : "";
      body.acReg = typeof body.acReg === "string" ? body.acReg.trim().toUpperCase() : "";
      body.checkedBy = currentUser.email;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || body.fltNo.length < 3 || body.fltNo.length > 20 || body.acReg.length < 3 || body.acReg.length > 20) {
        return json({ message: "Date, flight number and aircraft registration are required" }, 400);
      }
      if (JSON.stringify(body).length > 250_000) return json({ message: "Ramp report is too large" }, 413);
      const id = crypto.randomUUID();
      await db.insert(rampInspections).values({
        id, date: body.date || "", fltNo: body.fltNo || "", acReg: body.acReg || "",
        payload: JSON.stringify(body), createdAt: new Date().toISOString()
      });

      if (body.fltNo && body.date) {
        const sameDateFlights = await db.select({ id: flights.id, flightNo: flights.flightNo })
          .from(flights).where(eq(flights.date, body.date));
        const completedFlight = sameDateFlights.find(flight =>
          normalizeFlightNumber(flight.flightNo) === normalizeFlightNumber(body.fltNo)
        );
        if (completedFlight) {
          await db.update(flights).set({
            status: 'Completed', eta: body.eta || null, ata: body.ata || null, atd: body.atd || null,
            updatedAt: new Date().toISOString()
          }).where(eq(flights.id, completedFlight.id));
        }
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
      const body: any = await request.json();      body.date = typeof body.date === "string" ? body.date.trim() : "";
      body.fltNo = typeof body.fltNo === "string" ? body.fltNo.trim().toUpperCase() : "";
      body.acReg = typeof body.acReg === "string" ? body.acReg.trim().toUpperCase() : "";
      body.checkedBy = currentUser.email;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || body.fltNo.length < 3 || body.fltNo.length > 20 || body.acReg.length < 3 || body.acReg.length > 20) {
        return json({ message: "Date, flight number and aircraft registration are required" }, 400);
      }
      if (JSON.stringify(body).length > 250_000) return json({ message: "Ramp report is too large" }, 413);
      await db.update(rampInspections).set({
        date: body.date || "", fltNo: body.fltNo || "", acReg: body.acReg || "",
        payload: JSON.stringify(body), updatedAt: new Date().toISOString()
      }).where(eq(rampInspections.id, id!));

      if (body.fltNo && body.date) {
        const sameDateFlights = await db.select({ id: flights.id, flightNo: flights.flightNo })
          .from(flights).where(eq(flights.date, body.date));
        const completedFlight = sameDateFlights.find(flight =>
          normalizeFlightNumber(flight.flightNo) === normalizeFlightNumber(body.fltNo)
        );
        if (completedFlight) {
          await db.update(flights).set({
            status: 'Completed', eta: body.eta || null, ata: body.ata || null, atd: body.atd || null,
            updatedAt: new Date().toISOString()
          }).where(eq(flights.id, completedFlight.id));
        }
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
      const currentUser = await requireAuth(request, env);
      await requireRWYView(env, currentUser);
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
      const currentUser = await requireAuth(request, env);
      await requireRWYView(env, currentUser);
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
    // LIVE WEATHER — FUNADHOO AIRPORT (VRCF)
    // ==========================================
    if (pathname === "/api/weather" && method === "GET") {
      await requireAuth(request, env);
      const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
      weatherUrl.searchParams.set('latitude', '6.1625');
      weatherUrl.searchParams.set('longitude', '73.2875');
      weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m');
      weatherUrl.searchParams.set('hourly', 'visibility');
      weatherUrl.searchParams.set('timezone', 'Indian/Maldives');
      weatherUrl.searchParams.set('forecast_days', '1');
      const weatherResponse = await fetch(weatherUrl.toString(), { headers: { 'User-Agent': 'FND-Management-System/1.0' } });
      if (!weatherResponse.ok) return json({ message: 'Live weather service is temporarily unavailable' }, 502);
      const weather: any = await weatherResponse.json();
      const currentHour = String(weather.current?.time || '').slice(0, 13) + ':00';
      const hourIndex = Array.isArray(weather.hourly?.time) ? weather.hourly.time.indexOf(currentHour) : -1;
      return json({
        station: 'VRCF', airport: 'Funadhoo Airport', latitude: 6.1625, longitude: 73.2875,
        observedAt: weather.current?.time || new Date().toISOString(), units: weather.current_units || {},
        temperature: weather.current?.temperature_2m, feelsLike: weather.current?.apparent_temperature,
        humidity: weather.current?.relative_humidity_2m, precipitation: weather.current?.precipitation,
        rain: weather.current?.rain, weatherCode: weather.current?.weather_code, cloudCover: weather.current?.cloud_cover,
        pressure: weather.current?.pressure_msl, windSpeed: weather.current?.wind_speed_10m,
        windDirection: weather.current?.wind_direction_10m, windGusts: weather.current?.wind_gusts_10m,
        visibility: hourIndex >= 0 ? weather.hourly?.visibility?.[hourIndex] : null
      });
    }
    // ==========================================
    // ANNOUNCEMENTS
    // ==========================================
    if (pathname === "/api/announcements" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await ensureAnnouncementsTable();
      const [staffProfile] = await db.select().from(staff).where(eq(staff.email, String(currentUser.email || '').toLowerCase())).limit(1);
      const now = new Date();
      const results = await db.select().from(announcements).orderBy(desc(announcements.publishAt), desc(announcements.createdAt));
      return json(results.filter((announcement: any) => {
        if (isManagerRole(currentUser.role)) return true;
        if (announcement.status !== 'published') return false;
        if (announcement.publishAt && new Date(announcement.publishAt) > now) return false;
        if (announcement.expiresAt && new Date(announcement.expiresAt) < now) return false;
        return canSeeAnnouncement(announcement, currentUser, staffProfile);
      }));
    }

    if (pathname === "/api/announcements" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      await ensureAnnouncementsTable();
      const body: any = await request.json();
      const title = String(body.title || '').trim();
      const message = String(body.message || '').trim();
      const audience = String(body.audience || '');
      const priority = ['normal', 'important', 'urgent'].includes(body.priority) ? body.priority : 'normal';
      const status = ['draft', 'published'].includes(body.status) ? body.status : 'published';
      if (title.length < 3 || title.length > 120 || message.length < 3 || message.length > 4000) return json({ message: 'Enter a valid title and announcement message' }, 400);
      if (!announcementAudiences.includes(audience)) return json({ message: 'Invalid announcement audience' }, 400);
      const [staffProfile] = await db.select().from(staff).where(eq(staff.email, String(currentUser.email || '').toLowerCase())).limit(1);
      const now = new Date().toISOString();
      const record = { id: crypto.randomUUID(), title, message, audience, priority, status, publishAt: body.publishAt || now, expiresAt: body.expiresAt || null, createdBy: currentUser.email, createdByName: staffProfile?.name || currentUser.email, createdAt: now, updatedAt: now };
      await db.insert(announcements).values(record);
      return json(record, 201);
    }

    if (pathname.startsWith("/api/announcements/") && method === "PUT") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      await ensureAnnouncementsTable();
      const id = pathname.split('/').pop()!;
      const body: any = await request.json();
      const title = String(body.title || '').trim();
      const message = String(body.message || '').trim();
      const audience = String(body.audience || '');
      if (title.length < 3 || title.length > 120 || message.length < 3 || message.length > 4000) return json({ message: 'Enter a valid title and announcement message' }, 400);
      if (!announcementAudiences.includes(audience)) return json({ message: 'Invalid announcement audience' }, 400);
      const priority = ['normal', 'important', 'urgent'].includes(body.priority) ? body.priority : 'normal';
      const status = ['draft', 'published'].includes(body.status) ? body.status : 'published';
      await db.update(announcements).set({ title, message, audience, priority, status, publishAt: body.publishAt || new Date().toISOString(), expiresAt: body.expiresAt || null, updatedAt: new Date().toISOString() }).where(eq(announcements.id, id));
      return json({ success: true });
    }

    if (pathname.startsWith("/api/announcements/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      await ensureAnnouncementsTable();
      const id = pathname.split('/').pop()!;
      await db.delete(announcements).where(eq(announcements.id, id));
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

      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());

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

      const [liveRampRow] = await db.select().from(rampLiveDraft).where(eq(rampLiveDraft.id, 'current')).limit(1);
      let liveRampDraft: any = {};
      try {
        liveRampDraft = liveRampRow?.payload ? JSON.parse(liveRampRow.payload) : {};
      } catch {
        liveRampDraft = {};
      }
      const liveFlightList = flightList.map((flight: any) => {
        const isLiveFlight = liveRampDraft?.date === flight.date &&
          normalizeFlightNumber(liveRampDraft?.fltNo) === normalizeFlightNumber(flight.flightNo);
        if (!isLiveFlight) return flight;
        const isCompleted = String(flight.status || '').trim().toLowerCase() === 'completed';
        return {
          ...flight,
          eta: liveRampDraft.eta || flight.eta || null,
          ata: liveRampDraft.ata || flight.ata || null,
          atd: liveRampDraft.atd || flight.atd || null,
          status: isCompleted ? 'Completed' : rampFlightStatus(liveRampDraft, flight.route),
        };
      });

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

      const canViewFlightBoard = isManagerRole(currentUser.role) || currentUser.role === 'smt' || myStaff?.isSmt === true || myStaff?.isIncharge === true || myStaff?.specialOpsAccess === true || myStaff?.flightsViewAccess === true || myStaff?.flightsEditAccess === true;

      const activeFlightList = liveFlightList
        .filter((flight: any) => {
          const status = String(flight.status || '').toLowerCase();
          return flight.date >= today && !['cancelled', 'completed'].includes(status);
        })
        .sort((a: any, b: any) => {
          const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
          if (dateCompare !== 0) return dateCompare;
          return String(a.arrivalTime || a.departureTime || '').localeCompare(String(b.arrivalTime || b.departureTime || ''));
        });
      const latestRecordedFlight = [...liveFlightList]
        .filter((flight: any) => String(flight.status || '').toLowerCase() !== 'cancelled')
        .sort((a: any, b: any) => {
          const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
          if (dateCompare !== 0) return dateCompare;
          return String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''));
        })[0];
      const dashboardFlightList = activeFlightList.length > 0
        ? activeFlightList
        : (latestRecordedFlight ? [latestRecordedFlight] : []);

      const upcomingFlights = canViewFlightBoard ? dashboardFlightList
        .slice(0, 5)
        .map((flight: any) => {
          let passengerCounts = { adults: 0, infants: 0 };
          try {
            const stored = JSON.parse(flight.bookedFigure || '{}');
            passengerCounts = typeof stored === 'object' && stored !== null
              ? { adults: Number(stored.adults) || 0, infants: Number(stored.infants) || 0 }
              : { adults: Number(stored) || 0, infants: 0 };
          } catch {
            passengerCounts = { adults: Number(flight.bookedFigure) || 0, infants: 0 };
          }
          return { ...flight, paxAdults: passengerCounts.adults, paxInfants: passengerCounts.infants };
        }) : [];

      const nextFlight = upcomingFlights[0] || null;
      const normalizeStaffName = (value: any) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const normalizeDepartment = (value: any) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const normalizeSn = (value: any) => String(value || '').trim().replace(/^sn-/i, '').toUpperCase();
      const activeLeaveToday = leaveList.filter(leave =>
        String(leave.status || '').trim().toLowerCase() === 'approved' &&
        String(leave.startDate || '') <= today &&
        String(leave.endDate || '') >= today
      );
      const rosterUnavailableStatuses = new Set(['absent', 'annual leave', 'sick leave', 'sick leave / mc', 'no pay leave', 'duty travel', 'paternity leave', 'maternity leave', 'pre-maternity leave', 'family responsibility leave (frl)']);
      const rosterUnavailableToday = roster.filter(entry => {
        if (entry.date !== today) return false;
        const status = String(entry.status || '').trim().toLowerCase();
        return status !== 'scheduled' || rosterUnavailableStatuses.has(status);
      });
      const leaveStaffIds = new Set([...activeLeaveToday, ...rosterUnavailableToday].map(entry => String(entry.staffId || '')).filter(Boolean));
      const leaveStaffNames = new Set([...activeLeaveToday, ...rosterUnavailableToday].map(entry => normalizeStaffName(entry.staffName)).filter(Boolean));
      const leaveIdentityKeys = new Set([...activeLeaveToday, ...rosterUnavailableToday].map(entry => `${normalizeStaffName(entry.staffName)}|${normalizeDepartment(entry.staffDepartment)}`));
      const leaveStaffSns = new Set(activeLeaveToday.map(leave => normalizeSn((leave as any).staffSn)).filter(Boolean));
      const addLinkedUnavailableStaff = (entry: any) => {
        const linkedStaff = staffList.find(member => String(member.id || '') === String(entry.staffId || '') || normalizeStaffName(member.name) === normalizeStaffName(entry.staffName));
        if (!linkedStaff) return;
        leaveStaffIds.add(String(linkedStaff.id || ''));
        leaveStaffNames.add(normalizeStaffName(linkedStaff.name));
        leaveIdentityKeys.add(`${normalizeStaffName(linkedStaff.name)}|${normalizeDepartment(linkedStaff.department)}`);
        if (linkedStaff.sn) leaveStaffSns.add(normalizeSn(linkedStaff.sn));
      };
      activeLeaveToday.forEach(addLinkedUnavailableStaff);
      rosterUnavailableToday.forEach(addLinkedUnavailableStaff);
      const visibleDutyEntries = roster.filter(entry => {
        if (entry.date !== today || String(entry.status || '').trim().toLowerCase() !== 'scheduled') return false;
        const staffId = String(entry.staffId || '');
        const normalizedName = normalizeStaffName(entry.staffName);
        const identityKey = `${normalizedName}|${normalizeDepartment(entry.staffDepartment)}`;
        const linkedStaff = staffList.find(member => String(member.id || '') === staffId || normalizeStaffName(member.name) === normalizedName);
        const linkedSn = normalizeSn(linkedStaff?.sn);
        return !leaveStaffIds.has(staffId) && !leaveStaffNames.has(normalizedName) && !leaveIdentityKeys.has(identityKey) && (!linkedSn || !leaveStaffSns.has(linkedSn));
      });
      const onDutyToday = Array.from(new Map(visibleDutyEntries.map(entry => [`${String(entry.staffName || "").trim().replace(/\s+/g, " ").toLowerCase()}|${String(entry.staffDepartment || "").trim().toLowerCase()}`, entry])).values());
      const onLeaveToday = activeLeaveToday;
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
        upcomingFlights,
        canViewFlightBoard,

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
