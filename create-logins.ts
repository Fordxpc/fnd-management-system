import { getAuth } from './src/lib/auth';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './src/db/schema';
import { staff } from './src/db/schema';

// 🚨 PASTE YOUR NEON DATABASE URL HERE
const dbUrl = 'postgresql://neondb_owner:npg_HZWIy6fTKJU9@ep-wispy-bread-aoe2biqc-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function run() {
  const sql = neon(dbUrl);
  const db = drizzle(sql, { schema });

  // Create a mock environment for Better Auth
  const env = {
    DATABASE_URL: dbUrl,
    BETTER_AUTH_SECRET: 'this-is-a-32-character-secret-key-for-better-auth',
    BETTER_AUTH_URL: 'https://management.funadhooairport.com'
  };

  const auth = getAuth(env);
  
  // Fetch all staff members from Neon
  const staffList = await db.select().from(staff);
  console.log(`Found ${staffList.length} staff members in the database...`);

  let created = 0;
  let exists = 0;
  let failed = 0;

  for (const person of staffList) {
    if (!person.sn) {
      console.log(`⚠️ Skipping ${person.name} (No SN)`);
      continue;
    }

    // Format SN: ensure it starts with "sn-"
    let snStr = person.sn.toLowerCase().trim();
    if (!snStr.startsWith('sn-')) snStr = `sn-${snStr}`;
    const email = `${snStr}@funadhooairport.com`;

    try {
      // Call Better Auth directly! No internet requests needed.
      const res = await auth.api.signUpEmail({
        body: { 
          email: email, 
          password: 'Fnd@2026', 
          name: person.name || 'Staff Member' 
        }
      });
      console.log(`✅ Created: ${email}`);
      created++;
    } catch (e: any) {
      const errMsg = e.message || JSON.stringify(e);
      if (errMsg.includes('already exists') || errMsg.includes('USER_ALREADY_EXISTS')) {
        console.log(`⚠️ Already exists: ${email}`);
        exists++;
      } else {
        console.log(`❌ Failed: ${email} - ${errMsg}`);
        failed++;
      }
    }
  }

  console.log(`\n🎉 DONE! Created: ${created}, Already Existed: ${exists}, Failed: ${failed}`);
}

run();