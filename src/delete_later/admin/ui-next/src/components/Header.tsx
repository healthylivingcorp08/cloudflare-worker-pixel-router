'use client'; // This component requires client-side interaction (logout)

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Assuming Shadcn UI setup

const Header: React.FC = () => {
    const router = useRouter();

    const handleLogout = () => {
        // Remove the token from localStorage
        if (typeof window !== 'undefined') {
            localStorage.removeItem('adminToken');
            console.log('Admin token removed.');
        }
        // Redirect to the login page
        router.push('/login');
    };

    return (
        <header className="flex items-center justify-between p-4 border-b bg-background">
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            <Button variant="outline" onClick={handleLogout}>
                Logout
            </Button>
        </header>
    );
};

export default Header;