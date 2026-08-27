import Dexie from 'dexie';

// Match exact DB name visible in DevTools
export const db = new Dexie('CalorieTrackerDB');

db.version(10).stores({
  meals: '++id, name, calories, timestamp',
});

db.open().catch((err) => console.error('Dexie open error:', err));