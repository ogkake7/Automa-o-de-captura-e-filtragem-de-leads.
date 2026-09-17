import React from 'react';
import { PhoneOff } from 'lucide-react';

export function NoWhatsApp() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">OFFLINE<span className="text-cyber-red">_LEADS</span></h1>
        <p className="text-cyber-cyan/70">Leads capturados sem WhatsApp ativo.</p>
      </header>

      <div className="bg-cyber-card border border-cyber-red/20 rounded-lg overflow-hidden">
        <div className="p-4 bg-cyber-red/5 border-b border-cyber-red/20 flex items-center gap-3">
          <PhoneOff className="text-cyber-red w-5 h-5" />
          <span className="text-sm text-cyber-red">Estes números requerem follow-up manual.</span>
        </div>
        
        <div className="p-12 text-center text-gray-500">
          (Filtro via Firestore a ser implementado)
        </div>
      </div>
    </div>
  );
}
