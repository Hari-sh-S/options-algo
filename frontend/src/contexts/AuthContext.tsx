"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    type User,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase";

interface AuthState {
    user: User | null;
    idToken: string | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
    user: null,
    idToken: null,
    loading: true,
    signInWithGoogle: async () => { },
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [idToken, setIdToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                const token = await firebaseUser.getIdToken();
                setIdToken(token);
            } else {
                setIdToken(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Auto-refresh token every 50 minutes (tokens expire after 60)
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(async () => {
            const token = await user.getIdToken(true);
            setIdToken(token);
        }, 50 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    const signInWithGoogle = useCallback(async () => {
        await signInWithPopup(getFirebaseAuth(), googleProvider);
    }, []);

    const signOut = useCallback(async () => {
        await firebaseSignOut(getFirebaseAuth());
        setUser(null);
        setIdToken(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, idToken, loading, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
