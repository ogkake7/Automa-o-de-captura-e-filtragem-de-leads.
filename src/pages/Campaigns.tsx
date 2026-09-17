import React, { useEffect, useState } from 'react';
import { Terminal, Loader2, AlertTriangle } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

export function Campaigns() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Escutando batches recentes
    const q = query(collection(db, 'batches'), orderBy('createdAt', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const data: any[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setLogs(data);
      setError(null);
      setLoading(false);
    }, (err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.error("Error fetching batches:", err);
      setError(`Erro ao ler batches [${err.code || 'UNKNOWN'}]: ${err.message}`);
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'batches');
      } catch (e) {
        // Logged by handleFirestoreError
      }
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">SYS<span className="text-cyber-green">_CAMPAIGNS</span></h1>
        <p className="text-cyber-cyan/70">Monitoramento de disparos no Firestore.</p>
      </header>
      
      {error && (
        <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cyber-red shrink-0 mt-0.5" />
          <p className="text-sm text-cyber-red">{error}</p>
        </div>
      )}

      <div className="bg-[#05080c] border border-gray-800 rounded-lg overflow-hidden font-mono text-sm relative shadow-[0_0_20px_rgba(0,0,0,0.5)] min-h-[400px]">
        <div className="bg-gray-900/50 border-b border-gray-800 px-4 py-2 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-500" />
          <span className="text-gray-500 text-xs">WA_SERVICE_TERMINAL // DB_STREAM_ACTIVE</span>
        </div>
        
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-cyber-cyan">
             <Loader2 className="w-8 h-8 animate-spin mb-2" />
             <p className="text-sm">CONECTANDO AO STREAM...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum registro de disparo encontrado.
          </div>
        ) : (
          <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex flex-col border-b border-gray-800/50 pb-2">
                <span className="text-cyber-cyan w-48 shrink-0">BATCH: {log.id}</span>
                <span className="text-gray-500">Template ID: {log.templateId}</span>
                <span className="text-gray-500">Criado por: {log.createdBy}</span>
                <span className="text-gray-500 text-xs mt-1">Acompanhamento dos itens precisa ler subcoleção /items.</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
