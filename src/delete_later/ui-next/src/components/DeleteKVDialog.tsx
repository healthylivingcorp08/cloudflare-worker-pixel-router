'use client';

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose, // Import DialogClose for the Cancel button
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area"; // For potentially long lists of keys
// Alert component removed, using toast instead
import { Loader2 } from "lucide-react"; // For loading indicator
import { toast } from "sonner"; // Import toast
import { authFetch } from '@/lib/api';

interface DeleteKVDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    siteId: string | null;
    keysToDelete: Set<string>;
    onSuccess: () => void; // Callback after successful deletion
}

export default function DeleteKVDialog({
    open,
    onOpenChange,
    siteId,
    keysToDelete,
    onSuccess,
}: DeleteKVDialogProps) {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // Error state removed, using toast instead

    const handleDelete = async () => {
        if (!siteId || keysToDelete.size === 0) {
            toast.error("No site selected or no keys to delete.");
            return;
        }

        setIsLoading(true);
        // No error state to reset

        try {
            // API endpoint: DELETE /admin/api/kv/bulk-delete
            // Body: { keys: ["key1", "key2", ...] }
            await authFetch(`/admin/api/kv/bulk-delete`, { // Removed unused 'response' variable
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: Array.from(keysToDelete) }), // Convert Set to Array
            });

            // If authFetch didn't throw, the request was successful (response.ok was true).
            // The check for !response.ok is handled internally by authFetch.

            // Deletion successful
            toast.success(`Successfully deleted ${keysToDelete.size} KV pair(s).`);
            onSuccess(); // Trigger refresh in parent component
            onOpenChange(false); // Close the dialog

        } catch (err: unknown) { // Changed type from any to unknown
            console.error("Error deleting KV pairs:", err);
            let errorMessage = "An unexpected error occurred while deleting KV pairs.";
            if (err instanceof Error) { // Check if it's an Error instance
                errorMessage = err.message;
            }
            toast.error("Failed to delete KV pairs", { description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    // Close handler to reset state when dialog is closed externally
    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            // No error state to reset
            setIsLoading(false);
        }
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Confirm Deletion</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete the following {keysToDelete.size} KV pair(s) from site <span className="font-semibold">{siteId ?? 'N/A'}</span>? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                {keysToDelete.size > 0 && (
                    <ScrollArea className="h-[100px] w-full rounded-md border p-4 my-2">
                        <ul className="list-disc pl-5 space-y-1">
                            {Array.from(keysToDelete).map(key => (
                                <li key={key} className="font-mono text-sm">{key}</li>
                            ))}
                        </ul>
                    </ScrollArea>
                )}

                {/* Error display removed, handled by toast */}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isLoading}>Cancel</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isLoading || !siteId || keysToDelete.size === 0}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Delete {keysToDelete.size} Item(s)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}