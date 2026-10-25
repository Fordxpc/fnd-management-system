// functions/api/[[path]].ts

export interface Env {
  DB: D1Database;
}

// Helper to send data to Firebase Firestore REST API (Backup)
async function backupToFirebase(collectionName: string, docId: string, data: Record<string, any>) {
  const FIREBASE_PROJECT_ID = "fnd-ops-management";
  const FIREBASE_API_KEY = "AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU"; 
  
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${docId}?key=${FIREBASE_API_KEY}`;

  const formattedData = {
    fields: Object.keys(data).reduce((acc: Record<string, any>, key: string) => {
      const val = data[key];
      if (val === null || val === undefined) return acc;
      if (typeof val === 'string') acc[key] = { stringValue: val };
      else if (typeof val === 'number') acc[key] = { doubleValue: val };
      else if (typeof val === 'boolean') acc[key] = { booleanValue: val };
      return acc;
    }, {})
  };

  try {
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedData)
    });
  } catch (err) {
    console.error("Firebase backup failed:", err);
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ==========================================
    // STAFF MODULE
    // ==========================================
    
    if (url.pathname === "/api/staff" && method === "GET") {
      // Sort by orderIndex (for Roster reordering), then by name
      const { results } = await env.DB.prepare("SELECT * FROM staff ORDER BY orderIndex ASC, name ASC").all();
      
      const formattedResults = results.map((row: any) => ({
        ...row,
        isSMT: row.isSMT === 1,
        balanceVisible: row.balanceVisible === 1
      }));

      return new Response(JSON.stringify(formattedResults), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/staff" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      
      await env.DB.prepare(`
        INSERT INTO staff (
          id, sn, name, email, personalEmail, nid, joinDate, phone, gender, 
          department, position, isSMT, balanceVisible, notes, basicSalary, 
          dailyAllowance, holidayAllowanceRate, bankAccount, status, createdAt, orderIndex
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.sn || '', body.name, body.email, body.personalEmail || '', 
        body.nid || '', body.joinDate || '', body.phone || '', body.gender || '',
        body.department, body.position || '', body.isSMT ? 1 : 0, body.balanceVisible ? 1 : 0, 
        body.notes || '', body.basicSalary || 0, body.dailyAllowance || 0, 
        body.holidayAllowanceRate || 0, body.bankAccount || '', 'active', createdAt, 9999
      ).run();

      context.waitUntil(backupToFirebase('staff', id, { ...body, status: 'active', createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/staff/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
      
      context.waitUntil(
        fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/staff/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' })
      );
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/staff/reorder" && method === "PUT") {
      const body: any = await request.json();
      const stmt = env.DB.prepare("UPDATE staff SET orderIndex = ? WHERE id = ?");
      const batch = body.orderedIds.map((id: string, index: number) => stmt.bind(index, id));
      if (batch.length > 0) {
        await env.DB.batch(batch);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SYNC USER ON LOGIN (Upsert)
    if (url.pathname === "/api/users/sync" && method === "POST") {
      const body: any = await request.json();
      
      // Check if user exists
      const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(body.email).first();
      
      if (existing) {
        // Update their role/dept if it changed
        await env.DB.prepare(`
          UPDATE users SET role = ?, department = ? WHERE email = ?
        `).bind(body.role, body.department, body.email).run();
      } else {
        // Insert new user
        await env.DB.prepare(`
          INSERT INTO users (id, email, role, department) VALUES (?, ?, ?, ?)
        `).bind(body.uid, body.email, body.role, body.department).run();
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // USER PRESETS & MANAGEMENT MODULE
    // ==========================================

    // GET ALL PRESETS
    if (url.pathname === "/api/user-presets" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM user_presets").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CREATE PRESET
    if (url.pathname === "/api/user-presets" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      // Use INSERT OR REPLACE to prevent unique constraint errors
      await env.DB.prepare(`
        INSERT OR REPLACE INTO user_presets (id, email, role, department, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, body.email, body.role, body.department, createdAt, body.createdBy || '').run();

      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE PRESET
    if (url.pathname.startsWith("/api/user-presets/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM user_presets WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET ALL ACTIVE USERS
    if (url.pathname === "/api/users" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // UPDATE USER (Role/Department)
    if (url.pathname.startsWith("/api/users/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      
      await env.DB.prepare(`
        UPDATE users SET role = ?, department = ? WHERE id = ?
      `).bind(body.role, body.department, id).run();

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE USER
    if (url.pathname.startsWith("/api/users/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    // ==========================================
    // WILDLIFE MODULE
    // ==========================================

    // GET ALL BIRD COUNTS
    if (url.pathname === "/api/wildlife" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM bird_counts ORDER BY createdAt DESC").all();
      const formatted = results.map((row: any) => ({
        ...row,
        rows: JSON.parse(row.rows || '[]')
      }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CREATE BIRD COUNT
    if (url.pathname === "/api/wildlife" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO bird_counts (id, date, refNo, wind, temp, cloud, rain, startTime, endTime, rows, observer, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.date, body.refNo, body.wind || '', body.temp || '', body.cloud || '', body.rain || 'N',
        body.startTime || '', body.endTime || '', JSON.stringify(body.rows), body.observer || '', createdAt
      ).run();

      context.waitUntil(backupToFirebase('bird_counts', id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE BIRD COUNT
    if (url.pathname.startsWith("/api/wildlife/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM bird_counts WHERE id = ?").bind(id).run();
      
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/bird_counts/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // SETTINGS & USERS MODULE
    // ==========================================

    // GET OT RULES
    if (url.pathname === "/api/settings/ot_rules" && method === "GET") {
      const rule: any = await env.DB.prepare("SELECT * FROM settings WHERE id = 'ot_rules'").first();
      if (rule) {
        rule.deductLeaves = JSON.parse(rule.deductLeaves || '[]');
      }
      return new Response(JSON.stringify(rule || { adminHours: 40, regularHours: 48, deductLeaves: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SAVE OT RULES
    if (url.pathname === "/api/settings/ot_rules" && method === "POST") {
      const body: any = await request.json();
      await env.DB.prepare(`
        INSERT INTO settings (id, adminHours, regularHours, deductLeaves) 
        VALUES ('ot_rules', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET adminHours = excluded.adminHours, regularHours = excluded.regularHours, deductLeaves = excluded.deductLeaves
      `).bind(body.adminHours, body.regularHours, JSON.stringify(body.deductLeaves)).run();

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET ALL REGISTERED USERS (For Settings Master List)
    if (url.pathname === "/api/users" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE USER
    if (url.pathname.startsWith("/api/users/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // RAMP CHECK MODULE
    // ==========================================

    // GET LIVE DRAFT
    if (url.pathname === "/api/ramp/draft" && method === "GET") {
      const row: any = await env.DB.prepare("SELECT payload FROM ramp_live_draft WHERE id = 'current'").first();
      const payload = row ? JSON.parse(row.payload) : {};
      return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SAVE LIVE DRAFT
    if (url.pathname === "/api/ramp/draft" && method === "POST") {
      const body: any = await request.json();
      await env.DB.prepare(`
        INSERT INTO ramp_live_draft (id, payload) VALUES ('current', ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
      `).bind(JSON.stringify(body)).run();
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET ALL SAVED REPORTS
    if (url.pathname === "/api/ramp/reports" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ramp_inspections ORDER BY date DESC, createdAt DESC").all();
      const formatted = results.map((row: any) => ({
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

    // CREATE REPORT
    if (url.pathname === "/api/ramp/reports" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO ramp_inspections (id, date, fltNo, acReg, payload, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, body.date || '', body.fltNo || '', body.acReg || '', JSON.stringify(body), createdAt).run();

      context.waitUntil(backupToFirebase('ramp_inspections', id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // UPDATE REPORT
    if (url.pathname.startsWith("/api/ramp/reports/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date().toISOString();

      await env.DB.prepare(`
        UPDATE ramp_inspections 
        SET date = ?, fltNo = ?, acReg = ?, payload = ?, updatedAt = ?
        WHERE id = ?
      `).bind(body.date || '', body.fltNo || '', body.acReg || '', JSON.stringify(body), updatedAt, id).run();

      context.waitUntil(backupToFirebase('ramp_inspections', id!, { ...body, updatedAt }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE REPORT
    if (url.pathname.startsWith("/api/ramp/reports/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM ramp_inspections WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/ramp_inspections/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ==========================================
    // OPS BOARD MODULE (Runway & Ground)
    // ==========================================

    // GET RUNWAY HISTORY
    if (url.pathname === "/api/ops/runway" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ops_runway_history ORDER BY createdAt DESC LIMIT 200").all();
      const formatted = results.map((row: any) => ({
        ...row,
        rwy19: JSON.parse(row.rwy19 || '[]'),
        rwy01: JSON.parse(row.rwy01 || '[]'),
        lights: JSON.parse(row.lights || '[]')
      }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST SAVE RUNWAY BOARD
    if (url.pathname === "/api/ops/runway" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO ops_runway_history (id, date, time, createdAt, rwy19, rwy01, lights)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.date, body.time, createdAt, 
        JSON.stringify(body.rwy19), JSON.stringify(body.rwy01), JSON.stringify(body.lights)
      ).run();

      context.waitUntil(backupToFirebase('ops_runway_history', id, body));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET GROUND HISTORY
    if (url.pathname === "/api/ops/ground" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ops_ground_history ORDER BY createdAt DESC LIMIT 200").all();
      const formatted = results.map((row: any) => ({
        ...row,
        assignments: JSON.parse(row.assignments || '{}')
      }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST SAVE GROUND BOARD
    if (url.pathname === "/api/ops/ground" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO ops_ground_history (id, date, time, createdAt, assignments)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        id, body.date, body.time, createdAt, JSON.stringify(body.assignments)
      ).run();

      context.waitUntil(backupToFirebase('ops_ground_history', id, body));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // FOD MODULE
    // ==========================================

    if (url.pathname === "/api/fod" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM fod_collections ORDER BY date DESC LIMIT 200").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/fod" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO fod_collections (id, date, grams, remarks, loggedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, body.date, body.grams, body.remarks, body.loggedBy || '', createdAt).run();

      context.waitUntil(backupToFirebase('fod_collections', id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/fod/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM fod_collections WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/fod_collections/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ==========================================
    // HOLIDAYS MODULE
    // ==========================================

    if (url.pathname === "/api/holidays" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM holidays ORDER BY date ASC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // CREATE CUSTOM HOLIDAY
    if (url.pathname === "/api/holidays" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO holidays (id, date, name, createdAt)
        VALUES (?, ?, ?, ?)
      `).bind(id, body.date, body.name, createdAt).run();

      context.waitUntil(backupToFirebase('holidays', id, { date: body.date, name: body.name, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE HOLIDAY
    if (url.pathname.startsWith("/api/holidays/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM holidays WHERE id = ?").bind(id).run();
      
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/holidays/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ==========================================
    // LEAVE REQUESTS MODULE
    // ==========================================

    if (url.pathname === "/api/leave-requests" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM leave_requests ORDER BY requestedAt DESC").all();
      const formattedResults = results.map((row: any) => ({
        ...row,
        staffIsSMT: row.staffIsSMT === 1
      }));
      return new Response(JSON.stringify(formattedResults), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/leave-requests" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const requestedAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO leave_requests (id, staffId, staffName, staffDepartment, staffSN, staffGender, staffIsSMT, leaveType, startDate, endDate, days, reason, status, requestedAt, requestedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(
        id, body.staffId, body.staffName, body.staffDepartment, body.staffSN || '', body.staffGender || '', body.staffIsSMT ? 1 : 0,
        body.leaveType, body.startDate, body.endDate, body.days, body.reason || '', requestedAt, body.requestedBy || ''
      ).run();

      context.waitUntil(backupToFirebase('leave_requests', id, { ...body, status: 'pending', requestedAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/leave-requests/") && url.pathname.endsWith("/approve") && method === "PUT") {
      const id = url.pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date().toISOString();

      await env.DB.prepare(`UPDATE leave_requests SET status = 'approved', reviewedBy = ?, reviewedAt = ? WHERE id = ?`)
        .bind(body.reviewedBy, reviewedAt, id).run();

      const reqData: any = await env.DB.prepare("SELECT * FROM leave_requests WHERE id = ?").bind(id).first();
      
      if (reqData) {
        const start = new Date(reqData.startDate + 'T00:00:00');
        const end = new Date(reqData.endDate + 'T00:00:00');
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          await env.DB.prepare("DELETE FROM roster_entries WHERE staffId = ? AND date = ?").bind(reqData.staffId, dateStr).run();
          await env.DB.prepare(`
            INSERT INTO roster_entries (id, staffId, staffName, staffDepartment, date, shiftTime, status, leaveRequestId, createdAt)
            VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)
          `).bind(crypto.randomUUID(), reqData.staffId, reqData.staffName, reqData.staffDepartment, dateStr, reqData.leaveType, id, new Date().toISOString()).run();
        }
      }

      context.waitUntil(backupToFirebase('leave_requests', id, { status: 'approved', reviewedBy: body.reviewedBy, reviewedAt }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/leave-requests/") && url.pathname.endsWith("/reject") && method === "PUT") {
      const id = url.pathname.split("/")[3];
      const body: any = await request.json();
      const reviewedAt = new Date().toISOString();

      await env.DB.prepare(`UPDATE leave_requests SET status = 'rejected', reviewedBy = ?, reviewedAt = ?, reviewNotes = ? WHERE id = ?`)
        .bind(body.reviewedBy, reviewedAt, body.reviewNotes || '', id).run();

      context.waitUntil(backupToFirebase('leave_requests', id, { status: 'rejected', reviewedBy: body.reviewedBy, reviewedAt, reviewNotes: body.reviewNotes }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/leave-requests/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM leave_requests WHERE id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM roster_entries WHERE leaveRequestId = ?").bind(id).run();

      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/leave_requests/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
        // ==========================================
    // OVERTIME MODULE
    // ==========================================

    // GET OT RULES
    if (url.pathname === "/api/settings/ot_rules" && method === "GET") {
      const rule: any = await env.DB.prepare("SELECT * FROM settings WHERE id = 'ot_rules'").first();
      if (rule) {
        rule.deductLeaves = JSON.parse(rule.deductLeaves); // Convert back to array
      }
      return new Response(JSON.stringify(rule || { adminHours: 40, regularHours: 48, deductLeaves: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET ALL OVERTIME ENTRIES
    if (url.pathname === "/api/overtime" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM overtime_entries ORDER BY date DESC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CREATE OVERTIME ENTRY
    if (url.pathname === "/api/overtime" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO overtime_entries (id, staffId, staffName, staffSN, staffDepartment, date, startTime, endTime, hours, notes, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.staffId, body.staffName, body.staffSN || '', body.staffDepartment, body.date, 
        body.startTime, body.endTime, body.hours, body.notes || '', createdAt, body.createdBy || ''
      ).run();

      context.waitUntil(backupToFirebase('overtime_entries', id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE OVERTIME ENTRY
    if (url.pathname.startsWith("/api/overtime/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM overtime_entries WHERE id = ?").bind(id).run();
      
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/overtime_entries/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ==========================================
    // FLIGHTS MODULE
    // ==========================================

    // GET ALL FLIGHTS
    if (url.pathname === "/api/flights" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM flights").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CREATE FLIGHT
    if (url.pathname === "/api/flights" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO flights (id, date, flightNo, type, aircraft, bookedFigure, checkInTime, arrivalTime, departureTime, route, originDepTime, status, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.date, body.flightNo, body.type, body.aircraft, body.bookedFigure || '', 
        body.checkInTime || '', body.arrivalTime || '', body.departureTime || '', 
        body.route || '', body.originDepTime || '', body.status, body.remarks || '', createdAt
      ).run();

      context.waitUntil(backupToFirebase('flights', id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // UPDATE FLIGHT
    if (url.pathname.startsWith("/api/flights/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date().toISOString();

      await env.DB.prepare(`
        UPDATE flights SET 
          date = ?, flightNo = ?, type = ?, aircraft = ?, bookedFigure = ?, 
          checkInTime = ?, arrivalTime = ?, departureTime = ?, route = ?, 
          originDepTime = ?, status = ?, remarks = ?, updatedAt = ?
        WHERE id = ?
      `).bind(
        body.date, body.flightNo, body.type, body.aircraft, body.bookedFigure || '', 
        body.checkInTime || '', body.arrivalTime || '', body.departureTime || '', 
        body.route || '', body.originDepTime || '', body.status, body.remarks || '', updatedAt, id
      ).run();

      context.waitUntil(backupToFirebase('flights', id!, { ...body, updatedAt }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE FLIGHT
    if (url.pathname.startsWith("/api/flights/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM flights WHERE id = ?").bind(id).run();

      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/flights/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ==========================================
    // ROSTER MODULE
    // ==========================================

    if (url.pathname === "/api/roster" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM roster_entries").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/roster" && method === "POST") {
      const body: any = await request.json();
      
      const existing: any = await env.DB.prepare("SELECT id, leaveRequestId FROM roster_entries WHERE staffId = ? AND date = ?")
        .bind(body.staffId, body.date).first();

      if (existing && existing.leaveRequestId) {
        return new Response(JSON.stringify({ message: "Cannot overwrite approved leave." }), { status: 400, headers: corsHeaders });
      }

      const id = existing ? existing.id : crypto.randomUUID();
      const createdAt = new Date().toISOString();

      if (existing) {
        await env.DB.prepare("DELETE FROM roster_entries WHERE id = ?").bind(id).run();
      }

      if (body.status !== 'clear') {
        await env.DB.prepare(`
          INSERT INTO roster_entries (id, staffId, staffName, staffDepartment, date, shiftTime, status, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, body.staffId, body.staffName, body.staffDepartment, body.date, body.shiftTime || '', body.status, createdAt
        ).run();

        context.waitUntil(backupToFirebase('roster_entries', id, body));
      }

      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/roster/bulk" && method === "POST") {
      const body: any = await request.json();
      const stmt = env.DB.prepare(`
        INSERT INTO roster_entries (id, staffId, staffName, staffDepartment, date, shiftTime, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batch = [];
      for (const entry of body.entries) {
        const id = crypto.randomUUID();
        batch.push(stmt.bind(id, entry.staffId, entry.staffName, entry.staffDepartment, entry.date, entry.shiftTime || '', entry.status, new Date().toISOString()));
        context.waitUntil(backupToFirebase('roster_entries', id, entry));
      }

      if (batch.length > 0) {
        await env.DB.batch(batch);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404, headers: corsHeaders });

  } catch (err: any) {
    return new Response(JSON.stringify({ message: err.message, stack: err.stack }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
};