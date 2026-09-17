import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, AlertTriangle, X, CheckCircle } from 'lucide-react';
import { CyberButton } from '../components/CyberButton';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

interface Template {
  id: string;
  nome: string;
  texto: string;
  createdBy?: string;
}

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { role, user, getIdToken } = useAuth();

  // Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const q = query(collection(db, 'templates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      const data: Template[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Template);
      });
      setTemplates(data);
      setError(null);
      setLoading(false);
    }, (err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.error("Error fetching templates:", err);
      setError(`Erro ao ler templates [${err.code || 'UNKNOWN'}]: ${err.message}`);
      setLoading(false);
      try {
        handleFirestoreError(err, OperationType.LIST, 'templates');
      } catch (e) {
        // Logged
      }
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  // SECURE BACKEND WRITE: Delete Template
  const handleDelete = async (id: string) => {
    if (role !== 'admin') {
      alert('Apenas administradores podem excluir templates.');
      return;
    }
    if (!confirm('Deseja realmente remover este template de mensagem?')) return;

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir template');
      }
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  // SECURE BACKEND WRITE: Create Template
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newText.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nome: newTitle.trim(),
          texto: newText.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar template');
      }

      setNewTitle('');
      setNewText('');
      setIsModalOpen(false);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">MSG<span className="text-cyber-green">_TEMPLATES</span></h1>
          <p className="text-xs md:text-sm text-cyber-cyan/70">Modelos de mensagens com escrita validada no backend via Firebase Admin.</p>
        </div>
        <CyberButton 
          variant="primary" 
          onClick={() => {
            setSaveError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> NOVO TEMPLATE
        </CyberButton>
      </header>

      {error && (
        <div className="p-4 bg-cyber-red/10 border border-cyber-red/30 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cyber-red shrink-0 mt-0.5" />
          <p className="text-sm text-cyber-red">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center text-cyber-cyan p-12">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm">CARREGANDO TEMPLATES...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-cyber-card border border-cyber-cyan/20 p-8 rounded-lg text-center text-gray-500">
          Nenhum template cadastrado ainda. Clique em "NOVO TEMPLATE" para cadastrar mensagens para envio no WhatsApp.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-cyber-card border border-cyber-cyan/20 p-5 rounded-lg relative group flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-base md:text-lg font-bold text-cyber-green break-words">{tpl.nome}</h3>
                  {role === 'admin' && (
                    <button 
                      onClick={() => handleDelete(tpl.id)} 
                      className="text-gray-400 hover:text-cyber-red p-1 rounded transition-colors"
                      title="Excluir template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="bg-cyber-bg p-3.5 rounded border border-cyber-cyan/10 font-mono text-xs md:text-sm whitespace-pre-wrap text-gray-300 leading-relaxed max-h-60 overflow-y-auto">
                  {tpl.texto}
                </div>
              </div>
              <div className="mt-3 text-[11px] text-gray-500 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-cyber-green" /> Pronto para uso em disparos
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo Template */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cyber-card border border-cyber-cyan/40 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-[0_0_30px_rgba(0,255,249,0.15)]">
            <div className="flex items-center justify-between border-b border-cyber-cyan/20 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyber-green" /> CADASTRAR TEMPLATE
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveError && (
              <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded text-xs text-cyber-red">
                {saveError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-cyber-cyan block mb-1 uppercase font-bold">Título do Template:</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Prospecção Clínicas Sem Site"
                  required
                  className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-2.5 text-white text-sm focus:border-cyber-green outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-cyber-cyan block mb-1 uppercase font-bold">
                  Texto da Mensagem (use <code className="text-cyber-green">{"{nome}"}</code> para variável):
                </label>
                <textarea 
                  rows={5}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Olá {nome}, vi sua empresa no Google Maps e percebi que você ainda não possui um site otimizado..."
                  required
                  className="w-full bg-[#0d131f] border border-cyber-cyan/30 rounded p-3 text-white text-sm focus:border-cyber-green outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-cyber-cyan/20">
                <CyberButton 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </CyberButton>
                <CyberButton 
                  type="submit" 
                  variant="primary" 
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? "GRAVANDO..." : "SALVAR TEMPLATE"}
                </CyberButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
