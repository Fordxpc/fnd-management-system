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

export const onRequest = async (context: any) => {
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

    if (url.pathname.startsWith("/api/staff/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date().toISOString();

      await env.DB.prepare(`
        UPDATE staff SET 
          sn = ?, name = ?, email = ?, personalEmail = ?, nid = ?, joinDate = ?, 
          phone = ?, gender = ?, department = ?, position = ?, isSMT = ?, 
          balanceVisible = ?, notes = ?, basicSalary = ?, dailyAllowance = ?, 
          holidayAllowanceRate = ?, bankAccount = ?, updatedAt = ?
        WHERE id = ?
      `).bind(
        body.sn || '', body.name, body.email, body.personalEmail || '', 
        body.nid || '', body.joinDate || '', body.phone || '', body.gender || '',
        body.department, body.position || '', body.isSMT ? 1 : 0, body.balanceVisible ? 1 : 0, 
        body.notes || '', body.basicSalary || 0, body.dailyAllowance || 0, 
        body.holidayAllowanceRate || 0, body.bankAccount || '', updatedAt, id
      ).run();

      context.waitUntil(backupToFirebase('staff', id!, { ...body, updatedAt }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/staff/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/staff/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/staff/reorder" && method === "PUT") {
      const body: any = await request.json();
      const stmt = env.DB.prepare("UPDATE staff SET orderIndex = ? WHERE id = ?");
      const batch = body.orderedIds.map((id: string, index: number) => stmt.bind(index, id));
      if (batch.length > 0) await env.DB.batch(batch);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // HOLIDAYS MODULE
    // ==========================================
    if (url.pathname === "/api/holidays" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM holidays ORDER BY date ASC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/holidays" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO holidays (id, date, name, createdAt) VALUES (?, ?, ?, ?)`).bind(id, body.date, body.name, createdAt).run();
      context.waitUntil(backupToFirebase('holidays', id, { date: body.date, name: body.name, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
      const formattedResults = results.map((row: any) => ({ ...row, staffIsSMT: row.staffIsSMT === 1 }));
      return new Response(JSON.stringify(formattedResults), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/leave-requests" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const requestedAt = new Date().toISOString();
      const finalStatus = body.status || 'pending';

      await env.DB.prepare(`
        INSERT INTO leave_requests (id, staffId, staffName, staffDepartment, staffSN, staffGender, staffIsSMT, leaveType, startDate, endDate, days, reason, status, requestedAt, requestedBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.staffId, body.staffName, body.staffDepartment, body.staffSN || '', body.staffGender || '', body.staffIsSMT ? 1 : 0,
        body.leaveType, body.startDate, body.endDate, body.days, body.reason || '', finalStatus, requestedAt, body.requestedBy || ''
      ).run();

      context.waitUntil(backupToFirebase('leave_requests', id, { ...body, status: finalStatus, requestedAt }));
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
        const staffRec: any = await env.DB.prepare("SELECT id FROM staff WHERE name = ?").bind(reqData.staffName).first();
        const actualStaffId = staffRec ? staffRec.id : reqData.staffId;

        const start = new Date(reqData.startDate + 'T00:00:00');
        const end = new Date(reqData.endDate + 'T00:00:00');
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          await env.DB.prepare("DELETE FROM roster_entries WHERE staffId = ? AND date = ?").bind(actualStaffId, dateStr).run();
          await env.DB.prepare(`
            INSERT INTO roster_entries (id, staffId, staffName, staffDepartment, date, shiftTime, status, leaveRequestId, createdAt)
            VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)
          `).bind(crypto.randomUUID(), actualStaffId, reqData.staffName, reqData.staffDepartment, dateStr, reqData.leaveType, id, new Date().toISOString()).run();
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
    // ROSTER MODULE
    // ==========================================
    if (url.pathname === "/api/roster" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM roster_entries").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/roster" && method === "POST") {
      const body: any = await request.json();
      const existing: any = await env.DB.prepare("SELECT id, leaveRequestId FROM roster_entries WHERE staffId = ? AND date = ?").bind(body.staffId, body.date).first();
      if (existing && existing.leaveRequestId) {
        return new Response(JSON.stringify({ message: "Cannot overwrite approved leave." }), { status: 400, headers: corsHeaders });
      }
      const id = existing ? existing.id : crypto.randomUUID();
      const createdAt = new Date().toISOString();
      if (existing) await env.DB.prepare("DELETE FROM roster_entries WHERE id = ?").bind(id).run();
      if (body.status !== 'clear') {
        await env.DB.prepare(`
          INSERT INTO roster_entries (id, staffId, staffName, staffDepartment, date, shiftTime, status, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.staffId, body.staffName, body.staffDepartment, body.date, body.shiftTime || '', body.status, createdAt).run();
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
      if (batch.length > 0) await env.DB.batch(batch);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // FLIGHTS MODULE
    // ==========================================
    if (url.pathname === "/api/flights" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM flights").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/flights" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO flights (id, date, flightNo, type, aircraft, bookedFigure, checkInTime, arrivalTime, departureTime, route, originDepTime, status, remarks, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, body.date, body.flightNo, body.type, body.aircraft, body.bookedFigure || '', body.checkInTime || '', body.arrivalTime || '', body.departureTime || '', body.route || '', body.originDepTime || '', body.status, body.remarks || '', createdAt).run();
      context.waitUntil(backupToFirebase('flights', id, { ...body, createdAt }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/flights/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      const updatedAt = new Date().toISOString();
      await env.DB.prepare(`
        UPDATE flights SET date = ?, flightNo = ?, type = ?, aircraft = ?, bookedFigure = ?, checkInTime = ?, arrivalTime = ?, departureTime = ?, route = ?, originDepTime = ?, status = ?, remarks = ?, updatedAt = ? WHERE id = ?
      `).bind(body.date, body.flightNo, body.type, body.aircraft, body.bookedFigure || '', body.checkInTime || '', body.arrivalTime || '', body.departureTime || '', body.route || '', body.originDepTime || '', body.status, body.remarks || '', updatedAt, id).run();
      context.waitUntil(backupToFirebase('flights', id!, { ...body, updatedAt }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/flights/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM flights WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/flights/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // SETTINGS & USERS MODULE
    // ==========================================
    if (url.pathname === "/api/settings/ot_rules" && method === "GET") {
      const rule: any = await env.DB.prepare("SELECT * FROM settings WHERE id = 'ot_rules'").first();
      if (rule) rule.deductLeaves = JSON.parse(rule.deductLeaves || '[]');
      return new Response(JSON.stringify(rule || { adminHours: 40, regularHours: 48, deductLeaves: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/settings/ot_rules" && method === "POST") {
      const body: any = await request.json();
      await env.DB.prepare(`
        INSERT INTO settings (id, adminHours, regularHours, deductLeaves) VALUES ('ot_rules', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET adminHours = excluded.adminHours, regularHours = excluded.regularHours, deductLeaves = excluded.deductLeaves
      `).bind(body.adminHours, body.regularHours, JSON.stringify(body.deductLeaves)).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/users" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM users").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/users/sync" && method === "POST") {
      const body: any = await request.json();
      const existing: any = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(body.email).first();
      if (existing) {
        await env.DB.prepare(`UPDATE users SET role = ?, department = ?, name = ?, position = ? WHERE email = ?`).bind(body.role, body.department, body.name || '', body.position || '', body.email).run();
      } else {
        await env.DB.prepare(`INSERT INTO users (id, email, role, department, name, position) VALUES (?, ?, ?, ?, ?, ?)`).bind(body.uid, body.email, body.role, body.department, body.name || '', body.position || '').run();
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/users/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      await env.DB.prepare(`UPDATE users SET role = ?, department = ?, name = ?, position = ? WHERE id = ?`)
        .bind(body.role, body.department, body.name || '', body.position || '', id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/users/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // CREATE FIREBASE AUTH USER & PRE-REGISTER
    // ==========================================
    if (url.pathname === "/api/users/create-auth" && method === "POST") {
      const body: any = await request.json();
      const { email, password, role, department, name, position } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({ message: "Email and password are required" }), { status: 400, headers: corsHeaders });
      }

      // Check if user is already ACTIVE in our system
      const activeUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
      if (activeUser) {
        return new Response(JSON.stringify({ message: "This user is already active in the system." }), { status: 400, headers: corsHeaders });
      }

      // Try to create in Firebase Auth
      const firebaseUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`;
      const firebaseRes = await fetch(firebaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: false })
      });

      const firebaseData: any = await firebaseRes.json();

      if (firebaseData.error) {
        if (firebaseData.error.message === 'EMAIL_EXISTS') {
          // User exists in Firebase but not active in our DB. 
          // We will just add them to the pre-registration list.
          const id = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT OR REPLACE INTO user_presets (id, email, role, department, name, position, createdAt, createdBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, email, role, department, name || '', position || '', new Date().toISOString(), 'Admin Panel').run();

          return new Response(JSON.stringify({ success: true, message: "Existing Firebase user added to pre-registrations." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        let msg = firebaseData.error.message;
        if (msg === 'WEAK_PASSWORD : Password should be at least 6 characters') msg = 'Password must be at least 6 characters.';
        return new Response(JSON.stringify({ message: msg }), { status: 400, headers: corsHeaders });
      }

      // If Firebase creation was successful, save to D1
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT OR REPLACE INTO user_presets (id, email, role, department, name, position, createdAt, createdBy) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, email, role, department, name || '', position || '', new Date().toISOString(), 'Admin Panel'
      ).run();

      return new Response(JSON.stringify({ success: true, id, message: "User created and pre-registered." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // USER PRESETS MODULE
    // ==========================================
    if (url.pathname === "/api/user-presets" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM user_presets").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/user-presets" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT OR REPLACE INTO user_presets (id, email, role, department, name, position, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, body.email, body.role, body.department, body.name || '', body.position || '', new Date().toISOString(), body.createdBy || '').run();
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/user-presets/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      await env.DB.prepare(`UPDATE user_presets SET role = ?, department = ?, name = ?, position = ? WHERE id = ?`)
        .bind(body.role, body.department, body.name || '', body.position || '', id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/user-presets/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM user_presets WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // OVERTIME MODULE
    // ==========================================
    if (url.pathname === "/api/overtime" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM overtime_entries ORDER BY date DESC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/overtime" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO overtime_entries (id, staffId, staffName, staffSN, staffDepartment, date, startTime, endTime, hours, notes, status, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).bind(id, body.staffId, body.staffName, body.staffSN || '', body.staffDepartment, body.date, body.startTime, body.endTime, body.hours, body.notes || '', new Date().toISOString(), body.createdBy || '').run();
      context.waitUntil(backupToFirebase('overtime_entries', id, { ...body, status: 'pending' }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/overtime/") && method === "PUT" && !url.pathname.endsWith("/approve") && !url.pathname.endsWith("/reject")) {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      await env.DB.prepare(`
        UPDATE overtime_entries SET date = ?, startTime = ?, endTime = ?, hours = ?, notes = ? WHERE id = ?
      `).bind(body.date, body.startTime, body.endTime, body.hours, body.notes || '', id).run();
      context.waitUntil(backupToFirebase('overtime_entries', id!, body));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/overtime/") && url.pathname.endsWith("/approve") && method === "PUT") {
      const id = url.pathname.split("/")[3];
      const body: any = await request.json();
      await env.DB.prepare(`UPDATE overtime_entries SET status = 'approved', reviewedBy = ?, reviewedAt = ? WHERE id = ?`)
        .bind(body.reviewedBy, new Date().toISOString(), id).run();
      context.waitUntil(backupToFirebase('overtime_entries', id, { status: 'approved', reviewedBy: body.reviewedBy }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/overtime/") && url.pathname.endsWith("/reject") && method === "PUT") {
      const id = url.pathname.split("/")[3];
      const body: any = await request.json();
      await env.DB.prepare(`UPDATE overtime_entries SET status = 'rejected', reviewedBy = ?, reviewedAt = ? WHERE id = ?`)
        .bind(body.reviewedBy, new Date().toISOString(), id).run();
      context.waitUntil(backupToFirebase('overtime_entries', id, { status: 'rejected', reviewedBy: body.reviewedBy }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/overtime/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM overtime_entries WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/overtime_entries/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // OPS BOARD MODULE
    // ==========================================
    if (url.pathname === "/api/ops/runway" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ops_runway_history ORDER BY createdAt DESC LIMIT 200").all();
      const formatted = results.map((row: any) => ({ ...row, rwy19: JSON.parse(row.rwy19 || '[]'), rwy01: JSON.parse(row.rwy01 || '[]'), lights: JSON.parse(row.lights || '[]') }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/ops/runway" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO ops_runway_history (id, date, time, createdAt, rwy19, rwy01, lights) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, body.date, body.time, new Date().toISOString(), JSON.stringify(body.rwy19), JSON.stringify(body.rwy01), JSON.stringify(body.lights)).run();
      context.waitUntil(backupToFirebase('ops_runway_history', id, body));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/ops/ground" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ops_ground_history ORDER BY createdAt DESC LIMIT 200").all();
      const formatted = results.map((row: any) => ({ ...row, assignments: JSON.parse(row.assignments || '{}') }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/ops/ground" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO ops_ground_history (id, date, time, createdAt, assignments) VALUES (?, ?, ?, ?, ?)`).bind(id, body.date, body.time, new Date().toISOString(), JSON.stringify(body.assignments)).run();
      context.waitUntil(backupToFirebase('ops_ground_history', id, body));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/fod" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM fod_collections ORDER BY date DESC LIMIT 200").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/fod" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO fod_collections (id, date, grams, remarks, loggedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, body.date, body.grams, body.remarks, body.loggedBy || '', new Date().toISOString()).run();
      context.waitUntil(backupToFirebase('fod_collections', id, { ...body }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/fod/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM fod_collections WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/fod_collections/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // WILDLIFE MODULE
    // ==========================================
    if (url.pathname === "/api/wildlife" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM bird_counts ORDER BY createdAt DESC").all();
      const formatted = results.map((row: any) => ({ ...row, rows: JSON.parse(row.rows || '[]') }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/wildlife" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO bird_counts (id, date, refNo, wind, temp, cloud, rain, startTime, endTime, rows, observer, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, body.date, body.refNo, body.wind || '', body.temp || '', body.cloud || '', body.rain || 'N', body.startTime || '', body.endTime || '', JSON.stringify(body.rows), body.observer || '', new Date().toISOString()).run();
      context.waitUntil(backupToFirebase('bird_counts', id, { ...body }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/wildlife/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM bird_counts WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/bird_counts/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // RAMP CHECK MODULE
    // ==========================================
    if (url.pathname === "/api/ramp/draft" && method === "GET") {
      const row: any = await env.DB.prepare("SELECT payload FROM ramp_live_draft WHERE id = 'current'").first();
      return new Response(JSON.stringify(row ? JSON.parse(row.payload) : {}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/ramp/draft" && method === "POST") {
      const body: any = await request.json();
      await env.DB.prepare(`INSERT INTO ramp_live_draft (id, payload) VALUES ('current', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`).bind(JSON.stringify(body)).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/ramp/reports" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM ramp_inspections ORDER BY date DESC, createdAt DESC").all();
      const formatted = results.map((row: any) => ({ ...JSON.parse(row.payload), id: row.id, date: row.date, fltNo: row.fltNo, acReg: row.acReg, createdAt: row.createdAt, updatedAt: row.updatedAt }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/ramp/reports" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      
      await env.DB.prepare(`
        INSERT INTO ramp_inspections (id, date, fltNo, acReg, payload, createdAt) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, body.date || '', body.fltNo || '', body.acReg || '', JSON.stringify(body), new Date().toISOString()).run();

      if (body.fltNo && body.date) {
        let newStatus = 'Scheduled';
        if (body.atd) newStatus = 'Departed';
        else if (body.ata) newStatus = 'Landed';
        else if (body.eta) newStatus = 'Departed (Origin)';

        await env.DB.prepare(`
          UPDATE flights 
          SET status = ?, eta = ?, ata = ?, atd = ? 
          WHERE TRIM(UPPER(flightNo)) = TRIM(UPPER(?)) AND date = ?
        `).bind(newStatus, body.eta || null, body.ata || null, body.atd || null, body.fltNo, body.date).run();
      }

      context.waitUntil(backupToFirebase('ramp_inspections', id, { ...body }));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/ramp/reports/") && method === "PUT") {
      const id = url.pathname.split("/").pop();
      const body: any = await request.json();
      
      await env.DB.prepare(`
        UPDATE ramp_inspections 
        SET date = ?, fltNo = ?, acReg = ?, payload = ?, updatedAt = ? 
        WHERE id = ?
      `).bind(body.date || '', body.fltNo || '', body.acReg || '', JSON.stringify(body), new Date().toISOString(), id).run();

      if (body.fltNo && body.date) {
        let newStatus = 'Scheduled';
        if (body.atd) newStatus = 'Departed';
        else if (body.ata) newStatus = 'Landed';
        else if (body.eta) newStatus = 'Departed (Origin)';

        await env.DB.prepare(`
          UPDATE flights 
          SET status = ?, eta = ?, ata = ?, atd = ? 
          WHERE TRIM(UPPER(flightNo)) = TRIM(UPPER(?)) AND date = ?
        `).bind(newStatus, body.eta || null, body.ata || null, body.atd || null, body.fltNo, body.date).run();
      }

      context.waitUntil(backupToFirebase('ramp_inspections', id!, { ...body }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/ramp/reports/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM ramp_inspections WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/ramp_inspections/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // TIMESHEET / ATTENDANCE MODULE
    // ==========================================
    if (url.pathname === "/api/timesheets" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM timesheets ORDER BY date DESC, clockIn DESC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/timesheets" && method === "POST") {
      const body: any = await request.json();
      const existing: any = await env.DB.prepare("SELECT id FROM timesheets WHERE staffId = ? AND date = ?").bind(body.staffId, body.date).first();
      if (existing) {
        await env.DB.prepare(`UPDATE timesheets SET clockIn = ?, clockOut = ?, status = ?, notes = ? WHERE id = ?`).bind(body.clockIn, body.clockOut, body.status, body.notes || '', existing.id).run();
        context.waitUntil(backupToFirebase('timesheets', existing.id, body));
        return new Response(JSON.stringify({ success: true, id: existing.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO timesheets (id, staffId, staffName, staffDepartment, date, clockIn, clockOut, status, notes, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.staffId, body.staffName, body.staffDepartment, body.date, body.clockIn || '', body.clockOut || '', body.status || 'Present', body.notes || '', new Date().toISOString()).run();
        context.waitUntil(backupToFirebase('timesheets', id, body));
        return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (url.pathname.startsWith("/api/timesheets/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM timesheets WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/timesheets/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // TEMPORARY ACCESS MODULE
    // ==========================================
    if (url.pathname === "/api/temp-access" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM temp_access").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/temp-access" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO temp_access (id, email, targetDept, startDate, endDate) VALUES (?, ?, ?, ?, ?)`)
        .bind(id, body.email, body.targetDept, body.startDate, body.endDate).run();
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/temp-access/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM temp_access WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // LIGHTS INSPECTORS MODULE
    // ==========================================
    if (url.pathname === "/api/lights-inspectors" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM lights_inspectors").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/lights-inspectors" && method === "POST") {
      const body: any = await request.json();
      await env.DB.prepare(`INSERT OR REPLACE INTO lights_inspectors (staffId, staffName, staffSN) VALUES (?, ?, ?)`)
        .bind(body.staffId, body.staffName, body.staffSN || '').run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/lights-inspectors/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM lights_inspectors WHERE staffId = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // BIRDSTRIKE REPORT MODULE
    // ==========================================
    if (url.pathname === "/api/birdstrikes" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM bird_strikes ORDER BY date DESC, time DESC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/birdstrikes" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      
      await env.DB.prepare(`
        INSERT INTO bird_strikes (
          id, reportNo, date, time, reporterName, contactNo, organization, email, 
          category, occurrenceType, birdSize, place, metConditions, peopleInvolved, 
          aircraftInfo, explanation, correctiveAction, submittedBy, designation, photoBase64, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.reportNo, body.date, body.time, body.reporterName, body.contactNo, body.organization, body.email,
        body.category, body.occurrenceType, body.birdSize, body.place, body.metConditions, JSON.stringify(body.peopleInvolved),
        JSON.stringify(body.aircraftInfo), body.explanation, body.correctiveAction, body.submittedBy, body.designation, body.photoBase64 || '', new Date().toISOString()
      ).run();

      context.waitUntil(backupToFirebase('bird_strikes', id, body));
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/birdstrikes/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM bird_strikes WHERE id = ?").bind(id).run();
      context.waitUntil(fetch(`https://firestore.googleapis.com/v1/projects/fnd-ops-management/databases/(default)/documents/bird_strikes/${id}?key=AIzaSyAOP4-blrEyJJpvXwLcrNCaKZAyKCB9NxU`, { method: 'DELETE' }));
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================================
    // RUNWAY LIGHTS MODULE
    // ==========================================
    if (url.pathname === "/api/lights" && method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM rwy_lights ORDER BY date DESC").all();
      const formatted = results.map((row: any) => ({ ...row, data: JSON.parse(row.data || '{}') }));
      return new Response(JSON.stringify(formatted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/lights" && method === "POST") {
      const body: any = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO rwy_lights (id, date, time, weather, inspectorName, data, remarks, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, body.date, body.time || '', body.weather || '', body.inspectorName, JSON.stringify(body.data), body.remarks || '', new Date().toISOString()).run();
      return new Response(JSON.stringify({ success: true, id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname.startsWith("/api/lights/") && method === "DELETE") {
      const id = url.pathname.split("/").pop();
      await env.DB.prepare("DELETE FROM rwy_lights WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404, headers: corsHeaders });

  } catch (err: any) {
    return new Response(JSON.stringify({ message: err.message, stack: err.stack }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
};