'use client';

import { useState } from 'react';
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
import { authFetch } from '@/lib/api';
import { toast } from "sonner"; // Import toast from sonner

 interface CreateSiteDialogProps {
   open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void; // Callback on successful creation
}

export function CreateSiteDialog({ open, onOpenChange, onSuccess }: CreateSiteDialogProps) {
  const [newSiteId, setNewSiteId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Remove error state, use toast instead
  // const [error, setError] = useState<string | null>(null);

  const handleCreateSite = async () => {
    if (!newSiteId.trim()) {
      toast.error('Site ID cannot be empty.'); // Use sonner toast
      return;
    }
    setIsLoading(true);
    // No need to reset error state
    try {
      // The API endpoint is /admin/api/config/:siteId and uses PUT for creation
      // It expects the full SiteConfig object in the body
      const siteId = newSiteId.trim();
      const newConfig = {
        siteId: siteId,
        scrubPercent: 0, // Default scrub percent
        pages: {},       // Start with empty pages
        // Metadata will be added by the backend
      };

      // authFetch will return parsed data on success or throw an error
      const result = await authFetch(`/admin/api/config/${siteId}`, { // Use siteId in URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig), // Send the full config object
      });

      // If authFetch didn't throw, it was successful. 'result' contains the response data.
      console.log('Site created successfully:', result); // Log the actual result
      toast.success('Site created successfully!');
      setNewSiteId(''); // Clear input on success
      onSuccess(); // Call the success callback
      onOpenChange(false); // Close the dialog

    } catch (err) { // Catch errors thrown by authFetch or other issues
      console.error("Failed to create site:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast.error('Failed to create site', { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNewSiteId('');
      setIsLoading(false);
    }
    onOpenChange(isOpen);
  };

  // Ensure the component returns JSX
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Site</DialogTitle>
          <DialogDescription>
            Enter a unique ID for the new site. This ID will be used in configurations and URLs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="site-id" className="text-right">
              Site ID
            </Label>
            <Input
              id="site-id"
              value={newSiteId}
              onChange={(e) => setNewSiteId(e.target.value)}
              className="col-span-3"
              placeholder="e.g., my-new-site"
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreateSite} disabled={isLoading || !newSiteId.trim()}>
            {isLoading ? 'Creating...' : 'Create Site'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}