import Dexie from 'dexie';

export const db = new Dexie('NutriTrackDB');

// Version 2 forces creation of the meals store
db.version(2).stores({
  meals: '++id, name, calories, timestamp',
});

db.open().catch((err) => {
  console.error('Dexie open error:', err);
});