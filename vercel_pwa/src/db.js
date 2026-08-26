import Dexie from 'dexie';

export const db = new Dexie('NutriTrackDB');

db.version(1).stores({
  meals: '++id, name, calories, timestamp',
});

// Force database creation immediately upon import
db.open()
  .then(() => console.log('NutriTrackDB successfully opened/created.'))
  .catch((err) => console.error('IndexedDB opening error:', err));