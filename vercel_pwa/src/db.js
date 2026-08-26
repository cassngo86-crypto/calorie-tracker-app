import Dexie from 'dexie';

export const db = new Dexie('NutriTrackDB');

db.version(1).stores({
  meals: '++id, name, calories, timestamp',
});

// Explicitly open the database connection on load
db.open().catch((err) => {
  console.error('Failed to open IndexedDB:', err.stack || err);
});