import Dexie from 'dexie';

export const db = new Dexie('CalorieTrackerDB');

db.version(1).stores({
  meals: '++id, timestamp, date, mealName, calories, protein, carbs, fat'
});