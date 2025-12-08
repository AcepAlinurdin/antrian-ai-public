import React from 'react';
import { Wrench } from 'lucide-react';

const MechanicStatus = ({ activeMechanics }) => (
  <div className="grid grid-cols-2 gap-4 mb-6">
    {[1, 2].map(num => (
      <div key={num} className={`p-3 rounded border flex items-center gap-3 transition-colors ${activeMechanics >= num ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-800 border-slate-700 opacity-50'}`}>
        <Wrench size={20} className={activeMechanics >= num ? "text-blue-400" : "text-slate-500"} />
        <span className="text-sm font-bold">{activeMechanics >= num ? `Mekanik ${num} Sibuk` : `Mekanik ${num} Ready`}</span>
      </div>
    ))}
  </div>
);

export default MechanicStatus;