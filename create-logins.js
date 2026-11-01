import { neon } from '@neondatabase/serverless';

// 🚨 PASTE YOUR NEON DATABASE URL HERE
const sql = neon('postgresql://neondb_owner:npg_HZWIy6fTKJU9@ep-wispy-bread-aoe2biqc-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

async function createAccounts() {
  // Get all unique staff with an SN
  const staffList = await sql`SELECT DISTINCT name, sn FROM staff WHERE sn IS NOT NULL AND sn != ''`;
  
  console.log(`Found ${staffList.length} unique staff members. Checking logins...`);
  
  let created = 0;
  let exists = 0;
  let failed = 0;

  for (const person of staffList) {
    let snStr = person.sn.toLowerCase().trim();
    if (!snStr.startsWith('sn-')) snStr = `sn-${snStr}`;
    const loginEmail = `${snStr}@funadhooairport.com`;
    
    try {
      const res = await fetch('https://management.funadhooairport.com/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://management.funadhooairport.com' },
        body: JSON.stringify({ email: loginEmail, password: 'Fnd@2026', name: person.name })
      });
      
      const text = await res.text();
      
      if (res.ok) {
        console.log(`✅ Created: ${loginEmail}`);
        created++;
      } else if (res.status === 422 || text.includes('already exists') || text.includes('USER_ALREADY_EXISTS')) {
        console.log(`⚠️ Already exists: ${loginEmail}`);
        exists++;
      } else {
        console.log(`❌ Failed: ${loginEmail} (Status: ${res.status}) - ${text}`);
        failed++;
      }
    } catch(e) {
      console.log(`❌ Network Error for ${loginEmail}`);
      failed++;
    }
    
    // Delay to prevent Cloudflare rate-limiting
    await new Promise(r => setTimeout(r, 200)); 
  }
  
  console.log(`\n🎉 DONE! Created: ${created}, Already Existed: ${exists}, Failed: ${failed}`);
}

createAccounts();