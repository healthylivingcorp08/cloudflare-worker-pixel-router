'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { login } from '@/lib/api';
import { toast } from "sonner"; // Import toast from sonner

export default function LoginPage() {
    const router = useRouter();
    // No need for useToast hook with sonner
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await login(username, password);
            // Assuming the API returns { success: true, data: { token: '...' } } on success
            if (response && response.data?.token) {
                localStorage.setItem('adminToken', response.data.token);
                toast.success("Login Successful", { // Use sonner's success toast
                    description: "Redirecting to dashboard...",
                });
                // Redirect to the base path which AuthWrapper will handle
                // The base path is proxied from /admin in the worker
                router.push('/');
            } else {
                // Handle cases where login API succeeds (200 OK) but doesn't return a token (shouldn't happen with current worker logic)
                const errMsg = 'Login failed: Invalid response from server.';
                setError(errMsg);
                toast.error("Login Failed", { // Use sonner's error toast
                    description: errMsg,
                });
            }
        } catch (err: any) {
            console.error("Login error:", err);
            const errorMessage = err.message || 'An unexpected error occurred.';
            setError(`Login failed: ${errorMessage}`);
            toast.error("Login Failed", { // Use sonner's error toast
                 description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Admin Login</CardTitle>
                    <CardDescription>
                        Enter your username and password to access the admin panel.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="admin"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        {error && (
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Logging in...' : 'Login'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}