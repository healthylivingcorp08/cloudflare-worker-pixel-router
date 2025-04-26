'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { authFetch } from '@/lib/api';
import { toast } from "sonner"; // Import toast

interface AddKVDialogProps {
  siteId: string; // The site ID to add the KV pair to
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void; // Callback on successful addition
}

export default function AddKVDialog({ siteId, open, onOpenChange, onSuccess }: AddKVDialogProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Remove error state, use toast instead
  // const [error, setError] = useState<string | null>(null);

  // Clear form when dialog opens or siteId changes
  useEffect(() => {
    if (open) {
      setKey('');
      setValue('');
      // No error state to reset
      setIsLoading(false);
    }
  }, [open, siteId]);

  const handleAddKV = async () => {
    if (!key.trim() || !value.trim()) {
      toast.error('Both Key and Value are required.'); // Use toast
      return;
    }
    setIsLoading(true);
    // No need to reset error state
    try {
      // API endpoint: /admin/api/kv/{siteId}/{key}
      // Method: PUT
      // Body: { value: '...' }
      await authFetch(`/admin/api/kv/${siteId}/${encodeURIComponent(key.trim())}`, { // Removed unused 'response' variable
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: value }), // Send only the value in the body
      });

      // If authFetch didn't throw, the request was successful (response.ok was true).
      // No need to check response.success as the PUT endpoint might return 204 No Content.

      // console.log('KV pair added successfully:', response); // 'response' might be null or unknown here
      toast.success('KV pair added successfully!'); // Use toast
      onSuccess(); // Refresh the KV table
      onOpenChange(false); // Close the dialog
    } catch (err) {
      console.error("Failed to add KV pair:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast.error('Failed to add KV pair', { description: errorMessage }); // Use toast
    } finally {
      setIsLoading(false);
    }
  };

  // Reset state when dialog closes manually
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        // State reset is handled by useEffect when open becomes false
    }
    onOpenChange(isOpen);
  };


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New KV Pair</DialogTitle>
          <DialogDescription>
            Enter the key and value for the new pair for site: {siteId}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="kv-key" className="text-right">
              Key
            </Label>
            <Input
              id="kv-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="col-span-3"
              placeholder="e.g., feature_flag"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4"> {/* Changed items-center to items-start for Textarea */}
            <Label htmlFor="kv-value" className="text-right pt-2"> {/* Added padding-top */}
              Value
            </Label>
            <Textarea
              id="kv-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="col-span-3"
              placeholder="Enter value (string, JSON, etc.)"
              disabled={isLoading}
              rows={4} // Set initial rows for textarea
            />
          </div>
          {/* Remove error display, handled by toast */}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleAddKV} disabled={isLoading || !key.trim() || !value.trim()}>
            {isLoading ? 'Adding...' : 'Add Pair'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}