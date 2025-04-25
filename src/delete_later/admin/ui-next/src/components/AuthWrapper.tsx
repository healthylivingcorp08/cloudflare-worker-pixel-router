'use client'; // This component needs to run on the client

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import React from 'react';

interface AuthWrapperProps {
    children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // Use null to indicate loading state

    useEffect(() => {
        // Check for token only on the client-side
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('adminToken');
            if (!token) {
                console.log('AuthWrapper: No token found, redirecting to login.');
                router.push('/login');
            } else {
                // Optional: Add an API call here to validate the token on the server
                // If validation fails, clear token and redirect:
                // localStorage.removeItem('adminToken');
                // router.push('/login');
                // For now, just presence of token is enough
                setIsAuthenticated(true);
            }
        }
    }, [router]); // Dependency array includes router

    // Render children only if authenticated, otherwise render null or a loading indicator
    // This prevents flashing the protected content before the redirect happens
    if (isAuthenticated === null) {
        // Optional: Render a loading spinner or skeleton screen
        return null; // Or <LoadingSpinner />;
    }

    // If authenticated, render the children components
    return <>{children}</>;
};

export default AuthWrapper;