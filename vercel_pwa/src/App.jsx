import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Camera, BarChart2, Plus, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [loading, setLoading] = useState(false);
  const meals = useLiveQuery(() => db.meals.toArray()) || [];
  
 
  const handleImageCapture = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = async () => {
    try {
      const base64Image = reader.result;

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Map API response keys to your meal object structure
      const newMeal = {
        name: data.food_name || 'Scanned Meal',
        calories: Number(data.calories) || 0,
        protein: Number(data.protein_g) || 0,
        carbs: Number(data.carbs_g) || 0,
        fat: Number(data.fat_g) || 0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // Save to Dexie / local state
      await db.meals.add(newMeal); 

    } catch (err) {
      console.error('Scan Error:', err);
      alert('Analysis failed. Please try again.');
    }
  };

  reader.readAsDataURL(file);
};

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col justify-between pb-16">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 text-center font-bold text-lg shadow-md">
        🥗 NutriTrack PWA
      </header>

      {/* Main Content */}
      <main className="p-4 flex-1">
        {activeTab === 'scan' && (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-2xl bg-white p-6 shadow-sm">
            {loading ? (
              <p className="text-emerald-600 font-semibold animate-pulse">Analyzing with Gemini AI...</p>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <Camera className="w-12 h-12 text-emerald-600 mb-2" />
                <span className="text-gray-600 font-medium">Tap to Take Photo or Upload</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleImageCapture} className="hidden" />
              </label>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Today's Intake</h2>
            <div className="h-64 bg-white p-4 rounded-xl shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meals}>
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="calories" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">Logged Meals</h3>
              {meals.map((m) => (
                <div key={m.id} className="bg-white p-3 rounded-lg shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{m.mealName}</p>
                    <p className="text-xs text-gray-500">{m.timestamp} - {m.calories} kcal</p>
                  </div>
                  <button onClick={() => db.meals.delete(m.id)} className="text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 flex justify-around p-3">
        <button onClick={() => setActiveTab('scan')} className={`flex flex-col items-center ${activeTab === 'scan' ? 'text-emerald-600' : 'text-gray-400'}`}>
          <Plus className="w-6 h-6" />
          <span className="text-xs mt-1">Scan</span>
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center ${activeTab === 'analytics' ? 'text-emerald-600' : 'text-gray-400'}`}>
          <BarChart2 className="w-6 h-6" />
          <span className="text-xs mt-1">Analytics</span>
        </button>
      </nav>
    </div>
  );
}