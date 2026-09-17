import React, { useEffect, useState } from 'react';
import { Users, Send, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

function StatCard({ title, value, icon: Icon, colorClass, loading }: { title: string, value: string | number, icon: React.ElementType, colorClass: string, loading: boolean }) {
  return (
    <div className="bg-cyber-card border border-cyber-cyan/20 p-6 rounded-lg relative overflow-hidden group">
      <div className={`absolute -right-6 -top-6 w-24 h-24 bg-${colorClass}/5 rounded-full blur-2xl group-hover:bg-${colorClass}/10 transition-all`}></div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm text-gray-400 uppercase tracking-wider">{title}</h3>
        <Icon className={`w-5 h-5 text-${colorClass}`} />
      </div>
      {loading ? (
        <Loader2 className={`w-8 h-8 text-${colorClass} animate-spin`} />
      ) : (
        <p className={`text-3xl font-bold text-${colorClass} drop-shadow-[0_0_8px_rgba(var(--${colorClass}),0.5)]`}>
          {value}
        </p>
      )}
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [qualificados, setQualificados] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Firestore Realtime Stats isolated by authenticated account (Zero mock data rule)
  useEffect(() => {
    if (!user) {
      setTotalLeads(0);
      setQualificados(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Filter leads directly in the Firestore query by the authenticated user's ID (capturedBy)
    // Ensures the personal dashboard reflects ONLY leads captured by the logged-in account (including admin)
    const leadsQuery = query(
      collection(db, 'leads'),
      where('capturedBy', '==', user.uid)
    );

    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      // If Firestore takes more than 5s, gracefully stop spinner and show 0 or cached data
      setLoading(false);
    }, 5000);
    
    // Subscribe to isolated leads query for the authenticated account
    const unsubscribe = onSnapshot(leadsQuery, (snapshot) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setTotalLeads(snapshot.size);
      
      // Qualificados da conta logada: tem whatsapp e não tem site
      const qualis = snapshot.docs.filter(d => {
        const data = d.data();
        return data.whatsappStatus === 'ativo' && data.semSite === true;
      });
      setQualificados(qualis.length);
      setError(null);
      setLoading(false);
    }, (err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.error("Error fetching leads for dashboard:", err);
      setError(`Erro ao carregar dados: ${err.message || 'Falha de conexão'}`);
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'leads');
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          CAPTURA E FILTRO DE LEADS <span className="text-cyber-green">BY KAKE</span>
        </h1>
        <p className="text-cyber-cyan/80 text-sm md:text-base font-medium tracking-wide">
          POUPE SEU TEMPO CHAMANDO LEAD POR LEAD — DEIXE A AUTOMAÇÃO TRABALHAR PRA VOCÊ.
        </p>
      </header>

      {error && (
        <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cyber-red shrink-0 mt-0.5" />
          <p className="text-sm text-cyber-red">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Leads (DB)" value={totalLeads} icon={Users} colorClass="cyber-cyan" loading={loading} />
        <StatCard title="Oportunidades (S/ Site + WA)" value={qualificados} icon={CheckCircle} colorClass="cyber-green" loading={loading} />
        <StatCard title="Disparos Pendentes" value={0} icon={Send} colorClass="cyber-yellow" loading={loading} />
        <StatCard title="Erros de Disparo" value={0} icon={AlertTriangle} colorClass="cyber-red" loading={loading} />
      </div>

      <div className="bg-cyber-card border border-cyber-cyan/20 p-6 rounded-lg">
        <h3 className="text-lg font-bold text-white mb-6 uppercase border-b border-cyber-cyan/20 pb-4">Volume de Disparos</h3>
        <div className="h-80 w-full flex items-center justify-center border border-dashed border-cyber-cyan/20 rounded">
           <span className="text-gray-500 text-sm">AGUARDANDO DADOS DE DISPARO...</span>
        </div>
      </div>
    </div>
  );
}
