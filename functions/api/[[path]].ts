import { requireAuth } from "../middleware/auth.js";
import { requireManager, requireSMT } from "../middleware/authorization.js";
import { getAuth } from "../../src/lib/auth.js";
import { hashPassword } from "better-auth/crypto";
import { buildManagerSummary } from "../../src/lib/manager-summary.js";
import { getDb } from "../../src/lib/db.js";
import {
  user, session, account, users, staff, holidays, flights, leaveRequests, overtimeEntries,
  rosterEntries, birdCounts, safetyOccurrenceReports, rampInspections, tempAccess, settings,
  userPresets, timesheets, opsGroundHistory, opsRunwayHistory, fodCollections,
  lightsInspectors, rwyLights, savedReports, rampLiveDraft, opsChecks,
  passwordResetRequests, announcements, chatGroups, chatGroupMembers, chatMessages,
  appNotifications, appPushSubscriptions, resignationRequests
} from "../../src/db/schema.js";
import { eq, and, inArray, sql, asc, desc, or, isNull } from "drizzle-orm";
import { getVapidAuthorization, isTrustedPushEndpoint } from "../../src/lib/web-push.js";
import { canReceiveRequestNotification } from "../../src/lib/notification-policy.js";
import { planRosterLeaveConsolidation, ROSTER_LEAVE_REASON } from "../../src/lib/roster-leave-history.js";
import { canonicalSn, staffNumberConflict, deduplicateDutyEntries, groupDutyDisplayEntries, reconcileDutyAvailability } from "../../src/lib/duty-identity.js";
import { EMPTY_ROSTER_BEFORE_LEAVE, snapshotRosterBeforeLeave } from "../../src/lib/roster-restore.js";
import { buildDutyConflictReport } from "../../src/lib/duty-conflict-report.js";
import { planLegacyDutyRepair } from "../../src/lib/legacy-duty-repair.js";
import { approvalRosterConflict, auditLeaveRosterIntegrity, countLeaveDays, leaveDateRange, overlappingLeaveRequest } from "../../src/lib/leave-integrity.js";
import { globalHR, canEditDepartmentProfile, canReviewResignation, restrictInchargeEditPayload, isValidISODate, validateLetterUpload, makeResignationAcceptanceLetter } from "../../src/lib/resignation-policy.js";
import { isInactiveStaff } from "../../src/lib/resigned-roster.js";
import { calculateOTPeriod, normalizeOtPolicy, otPeriod, offsetDate } from "../../src/lib/ot-eligibility.js";
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
  requireLeaveApproval,
  requireOTApproval
} from "../../src/lib/permission-check.js";

let staffPhotoColumnReady = false;
let rosterRestoreColumnsReady = false;
let notificationTablesReady = false;

const isManagerRole = (role: string | undefined | null) =>
  ['developer', 'manager', 'admin', 'owner'].includes(role || '');

const normalizeFlightNumber = (value: any) => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
const rampFlightStatus = (draft: any, routeValue?: any) => {
  if (draft?.atd) return 'Departed';
  if (draft?.ata) return 'Landed';
  if (draft?.eta) {
    const route = String(draft.route || routeValue || '');
    const airports = route.split(/[\s/>\-–—]+/).map(code => code.trim().toUpperCase()).filter(Boolean);
    const fndIndex = airports.indexOf('FND');
    const origin = fndIndex > 0 ? airports[fndIndex - 1] : '';
    return origin ? `Departed from ${origin}` : 'Departed from origin';
  }
  return 'Scheduled';
};

