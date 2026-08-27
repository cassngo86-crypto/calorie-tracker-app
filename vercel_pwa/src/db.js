import Dexie from 'dexie';

export const db = new Dexie('NutriTrackDB');

// Define table schema
db.version(1).stores({
  meals: '++id, name, calories, timestamp',
});

// Auto-recovery if database is locked or corrupted
db.open().catch(async (err) => {
  console.warn('Database initialization issue detected. Resetting...', err);
  await db.delete();
  await db.open();
});