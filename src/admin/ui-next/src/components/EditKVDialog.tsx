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
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from '@/lib/api';
import { KVPair } from '../../../../types'; // Corrected relative path
import { toast } from "sonner"; // Import toast

interface EditKVDialogProps {
  siteId: string;
  kvPair: KVPair | null; // The KV pair to edit
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedKV: KVPair) => void; // Callback with updated KV pair
}

export default function EditKVDialog({ siteId, kvPair, open, onOpenChange, onSuccess }: EditKVDialogProps) {
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Error state removed, using toast instead

  // Populate form when dialog opens or kvPair changes
  useEffect(() => {
    if (open && kvPair) {
      setValue(kvPair.value);
      // No error state to reset
      setIsLoading(false);
    } else if (!open) {
        // Optionally clear state when closing, though handled by open check too
        setValue('');
        // No error state to reset
        setIsLoading(false);
    }
  }, [open, kvPair]);

  const handleEditKV = async () => {
    if (!kvPair) {
      toast.error('No KV pair selected for editing.');
      return;
    }
    if (!value.trim()) {
      toast.error('Value cannot be empty.');
      return;
    }

    setIsLoading(true);
    // No error state to reset
    try {
      // API endpoint: PUT /admin/api/kv/{key} - Key includes siteId prefix
      // Body: { value: '...' }
      // The key itself already contains the siteId prefix, so don't add it again in the path.
      const response = await authFetch(`/admin/api/kv/${encodeURIComponent(kvPair.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: value }),
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to update KV pair.');
      }

      console.log('KV pair updated successfully:', response);
      toast.success('KV pair updated successfully!');
      // Call onSuccess with the key and the NEW value for optimistic update
      onSuccess({ key: kvPair.key, value: value });
      onOpenChange(false); // Close the dialog
    } catch (err) {
      console.error("Failed to update KV pair:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast.error('Failed to update KV pair', { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

   // Reset state when dialog closes manually
  const handleOpenChange = (isOpen: boolean) => {
    // State reset is handled by useEffect when open changes
    onOpenChange(isOpen);
  };


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit KV Pair</DialogTitle>
          <DialogDescription>
            Modify the value for key: <span className="font-mono bg-muted px-1 rounded">{kvPair?.key ?? 'N/A'}</span> on site: {siteId} {/* Corrected: Use kvPair.key */}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="kv-key-edit" className="text-right">
              Key
            </Label>
            {/* Key is read-only */}
            <Input
              id="kv-key-edit"
              value={kvPair?.key ?? ''}
              className="col-span-3"
              readOnly
              disabled
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="kv-value-edit" className="text-right pt-2">
              Value
            </Label>
            <Textarea
              id="kv-value-edit"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="col-span-3"
              placeholder="Enter new value"
              disabled={isLoading}
              rows={6} // Adjust rows as needed
            />
          </div>
          {/* Error display removed, handled by toast */}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleEditKV} disabled={isLoading || !value.trim()}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}