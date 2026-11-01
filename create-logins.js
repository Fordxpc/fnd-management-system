import { neon } from '@neondatabase/serverless';

// 🚨 PASTE YOUR NEON DATABASE URL HERE
const sql = neon('postgresql://neondb_owner:npg_HZWIy6fTKJU9@ep-wispy-bread-aoe2biqc-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');

async function createAccounts() {
  // Get staff with an SN
  const staffList = await sql`SELECT name, sn FROM staff WHERE sn IS NOT NULL AND sn != ''`;
  
  console.log(`Found ${staffList.length} staff members. Generating logins...`);
  
  let success = 0;
  let exists = 0;
  let failed = 0;

  for (const person of staffList) {
    // Format SN: ensure it starts with "sn-" and preserves leading zeros
    let snStr = person.sn.toLowerCase().trim();
    if (!snStr.startsWith('sn-')) {
      snStr = `sn-${snStr}`;
    }
    
    // Final email format: sn-0729@funadhooairport.com
    const loginEmail = `${snStr}@funadhooairport.com`;
    
    try {
      const res = await fetch('https://management.funadhooairport.com/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Origin': 'https://management.funadhooairport.com' 
        },
        body: JSON.stringify({ 
          email: loginEmail, 
          password: 'Fnd@2026', 
          name: person.name 
        })
      });
      
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { data = { message: text }; }
      
      if (res.ok) {
        console.log(`✅ Created: ${loginEmail}`);
        success++;
      } else if (data.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
        console.log(`⚠️ Already exists: ${loginEmail}`);
        exists++;
      } else {
        console.log(`❌ Failed: ${loginEmail} - ${data.message}`);
        failed++;
      }
    } catch(e) {
      console.log(`❌ Network Error for ${loginEmail}:`, e.message);
      failed++;
    }
    
    // Add a small delay to prevent Cloudflare rate-limiting
    await new Promise(r => setTimeout(r, 100)); 
  }
  
  console.log(`\n🎉 DONE! Created: ${success}, Already Existed: ${exists}, Failed: ${failed}`);
  console.log(`All staff can now log in with email: sn-XXXX@funadhooairport.com and password: Fnd@2026`);
}

createAccounts();