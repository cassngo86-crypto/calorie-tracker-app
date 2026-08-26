import Dexie from 'dexie';

export const db = new Dexie('NutriTrackDB');
db.version(1).stores({
  meals: '++id, name, calories, timestamp', 
});