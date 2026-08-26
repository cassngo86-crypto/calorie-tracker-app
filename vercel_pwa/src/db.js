import Dexie from 'dexie';

export const db = new Dexie('NutriTrackDB');

db.version(1).stores({
  meals: '++id, name, calories, timestamp',
});

// Auto-open and catch version/lock conflicts
db.open().catch(async (err) => {
  console.error('Failed to open NutriTrackDB, recreating...', err);
  await db.delete();
  await db.open();
});