const normalizeRampPayload = (value: any) => {
  const normalized: any = value && typeof value === 'object' ? { ...value } : {};
  const legacyAliases: Record<string, string> = { baggage: 'bag' };
  Object.entries(legacyAliases).forEach(([legacy, current]) => {
    ['In', 'Out', 'Trans'].forEach(direction => {
      ['', 'Pcs', 'Kg'].forEach(suffix => {
        const legacyKey = `${legacy}${direction}${suffix}`;
        const currentKey = `${current}${direction}${suffix}`;
        if ((normalized[currentKey] === undefined || normalized[currentKey] === '') && normalized[legacyKey] !== undefined && normalized[legacyKey] !== '') {
          normalized[currentKey] = normalized[legacyKey];
        }
      });
    });
  });
  ['cargo', 'mail', 'bag', 'other'].forEach(prefix => {
    ['In', 'Out', 'Trans'].forEach(direction => {
      const combinedKey = `${prefix}${direction}`;
      const piecesKey = `${combinedKey}Pcs`;
      const kgKey = `${combinedKey}Kg`;
      const combined = String(normalized[combinedKey] ?? '').trim();
      if (combined && (normalized[piecesKey] === undefined || normalized[piecesKey] === '' || normalized[kgKey] === undefined || normalized[kgKey] === '')) {
        const parts = combined.split(/[\/|]/).map(part => part.trim());
        if (normalized[piecesKey] === undefined || normalized[piecesKey] === '') normalized[piecesKey] = parts[0] || '';
        if (normalized[kgKey] === undefined || normalized[kgKey] === '') normalized[kgKey] = parts[1] || '';
      }
      if (!combined && (normalized[piecesKey] !== undefined || normalized[kgKey] !== undefined)) {
        normalized[combinedKey] = `${normalized[piecesKey] ?? ''}/${normalized[kgKey] ?? ''}`;
      }
    });
  });
  return normalized;
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

  // Keep original roster values when a shift/OFF/absence is temporarily covered by leave.
  // This migration is idempotent on Cloudflare and does not change old roster values.
  if (!rosterRestoreColumnsReady) {
    await db.execute(sql`ALTER TABLE "roster_entries" ADD COLUMN IF NOT EXISTS "previous_status" text`);
    await db.execute(sql`ALTER TABLE "roster_entries" ADD COLUMN IF NOT EXISTS "previous_shift_time" text`);
    rosterRestoreColumnsReady = true;
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


  // Notification tables are created on demand; migration SQL is also provided
  // for controlled pre-deployment rollout. No existing staff data is touched.
  const ensureNotificationTables = async () => {
    if (notificationTablesReady) return;
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "app_notifications" (
      "id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL,
      "kind" text NOT NULL, "title" text NOT NULL, "body" text NOT NULL,
      "target_page" text NOT NULL, "source_id" text,
      "dedupe_key" text NOT NULL UNIQUE,
      "created_at" timestamp DEFAULT now(), "read_at" timestamp
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "app_notifications_user_created_idx" ON "app_notifications"("user_id", "created_at" DESC)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS "app_push_subscriptions" (
      "id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL,
      "endpoint" text NOT NULL UNIQUE, "p256dh" text NOT NULL, "auth" text NOT NULL,
      "created_at" timestamp DEFAULT now()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "app_push_subscriptions_user_idx" ON "app_push_subscriptions"("user_id")`);
    notificationTablesReady = true;
  };

  const pushToUser = async (userId: string) => {
    if (!env?.VAPID_PUBLIC_KEY || !env?.VAPID_PRIVATE_KEY) return;
    const subscriptions = await db.select().from(appPushSubscriptions)
      .where(eq(appPushSubscriptions.userId, userId)).limit(20);
    await Promise.allSettled(subscriptions.map(async subscription => {
      if (!isTrustedPushEndpoint(subscription.endpoint)) return;
      try {
        const authorization = await getVapidAuthorization(subscription.endpoint, env);
        // No message body is sent to a third-party push service.
        const response = await fetch(subscription.endpoint, {
          method: 'POST',
          headers: { Authorization: authorization, TTL: '60', Urgency: 'normal' },
        });
        if (response.status === 404 || response.status === 410) {
          await db.delete(appPushSubscriptions).where(eq(appPushSubscriptions.id, subscription.id));
        } else if (!response.ok) {
          console.warn('Push delivery rejected:', response.status);
        }
      } catch (error) { console.warn('Push delivery unavailable:', error); }
    }));
  };

  const notifyPasswordResetApprovers = async (requestId: string, email: string) => {
    await ensureNotificationTables();
    // Only approved management roles receive password-reset notifications.
    const recipients = await db.select({ id: user.id }).from(user)
      .innerJoin(users, sql`lower(${user.email}) = lower(${users.email})`)
      .where(inArray(users.role, ['developer', 'manager', 'admin', 'owner']));
    await Promise.allSettled(recipients.map(async recipient => {
      const rows = await db.insert(appNotifications).values({
        id: crypto.randomUUID(), userId: recipient.id,
        kind: 'password_reset_request', title: 'Password reset request',
        body: `${email} requested a password reset. Review the pending request in Settings.`,
        targetPage: 'settings', sourceId: requestId,
        dedupeKey: `password-reset:${requestId}:${recipient.id}`,
        createdAt: new Date().toISOString(),
      }).onConflictDoNothing().returning({ id: appNotifications.id });
      if (rows.length) {
        const delivery = pushToUser(recipient.id).catch(error => console.warn('Password reset phone push failed', error));
        if (typeof context.waitUntil === 'function') context.waitUntil(delivery);
        else await delivery;
      }
    }));
  };

  // In-app alerts survive failed/unavailable phone push delivery. Browser push is
  // scheduled separately via waitUntil; employee names never go in a push payload.
  const emitNotifications = async (recipients: string[], message: {
    kind: string; title: string; body: string; targetPage: string; sourceId: string; eventKey: string;
  }) => {
    const uniqueIds = [...new Set(recipients.filter(Boolean))];
    if (!uniqueIds.length) return;
    await ensureNotificationTables();
    for (const recipientId of uniqueIds) {
      try {
        const created = await db.insert(appNotifications).values({
          id: crypto.randomUUID(), userId: recipientId, kind: message.kind,
          title: message.title, body: message.body, targetPage: message.targetPage,
          sourceId: message.sourceId, dedupeKey: `${message.eventKey}:${recipientId}`,
          createdAt: new Date().toISOString(),
        }).onConflictDoNothing().returning({ id: appNotifications.id });
        if (created.length) {
          const delivery = pushToUser(recipientId).catch(error => console.warn('Device push failed', error));
          if (typeof context.waitUntil === 'function') context.waitUntil(delivery);
          else await delivery;
        }
      } catch (error) { console.error('Failed to create recipient notification', error); }
    }
  };

  const getRequestApprovers = async (target: any, requesterEmail: string): Promise<string[]> => {
    // Approval roles: Developer/Admin/Manager/Owner globally; SMT/Incharge only
    // for the target employee's department, per requireDepartmentApproval.
    const [accounts, directory] = await Promise.all([
      db.select({ id: user.id, email: user.email, role: users.role })
        .from(user).innerJoin(users, sql`lower(${user.email}) = lower(${users.email})`),
      db.select({ email: staff.email, department: staff.department, isSmt: staff.isSmt, isIncharge: staff.isIncharge })
        .from(staff),
    ]);
    return accounts.filter(accountRow => {
      const linked = directory.find(person => String(person.email || '').trim().toLowerCase() ===
        String(accountRow.email || '').trim().toLowerCase());
      return canReceiveRequestNotification({ ...accountRow, department: linked?.department,
        isSmt: linked?.isSmt, isIncharge: linked?.isIncharge },
        { email: target.email, department: target.department }, requesterEmail);
    }).map(accountRow => accountRow.id);
  };

  const getRequestOwner = async (targetEmail: unknown): Promise<string[]> => {
    const email = String(targetEmail || '').trim().toLowerCase();
    if (!email) return [];
    const accounts = await db.select({ id: user.id }).from(user)
      .where(sql`lower(${user.email}) = ${email}`).limit(1);
    return accounts.map(accountRow => accountRow.id);
  };

  const closePendingApproverNotifications = async (kind: string, sourceId: string) => {
    try {
      await ensureNotificationTables();
      await db.update(appNotifications).set({ readAt: new Date().toISOString() }).where(and(
        eq(appNotifications.kind, kind), eq(appNotifications.sourceId, sourceId), isNull(appNotifications.readAt)
      ));
    } catch (error) { console.warn('Unable to close old request notification', error); }
  };

  const getOvertimeDuration = (date: unknown, startTime: unknown, endTime: unknown) => {
    const day = String(date || '');
    const start = String(startTime || '');
    const end = String(endTime || '');
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day + 'T12:00:00Z'));
    const timeRE = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!validDate || !timeRE.test(start) || !timeRE.test(end)) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let minutes = eh * 60 + em - sh * 60 - sm;
    if (minutes < 0) minutes += 24 * 60; // overnight shift
    if (minutes < 15 || minutes > 16 * 60) return null;
    return Math.round(minutes / 60 * 100) / 100;
  };

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
  const getChatStaffId = async (currentUser: any) => {
    const profile = await getCurrentStaffProfile(currentUser);
    return profile?.id ? String(profile.id) : String(currentUser.id || '');
  };
  const canAccessSystemGroup = (group: any, currentUser: any, profile: any) => {
    if (group.createdBy !== 'system') return false;
    const role = String(currentUser.role || 'staff').toLowerCase();
    const department = String(profile?.department || currentUser.department || '');
    const management = isManagerRole(role);
    const smt = management || role === 'smt' || profile?.isSmt === true || profile?.isIncharge === true;
    if (group.name === 'FND Staffs') return !!currentUser.id;
    if (group.name === 'SMT & Management') return smt;
    if (group.name === 'Flight Operations') return smt || department === 'Ground Operations';
    return !!department && group.department === department;
  };
  const requireChatGroupAccess = async (groupId: string, currentUser: any) => {
    const [group] = await db.select().from(chatGroups).where(eq(chatGroups.id, groupId)).limit(1);
    if (!group) { const err: any = new Error("Channel not found"); err.status = 404; throw err; }
    const profile = await getCurrentStaffProfile(currentUser);
    if (group.createdBy === 'system') {
      if (canAccessSystemGroup(group, currentUser, profile)) return group;
      const denied: any = new Error('You are not authorized for this channel');
      denied.status = 403;
      throw denied;
    }
    const chatStaffId = await getChatStaffId(currentUser);
    const membership = await db.select().from(chatGroupMembers).where(and(
      eq(chatGroupMembers.groupId, groupId),
      or(eq(chatGroupMembers.staffId, chatStaffId), eq(chatGroupMembers.staffId, String(currentUser.id || '')))
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
  /**
   * Consolidate only approved, roster-generated leave with matching roster links.
   * Keep the earliest history row and move every linked roster day before
   * deleting redundant rows. Manual leave requests are never modified.
   */
  const reconcileRosterLeaveHistory = async (staffId?: string) => {
    const restrictions = and(
      eq(leaveRequests.reason, ROSTER_LEAVE_REASON),
      eq(leaveRequests.status, 'approved'),
      ...(staffId ? [eq(leaveRequests.staffId, staffId)] : [])
    );
    const generatedRequests = await db.select().from(leaveRequests).where(restrictions);
    if (!generatedRequests.length) return;
    const linkedRosterRows = await db.select().from(rosterEntries).where(
      inArray(rosterEntries.leaveRequestId, generatedRequests.map(row => row.id))
    );
    if (!linkedRosterRows.length) return;
    const publicHolidays = await db.select({ date: holidays.date }).from(holidays);
    const plans = planRosterLeaveConsolidation(
      generatedRequests, linkedRosterRows, publicHolidays.map(row => row.date).filter((date): date is string => !!date)
    );
    for (const plan of plans) {
      // Preserve references to deleted daily approvals in the surviving history record.
      const keeper = generatedRequests.find(row => row.id === plan.keepId)!;
      const mergedRows = generatedRequests.filter(row => plan.removeIds.includes(row.id));
      const oldNotes = String(keeper.reviewNotes || '').trim();
      const newAudit = mergedRows.filter(row => !oldNotes.includes(row.id)).map(row =>
        `${row.startDate} (${row.id}, approved by ${row.reviewedBy || 'unknown'})`
      );
      const notes = newAudit.length
        ? [oldNotes, `Merged roster approvals: ${newAudit.join('; ')}`].filter(Boolean).join(' | ')
        : oldNotes;
      const updateSurvivor = db.update(leaveRequests).set({
        startDate: plan.startDate, endDate: plan.endDate, days: plan.days,
        ...(newAudit.length ? { reviewNotes: notes } : {}),
      }).where(eq(leaveRequests.id, plan.keepId));
      if (plan.removeIds.length) {
        // Move roster links and delete daily duplicates in one database transaction.
        await db.batch([
          updateSurvivor,
          db.update(rosterEntries).set({ leaveRequestId: plan.keepId }).where(
            inArray(rosterEntries.leaveRequestId, plan.removeIds)
          ),
          db.delete(leaveRequests).where(inArray(leaveRequests.id, plan.removeIds)),
        ]);
      } else {
        await updateSurvivor;
      }
    }
  };
  const ensureRosterLeaveHistory = async (currentUser: any, targetStaff: any, leaveType: string, date: string) => {
    if (!rosterLeaveStatuses.has(leaveType)) return null;
    // Never convert an employee's manually submitted request into a roster-generated approval.
    const overlappingManualRequests = await db.select({ id: leaveRequests.id }).from(leaveRequests).where(and(
      eq(leaveRequests.staffId, targetStaff.id),
      sql`${leaveRequests.startDate} <= ${date}`,
      sql`${leaveRequests.endDate} >= ${date}`,
      sql`${leaveRequests.reason} IS DISTINCT FROM ${ROSTER_LEAVE_REASON}`,
      sql`lower(coalesce(${leaveRequests.status}, 'pending')) <> 'rejected'`
    )).limit(1);
    if (overlappingManualRequests.length) {
      const error: any = new Error('This date is covered by a manually submitted leave request. Review it in Leave Requests instead.');
      error.status = 409;
      throw error;
    }
    const existing = await db.select().from(leaveRequests).where(and(
      eq(leaveRequests.staffId, targetStaff.id), eq(leaveRequests.startDate, date),
      eq(leaveRequests.endDate, date), eq(leaveRequests.leaveType, leaveType),
      eq(leaveRequests.reason, ROSTER_LEAVE_REASON)
    )).limit(1);
    if (existing[0]) {
      if (existing[0].status !== 'approved') await db.update(leaveRequests).set({
        status: 'approved', reviewedBy: currentUser.email, reviewedAt: new Date().toISOString(),
      }).where(eq(leaveRequests.id, existing[0].id));
      return existing[0].id;
    }
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.insert(leaveRequests).values({
      id, staffId: targetStaff.id, staffName: targetStaff.name || "", staffDepartment: targetStaff.department || "",
      staffSn: targetStaff.sn || "", staffGender: targetStaff.gender || "", leaveType,
      startDate: date, endDate: date, days: 1, reason: ROSTER_LEAVE_REASON,
      status: "approved", requestedBy: currentUser.email, requestedAt: now, reviewedBy: currentUser.email, reviewedAt: now,
    });
    return id;
  };
  const requireRequestMutationAccess = async (currentUser: any, record: any, recordLabel: string) => {
    if (!record) {
      const err: any = new Error(`${recordLabel} not found`);
      err.status = 404;
      throw err;
    }
    if (isManagerRole(currentUser.role)) return true;
    if (String(record.status || '').trim().toLowerCase() !== 'pending') {
      const err: any = new Error(`Only managers can change a reviewed ${recordLabel.toLowerCase()}`);
      err.status = 403;
      throw err;
    }
    const profile = await getCurrentStaffProfile(currentUser);
    if (!profile) {
      const err: any = new Error('Linked staff profile not found');
      err.status = 403;
      throw err;
    }
    const creatorEmail = String(record.requestedBy || record.createdBy || '').trim().toLowerCase();
    const ownRecord = String(record.staffId || '') === String(profile.id || '') || creatorEmail === String(currentUser.email || '').trim().toLowerCase();
    const departmentLead = currentUser.role === 'smt' || profile.isSmt === true || profile.isIncharge === true;
    const sameDepartment = String(record.staffDepartment || '').trim().toLowerCase() === String(profile.department || '').trim().toLowerCase();
    if (ownRecord || (departmentLead && sameDepartment)) return true;
    const err: any = new Error(`You cannot change this ${recordLabel.toLowerCase()}`);
    err.status = 403;
    throw err;
  };
  const scopeRequestsForUser = async (currentUser: any, rows: any[], smtCanViewAll: boolean) => {
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
  // Personal notification APIs: every query is scoped to the logged-in auth ID.
  if (pathname === '/api/notifications' && method === 'GET') {
    const currentUser = await requireAuth(request, env);
    await ensureNotificationTables();
    const [items, unreadRows] = await Promise.all([
      db.select().from(appNotifications).where(eq(appNotifications.userId, currentUser.id))
        .orderBy(desc(appNotifications.createdAt)).limit(100),
      db.select({ total: sql<number>`count(*)::int` }).from(appNotifications)
        .where(and(eq(appNotifications.userId, currentUser.id), isNull(appNotifications.readAt))),
    ]);
    return json({ items, unread: Number(unreadRows[0]?.total || 0) });
  }
  if (pathname === '/api/notifications/read-all' && method === 'POST') {
    const currentUser = await requireAuth(request, env);
    await ensureNotificationTables();
    await db.update(appNotifications).set({ readAt: new Date().toISOString() }).where(
      and(eq(appNotifications.userId, currentUser.id), isNull(appNotifications.readAt)));
    return json({ success: true });
  }
  const notificationReadMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (notificationReadMatch && method === 'POST') {
    const currentUser = await requireAuth(request, env);
    await ensureNotificationTables();
    await db.update(appNotifications).set({ readAt: new Date().toISOString() }).where(
      and(eq(appNotifications.id, notificationReadMatch[1]), eq(appNotifications.userId, currentUser.id)));
    return json({ success: true });
  }
  if (pathname === '/api/push/public-key' && method === 'GET') {
    await requireAuth(request, env);
    return json({ enabled: !!(env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_KEY),
      publicKey: env?.VAPID_PUBLIC_KEY && env?.VAPID_PRIVATE_KEY ? String(env.VAPID_PUBLIC_KEY) : '' });
  }
  if (pathname === '/api/push/subscriptions' && method === 'POST') {
    const currentUser = await requireAuth(request, env);
    if (!env?.VAPID_PRIVATE_KEY || !env?.VAPID_PUBLIC_KEY) return json({ message: 'Phone push has not been configured' }, 503);
    await ensureNotificationTables();
    const body: any = await request.json();
    const subscription = body?.subscription;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!isTrustedPushEndpoint(endpoint) || !/^[A-Za-z0-9_-]{40,200}$/.test(String(p256dh || '')) ||
        !/^[A-Za-z0-9_-]{16,100}$/.test(String(auth || ''))) {
      return json({ message: 'Invalid push subscription' }, 400);
    }
    await db.insert(appPushSubscriptions).values({ id: crypto.randomUUID(), userId: currentUser.id,
      endpoint, p256dh, auth, createdAt: new Date().toISOString() }).onConflictDoUpdate({
        target: appPushSubscriptions.endpoint,
        set: { p256dh, auth, userId: currentUser.id },
      });
    return json({ success: true });
  }
  if (pathname === '/api/push/subscriptions' && method === 'DELETE') {
    const currentUser = await requireAuth(request, env);
    await ensureNotificationTables();
    const body: any = await request.json();
    if (typeof body?.endpoint !== 'string') return json({ message: 'Endpoint required' }, 400);
    await db.delete(appPushSubscriptions).where(and(eq(appPushSubscriptions.userId, currentUser.id),
      eq(appPushSubscriptions.endpoint, body.endpoint)));
    return json({ success: true });
  }
  if (pathname === '/api/notifications/test' && method === 'POST') {
    const currentUser = await requireAuth(request, env);
    await ensureNotificationTables();
    const previous = await db.select({ createdAt: appNotifications.createdAt }).from(appNotifications)
      .where(and(eq(appNotifications.userId, currentUser.id), eq(appNotifications.kind, 'push_test')))
      .orderBy(desc(appNotifications.createdAt)).limit(1);
    if (previous[0]?.createdAt && Date.now() - Date.parse(String(previous[0].createdAt)) < 60_000) {
      return json({ message: 'Please wait one minute before sending another test' }, 429);
    }
    await db.insert(appNotifications).values({ id: crypto.randomUUID(), userId: currentUser.id,
      kind: 'push_test', title: 'FND notification test',
      body: 'Your in-app notifications are working. If phone alerts are enabled, you should receive a device alert.',
      targetPage: 'notifications', dedupeKey: `push-test:${crypto.randomUUID()}`,
      createdAt: new Date().toISOString() });
    await pushToUser(currentUser.id);
    return json({ success: true });
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
      const chatStaffId = await getChatStaffId(currentUser);
      const myMemberships = await db.select().from(chatGroupMembers).where(or(
        eq(chatGroupMembers.staffId, chatStaffId),
        eq(chatGroupMembers.staffId, String(currentUser.id || ''))
      ));
      const myGroupIds = new Set(myMemberships.map((membership: any) => membership.groupId));
      const profile = await getCurrentStaffProfile(currentUser);
      // Effective access to automatic channels is based on today's verified
      // role/department, so new staff need no database member-sync on GET.
      return json(allGroups.filter((group: any) => group.createdBy === 'system'
        ? canAccessSystemGroup(group, currentUser, profile) : myGroupIds.has(group.id)));
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

      const creatorStaffId = await getChatStaffId(currentUser);
      await db.insert(chatGroupMembers).values({
        id: crypto.randomUUID(), groupId: id, staffId: creatorStaffId, role: 'admin', createdAt: new Date().toISOString()
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

      const chatStaffId = await getChatStaffId(currentUser);
      const isGroupAdmin = await db.select().from(chatGroupMembers).where(and(
        eq(chatGroupMembers.groupId, groupId),
        or(eq(chatGroupMembers.staffId, chatStaffId), eq(chatGroupMembers.staffId, String(currentUser.id || ''))),
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
      const requestedEmail = String(body?.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail) || requestedEmail.length > 254) {
        return json({ message: 'Enter a valid email address' }, 400);
      }

      const existingUser = await db.select().from(users)
        .where(sql`lower(${users.email}) = ${requestedEmail}`).limit(1);
      if (existingUser.length === 0) {
         return json({ message: "If an account exists, a request was sent." });
      }

      const existingRequest = await db.select().from(passwordResetRequests).where(and(eq(passwordResetRequests.email, requestedEmail), eq(passwordResetRequests.status, "pending"))).limit(1);
      if (existingRequest.length > 0) return json({ success: true, message: "If an account exists, the request has been recorded." });
      const recent = await db.select({ requestedAt: passwordResetRequests.requestedAt })
        .from(passwordResetRequests).where(eq(passwordResetRequests.email, requestedEmail))
        .orderBy(desc(passwordResetRequests.requestedAt)).limit(1);
      if (recent[0]?.requestedAt && Date.now() - Date.parse(String(recent[0].requestedAt)) < 15 * 60 * 1000) {
        return json({ success: true, message: "If an account exists, the request has been recorded." });
      }

      const id = crypto.randomUUID();
      await db.insert(passwordResetRequests).values({
        id, email: requestedEmail, status: "pending", requestedAt: new Date().toISOString(),
      });
      // Persist the request even if notification delivery temporarily fails.
      try { await notifyPasswordResetApprovers(id, requestedEmail); }
      catch (error) { console.error('Could not notify password-reset approvers:', error); }

      return json({ success: true, message: "If an account exists, the request has been recorded." });
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

      if (reqData.status !== "pending") return json({ message: "Request already processed" }, 409);
      const userId = targetUser[0].id;
      const [credential] = await db.select({ id: account.id }).from(account).where(and(
        eq(account.userId, userId), eq(account.providerId, "credential")
      )).limit(1);
      if (!credential) return json({ message: "This user has no email/password credential. Contact the system administrator." }, 409);

      // Preserve the auth user and all its linked staff data. The password,
      // session revocation and request resolution are one atomic SQL statement.
      // No user or credential rows are ever deleted.
      try {
        const temporaryPassword = `Fnd!${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
        const hash = await hashPassword(temporaryPassword);
        const result: any = await db.execute(sql`
          WITH changed AS (
            UPDATE "account" SET "password" = ${hash}, "updated_at" = now()
            WHERE "id" = ${credential.id} AND "user_id" = ${userId} AND "provider_id" = 'credential'
              AND EXISTS (SELECT 1 FROM "password_reset_requests" WHERE "id" = ${id} AND "status" = 'pending')
            RETURNING "id"
          ), revoked AS (
            DELETE FROM "session" WHERE "user_id" = ${userId} AND EXISTS (SELECT 1 FROM changed)
            RETURNING "id"
          )
          UPDATE "password_reset_requests" SET "status" = 'resolved'
          WHERE "id" = ${id} AND "status" = 'pending' AND EXISTS (SELECT 1 FROM changed)
          RETURNING "id"
        `);
        if (!result?.rows?.length) return json({ message: "Reset already processed. No password changed." }, 409);
        try {
          await ensureNotificationTables();
          await db.update(appNotifications).set({ readAt: new Date().toISOString() }).where(and(
            eq(appNotifications.kind, 'password_reset_request'), eq(appNotifications.sourceId, id)));
        } catch (error) { console.warn('Reset completed; notification cleanup failed:', error); }
        try {
          await emitNotifications([userId], {
            kind: 'password_reset_completed', title: 'Your password was reset',
            body: 'Management reset your sign-in password. Contact your administrator for your new temporary password.',
            targetPage: 'notifications', sourceId: id!, eventKey: `password-reset:completed:${id}`,
          });
        } catch (notifyError) { console.warn('Password reset completed; user notification unavailable', notifyError); }
        return json({ success: true, message: "Password reset completed; previous sessions were revoked", temporaryPassword,
          userName: reqData.email, loginUrl: env?.BETTER_AUTH_URL || "https://management.funadhooairport.com" });
      } catch (err: any) {
        console.error("Failed to reset password (account preserved)", err);
        return json({ message: "Password reset failed. The existing account was not deleted." }, 500);
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
      const staffRecords = await db.select().from(staff).orderBy(asc(staff.orderIndex));
      // A resignation date is derived from completed offboarding, not today's date.
      // Preserve the original staff row and Staff SN for all historical references.
      const completedDepartures = await db.select({
        staffId: resignationRequests.staffId,
        lastDay: resignationRequests.requestedLastDay,
      }).from(resignationRequests)
        .where(and(eq(resignationRequests.status, 'approved'),
          eq(resignationRequests.offboardingStatus, 'completed')))
        .orderBy(desc(resignationRequests.offboardedAt));
      const lastDayByStaff = new Map<string, string>();
      for (const departure of completedDepartures) {
        if (!lastDayByStaff.has(departure.staffId)) {
          lastDayByStaff.set(departure.staffId, departure.lastDay);
        }
      }
      const results = staffRecords.map((record) => ({
        ...record,
        resignationLastDay: lastDayByStaff.get(record.id) || null,
      }));
      const canViewPrivateStaffData = ["developer", "manager", "admin", "owner"].includes(currentUser.role);
      const viewerStaff = await getCurrentStaffProfile(currentUser);
      const canSeeOwnDepartmentDetails = (record: any) => Boolean(viewerStaff?.isIncharge &&
        String(viewerStaff.department || '').toLowerCase() === String(record.department || '').toLowerCase());
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
        if (canSeeOwnDepartmentDetails(record)) return {
          ...record, personalEmail:'', nid:'', notes:'', basicSalary:0,
          dailyAllowance:0, holidayAllowanceRate:0, bankAccount:'',
        };
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
      const sn = canonicalSn(body.sn);
      if (!sn) return json({ message: 'A unique staff number (SN) is required' }, 400);
      const existingStaffSn = await db.select({ id: staff.id, sn: staff.sn }).from(staff);
      if (staffNumberConflict(existingStaffSn, sn)) {
        return json({ message: `Staff number SN-${sn} already exists. Edit that staff record instead of creating a duplicate.` }, 409);
      }
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      if (body.photoBase64 && (!String(body.photoBase64).startsWith('data:image/') || String(body.photoBase64).length > 900_000)) return json({ message: 'Profile photo must be an image smaller than 650 KB' }, 400);

      const officialNames: Record<string, string> = {
        '0037': 'Adam Faisal', '0038': 'Adam Shakir',
        '0729': 'Mohamed Fuadhu', '0757': 'Mohamed Adam',
      };
      await db.insert(staff).values({
        id,
        sn: `SN-${sn}`,
        name: officialNames[sn] || body.name,
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
      const id = pathname.split("/").pop();
      const originalBody: any = await request.json();
      const [targetStaff] = await db.select().from(staff).where(eq(staff.id, id!)).limit(1);
      if (!targetStaff) return json({ message: "Staff member not found" }, 404);
      const [targetUser] = targetStaff.email ? await db.select().from(users).where(
        sql`lower(${users.email}) = ${String(targetStaff.email).toLowerCase()}`).limit(1) : [];
      const editorStaff = await getCurrentStaffProfile(currentUser);
      const restrictedAccount = ['developer','manager','admin','owner','smt'].includes(String(targetUser?.role || '').toLowerCase());
      if (!canEditDepartmentProfile(currentUser, editorStaff, targetStaff, restrictedAccount)) {
        return json({message:'You may only edit non-sensitive fields of staff in your own department'},403);
      }
      if (targetUser?.role === "developer" && currentUser.role !== "developer") return json({ message: "Developer records can only be modified by the Developer" }, 403);
      const isGlobalEditor = isManagerRole(currentUser.role);
      const body: any = isGlobalEditor ? originalBody : restrictInchargeEditPayload(originalBody);
      const targetIsSMT = targetStaff.isSmt === true || targetUser?.role === "smt" || body.isSMT === true;
      if (body.isIncharge === true && !targetIsSMT) return json({ message: "Only SMT members can be department in-charge" }, 400);
      if (body.specialOpsAccess === true && !["Ground Operations", "Maintenance", "Fire & Rescue"].includes(targetStaff.department || "")) {
        return json({ message: "Special Ops Access is limited to eligible operational departments" }, 400);
      }
      if (body.photoBase64 && (!String(body.photoBase64).startsWith('data:image/') || String(body.photoBase64).length > 900_000)) return json({ message: 'Profile photo must be an image smaller than 650 KB' }, 400);
      if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 160)) return json({message:'A valid staff name is required'},400);
      if (body.position !== undefined && (typeof body.position !== 'string' || body.position.length > 160)) return json({message:'Invalid designation'},400);
      if (body.phone !== undefined && (typeof body.phone !== 'string' || body.phone.length > 60)) return json({message:'Invalid phone number'},400);
      const requestedSn = body.sn !== undefined ? canonicalSn(body.sn) : canonicalSn(targetStaff.sn);
      if (!requestedSn) return json({ message: 'A unique staff number (SN) is required' }, 400);
      const existingSnRows = await db.select({ id: staff.id, sn: staff.sn }).from(staff);
      if (staffNumberConflict(existingSnRows, requestedSn, id!)) {
        return json({ message: `Staff number SN-${requestedSn} already belongs to another record. Review the duplicate before saving.` }, 409);
      }
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

      if (body.sn !== undefined) updateData.sn = `SN-${requestedSn}`;
      // Preserve confirmed official spellings when the matching SN is edited.
      const officialNames: Record<string, string> = {
        '0037': 'Adam Faisal', '0038': 'Adam Shakir',
        '0729': 'Mohamed Fuadhu', '0757': 'Mohamed Adam',
      };
      if (officialNames[requestedSn]) updateData.name = officialNames[requestedSn];
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
      // Archive rather than hard-delete. Staff IDs and SNs must remain stable
      // for roster/leave/OT/resignation history even when no history exists yet.
      if (isInactiveStaff(targetStaff)) return json({ success: true, alreadyArchived: true });
      await db.update(staff).set({ status: 'archived', updatedAt: new Date().toISOString() })
        .where(eq(staff.id, id!));
      if (targetStaff.email) {
        const [authAccount] = await db.select({ id: user.id }).from(user)
          .where(sql`lower(${user.email}) = ${targetStaff.email.toLowerCase()}`).limit(1);
        if (authAccount) await db.delete(session).where(eq(session.userId, authAccount.id));
      }
      return json({ success: true, archived: true });
    }

    // ==========================================
    // RESIGNATIONS — employee upload, own-department review, manual offboarding.
    // Apply migrations/phase13_resignations.sql before first use.
    // ==========================================
    if (pathname === '/api/resignations' && method === 'GET') {
      const actor = await requireAuth(request, env);
      const actorStaff = await getCurrentStaffProfile(actor);
      // Do not fetch letter attachments for the general list. Documents are read
      // only through the separately authorized /attachment endpoint.
      const directory = await db.select({
        id: resignationRequests.id,
        staffId: resignationRequests.staffId,
        staffSn: resignationRequests.staffSn,
        staffName: resignationRequests.staffName,
        department: resignationRequests.department,
        requestedLastDay: resignationRequests.requestedLastDay,
        submittedByUserId: resignationRequests.submittedByUserId,
        attachmentName: resignationRequests.attachmentName,
        status: resignationRequests.status,
        createdAt: resignationRequests.createdAt,
        reviewedAt: resignationRequests.reviewedAt,
        reviewedByUserId: resignationRequests.reviewedByUserId,
        reviewerName: resignationRequests.reviewerName,
        reviewNote: resignationRequests.reviewNote,
        acceptanceLetter: resignationRequests.acceptanceLetter,
        offboardingStatus: resignationRequests.offboardingStatus,
        offboardedAt: resignationRequests.offboardedAt,
        offboardedByUserId: resignationRequests.offboardedByUserId,
      }).from(resignationRequests)
        .orderBy(desc(resignationRequests.createdAt)).limit(250);
      const visible = directory.filter(row => globalHR(actor.role) ||
        row.submittedByUserId === actor.id ||
        (actorStaff?.id === row.staffId) ||
        (actorStaff?.isIncharge && String(actorStaff.department || '') === row.department));
      return json(visible.map(row => {
        return { ...row, canReview: row.status === 'pending' &&
            canReviewResignation(actor, actorStaff, {id: row.staffId, department: row.department}),
          canOffboard: globalHR(actor.role) && row.status === 'approved' && row.offboardingStatus !== 'completed' };
      }));
    }

    if (pathname === '/api/resignations' && method === 'POST') {
      const actor = await requireAuth(request, env);
      const ownStaff = await getCurrentStaffProfile(actor);
      if (!ownStaff || ownStaff.status && ownStaff.status !== 'active') return json({message:'An active linked staff profile is required to resign'},403);
      const body: any = await request.json();
      const lastDay = String(body.requestedLastDay || '');
      const todayLocal = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (!isValidISODate(lastDay) || lastDay < todayLocal || lastDay > `${Number(todayLocal.slice(0,4)) + 2}-12-31`) {
        return json({message:'Choose a valid last working day within two years'},400);
      }
      const uploaded = validateLetterUpload(body.letterDataUrl);
      if (!uploaded) return json({message:'Upload a valid PDF, PNG or JPG resignation letter (maximum 2 MB)'},400);
      const attachmentName = String(body.attachmentName || '').trim().replace(/[^a-zA-Z0-9_.() -]/g,'').slice(0,120);
      const allowedExtension = uploaded.mime === 'application/pdf' ? /\.pdf$/i : uploaded.mime === 'image/png' ? /\.png$/i : /\.jpe?g$/i;
      if (!attachmentName || !allowedExtension.test(attachmentName)) return json({message:'The letter filename must match its file type'},400);
      const pending = await db.select({id:resignationRequests.id}).from(resignationRequests).where(and(
        eq(resignationRequests.staffId, ownStaff.id), eq(resignationRequests.status, 'pending'))).limit(1);
      if (pending.length) return json({message:'You already have a pending resignation request'},409);
      const id = crypto.randomUUID();
      await db.insert(resignationRequests).values({
        id, staffId: ownStaff.id, staffSn: String(ownStaff.sn || ''), staffName: String(ownStaff.name || ''),
        department: String(ownStaff.department || ''), requestedLastDay: lastDay,
        submittedByUserId: actor.id, attachmentName, attachmentData: body.letterDataUrl,
        status: 'pending', createdAt: new Date().toISOString(), offboardingStatus: 'not_started',
      });
      try {
        const recipients = await getRequestApprovers(ownStaff, actor.email);
        await emitNotifications(recipients, {kind:'resignation_request', title:'Resignation request awaiting review',
          body:'A staff resignation has been submitted with a letter. Review it in Resignations.',
          targetPage:'resignations', sourceId:id, eventKey:`resignation-submitted:${id}`});
      } catch (err) { console.warn('Resignation submitted, notification delivery unavailable',err); }
      return json({success:true,id},201);
    }

    const resignationDocumentMatch = pathname.match(/^\/api\/resignations\/([a-z0-9-]+)\/(attachment|letter)$/);
    if (resignationDocumentMatch && method === 'GET') {
      const actor = await requireAuth(request, env);
      const actorStaff = await getCurrentStaffProfile(actor);
      const [record] = await db.select().from(resignationRequests).where(eq(resignationRequests.id,resignationDocumentMatch[1])).limit(1);
      if (!record) return json({message:'Resignation not found'},404);
      const allowed = globalHR(actor.role) || record.submittedByUserId === actor.id ||
        actorStaff?.id === record.staffId ||
        (actorStaff?.isIncharge && actorStaff.department === record.department);
      if (!allowed) return json({message:'Not authorized for this resignation letter'},403);
      if (resignationDocumentMatch[2] === 'attachment') return json({name:record.attachmentName,dataUrl:record.attachmentData});
      if (record.status !== 'approved' || !record.acceptanceLetter) return json({message:'The acceptance letter is not available until approval'},409);
      return json({name:`Resignation_Acceptance_${record.staffSn || record.id}.txt`,text:record.acceptanceLetter});
    }

    const resignationDecisionMatch = pathname.match(/^\/api\/resignations\/([a-z0-9-]+)\/(approve|reject|offboard)$/);
    if (resignationDecisionMatch && method === 'POST') {
      const actor = await requireAuth(request, env);
      const actorStaff = await getCurrentStaffProfile(actor);
      const [record] = await db.select().from(resignationRequests).where(eq(resignationRequests.id,resignationDecisionMatch[1])).limit(1);
      if (!record) return json({message:'Resignation not found'},404);
      const [targetStaff] = await db.select().from(staff).where(eq(staff.id,record.staffId)).limit(1);
      if (!targetStaff) return json({message:'Staff record is missing; contact Administration'},409);
      const action = resignationDecisionMatch[2];
      if (record.submittedByUserId === actor.id) return json({message:'You cannot approve or complete your own resignation'},403);
      if (action === 'offboard') {
        if (!globalHR(actor.role) || actorStaff?.id === targetStaff.id) return json({message:'Admin/Manager authorization required'},403);
        if (record.status !== 'approved' || !['not_started','retry_required'].includes(record.offboardingStatus || 'not_started')) return json({message:'Only an approved, unfinished resignation can be offboarded'},409);
        const todayLocal = new Intl.DateTimeFormat('sv-SE',{timeZone:'Indian/Maldives'}).format(new Date());
        if (record.requestedLastDay > todayLocal) return json({message:'Last working day has not arrived yet'},409);
        const [appAccount] = await db.select({id:user.id,email:user.email}).from(user)
          .where(sql`lower(${user.email}) = ${String(targetStaff.email || '').toLowerCase()}`).limit(1);
        const [roleRecord] = targetStaff.email ? await db.select({role:users.role}).from(users).where(
          sql`lower(${users.email}) = ${String(targetStaff.email).toLowerCase()}`).limit(1) : [];
        if (roleRecord?.role === 'developer' && actor.role !== 'developer') return json({message:'Developer account can only be deactivated by a Developer'},403);
        const claimed = await db.update(resignationRequests).set({offboardingStatus:'processing'})
          .where(and(eq(resignationRequests.id,record.id),
            inArray(resignationRequests.offboardingStatus,['not_started','retry_required'])))
          .returning({id:resignationRequests.id});
        if (!claimed.length) return json({message:'Offboarding is being handled or already completed'},409);
        try {
          // Archive, never hard-delete. If a later step fails, retain a retryable state.
          await db.update(staff).set({status:'resigned',updatedAt:new Date().toISOString()}).where(eq(staff.id,targetStaff.id));
          if (appAccount?.id) await db.delete(session).where(eq(session.userId,appAccount.id));
          await db.update(resignationRequests).set({offboardingStatus:'completed',
            offboardedAt:new Date().toISOString(),offboardedByUserId:actor.id})
            .where(eq(resignationRequests.id,record.id));
        } catch (error) {
          await db.update(resignationRequests).set({offboardingStatus:'retry_required'})
            .where(eq(resignationRequests.id,record.id)).catch(()=>{});
          throw error;
        }
        return json({success:true,message:'Staff archived and existing sessions revoked where an account was linked. Retain history; review permanent deletion separately.'});
      }
      if (!canReviewResignation(actor,actorStaff,targetStaff)) return json({message:'Only the department In-Charge or authorized management may decide this request'},403);
      if (record.status !== 'pending') return json({message:'This resignation has already been decided'},409);
      const body: any = await request.json().catch(() => ({}));
      const note = String(body.note || '').trim().slice(0,900);
      if (action === 'reject' && note.length < 5) return json({message:'Please provide a rejection reason'},400);
      const approved = action === 'approve';
      const acceptance = approved ? makeResignationAcceptanceLetter({
        employeeName: record.staffName, employeeSn: record.staffSn, department: record.department,
        lastWorkingDay: record.requestedLastDay, approvalDate: new Intl.DateTimeFormat('sv-SE', {timeZone:'Indian/Maldives'}).format(new Date()),
        approvingOfficer: `${actorStaff?.name || actor.name || actor.email} (${actorStaff?.sn || actor.role})`,
      }) : null;
      const decided = await db.update(resignationRequests).set({
        status:approved?'approved':'rejected',reviewedAt:new Date().toISOString(),reviewedByUserId:actor.id,
        reviewerName:String(actorStaff?.name || actor.name || actor.email),reviewNote:note,acceptanceLetter:acceptance,
        offboardingStatus:approved?'not_started':'not_required',
      }).where(and(eq(resignationRequests.id,record.id),eq(resignationRequests.status,'pending')))
        .returning({id:resignationRequests.id});
      if (!decided.length) return json({message:'This request was already reviewed'},409);
      try {
        const owners = [record.submittedByUserId];
        await emitNotifications(owners,{kind:approved?'resignation_approved':'resignation_rejected',
          title:approved?'Resignation accepted':'Resignation request returned',
          body:approved?'Your acceptance letter is available in Resignations.':'Your resignation requires attention in Resignations.',
          targetPage:'resignations',sourceId:record.id,eventKey:`resignation-decision:${record.id}`});
        if (approved) {
          const [authRows, roleRows] = await Promise.all([
            db.select({id:user.id,email:user.email}).from(user),
            db.select({email:users.email,role:users.role}).from(users),
          ]);
          const adminEmails = new Set(roleRows.filter(row => globalHR(row.role)).map(row=>String(row.email||'').toLowerCase()));
          const managerIds = authRows.filter(row=>adminEmails.has(String(row.email||'').toLowerCase())).map(row=>row.id);
          await emitNotifications(managerIds,{kind:'resignation_offboarding', title:'Offboarding follow-up required',
            body:'An approved resignation needs an account deactivation and staff archive review after the last working day. Preserve historical records.',
            targetPage:'resignations',sourceId:record.id,eventKey:`resignation-offboarding:${record.id}`});
        }
      } catch (err) { console.warn('Resignation decided; notification delivery unavailable',err); }
      return json({success:true,status:approved?'approved':'rejected'});
    }

    // ==========================================
    // CHECKLIST MODULE
    // ==========================================
    if (pathname === "/api/checklist" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardView(env, currentUser);
      const results = await db.select().from(opsChecks).orderBy(desc(opsChecks.date), desc(opsChecks.time));
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
    // PHASE 11: MANAGER REPORTS, AGGREGATED WITHOUT PERSONAL REASONS.
    // ==========================================
    if (pathname === "/api/manager/summary" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const from = String(url.searchParams.get('from') || '');
      const to = String(url.searchParams.get('to') || '');
      const department = String(url.searchParams.get('department') || '');
      const dateRE = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRE.test(from) || !dateRE.test(to) || from > to ||
          Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) ||
          (Date.parse(to) - Date.parse(from)) / 86400000 > 366) {
        return json({ message: 'Select a valid date range up to 366 days' }, 400);
      }
      if (department && !ACCESS_DEPARTMENTS.includes(department)) return json({ message: 'Invalid department' }, 400);
      const [roster, leaves, overtime, flightRows, birds, fod, ramp, lights] = await Promise.all([
        db.select({ staffId: rosterEntries.staffId, staffDepartment: rosterEntries.staffDepartment,
          date: rosterEntries.date, status: rosterEntries.status }).from(rosterEntries)
          .where(and(sql`${rosterEntries.date} >= ${from}`, sql`${rosterEntries.date} <= ${to}`)),
        db.select({ staffDepartment: leaveRequests.staffDepartment, status: leaveRequests.status,
          startDate: leaveRequests.startDate, endDate: leaveRequests.endDate }).from(leaveRequests)
          .where(and(sql`${leaveRequests.startDate} <= ${to}`, sql`${leaveRequests.endDate} >= ${from}`)),
        db.select({ staffDepartment: overtimeEntries.staffDepartment, status: overtimeEntries.status,
          date: overtimeEntries.date, hours: overtimeEntries.hours }).from(overtimeEntries)
          .where(and(sql`${overtimeEntries.date} >= ${from}`, sql`${overtimeEntries.date} <= ${to}`)),
        db.select({ date: flights.date }).from(flights)
          .where(and(sql`${flights.date} >= ${from}`, sql`${flights.date} <= ${to}`)),
        db.select({ date: birdCounts.date }).from(birdCounts)
          .where(and(sql`${birdCounts.date} >= ${from}`, sql`${birdCounts.date} <= ${to}`)),
        db.select({ date: fodCollections.date }).from(fodCollections)
          .where(and(sql`${fodCollections.date} >= ${from}`, sql`${fodCollections.date} <= ${to}`)),
        db.select({ date: rampInspections.date }).from(rampInspections)
          .where(and(sql`${rampInspections.date} >= ${from}`, sql`${rampInspections.date} <= ${to}`)),
        db.select({ date: rwyLights.date }).from(rwyLights)
          .where(and(sql`${rwyLights.date} >= ${from}`, sql`${rwyLights.date} <= ${to}`)),
      ]);
      return json(buildManagerSummary({ roster, leaves, overtime, flights: flightRows, birds, fod, ramp, lights },
        from, to, department));
    }

    // ==========================================
    // LEAVE REQUESTS MODULE
    // ==========================================
    // Manager-only, read-only Phase 6 audit; does not consolidate or modify records.
    if (pathname === "/api/leave-integrity" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      if (!isManagerRole(currentUser.role)) return json({ message: "Manager access required" }, 403);
      const [requests, roster, holidayRows, staffRows] = await Promise.all([
        db.select().from(leaveRequests), db.select().from(rosterEntries),
        db.select({ date: holidays.date }).from(holidays),
        db.select({ id: staff.id, name: staff.name, sn: staff.sn }).from(staff),
      ]);
      return json(auditLeaveRosterIntegrity(requests, roster,
        holidayRows.map(row => row.date).filter((date): date is string => !!date), staffRows));
    }
    if (pathname === "/api/leave-requests" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      // A GET request is read-only. Never merge/delete historical leave while listing it.
      // Roster writes still reconcile their own entries; older rows need an explicit audit.
      const results = await db.select().from(leaveRequests)
        .orderBy(desc(leaveRequests.startDate), desc(leaveRequests.requestedAt));
      return json(await scopeRequestsForUser(currentUser, results, true));
    }
    if (pathname === "/api/leave-requests" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      const body: any = await request.json();
      const targetStaff = await getAuthorizedRequestStaff(currentUser, String(body.staffId || ""));
      if (isInactiveStaff(targetStaff)) return json({ message: 'Cannot request future leave for an archived or resigned staff member.' }, 409);
      const permittedTypes = new Set([
        ...rosterLeaveStatuses, 'ABSENT',
      ]);
      const leaveType = String(body.leaveType || '').trim();
      if (!permittedTypes.has(leaveType)) return json({ message: 'Select a valid leave type.' }, 400);

      let dates: string[];
      try { dates = leaveDateRange(String(body.startDate || ''), String(body.endDate || '')); }
      catch (error: any) { return json({ message: String(error.message || 'Invalid leave dates') }, 400); }

      // Compare the whole period, not only identical start/end dates.
      // Pending and approved records must not overlap; rejected requests can be replaced.
      const otherRequests = await db.select({
        id: leaveRequests.id, staffId: leaveRequests.staffId, status: leaveRequests.status,
        startDate: leaveRequests.startDate, endDate: leaveRequests.endDate,
      }).from(leaveRequests).where(and(
        eq(leaveRequests.staffId, targetStaff.id),
        sql`${leaveRequests.startDate} <= ${dates[dates.length - 1]}`,
        sql`${leaveRequests.endDate} >= ${dates[0]}`,
      ));
      if (overlappingLeaveRequest(otherRequests, targetStaff.id, dates[0], dates[dates.length - 1])) {
        return json({ message: 'This leave period overlaps another pending or approved request. Review that request first.' }, 409);
      }
      const holidayRows = leaveType === 'ANNUAL LEAVE'
        ? await db.select({ date: holidays.date }).from(holidays) : [];
      const days = countLeaveDays(leaveType, dates,
        holidayRows.map(row => row.date).filter((date): date is string => !!date));
      if (days === 0) return json({ message: 'No countable leave days in this period.' }, 400);

      const id = crypto.randomUUID();
      try {
        await db.insert(leaveRequests).values({
          id, staffId: targetStaff.id, staffName: targetStaff.name || "", staffDepartment: targetStaff.department || "",
          staffSn: targetStaff.sn || "", staffGender: targetStaff.gender || "", leaveType,
          startDate: dates[0], endDate: dates[dates.length - 1], days,
          reason: String(body.reason || '').slice(0, 2000),
          status: "pending", requestedBy: currentUser.email, requestedAt: new Date().toISOString(),
        });
        // For manual leave, one alert covers the entire approved date range.
        try { const approvers = await getRequestApprovers(targetStaff, currentUser.email);
        await emitNotifications(approvers, {
          kind: 'leave_request', title: 'New leave request',
          body: `${targetStaff.name || 'Staff member'} · ${leaveType} · ${dates[0]} to ${dates[dates.length - 1]}`,
          targetPage: 'leave', sourceId: id, eventKey: `leave:submitted:${id}`,
        }); } catch (notifyError) { console.warn('Leave request saved; notification unavailable', notifyError); }
        return json({ success: true, id, days });
      } catch (error) { console.error('Leave request creation failed', error); return json({ message: "Failed to create leave request." }, 400); }
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
      // Approval writes roster rows. Never recreate future duties after offboarding.
      if (isInactiveStaff(targetStaff)) return json({ message: 'Archived or resigned staff cannot receive new roster or leave assignments.' }, 409);

      await request.json();
      const reviewedAt = new Date().toISOString();

      // A repeated approval must not reset the original roster backup.
      if (String(leaveRow.status || '').toLowerCase() === 'approved') {
        return json({ success: true, alreadyApproved: true });
      }
      if (String(leaveRow.status || '').toLowerCase() !== 'pending') {
        return json({ message: 'Only pending leave can be approved.' }, 409);
      }

      // Do not mark a request approved until we have verified and saved its
      // roster backups. In particular, a duplicate employee name is not an ID.
      const reqData = leaveRow;

      if (reqData) {
        const actualStaffId = String(reqData.staffId || '');
        if (!actualStaffId) return json({ message: "Staff ID not found" }, 400);

        let dateStrings: string[];
        try { dateStrings = leaveDateRange(String(reqData.startDate || ''), String(reqData.endDate || '')); }
        catch (error: any) { return json({ message: `Invalid leave period: ${error.message}` }, 409); }
        const entriesToInsert: any[] = [];
        const datesAndBackups: Array<{ date: string; snapshot: ReturnType<typeof snapshotRosterBeforeLeave> }> = [];

        // Prevent this approval from replacing an overlapping approved/pending request.
        const overlappingRequests = await db.select({
          id: leaveRequests.id, staffId: leaveRequests.staffId, status: leaveRequests.status,
          startDate: leaveRequests.startDate, endDate: leaveRequests.endDate,
        }).from(leaveRequests).where(and(
          eq(leaveRequests.staffId, actualStaffId),
          sql`${leaveRequests.startDate} <= ${dateStrings[dateStrings.length - 1]}`,
          sql`${leaveRequests.endDate} >= ${dateStrings[0]}`,
        ));
        if (overlappingLeaveRequest(overlappingRequests, actualStaffId,
          dateStrings[0], dateStrings[dateStrings.length - 1], id)) {
          return json({ message: 'This leave overlaps another approved or pending request; no roster rows were changed.' }, 409);
        }

        // Validate every day's original assignment before replacing ANY roster rows.
        const priorRoster = dateStrings.length
          ? await db.select().from(rosterEntries).where(and(
              eq(rosterEntries.staffId, actualStaffId), inArray(rosterEntries.date, dateStrings)
            )) : [];
        for (const dateStr of dateStrings) {
          const oldRows = priorRoster.filter(row => row.date === dateStr);
          const conflict = approvalRosterConflict(oldRows, id!);
          if (conflict) return json({ message: `${dateStr}: ${conflict} No changes were made.` }, 409);
          try {
            datesAndBackups.push({ date: dateStr, snapshot: snapshotRosterBeforeLeave(oldRows) });
          } catch (error: any) {
            return json({ message: `Cannot safely approve leave on ${dateStr}: ${error.message}` }, 409);
          }
        }
        for (const { date: dateStr, snapshot } of datesAndBackups) {
          entriesToInsert.push({
            id: crypto.randomUUID(), staffId: actualStaffId, staffName: reqData.staffName,
            staffDepartment: reqData.staffDepartment, date: dateStr, shiftTime: "",
            status: reqData.leaveType, leaveRequestId: id, createdAt: new Date().toISOString(),
            previousStatus: snapshot.previousStatus, previousShiftTime: snapshot.previousShiftTime,
          });
        }
        // Neon HTTP executes batch() as one non-interactive database transaction:
        // roster deletion, replacement and approval either all commit or all roll back.
        // A database uniqueness strategy is still needed to prevent concurrent writers.
        if (dateStrings.length > 0) {
          await db.batch([
            db.delete(rosterEntries).where(and(eq(rosterEntries.staffId, actualStaffId), inArray(rosterEntries.date, dateStrings))),
            db.insert(rosterEntries).values(entriesToInsert),
            db.update(leaveRequests).set({ status: "approved", reviewedBy: currentUser.email, reviewedAt })
              .where(and(eq(leaveRequests.id, id!), eq(leaveRequests.status, 'pending'))),
          ]);
        }
      }
      await closePendingApproverNotifications('leave_request', id!);
      try {
        await emitNotifications(await getRequestOwner(targetStaff.email), {
          kind: 'leave_approved', title: 'Leave request approved',
          body: `Your ${String(leaveRow.leaveType || 'leave')} request for ${leaveRow.startDate} to ${leaveRow.endDate} was approved.`,
          targetPage: 'leave', sourceId: id!, eventKey: `leave:approved:${id}`,
        });
      } catch (notifyError) { console.warn('Leave approved; staff notification unavailable', notifyError); }
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

      if (String(leaveRow.status || '').toLowerCase() !== 'pending') {
        return json({ message: 'Only pending leave can be rejected.' }, 409);
      }
      const body: any = await request.json();
      const changed = await db.update(leaveRequests).set({
        status: 'rejected', reviewedBy: currentUser.email, reviewedAt: new Date().toISOString(),
        reviewNotes: String(body.reviewNotes || '').slice(0, 2000),
      }).where(and(eq(leaveRequests.id, id!), eq(leaveRequests.status, 'pending')))
        .returning({ id: leaveRequests.id });
      if (!changed.length) return json({ message: 'Request already reviewed' }, 409);
      await closePendingApproverNotifications('leave_request', id!);
      try {
        await emitNotifications(await getRequestOwner(targetStaff.email), {
          kind: 'leave_rejected', title: 'Leave request rejected',
          body: `Your ${String(leaveRow.leaveType || 'leave')} request for ${leaveRow.startDate} to ${leaveRow.endDate} was rejected.`,
          targetPage: 'leave', sourceId: id!, eventKey: `leave:rejected:${id}`,
        });
      } catch (notifyError) { console.warn('Leave rejected; notification unavailable', notifyError); }
      return json({ success: true });
    }

    if (pathname.startsWith("/api/leave-requests/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      const id = pathname.split("/").pop();
      const [leaveRecord] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id!)).limit(1);
      await requireRequestMutationAccess(currentUser, leaveRecord, 'Leave request');
      const linked = await db.select({ date: rosterEntries.date, previousStatus: rosterEntries.previousStatus })
        .from(rosterEntries).where(eq(rosterEntries.leaveRequestId, id!));
      const missingBackups = linked.filter(row => row.previousStatus == null);
      const suppliedBody: any = await request.json().catch(() => ({}));
      const suppliedRestores = suppliedBody?.legacyRestores && typeof suppliedBody.legacyRestores === 'object'
        ? suppliedBody.legacyRestores : {};
      if (missingBackups.some(row => !row.date || !suppliedRestores[row.date])) {
        return json({
          message: `Cannot safely delete this older leave: the previous roster assignments were never saved for ${missingBackups.map(row => row.date).join(', ')}. Select the correct earlier shift or OFF for each date; no changes were made.`,
          code: 'ROSTER_RESTORE_BACKUP_MISSING',
          dates: missingBackups.map(row => row.date)
        }, 409);
      }
      // Only managers who passed mutation authorization can supply legacy
      // replacements. They must explicitly select the prior roster state per day.
      const legacyRestores: Record<string, { status: string; shiftTime: string }> = {};
      for (const row of missingBackups) {
        const original = suppliedRestores[row.date!];
        const priorStatus = String(original?.status || '');
        const priorShift = String(original?.shiftTime || '').trim();
        if (![EMPTY_ROSTER_BEFORE_LEAVE, 'scheduled', 'OFF DAY', 'ABSENT'].includes(priorStatus) ||
          (priorStatus === 'scheduled' && (priorShift.length < 3 || priorShift.length > 40))) {
          return json({ message: `Select a valid earlier shift or OFF for ${row.date}. No changes were made.` }, 400);
        }
        legacyRestores[row.date!] = { status: priorStatus, shiftTime: priorStatus === 'scheduled' ? priorShift : '' };
      }
      const legacyPayload = JSON.stringify(legacyRestores);
      // This single Postgres statement restores known previous assignments and
      // explicitly chosen legacy values, then deletes the leave record atomically.
      // Empty before leave is distinguished from a missing historical snapshot.
      const restoreResult: any = await db.execute(sql`
        WITH target AS (
          SELECT id FROM leave_requests WHERE id = ${id!} AND NOT EXISTS (
            SELECT 1 FROM roster_entries r
            WHERE r.leave_request_id = ${id!} AND r.previous_status IS NULL
              AND (${legacyPayload}::jsonb -> r.date ->> 'status') IS NULL
          ) FOR UPDATE
        ), restored AS (
          UPDATE roster_entries AS r SET
            status = coalesce(r.previous_status, (${legacyPayload}::jsonb -> r.date ->> 'status')),
            shift_time = CASE
              WHEN coalesce(r.previous_status, (${legacyPayload}::jsonb -> r.date ->> 'status')) = 'scheduled'
              THEN coalesce(r.previous_shift_time, (${legacyPayload}::jsonb -> r.date ->> 'shiftTime'), '')
              ELSE '' END,
            leave_request_id = NULL, previous_status = NULL, previous_shift_time = NULL
          WHERE r.leave_request_id = (SELECT id FROM target)
            AND coalesce(r.previous_status, (${legacyPayload}::jsonb -> r.date ->> 'status')) <> ${EMPTY_ROSTER_BEFORE_LEAVE}
          RETURNING r.id
        ), cleared AS (
          DELETE FROM roster_entries AS r
          WHERE r.leave_request_id = (SELECT id FROM target)
            AND coalesce(r.previous_status, (${legacyPayload}::jsonb -> r.date ->> 'status')) = ${EMPTY_ROSTER_BEFORE_LEAVE}
          RETURNING r.id
        ), removed AS (
          DELETE FROM leave_requests WHERE id = (SELECT id FROM target) RETURNING id
        )
        SELECT (SELECT count(*) FROM restored) AS restored_count,
               (SELECT count(*) FROM cleared) AS cleared_count,
               (SELECT count(*) FROM removed) AS removed_count
      `);
      const responseRows = Array.isArray(restoreResult) ? restoreResult : (restoreResult?.rows || []);
      if (Number(responseRows[0]?.removed_count || 0) !== 1) {
        return json({ message: 'Leave request could not be removed safely. Refresh and try again.' }, 409);
      }
      return json({ success: true, rosterRestored: Number(responseRows[0]?.restored_count || 0) });
    }

    // Manager-confirmed repair for an orphaned historical duty entry which
    // overlaps a real approved leave. This never edits the leave request or
    // deletes a staff account. All row changes + the audit record are atomic.
    if (pathname === "/api/roster/repair-verified-conflict" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      if (!isManagerRole(currentUser.role)) {
        return json({ message: "Only Developer, Admin or Manager can repair legacy roster identities." }, 403);
      }
      await requireRosterEdit(env, currentUser);
      const body: any = await request.json().catch(() => ({}));
      const rosterEntryId = String(body.rosterEntryId || '').trim();
      const leaveRequestId = String(body.leaveRequestId || '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(rosterEntryId) || !/^[0-9a-f-]{36}$/i.test(leaveRequestId)) {
        return json({ message: "Valid roster and leave record IDs are required." }, 400);
      }
      const [legacy] = await db.select().from(rosterEntries).where(eq(rosterEntries.id, rosterEntryId)).limit(1);
      const [approvedLeave] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, leaveRequestId)).limit(1);
      if (!legacy || !approvedLeave) {
        return json({ message: "Roster or leave record no longer exists." }, 404);
      }
      const [official] = await db.select().from(staff).where(eq(staff.id, String(approvedLeave.staffId || ''))).limit(1);
      const directory = await db.select().from(staff);
      const officialRows = official?.id ? await db.select().from(rosterEntries).where(and(
        eq(rosterEntries.staffId, official.id), eq(rosterEntries.date, String(legacy.date || ''))
      )) : [];
      let repairPlan: ReturnType<typeof planLegacyDutyRepair>;
      try {
        repairPlan = planLegacyDutyRepair(legacy, approvedLeave, official, directory, officialRows);
      } catch (error: any) {
        return json({ message: `Cannot safely repair this roster entry: ${error.message}` }, 409);
      }
      // We require the user to affirm that this old duty is the shift which
      // should return if the approved leave is ever removed.
      if (body.confirmPreviousShift !== true) {
        return json({ message: "Confirm that the displayed duty time was the original shift before leave." }, 400);
      }
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS roster_identity_repair_audit (
          id text PRIMARY KEY, roster_entry_id text NOT NULL, leave_request_id text NOT NULL,
          official_staff_id text NOT NULL, reviewed_by text NOT NULL,
          old_data jsonb NOT NULL, repair_action text NOT NULL, created_at timestamp DEFAULT now()
        )
      `);
      const backup = JSON.stringify({ legacy, officialRoster: officialRows });
      const hasExisting = repairPlan.action === 'merge';
      const repairId = crypto.randomUUID();
      const originalStaffId = legacy.staffId || null;
      let outcome: any;
      if (hasExisting) {
        // One SQL statement: preserve the historical shift in the approved
        // leave row, remove only the exact orphan duplicate and write an audit.
        outcome = await db.execute(sql`
          WITH source AS MATERIALIZED (
            SELECT r.id FROM roster_entries r WHERE r.id = ${legacy.id}
              AND r.staff_id IS NOT DISTINCT FROM ${originalStaffId}
              AND r.date = ${legacy.date} AND r.status = 'scheduled'
              AND r.shift_time = ${legacy.shiftTime} AND r.leave_request_id IS NULL
            FOR UPDATE
          ), restored AS (
            UPDATE roster_entries r SET
              previous_status = 'scheduled', previous_shift_time = ${legacy.shiftTime}
            WHERE r.id = ${officialRows[0].id}
              AND r.staff_id = ${official.id} AND r.date = ${legacy.date}
              AND r.leave_request_id = ${approvedLeave.id} AND r.status = ${approvedLeave.leaveType}
              AND (r.previous_status IS NULL OR r.previous_status = ${EMPTY_ROSTER_BEFORE_LEAVE}
                   OR (r.previous_status = 'scheduled' AND r.previous_shift_time = ${legacy.shiftTime}))
              AND EXISTS (SELECT 1 FROM source) RETURNING id
          ), removed AS (
            DELETE FROM roster_entries r WHERE r.id IN (SELECT id FROM source)
              AND EXISTS (SELECT 1 FROM restored) RETURNING id
          ), audited AS (
            INSERT INTO roster_identity_repair_audit
              (id, roster_entry_id, leave_request_id, official_staff_id, reviewed_by, old_data, repair_action)
            SELECT ${repairId}, ${legacy.id}, ${approvedLeave.id}, ${official.id},
              ${currentUser.email || ''}, ${backup}::jsonb, 'merged_old_shift'
            WHERE EXISTS (SELECT 1 FROM removed) RETURNING id
          )
          SELECT (SELECT count(*) FROM removed) AS count,
                 (SELECT count(*) FROM audited) AS audits
        `);
      } else {
        // No official roster row exists yet. Convert the orphan duty to one
        // leave-linked roster entry, with its old shift safely retained.
        outcome = await db.execute(sql`
          WITH source AS MATERIALIZED (
            SELECT r.id FROM roster_entries r WHERE r.id = ${legacy.id}
              AND r.staff_id IS NOT DISTINCT FROM ${originalStaffId}
              AND r.date = ${legacy.date} AND r.status = 'scheduled'
              AND r.shift_time = ${legacy.shiftTime} AND r.leave_request_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM roster_entries other
                WHERE other.staff_id = ${official.id} AND other.date = ${legacy.date})
            FOR UPDATE
          ), linked AS (
            UPDATE roster_entries r SET staff_id = ${official.id},
              staff_name = ${official.name || ''}, staff_department = ${official.department || ''},
              status = ${approvedLeave.leaveType}, shift_time = '',
              leave_request_id = ${approvedLeave.id}, previous_status = 'scheduled',
              previous_shift_time = ${legacy.shiftTime}
            WHERE r.id IN (SELECT id FROM source) RETURNING id
          ), audited AS (
            INSERT INTO roster_identity_repair_audit
              (id, roster_entry_id, leave_request_id, official_staff_id, reviewed_by, old_data, repair_action)
            SELECT ${repairId}, ${legacy.id}, ${approvedLeave.id}, ${official.id},
              ${currentUser.email || ''}, ${backup}::jsonb, 'relinked_old_shift'
            WHERE EXISTS (SELECT 1 FROM linked) RETURNING id
          )
          SELECT (SELECT count(*) FROM linked) AS count,
                 (SELECT count(*) FROM audited) AS audits
        `);
      }
      const resultRows = Array.isArray(outcome) ? outcome : (outcome?.rows || []);
      if (Number(resultRows[0]?.count || 0) !== 1 || Number(resultRows[0]?.audits || 0) !== 1) {
        return json({ message: "Record changed during repair; no matching row was updated. Refresh and review." }, 409);
      }
      return json({ success: true, staffName: official.name, staffSn: official.sn,
        action: hasExisting ? 'merged_duplicate' : 'relinked_roster',
        restoredOriginalShift: legacy.shiftTime });
    }

    // ==========================================
    // ROSTER MODULE
    // ==========================================
    if (pathname === "/api/roster" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireRosterView(env, currentUser);
      const results = await db.select().from(rosterEntries).orderBy(desc(rosterEntries.date), asc(rosterEntries.staffName));
      const departed = await db.select({ staffId: resignationRequests.staffId,
        lastDay: resignationRequests.requestedLastDay })
        .from(resignationRequests).where(and(eq(resignationRequests.status, 'approved'),
          eq(resignationRequests.offboardingStatus, 'completed')))
        .orderBy(desc(resignationRequests.offboardedAt));
      const dateByStaff = new Map<string, string>();
      for (const row of departed) if (!dateByStaff.has(row.staffId)) dateByStaff.set(row.staffId, row.lastDay);
      // Post-departure *planned* rows stay safely stored for audit; never
      // advertise them as current duty or overwrite historical leave links.
      return json(results.filter((row) => !dateByStaff.has(String(row.staffId || '')) ||
        String(row.date || '') <= dateByStaff.get(String(row.staffId || ''))!));
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
      if (isInactiveStaff(targetStaff)) return json({
        message: 'Archived or resigned staff cannot receive roster assignments.'
      }, 409);
      const existing = await db.select().from(rosterEntries).where(and(
        eq(rosterEntries.staffId, body.staffId), eq(rosterEntries.date, body.date)
      ));
      if (existing.some(row => row.leaveRequestId)) return json({ message: "Cannot overwrite approved leave." }, 400);
      const restoringSnapshot = rosterLeaveStatuses.has(body.status)
        ? snapshotRosterBeforeLeave(existing) : null;
      const id = existing.length > 0 ? existing[0].id : crypto.randomUUID();
      const rosterLeaveRequestId = await ensureRosterLeaveHistory(currentUser, targetStaff, body.status, body.date);
      const deletePrevious = db.delete(rosterEntries).where(and(
        eq(rosterEntries.staffId, body.staffId), eq(rosterEntries.date, body.date)
      ));
      if (body.status !== "clear") {
        const insertReplacement = db.insert(rosterEntries).values({
          id, staffId: targetStaff.id, staffName: targetStaff.name || "", staffDepartment: targetStaff.department || "",
          date: body.date, shiftTime: body.status === "scheduled" ? body.shiftTime : "", status: body.status,
          leaveRequestId: rosterLeaveRequestId, createdAt: new Date().toISOString(),
          previousStatus: restoringSnapshot?.previousStatus ?? null,
          previousShiftTime: restoringSnapshot?.previousShiftTime ?? null,
        });
        // Never leave a blank shift from a failure between delete and insert.
        await db.batch([deletePrevious, insertReplacement]);
      } else {
        await deletePrevious;
      }
      if (rosterLeaveRequestId) await reconcileRosterLeaveHistory(targetStaff.id);
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
      const seenAssignments = new Set<string>();
      for (const entry of body.entries) {
        if (!entry.staffId || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date || "") || !allowedStatuses.includes(entry.status)) {
          return json({ message: "Bulk assignment contains an invalid entry" }, 400);
        }
        if (entry.status === "scheduled" && (!entry.shiftTime || String(entry.shiftTime).length > 40)) {
          return json({ message: "Every scheduled entry requires a valid shift" }, 400);
        }
        const assignmentKey = `${entry.staffId}|${entry.date}`;
        if (seenAssignments.has(assignmentKey)) {
          return json({ message: "Bulk assignment contains the same staff member and date more than once" }, 400);
        }
        seenAssignments.add(assignmentKey);
        let targetStaff = staffCache.get(entry.staffId);
        if (!targetStaff) { targetStaff = await getAuthorizedRosterStaff(currentUser, entry.staffId); staffCache.set(entry.staffId, targetStaff); }
        if (isInactiveStaff(targetStaff)) return json({
          message: `Archived or resigned staff ${targetStaff.name} cannot receive roster assignments.`
        }, 409);
        const existing = await db.select().from(rosterEntries).where(and(
          eq(rosterEntries.staffId, entry.staffId), eq(rosterEntries.date, entry.date)
        ));
        if (existing.some(row => row.leaveRequestId)) return json({ message: `Approved leave protects ${targetStaff.name} on ${entry.date}` }, 400);
        const restoringSnapshot = rosterLeaveStatuses.has(entry.status)
          ? snapshotRosterBeforeLeave(existing) : null;
        validated.push({ entry, targetStaff, existing: existing[0], restoringSnapshot });
      }
      // Validate leave collisions before writing any bulk roster rows.
      for (const item of validated) {
        if (rosterLeaveStatuses.has(item.entry.status)) {
          const overlap = await db.select({ id: leaveRequests.id }).from(leaveRequests).where(and(
            eq(leaveRequests.staffId, item.targetStaff.id),
            sql`${leaveRequests.startDate} <= ${item.entry.date}`,
            sql`${leaveRequests.endDate} >= ${item.entry.date}`,
            sql`${leaveRequests.reason} IS DISTINCT FROM ${ROSTER_LEAVE_REASON}`,
            sql`lower(coalesce(${leaveRequests.status}, 'pending')) <> 'rejected'`
          )).limit(1);
          if (overlap.length) return json({ message: `A manually submitted leave request covers ${item.targetStaff.name} on ${item.entry.date}` }, 409);
        }
      }
      const affectedLeaveStaff = new Set<string>();
      for (const item of validated) {
        const rosterLeaveRequestId = await ensureRosterLeaveHistory(currentUser, item.targetStaff, item.entry.status, item.entry.date);
        if (item.existing) await db.delete(rosterEntries).where(and(
          eq(rosterEntries.staffId, item.entry.staffId), eq(rosterEntries.date, item.entry.date)
        ));
        await db.insert(rosterEntries).values({
          id: item.existing?.id || crypto.randomUUID(), staffId: item.targetStaff.id,
          staffName: item.targetStaff.name || "", staffDepartment: item.targetStaff.department || "",
          date: item.entry.date, shiftTime: item.entry.status === "scheduled" ? item.entry.shiftTime : "",
          status: item.entry.status, leaveRequestId: rosterLeaveRequestId, createdAt: new Date().toISOString(),
          previousStatus: item.restoringSnapshot?.previousStatus ?? null,
          previousShiftTime: item.restoringSnapshot?.previousShiftTime ?? null,
        });
        if (rosterLeaveRequestId) affectedLeaveStaff.add(item.targetStaff.id);
      }
      for (const staffId of affectedLeaveStaff) await reconcileRosterLeaveHistory(staffId);
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
    // OT rules and staff-specific pay rates share the existing settings JSON column.
    // Legacy JSON arrays are read without changing their meaning. Only managers
    // can see pay rates; all authenticated staff receive non-sensitive rules.
    const loadOTRules = async () => {
      const [saved] = await db.select().from(settings).where(eq(settings.id, 'ot_rules')).limit(1);
      let raw: any = {};
      try { raw = JSON.parse(saved?.deductLeaves || '[]'); } catch { raw = []; }
      const config: any = Array.isArray(raw) ? { deductLeaves: raw } : (raw && typeof raw === 'object' ? raw : {});
      const policy = normalizeOtPolicy({ ...config, regularHours: saved?.regularHours ?? 48, adminHours: saved?.adminHours ?? 40 });
      const rates: Record<string, number> = {};
      const staffHours: Record<string, number> = {};
      for (const [key, val] of Object.entries(config.ratesByStaffId || {})) {
        if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 10000) rates[key] = val;
      }
      for (const [key, val] of Object.entries(config.weeklyHoursByStaffId || {})) {
        if (val === 40 || val === 48) staffHours[key] = val;
      }
      return { policy, rates, staffHours, revision: Number(config.revision || 0), updatedAt: String(config.updatedAt || ''), history: Array.isArray(config.history) ? config.history : [] };
    };
    if (pathname === "/api/settings/ot_rules" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      const config = await loadOTRules();
      return json({ ...config.policy, revision: config.revision,
        ...(isManagerRole(currentUser.role) ? {
          ratesByStaffId: config.rates, weeklyHoursByStaffId: config.staffHours,
          updatedAt: config.updatedAt
        } : {}) });
    }
    if (pathname === "/api/settings/ot_rules" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      requireManager(currentUser.role);
      const body: any = await request.json();
      if (!Array.isArray(body.deductLeaves) || typeof body.regularHours !== 'number' || typeof body.adminHours !== 'number' ||
        !Number.isFinite(body.regularHours) || !Number.isFinite(body.adminHours) || body.regularHours < 1 ||
        body.adminHours < 1 || body.regularHours > 84 || body.adminHours > 84 ||
        typeof body.leaveDayHours !== 'number' || !Number.isFinite(body.leaveDayHours) || body.leaveDayHours < 0 || body.leaveDayHours > 16 ||
        typeof body.frlFinalDays !== 'number' || !Number.isInteger(body.frlFinalDays) || body.frlFinalDays < 0 || body.frlFinalDays > 365) {
        return json({ message: 'Invalid overtime eligibility settings' }, 400);
      }
      const policy = normalizeOtPolicy(body);
      const original = await loadOTRules();
      const validStaff = await db.select({ id: staff.id }).from(staff);
      const allowedIds = new Set(validStaff.map(s => s.id));
      const rates: Record<string, number> = {};
      const staffHours: Record<string, number> = {};
      for (const [key, raw] of Object.entries(body.ratesByStaffId || {})) {
        if (!allowedIds.has(key)) continue;
        if (raw === '' || raw === null || raw === undefined) continue;
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 10000) return json({ message: 'Invalid OT rate' }, 400);
        rates[key] = raw;
      }
      for (const [key, value] of Object.entries(body.weeklyHoursByStaffId || {})) {
        if (!allowedIds.has(key)) continue;
        if (value !== 40 && value !== 48) return json({ message: 'Staff duty requirement must be 40 or 48 hours' }, 400);
        staffHours[key] = value as number;
      }
      const auditAt = new Date().toISOString();
      // Append policy history: existing records/approvals are never modified.
      const history = [...original.history, {
        revision: original.revision + 1, savedAt: auditAt, savedBy: currentUser.id,
        policy, ratesByStaffId: rates, weeklyHoursByStaffId: staffHours,
      }];
      const serialized = JSON.stringify({ ...policy, revision: original.revision + 1,
        updatedAt: auditAt, ratesByStaffId: rates, weeklyHoursByStaffId: staffHours, history });
      await db.insert(settings).values({
        id: 'ot_rules', adminHours: policy.adminHours, regularHours: policy.regularHours, deductLeaves: serialized,
      }).onConflictDoUpdate({
        target: settings.id,
        set: { adminHours: policy.adminHours, regularHours: policy.regularHours, deductLeaves: serialized },
      });
      return json({ success: true, revision: original.revision + 1 });
    }
    // Read-only OT payment eligibility report. Never changes Head Office approvals.
    if (pathname === '/api/overtime/eligibility' && method === 'GET') {
      const currentUser = await requireAuth(request, env);
      const month = String(url.searchParams.get('month') || '');
      let window: { from: string; to: string };
      try { window = otPeriod(month); } catch { return json({ message: 'Invalid OT period (YYYY-MM)' }, 400); }
      const start = offsetDate(window.from, -7);
      const end = offsetDate(window.to, 7);
      const [allOt, allRoster, allLeaves, allStaff, rules] = await Promise.all([
        db.select().from(overtimeEntries).where(and(sql`${overtimeEntries.date} >= ${start}`, sql`${overtimeEntries.date} <= ${end}`)),
        db.select().from(rosterEntries).where(and(sql`${rosterEntries.date} >= ${start}`, sql`${rosterEntries.date} <= ${end}`)),
        db.select().from(leaveRequests).where(and(eq(leaveRequests.status, 'approved'), sql`${leaveRequests.startDate} <= ${end}`, sql`${leaveRequests.endDate} >= ${start}`)),
        db.select({ id: staff.id, department: staff.department }).from(staff),
        loadOTRules(),
      ]);
      const scopedOT = await scopeRequestsForUser(currentUser, allOt, false);
      const allowedStaffIds = new Set(scopedOT.map((entry: any) => String(entry.staffId || '')).filter(Boolean));
      const staffById = new Map(allStaff.map(s => [s.id, s]));
      const ownStaff = isManagerRole(currentUser.role) ? null : await getCurrentStaffProfile(currentUser);
      const summaries = [...allowedStaffIds].sort().map(id => {
        const member = staffById.get(id);
        const requiredHours = rules.staffHours[id] ?? (member?.department === 'Administration' ? rules.policy.adminHours : rules.policy.regularHours);
        // In-Charge/SMT may review departmental OT hours, but must not receive
        // colleagues' compensation estimates or hourly rates.
        const canViewIncome = isManagerRole(currentUser.role) || String(ownStaff?.id || '') === id;
        const result = calculateOTPeriod(month, id, requiredHours, scopedOT, allRoster, allLeaves, rules.policy,
          canViewIncome ? (rules.rates[id] ?? null) : null);
        return { ...result, staffName: scopedOT.find((e: any) => String(e.staffId) === id)?.staffName || '',
          weeklyDutyRequirement: requiredHours };
      });
      return json({ ...window, month, policyRevision: rules.revision, summaries,
        disclaimer: 'Estimated eligibility using current policy. Not finalized payroll; approvals unchanged.' });
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

      if (!/^\S+@\S+\.\S+$/.test(email) || typeof password !== "string" || password.length < 8 || password.length > 128) return json({ message: "A valid email and password of 8 to 128 characters are required" }, 400);
      const activeUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (activeUser.length > 0) return json({ message: "This user already exists." }, 400);

      try {
        await getAuth(env).api.signUpEmail({ body: { email, password, name: name || "New User" } });
      
      } catch (err: any) {
        console.error("Failed to create auth account", err);

        const isPreview =
          url.hostname ===
          "feature-fnd-phase13-rebased-fnd-management-system.funadhoo-airport.workers.dev";

        return json(
          {
            message: "Failed to create auth account",
            ...(isPreview
              ? {
                  diagnostic: {
                    type: err?.name ?? "Unknown",
                    code: err?.body?.code ?? err?.code ?? err?.cause?.code ?? null,
                    status: err?.statusCode ?? err?.status ?? null,
                  },
                }
              : {}),
          },
          400
        );
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
      const results = await db.select().from(overtimeEntries).orderBy(desc(overtimeEntries.date), desc(overtimeEntries.createdAt));
      return json(await scopeRequestsForUser(currentUser, results, false));
    }
    if (pathname === "/api/overtime" && method === "POST") {

      const currentUser = await requireAuth(
        request,
        env
      );

      const body: any = await request.json();
      const targetStaff = await getAuthorizedRequestStaff(currentUser, String(body.staffId || ""));
      if (isInactiveStaff(targetStaff)) return json({ message: 'Cannot create overtime for an archived or resigned staff member.' }, 409);
      const duration = getOvertimeDuration(body.date, body.startTime, body.endTime);
      if (duration === null) return json({ message: "Enter valid OT date and times (15 minutes to 16 hours)." }, 400);
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
          endTime: body.endTime, hours: duration, notes: String(body.notes || "").slice(0, 1000),
          status: "pending", createdBy: currentUser.email, createdAt: new Date().toISOString(),
        });
        try {
          await emitNotifications(await getRequestApprovers(targetStaff, currentUser.email), {
            kind: 'ot_request', title: 'New overtime request',
            body: `${targetStaff.name || 'Staff member'} · ${body.date} · ${body.startTime}–${body.endTime}`,
            targetPage: 'overtime', sourceId: id, eventKey: `ot:submitted:${id}`,
          });
        } catch (notifyError) { console.warn('OT saved; notification unavailable', notifyError); }
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

      const id = pathname.split("/").pop();
      const [overtimeRecord] = await db.select().from(overtimeEntries).where(eq(overtimeEntries.id, id!)).limit(1);
      await requireRequestMutationAccess(currentUser, overtimeRecord, 'Overtime request');
      const body: any = await request.json();
      const duration = getOvertimeDuration(body.date, body.startTime, body.endTime);
      if (duration === null) return json({ message: "Enter valid OT date and times (15 minutes to 16 hours)." }, 400);
      await db.update(overtimeEntries).set({
        date: body.date, startTime: body.startTime, endTime: body.endTime,
        hours: duration, notes: String(body.notes || "").slice(0, 1000)
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
      const changed = await db.update(overtimeEntries).set({
        status: 'approved', reviewedBy: currentUser.email, reviewedAt: new Date().toISOString()
      }).where(and(eq(overtimeEntries.id, id!), eq(overtimeEntries.status, 'pending')))
        .returning({ id: overtimeEntries.id });
      if (!changed.length) return json({ message: 'OT already reviewed' }, 409);
      await closePendingApproverNotifications('ot_request', id!);
      try {
        await emitNotifications(await getRequestOwner(targetStaff.email), {
          kind: 'ot_approved', title: 'Overtime request approved',
          body: `Your overtime request for ${overtimeRow.date} (${overtimeRow.startTime}–${overtimeRow.endTime}) was approved.`,
          targetPage: 'overtime', sourceId: id!, eventKey: `ot:approved:${id}`,
        });
      } catch (notifyError) { console.warn('OT approved; notification unavailable', notifyError); }
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
      const changed = await db.update(overtimeEntries).set({
        status: 'rejected', reviewedBy: currentUser.email, reviewedAt: new Date().toISOString()
      }).where(and(eq(overtimeEntries.id, id!), eq(overtimeEntries.status, 'pending')))
        .returning({ id: overtimeEntries.id });
      if (!changed.length) return json({ message: 'OT already reviewed' }, 409);
      await closePendingApproverNotifications('ot_request', id!);
      try {
        await emitNotifications(await getRequestOwner(targetStaff.email), {
          kind: 'ot_rejected', title: 'Overtime request rejected',
          body: `Your overtime request for ${overtimeRow.date} (${overtimeRow.startTime}–${overtimeRow.endTime}) was rejected.`,
          targetPage: 'overtime', sourceId: id!, eventKey: `ot:rejected:${id}`,
        });
      } catch (notifyError) { console.warn('OT rejected; notification unavailable', notifyError); }
      return json({ success: true });
    }
    if (pathname.startsWith("/api/overtime/") && method === "DELETE") {
      const currentUser = await requireAuth(request, env);
      const id = pathname.split("/").pop();
      const [overtimeRecord] = await db.select().from(overtimeEntries).where(eq(overtimeEntries.id, id!)).limit(1);
      await requireRequestMutationAccess(currentUser, overtimeRecord, 'Overtime request');
      await db.delete(overtimeEntries).where(eq(overtimeEntries.id, id!));
      return json({ success: true });
    }

    const getUnavailableOpsStaffNames = async (date: string) => {
      const [leaveRows, rosterRows, staffRows] = await Promise.all([
        db.select().from(leaveRequests),
        db.select().from(rosterEntries).where(eq(rosterEntries.date, date)),
        db.select().from(staff),
      ]);
      const unavailableRecords = [
        ...leaveRows.filter((leave: any) => String(leave.status || '').trim().toLowerCase() === 'approved' && String(leave.startDate || '') <= date && String(leave.endDate || '') >= date),
        ...rosterRows.filter((entry: any) => String(entry.status || '').trim().toLowerCase() !== 'scheduled'),
      ];
      const unavailableNames = new Set<string>();
      unavailableRecords.forEach((record: any) => {
        const recordName = String(record.staffName || '').trim().replace(/\s+/g, ' ').toUpperCase();
        if (recordName) unavailableNames.add(recordName);
        const linkedStaff = staffRows.find((member: any) => String(member.id || '') === String(record.staffId || '') || String(member.name || '').trim().toLowerCase() === String(record.staffName || '').trim().toLowerCase());
        const linkedName = String(linkedStaff?.name || '').trim().replace(/\s+/g, ' ').toUpperCase();
        if (linkedName) unavailableNames.add(linkedName);
      });
      return unavailableNames;
    };

    // ==========================================
    // OPS RUNWAY
    // ==========================================
    if (pathname === "/api/ops/runway" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardView(env, currentUser);
      const results = await db.select().from(opsRunwayHistory).orderBy(desc(opsRunwayHistory.date), desc(opsRunwayHistory.createdAt));
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
      const date = String(body.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ message: 'A valid operations date is required' }, 400);
      const unavailableNames = await getUnavailableOpsStaffNames(date);
      const cleanNames = (value: any) => Array.from(new Set((Array.isArray(value) ? value : [])
        .map((name: any) => String(name || '').trim().replace(/\s+/g, ' ').toUpperCase())
        .filter((name: string) => name && !unavailableNames.has(name))));
      const id = crypto.randomUUID();
      await db.insert(opsRunwayHistory).values({
        id, date, time: String(body.time || ''), createdAt: new Date().toISOString(),
        rwy19: JSON.stringify(cleanNames(body.rwy19)), rwy01: JSON.stringify(cleanNames(body.rwy01)), lights: JSON.stringify(cleanNames(body.lights)),
      });
      return json({ success: true, id });
    }

    // ==========================================
    // OPS GROUND
    // ==========================================
    if (pathname === "/api/ops/ground" && method === "GET") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardView(env, currentUser);
      const results = await db.select().from(opsGroundHistory).orderBy(desc(opsGroundHistory.date), desc(opsGroundHistory.createdAt));
      return json(results.map((row: any) => ({
        ...row,
        assignments: typeof row.assignments === "string" ? JSON.parse(row.assignments) : row.assignments,
      })));
    }
    if (pathname === "/api/ops/ground" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireOpsBoardEdit(env, currentUser);
      const body: any = await request.json();
      const date = String(body.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ message: 'A valid operations date is required' }, 400);
      const unavailableNames = await getUnavailableOpsStaffNames(date);
      const assignments = body.assignments && typeof body.assignments === 'object' && !Array.isArray(body.assignments) ? body.assignments : {};
      const cleanAssignments = Object.fromEntries(Object.entries(assignments).map(([taskId, names]: [string, any]) => [
        taskId,
        Array.from(new Set((Array.isArray(names) ? names : [])
          .map((name: any) => String(name || '').trim().replace(/\s+/g, ' ').toUpperCase())
          .filter((name: string) => name && !unavailableNames.has(name)))),
      ]));
      const id = crypto.randomUUID();
      await db.insert(opsGroundHistory).values({
        id, date, time: String(body.time || ''), createdAt: new Date().toISOString(),
        assignments: JSON.stringify(cleanAssignments),
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
      const requestedDraftId = String(url.searchParams.get('draftId') || 'current').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'current';
      const rows = await db.select().from(rampLiveDraft).where(eq(rampLiveDraft.id, requestedDraftId)).limit(1);
      return json(rows.length > 0 ? JSON.parse(rows[0].payload || "{}") : {});
    }
    if (pathname === "/api/ramp/draft" && method === "POST") {
      const currentUser = await requireAuth(request, env);
      await requireRampEdit(env, currentUser);
      const body: any = await request.json();
      const payloadStr = JSON.stringify(body);
      const requestedDraftId = String(url.searchParams.get('draftId') || 'current').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'current';
      const [previousDraftRow] = requestedDraftId === 'current' ? [] : await db.select().from(rampLiveDraft).where(eq(rampLiveDraft.id, requestedDraftId)).limit(1);
      let previousDraft: any = {};
      try { previousDraft = previousDraftRow?.payload ? JSON.parse(previousDraftRow.payload) : {}; }
      catch { previousDraft = {}; }
      await db.insert(rampLiveDraft).values({ id: requestedDraftId, payload: payloadStr })
        .onConflictDoUpdate({ target: rampLiveDraft.id, set: { payload: payloadStr } });
      if (requestedDraftId !== 'current' && Object.keys(body).length > 0) {
        await db.insert(rampLiveDraft).values({ id: 'current', payload: payloadStr })
          .onConflictDoUpdate({ target: rampLiveDraft.id, set: { payload: payloadStr } });
      } else if (requestedDraftId !== 'current' && Object.keys(body).length === 0 && previousDraft?.date && previousDraft?.fltNo) {
        const [currentDraftRow] = await db.select().from(rampLiveDraft).where(eq(rampLiveDraft.id, 'current')).limit(1);
        try {
          const currentDraft = currentDraftRow?.payload ? JSON.parse(currentDraftRow.payload) : {};
          const clearsCurrentAlias = currentDraft?.date === previousDraft.date && normalizeFlightNumber(currentDraft?.fltNo) === normalizeFlightNumber(previousDraft.fltNo);
          if (clearsCurrentAlias) {
            await db.insert(rampLiveDraft).values({ id: 'current', payload: '{}' })
              .onConflictDoUpdate({ target: rampLiveDraft.id, set: { payload: '{}' } });
          }
        } catch { /* A malformed current alias is ignored. */ }
      }
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
      return json(results.map((row: any) => {
        let payload: any = {};
        try { payload = normalizeRampPayload(JSON.parse(row.payload || "{}")); }
        catch { payload = {}; }
        return {
          ...payload,
          id: row.id, date: row.date, fltNo: row.fltNo, acReg: row.acReg,
          createdAt: row.createdAt, updatedAt: row.updatedAt
        };
      }));
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
      const results = await db.select().from(timesheets).orderBy(desc(timesheets.date));
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

      // Dashboard uses only today's operational data and pending requests.
      // Never load or return leave reasons, salary, phone or other private fields.
      const [staffList, leaveList, roster, flightList, birdData, fodData, lightsData, rampData] = await Promise.all([
        db.select({ id: staff.id, name: staff.name, sn: staff.sn, email: staff.email,
          department: staff.department, isSmt: staff.isSmt, isIncharge: staff.isIncharge,
          specialOpsAccess: staff.specialOpsAccess, flightsViewAccess: staff.flightsViewAccess,
          flightsEditAccess: staff.flightsEditAccess }).from(staff),
        db.select({ id: leaveRequests.id, staffId: leaveRequests.staffId, staffName: leaveRequests.staffName,
          staffSn: leaveRequests.staffSn, staffDepartment: leaveRequests.staffDepartment,
          leaveType: leaveRequests.leaveType, status: leaveRequests.status,
          startDate: leaveRequests.startDate, endDate: leaveRequests.endDate,
          requestedAt: leaveRequests.requestedAt, requestedBy: leaveRequests.requestedBy }).from(leaveRequests)
          .where(or(eq(leaveRequests.status, 'pending'), and(
            eq(leaveRequests.status, 'approved'),
            sql`${leaveRequests.startDate} <= ${today}`, sql`${leaveRequests.endDate} >= ${today}`))),
        db.select({ id: rosterEntries.id, staffId: rosterEntries.staffId,
          staffName: rosterEntries.staffName, staffDepartment: rosterEntries.staffDepartment,
          date: rosterEntries.date, status: rosterEntries.status, shiftTime: rosterEntries.shiftTime,
          leaveRequestId: rosterEntries.leaveRequestId }).from(rosterEntries).where(eq(rosterEntries.date, today)),
        db.select().from(flights),
        db.select({ date: birdCounts.date }).from(birdCounts).where(eq(birdCounts.date, today)),
        db.select({ date: fodCollections.date }).from(fodCollections).where(eq(fodCollections.date, today)),
        db.select({ date: rwyLights.date }).from(rwyLights).where(eq(rwyLights.date, today)),
        db.select({ date: rampInspections.date }).from(rampInspections).where(eq(rampInspections.date, today)),
      ]);

      const liveRampRows = await db.select().from(rampLiveDraft);
      const liveRampDraftMap = new Map<string, any>();
      const orderedLiveRows = [
        ...liveRampRows.filter(row => row.id !== 'current'),
        ...liveRampRows.filter(row => row.id === 'current'),
      ];
      orderedLiveRows.forEach(row => {
        try {
          const draft = row.payload ? JSON.parse(row.payload) : {};
          if (draft?.date && draft?.fltNo) {
            const key = `${draft.date}|${normalizeFlightNumber(draft.fltNo)}`;
            if (!liveRampDraftMap.has(key)) liveRampDraftMap.set(key, draft);
          }
        } catch { /* Ignore malformed legacy draft. */ }
      });
      const liveRampDrafts = Array.from(liveRampDraftMap.values());
      const liveFlightList = flightList.map((flight: any) => {
        const liveRampDraft = liveRampDrafts.find(draft => draft.date === flight.date &&
          normalizeFlightNumber(draft.fltNo) === normalizeFlightNumber(flight.flightNo));
        if (!liveRampDraft) return flight;
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
          const movementCompare = String(b.departureTime || b.arrivalTime || '').localeCompare(String(a.departureTime || a.arrivalTime || ''));
          if (movementCompare !== 0) return movementCompare;
          return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
        })[0];
      const flightMinutes = (flight: any) => {
        const value = String(flight.arrivalTime || flight.departureTime || '');
        const match = value.match(/^(\d{1,2}):(\d{2})/);
        return match ? Number(match[1]) * 60 + Number(match[2]) : null;
      };
      let dashboardFlightList: any[] = [];
      if (activeFlightList.length > 0) {
        const primaryFlight = activeFlightList[0];
        const primaryMinutes = flightMinutes(primaryFlight);
        dashboardFlightList = activeFlightList.filter((flight: any) => {
          if (flight.date !== primaryFlight.date) return false;
          const minutes = flightMinutes(flight);
          if (primaryMinutes === null || minutes === null) return flight.id === primaryFlight.id;
          return Math.abs(minutes - primaryMinutes) <= 90;
        }).slice(0, 3);
      } else if (latestRecordedFlight) {
        dashboardFlightList = [latestRecordedFlight];
      }

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
      const activeLeaveToday = leaveList.filter(leave =>
        String(leave.status || '').trim().toLowerCase() === 'approved' &&
        String(leave.startDate || '') <= today &&
        String(leave.endDate || '') >= today
      );
      const rosterUnavailableToday = roster.filter(entry =>
        entry.date === today && String(entry.status || '').trim().toLowerCase() !== 'scheduled'
      );
      const scheduledRosterToday = roster.filter(entry =>
        entry.date === today && String(entry.status || '').trim().toLowerCase() === 'scheduled'
      );
      const { visibleDutyEntries, conflictingDutyEntries } = reconcileDutyAvailability(
        scheduledRosterToday,
        [...activeLeaveToday, ...rosterUnavailableToday],
        staffList,
      );
      const dutyLeaveConflictCount = conflictingDutyEntries.length;
      const dutyIdentityConflictCount = conflictingDutyEntries.filter(item => item.reason === 'name-review').length;
      // Record-level evidence is restricted to managers and SMT. This read-only
      // report never changes roster, leave, or Staff Directory records.
      const dutyConflictDetails = (isManagerRole(currentUser.role) || currentUser.role === 'smt')
        ? buildDutyConflictReport(conflictingDutyEntries, staffList)
        : [];
      // Use verified staff ID/SN and authoritative directory spelling.
      // Do not guess that two similar names belong to the same employee.
      const onDutyToday = deduplicateDutyEntries(visibleDutyEntries, staffList);
      // Presentation-only grouping. Preserve all source roster records and flag
      // unverified spelling/name collisions rather than silently deleting identities.
      const onDutyDisplayToday = groupDutyDisplayEntries(onDutyToday);
      const dutyIdentityReviewCount = onDutyDisplayToday.reduce((sum, group) =>
        sum + Math.max(0, group.sourceCount - 1), 0);
      const onLeaveToday = deduplicateDutyEntries(activeLeaveToday, staffList);
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
              .select({ id: overtimeEntries.id, staffId: overtimeEntries.staffId,
                staffDepartment: overtimeEntries.staffDepartment, status: overtimeEntries.status,
                createdBy: overtimeEntries.createdBy })
              .from(overtimeEntries).where(eq(overtimeEntries.status, 'pending'))
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
              .select({ id: overtimeEntries.id, staffId: overtimeEntries.staffId,
                staffDepartment: overtimeEntries.staffDepartment, status: overtimeEntries.status,
                createdBy: overtimeEntries.createdBy })
              .from(overtimeEntries).where(eq(overtimeEntries.status, 'pending'))
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
        onDutyDisplayToday,
        dutyIdentityReviewCount,
        dutyLeaveConflictCount,
        dutyIdentityConflictCount,
        dutyConflictDetails,

        onLeaveToday,

        unavailableToday: [...activeLeaveToday, ...rosterUnavailableToday].map((row: any) => ({
          staffId: row.staffId, staffName: row.staffName, staffDepartment: row.staffDepartment,
          leaveType: row.leaveType, status: row.status, date: row.date,
          startDate: row.startDate, endDate: row.endDate,
        })),

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
