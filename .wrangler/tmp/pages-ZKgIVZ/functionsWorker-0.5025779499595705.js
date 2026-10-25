var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/[[path]].ts
async function backupToFirebase(collectionName, docId, data) {
  const FIREBASE_PROJECT_ID = "fnd-ops-management";
  const FIREBASE_API_KEY = "AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU";
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${docId}?key=${FIREBASE_API_KEY}`;
  const formattedData = {
    fields: Object.keys(data).reduce((acc, key) => {
      const val = data[key];
      if (val === null || val === void 0) return acc;
      if (typeof val === "string") acc[key] = { stringValue: val };
      else if (typeof val === "number") acc[key] = { doubleValue: val };
      else if (typeof val === "boolean") acc[key] = { booleanValue: val };
      return acc;
    }, {})
  };
  try {
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formattedData)
    });
  } catch (err) {
    console.error("Firebase backup failed:", err);
  }
}
__name(backupToFirebase, "backupToFirebase");
var onRequest = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    if (url.pathname === "/api/staff" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM staff ORDER BY orderIndex ASC, name ASC").all();
      const formattedResults = results.map((row) => ({
        ...row,
        isSMT: row.isSMT === 1,
        balanceVisible: row.balanceVisible === 1
      }));
      return new Response(JSON.stringify(formattedResults), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/staff" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO staff (
          id, sn, name, email, personalEmail, nid, joinDate, phone, gender, 
          department, position, isSMT, balanceVisible, notes, basicSalary, 
          dailyAllowance, holidayAllowanceRate, bankAccount, status, createdAt, orderIndex
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.sn || "",
        body.name,
        body.email,
        body.personalEmail || "",
        body.nid || "",
        body.joinDate || "",
        body.phone || "",
        body.gender || "",
        body.department,
        body.position || "",
        body.isSMT ? 1 : 0,
        body.balanceVisible ? 1 : 0,
        body.notes || "",
        body.basicSalary || 0,
        body.dailyAllowance || 0,
        body.holidayAllowanceRate || 0,
        body.bankAccount || "",
        "active",
        createdAt,
        9999
      ).run();
      context.waitUntil(backupToFirebase("staff", id, { ...body, status: "active", createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/staff/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
      context.waitUntil(
        fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/staff/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: "DELETE" })
      );
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/staff/reorder" && method === "PUT") {
      const body = await request.json();
      const stmt = env.DB.prepare("UPDATE staff SET orderIndex = ? WHERE id = ?");
      const batch = body.orderedIds.map((id, index) => stmt.bind(index, id));
      if (batch.length > 0) {
        await env.DB.batch(batch);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/users/sync" && method === "POST") {
      const body = await request.json();
      const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(body.email).first();
      if (existing) {
        await env.DB.prepare(`
          UPDATE users SET role = ?, department = ? WHERE email = ?
        `).bind(body.role, body.department, body.email).run();
      } else {
        await env.DB.prepare(`
          INSERT INTO users (id, email, role, department) VALUES (?, ?, ?, ?)
        `).bind(body.uid, body.email, body.role, body.department).run();
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/user-presets" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM user_presets").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/user-presets" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT OR REPLACE INTO user_presets (id, email, role, department, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, body.email, body.role, body.department, createdAt, body.createdBy || "").run();
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/user-presets/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM user_presets WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/users" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/users/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body = await request.json();
      await env.DB.prepare(`
        UPDATE users SET role = ?, department = ? WHERE id = ?
      `).bind(body.role, body.department, id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/users/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/wildlife" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM bird_counts ORDER BY createdAt DESC").all();
      const formatted = results.map((row) => ({
        ...row,
        rows: JSON.parse(row.rows || "[]")
      }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/wildlife" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO bird_counts (id, date, refNo, wind, temp, cloud, rain, startTime, endTime, rows, observer, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.date,
        body.refNo,
        body.wind || "",
        body.temp || "",
        body.cloud || "",
        body.rain || "N",
        body.startTime || "",
        body.endTime || "",
        JSON.stringify(body.rows),
        body.observer || "",
        createdAt
      ).run();
      context.waitUntil(backupToFirebase("bird_counts", id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/wildlife/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM bird_counts WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/bird_counts/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: "DELETE" }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/settings/ot_rules" && method === "GET") {
      const rule = await env.DB.prepare("SELECT * FROM settings WHERE id = 'ot_rules'").first();
      if (rule) {
        rule.deductLeaves = JSON.parse(rule.deductLeaves || "[]");
      }
      return new Response(JSON.stringify(rule || { adminHours: 40, regularHours: 48, deductLeaves: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/settings/ot_rules" && method === "POST") {
      const body = await request.json();
      await env.DB.prepare(`
        INSERT INTO settings (id, adminHours, regularHours, deductLeaves) 
        VALUES ('ot_rules', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET adminHours = excluded.adminHours, regularHours = excluded.regularHours, deductLeaves = excluded.deductLeaves
      `).bind(body.adminHours, body.regularHours, JSON.stringify(body.deductLeaves)).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/users" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/users/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/ramp/draft" && method === "GET") {
      const row = await env.DB.prepare("SELECT payload FROM ramp_live_draft WHERE id = 'current'").first();
      const payload = row ? JSON.parse(row.payload) : {};
      return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/ramp/draft" && method === "POST") {
      const body = await request.json();
      await env.DB.prepare(`
        INSERT INTO ramp_live_draft (id, payload) VALUES ('current', ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
      `).bind(JSON.stringify(body)).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/ramp/reports" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ramp_inspections ORDER BY date DESC, createdAt DESC").all();
      const formatted = results.map((row) => ({
        ...JSON.parse(row.payload),
        id: row.id,
        date: row.date,
        fltNo: row.fltNo,
        acReg: row.acReg,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/ramp/reports" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO ramp_inspections (id, date, fltNo, acReg, payload, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, body.date || "", body.fltNo || "", body.acReg || "", JSON.stringify(body), createdAt).run();
      context.waitUntil(backupToFirebase("ramp_inspections", id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/ramp/reports/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body = await request.json();
      const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        UPDATE ramp_inspections 
        SET date = ?, fltNo = ?, acReg = ?, payload = ?, updatedAt = ?
        WHERE id = ?
      `).bind(body.date || "", body.fltNo || "", body.acReg || "", JSON.stringify(body), updatedAt, id).run();
      context.waitUntil(backupToFirebase("ramp_inspections", id, { ...body, updatedAt }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/ramp/reports/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM ramp_inspections WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/ramp_inspections/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: "DELETE" }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/ops/runway" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ops_runway_history ORDER BY createdAt DESC LIMIT 200").all();
      const formatted = results.map((row) => ({
        ...row,
        rwy19: JSON.parse(row.rwy19 || "[]"),
        rwy01: JSON.parse(row.rwy01 || "[]"),
        lights: JSON.parse(row.lights || "[]")
      }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/ops/runway" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO ops_runway_history (id, date, time, createdAt, rwy19, rwy01, lights)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.date,
        body.time,
        createdAt,
        JSON.stringify(body.rwy19),
        JSON.stringify(body.rwy01),
        JSON.stringify(body.lights)
      ).run();
      context.waitUntil(backupToFirebase("ops_runway_history", id, body));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/ops/ground" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ops_ground_history ORDER BY createdAt DESC LIMIT 200").all();
      const formatted = results.map((row) => ({
        ...row,
        assignments: JSON.parse(row.assignments || "{}")
      }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/ops/ground" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO ops_ground_history (id, date, time, createdAt, assignments)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        id,
        body.date,
        body.time,
        createdAt,
        JSON.stringify(body.assignments)
      ).run();
      context.waitUntil(backupToFirebase("ops_ground_history", id, body));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/fod" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM fod_collections ORDER BY date DESC LIMIT 200").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/fod" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO fod_collections (id, date, grams, remarks, loggedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, body.date, body.grams, body.remarks, body.loggedBy || "", createdAt).run();
      context.waitUntil(backupToFirebase("fod_collections", id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/fod/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM fod_collections WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/fod_collections/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: "DELETE" }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/holidays" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM holidays ORDER BY date ASC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/holidays" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO holidays (id, date, name, createdAt)
        VALUES (?, ?, ?, ?)
      `).bind(id, body.date, body.name, createdAt).run();
      context.waitUntil(backupToFirebase("holidays", id, { date: body.date, name: body.name, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/holidays/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM holidays WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/holidays/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: "DELETE" }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/leave-requests" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM leave_requests ORDER BY requestedAt DESC").all();
      const formattedResults = results.map((row) => ({
        ...row,
        staffIsSMT: row.staffIsSMT === 1
      }));
      return new Response(JSON.stringify(formattedResults), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/leave-requests" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const requestedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO leave_requests (id, staffId, staffName, staffDepartment, staffSN, staffGender, staffIsSMT, leaveType, startDate, endDate, days, reason, status, requestedAt, requestedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(
        id,
        body.staffId,
        body.staffName,
        body.staffDepartment,
        body.staffSN || "",
        body.staffGender || "",
        body.staffIsSMT ? 1 : 0,
        body.leaveType,
        body.startDate,
        body.endDate,
        body.days,
        body.reason || "",
        requestedAt,
        body.requestedBy || ""
      ).run();
      context.waitUntil(backupToFirebase("leave_requests", id, { ...body, status: "pending", requestedAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/leave-requests/") && url.pathname.endsWith("/approve") && method === "PUT") {
      const id = url.pathname.split("/")[3];
      const body = await request.json();
      const reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`UPDATE leave_requests SET status = 'approved', reviewedBy = ?, reviewedAt = ? WHERE id = ?`).bind(body.reviewedBy, reviewedAt, id).run();
      const reqData = await env.DB.prepare("SELECT * FROM leave_requests WHERE id = ?").bind(id).first();
      if (reqData) {
        const start = /* @__PURE__ */ new Date(reqData.startDate + "T00:00:00");
        const end = /* @__PURE__ */ new Date(reqData.endDate + "T00:00:00");
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split("T")[0];
          await env.DB.prepare("DELETE FROM roster_entries WHERE staffId = ? AND date = ?").bind(reqData.staffId, dateStr).run();
          await env.DB.prepare(`
            INSERT INTO roster_entries (id, staffId, staffName, staffDepartment, date, shiftTime, status, leaveRequestId, createdAt)
            VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)
          `).bind(crypto.randomUUID(), reqData.staffId, reqData.staffName, reqData.staffDepartment, dateStr, reqData.leaveType, id, (/* @__PURE__ */ new Date()).toISOString()).run();
        }
      }
      context.waitUntil(backupToFirebase("leave_requests", id, { status: "approved", reviewedBy: body.reviewedBy, reviewedAt }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/leave-requests/") && url.pathname.endsWith("/reject") && method === "PUT") {
      const id = url.pathname.split("/")[3];
      const body = await request.json();
      const reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`UPDATE leave_requests SET status = 'rejected', reviewedBy = ?, reviewedAt = ?, reviewNotes = ? WHERE id = ?`).bind(body.reviewedBy, reviewedAt, body.reviewNotes || "", id).run();
      context.waitUntil(backupToFirebase("leave_requests", id, { status: "rejected", reviewedBy: body.reviewedBy, reviewedAt, reviewNotes: body.reviewNotes }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/leave-requests/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM leave_requests WHERE id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM roster_entries WHERE leaveRequestId = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/leave_requests/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: "DELETE" }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/settings/ot_rules" && method === "GET") {
      const rule = await env.DB.prepare("SELECT * FROM settings WHERE id = 'ot_rules'").first();
      if (rule) {
        rule.deductLeaves = JSON.parse(rule.deductLeaves);
      }
      return new Response(JSON.stringify(rule || { adminHours: 40, regularHours: 48, deductLeaves: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/overtime" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM overtime_entries ORDER BY date DESC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/overtime" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO overtime_entries (id, staffId, staffName, staffSN, staffDepartment, date, startTime, endTime, hours, notes, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.staffId,
        body.staffName,
        body.staffSN || "",
        body.staffDepartment,
        body.date,
        body.startTime,
        body.endTime,
        body.hours,
        body.notes || "",
        createdAt,
        body.createdBy || ""
      ).run();
      context.waitUntil(backupToFirebase("overtime_entries", id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/overtime/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM overtime_entries WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/overtime_entries/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: "DELETE" }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/flights" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM flights").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/flights" && method === "POST") {
      const body = await request.json();
      const id = crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        INSERT INTO flights (id, date, flightNo, type, aircraft, bookedFigure, checkInTime, arrivalTime, departureTime, route, originDepTime, status, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.date,
        body.flightNo,
        body.type,
        body.aircraft,
        body.bookedFigure || "",
        body.checkInTime || "",
        body.arrivalTime || "",
        body.departureTime || "",
        body.route || "",
        body.originDepTime || "",
        body.status,
        body.remarks || "",
        createdAt
      ).run();
      context.waitUntil(backupToFirebase("flights", id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/flights/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body = await request.json();
      const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await env.DB.prepare(`
        UPDATE flights SET 
          date = ?, flightNo = ?, type = ?, aircraft = ?, bookedFigure = ?, 
          checkInTime = ?, arrivalTime = ?, departureTime = ?, route = ?, 
          originDepTime = ?, status = ?, remarks = ?, updatedAt = ?
        WHERE id = ?
      `).bind(
        body.date,
        body.flightNo,
        body.type,
        body.aircraft,
        body.bookedFigure || "",
        body.checkInTime || "",
        body.arrivalTime || "",
        body.departureTime || "",
        body.route || "",
        body.originDepTime || "",
        body.status,
        body.remarks || "",
        updatedAt,
        id
      ).run();
      context.waitUntil(backupToFirebase("flights", id, { ...body, updatedAt }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/api/flights/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM flights WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/flights/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: "DELETE" }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/roster" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM roster_entries").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/roster" && method === "POST") {
      const body = await request.json();
      const existing = await env.DB.prepare("SELECT id, leaveRequestId FROM roster_entries WHERE staffId = ? AND date = ?").bind(body.staffId, body.date).first();
      if (existing && existing.leaveRequestId) {
        return new Response(JSON.stringify({ message: "Cannot overwrite approved leave." }), { status: 400, headers: corsHeaders });
      }
      const id = existing ? existing.id : crypto.randomUUID();
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      if (existing) {
        await env.DB.prepare("DELETE FROM roster_entries WHERE id = ?").bind(id).run();
      }
      if (body.status !== "clear") {
        await env.DB.prepare(`
          INSERT INTO roster_entries (id, staffId, staffName, staffDepartment, date, shiftTime, status, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.staffId,
          body.staffName,
          body.staffDepartment,
          body.date,
          body.shiftTime || "",
          body.status,
          createdAt
        ).run();
        context.waitUntil(backupToFirebase("roster_entries", id, body));
      }
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/roster/bulk" && method === "POST") {
      const body = await request.json();
      const stmt = env.DB.prepare(`
        INSERT INTO roster_entries (id, staffId, staffName, staffDepartment, date, shiftTime, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const batch = [];
      for (const entry of body.entries) {
        const id = crypto.randomUUID();
        batch.push(stmt.bind(id, entry.staffId, entry.staffName, entry.staffDepartment, entry.date, entry.shiftTime || "", entry.status, (/* @__PURE__ */ new Date()).toISOString()));
        context.waitUntil(backupToFirebase("roster_entries", id, entry));
      }
      if (batch.length > 0) {
        await env.DB.batch(batch);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ message: err.message, stack: err.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}, "onRequest");

// ../.wrangler/tmp/pages-ZKgIVZ/functionsRoutes-0.8240229248176814.mjs
var routes = [
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// C:/Users/moham/AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/moham/AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
