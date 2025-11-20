import React, { useState } from 'react';
import { WeatherData, UploadedDoc } from '../types';

export const LeftPanel: React.FC = () => {
  // Mock Live Data
  const weather: WeatherData = {
    temp: 29,
    condition: 'Partly Cloudy',
    humidity: 84,
    windSpeed: 12, // km/h
    aqi: 42 // Good
  };

  const [docs, setDocs] = useState<UploadedDoc[]>([
    { id: '1', name: 'Freetown_Structure_Plan_2028.pdf', type: 'PDF', size: '4.2 MB', progress: 100 },
    { id: '2', name: 'Zoning_Ward_402.dwg', type: 'DWG', size: '12 MB', progress: 100 },
  ]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Visual simulation of drop
    const newDoc: UploadedDoc = {
        id: Date.now().toString(),
        name: 'New_Policy_Draft_v2.docx',
        type: 'DOCX',
        size: '1.1 MB',
        progress: 100
    };
    setDocs(prev => [newDoc, ...prev]);
  };

  return (
    <div className="hidden lg:flex flex-col w-80 gap-4 h-full pointer-events-auto">
      
      {/* Environment Widget - Very Transparent */}
      <div className="glass-panel rounded-xl p-4 relative overflow-hidden group hover:border-white/20 transition-colors backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-1 h-full bg-freetown-green/50"></div>
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-display font-bold uppercase text-freetown-green tracking-widest">Live Environment</h3>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        </div>
        
        <div className="flex items-center justify-between mb-4">
            <div>
                <span className="text-4xl font-display font-light text-white drop-shadow-lg">{weather.temp}°</span>
                <span className="text-sm text-gray-400 block shadow-black">{weather.condition}</span>
            </div>
            <div className="text-right">
                 <div className="text-freetown-blue font-mono text-xs shadow-black">HUM: {weather.humidity}%</div>
                 <div className="text-freetown-blue font-mono text-xs shadow-black">WND: {weather.windSpeed}kph</div>
                 <div className="text-green-400 font-mono text-xs shadow-black">AQI: {weather.aqi}</div>
            </div>
        </div>
        
        <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
            <div className="bg-gradient-to-r from-freetown-green to-freetown-blue h-1.5 rounded-full" style={{width: '65%'}}></div>
        </div>
        <p className="text-[10px] text-gray-500 mt-2 text-right">Station: Tower Hill</p>
      </div>

      {/* Document Upload Zone */}
      <div 
        className="flex-1 glass-panel rounded-xl p-4 flex flex-col backdrop-blur-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-display font-bold uppercase text-freetown-blue tracking-widest">Dataset Ingestion</h3>
        </div>

        {/* Drop Area */}
        <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-freetown-blue/50 hover:bg-freetown-blue/5 transition-all cursor-pointer mb-4 group bg-black/5">
            <svg className="w-8 h-8 text-gray-500 mx-auto mb-2 group-hover:text-freetown-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xs text-gray-400">Drag Technical Docs</p>
            <p className="text-[9px] text-gray-600 mt-1">PDF, DWG, CSV, SHP</p>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {docs.map(doc => (
                <div key={doc.id} className="bg-black/5 p-2 rounded border border-white/5 flex items-center gap-3 group hover:border-white/20 transition-colors cursor-pointer hover:bg-black/10">
                    <div className="w-8 h-8 rounded bg-freetown-blue/10 flex items-center justify-center text-[10px] text-freetown-blue font-bold">
                        {doc.type}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate group-hover:text-white shadow-black">{doc.name}</p>
                        <p className="text-[10px] text-gray-600">{doc.size} • Synced</p>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-freetown-green"></div>
                </div>
            ))}
        </div>

        <div className="mt-4 pt-3 border-t border-white/10">
             <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-300 transition-colors flex items-center justify-center gap-2">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                Manage Notion Database
             </button>
        </div>
      </div>
    </div>
  );
};