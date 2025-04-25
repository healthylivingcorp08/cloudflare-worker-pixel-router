'use client';

import React, { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
// Removed unused Button import
import { toast } from 'sonner'; // Import toast from sonner
import { authFetch } from '@/lib/api'; // Import authFetch directly

interface DeleteSiteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    siteId: string | null;
    onSuccess: () => void; // Callback on successful deletion
}

export function DeleteSiteDialog({ open, onOpenChange, siteId, onSuccess }: DeleteSiteDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    // No need for useToast hook when using sonner directly

    const handleDelete = async () => {
        if (!siteId) {
            toast.error('No site selected for deletion.'); // Use sonner's error method
            return;
        }

        setIsDeleting(true);
        try {
            console.log(`[DeleteSiteDialog] Attempting to delete site: ${siteId}`);
            // Use authFetch directly with the DELETE method
            await authFetch(`/admin/api/sites/${siteId}`, { // Ensure the full path is used
                method: 'DELETE',
            });

            // authFetch throws on non-ok status, so if it doesn't throw, it's successful.
            // For DELETE, it might return null or an empty response on success (e.g., 204).
            // Assuming api helper throws or returns a structured response
            console.log(`[DeleteSiteDialog] Site deletion successful for: ${siteId}`);
            toast.success(`Site "${siteId}" and all its KV data have been deleted.`); // Use sonner's success method
            onSuccess(); // Trigger refresh / UI update
            onOpenChange(false); // Close dialog
        } catch (error: unknown) { // Changed type from any to unknown
            console.error(`[DeleteSiteDialog] Error deleting site ${siteId}:`, error);
            let errorMessage = 'Failed to delete site.';
            if (error instanceof Error) { // Check if it's an Error instance
                // Attempt to access specific properties if needed, or just use message
                // Example: Check for a specific structure if your API returns errors consistently
                // if (typeof error === 'object' && error !== null && 'response' in error && ...) { ... }
                errorMessage = error.message;
            }
            // Note: Accessing error.response?.data?.error is unsafe with 'unknown'.
            // You'd need more robust type guards if you expect a specific error structure from authFetch.
            // For now, relying on error.message is safer.
            toast.error(errorMessage); // Use sonner's error method
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the site
                        <strong className="px-1">{siteId}</strong>
                        and all associated KV data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting || !siteId}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? 'Deleting...' : 'Yes, Delete Site'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}