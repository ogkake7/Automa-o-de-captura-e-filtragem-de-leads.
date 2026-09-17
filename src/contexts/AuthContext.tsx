import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut, sendEmailVerification } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { registerDeviceFingerprint } from '../lib/fingerprint';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'vendedor' | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  isEmailVerified: boolean;
  sendVerificationEmail: () => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  error: null,
  signOut: async () => {},
  getIdToken: async () => null,
  isEmailVerified: false,
  sendVerificationEmail: async () => ({ success: false, message: '' }),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'vendedor' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(true);
  };

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;
    let authTimeout: NodeJS.Timeout | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Fail-safe timeout to never trap the user in an infinite loading state
        authTimeout = setTimeout(() => {
          setLoading(false);
        }, 5000);

        const emailLower = (firebaseUser.email || '').toLowerCase();
        const isBootstrappedAdmin = emailLower === 'kaiquelcorrea@gmail.com';

        // Direct client write to teamUsers to ensure profile document exists
        try {
          const userDocRef = doc(db, 'teamUsers', firebaseUser.uid);
          setDoc(userDocRef, {
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            role: isBootstrappedAdmin ? 'admin' : 'vendedor',
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(err => {
            console.warn("[AUTH] Could not setDoc teamUsers:", err);
          });
        } catch (e) {
          console.warn("[AUTH] setDoc error:", e);
        }

        // Notify backend to securely sync profile and register device fingerprint
        try {
          const token = await firebaseUser.getIdToken();
          fetch('/api/auth/sync-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }).catch(e => console.warn('[AUTH] sync-profile warning:', e));

          // Registrar fingerprint de dispositivo para combate a abuso e contas descartáveis
          registerDeviceFingerprint(token).catch(e => console.warn('[AUTH] fingerprint registration error:', e));
        } catch (syncErr) {
          console.warn('[AUTH] token fetch error:', syncErr);
        }

        // Listen to role changes in Firestore (Read-only on client)
        const userDocRef = doc(db, 'teamUsers', firebaseUser.uid);
        
        if (unsubDoc) unsubDoc();

        unsubDoc = onSnapshot(userDocRef, (docSnap) => {
          if (authTimeout) clearTimeout(authTimeout);
          if (docSnap.exists()) {
            setRole(docSnap.data().role as 'admin' | 'vendedor');
            setError(null);
          } else if (isBootstrappedAdmin) {
            setRole('admin');
            setError(null);
          } else {
            setRole('vendedor');
            setError(null);
          }
          setLoading(false);
        }, (err) => {
          if (authTimeout) clearTimeout(authTimeout);
          console.error("Error fetching user role:", err);
          setRole(isBootstrappedAdmin ? 'admin' : 'vendedor');
          setError(null);
          setLoading(false);
        });
      } else {
        if (authTimeout) clearTimeout(authTimeout);
        setUser(null);
        setRole(null);
        setError(null);
        setLoading(false);
        if (unsubDoc) {
          unsubDoc();
          unsubDoc = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubDoc) unsubDoc();
      if (authTimeout) clearTimeout(authTimeout);
    };
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
    } catch (err: any) {
      console.error("Erro ao deslogar:", err);
    }
  };

  const sendVerificationEmail = async (): Promise<{ success: boolean; message: string }> => {
    if (!auth.currentUser) {
      return { success: false, message: 'Nenhum usuário logado.' };
    }
    try {
      await sendEmailVerification(auth.currentUser);
      return { success: true, message: 'E-mail de verificação enviado! Verifique sua caixa de entrada e spam.' };
    } catch (err: any) {
      console.error("Erro ao enviar e-mail de verificação:", err);
      return { success: false, message: err.message || 'Erro ao enviar e-mail de verificação.' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      role, 
      loading, 
      error, 
      signOut, 
      getIdToken,
      isEmailVerified: !!user?.emailVerified,
      sendVerificationEmail
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
