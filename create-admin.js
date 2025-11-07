/**
 * Helper script to create the first admin account
 * Run this after deploying and initializing the database
 * 
 * Usage:
 *   node create-admin.js
 * 
 * Or set environment variables:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=password123 node create-admin.js
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { admins } from './shared/schema.js';
import readline from 'readline';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createAdmin() {
  try {
    console.log('👤 Create First Admin Account');
    console.log('============================\n');

    // Get admin details
    const email = process.env.ADMIN_EMAIL || await question('Email: ');
    const password = process.env.ADMIN_PASSWORD || await question('Password: ');
    const firstName = process.env.ADMIN_FIRST_NAME || await question('First Name: ');
    const lastName = process.env.ADMIN_LAST_NAME || await question('Last Name: ');

    if (!email || !password || !firstName || !lastName) {
      console.error('❌ All fields are required');
      process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    
    if (existingAdmin.length > 0) {
      console.error('❌ Admin with this email already exists');
      process.exit(1);
    }

    // Hash password
    console.log('\n🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    console.log('📝 Creating admin account...');
    const [newAdmin] = await db.insert(admins).values({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      createdAt: new Date(),
    }).returning();

    console.log('\n✅ Admin account created successfully!');
    console.log('=====================================');
    console.log(`Email: ${newAdmin.email}`);
    console.log(`Name: ${newAdmin.firstName} ${newAdmin.lastName}`);
    console.log(`ID: ${newAdmin.id}`);
    console.log('\n🎉 You can now log in to your app!');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    if (error.message.includes('duplicate key')) {
      console.error('   Admin with this email already exists');
    }
    process.exit(1);
  } finally {
    rl.close();
    await sql.end();
  }
}

createAdmin();

