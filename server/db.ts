import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with proper settings for Neon/Supabase
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 0, // Don't close idle connections (let Neon manage this)
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
  maxUses: 7500, // Close (and replace) a connection after it has been used this many times
  allowExitOnIdle: false, // Don't exit the process when the pool is idle
});

// Handle pool errors gracefully
pool.on('error', (err: any, client: any) => {
  // Only log unexpected errors, not normal connection terminations
  if (!err.message?.includes('db_termination') && !err.message?.includes('shutdown')) {
    console.error('Unexpected error on idle database client:', err.message || err);
  }
  // Don't throw, just log - the pool will create a new connection
});

// Log only important events (not every connection)
pool.on('connect', () => {
  // Only log first connection or after errors - too verbose otherwise
});

pool.on('acquire', () => {
  // Don't log - too verbose for normal operation
});

pool.on('release', (err: any, client: any) => {
  if (err && !err.message?.includes('db_termination')) {
    console.error('Error releasing database client:', err.message || err);
  }
});

export const db = drizzle({ client: pool, schema });