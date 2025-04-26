'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';  // Added useRef
import { authFetch } from '@/lib/api';
import AddKVDialog from './AddKVDialog';
import EditKVDialog from './EditKVDialog'; // Corrected: Use default import
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
// Removed unused Dialog imports: Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose
// Removed unused Label and Textarea imports
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components

// Use KVPair from root types
import { KVPair } from '../../../../types'; // Corrected path

interface KVTableProps {
  selectedSiteId: string | null; // Allow null for when status filter is used
  filterText: string;
  statusFilter: string; // Added status filter prop
  refreshCounter: number; // Added refresh counter
  onEditSuccess: () => void; // Added success callback
  onDeleteSuccess: () => void; // Added success callback
  onSelectionChange: (selectedNames: Set<string>) => void;
}

export default function KVTable({
    selectedSiteId,
    filterText,
    statusFilter, // Destructure status filter
    // refreshCounter removed - not used internally
    onEditSuccess, // Use success callback
    onDeleteSuccess, // Use success callback
    onSelectionChange
}: KVTableProps) {
  const [kvData, setKvData] = useState<KVPair[]>([]); // Use KVPair
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const retryCountRef = useRef(0);  // Add retry count ref

  // State for Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KVPair | null>(null); // Use KVPair
  // Remove editedValue, isSaving, saveError - handled by EditKVDialog

  // State for Delete Dialog
  // Removed unused isDeleteDialogOpen and setIsDeleteDialogOpen state
  const [deletingItemKey, setDeletingItemKey] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);


  // State for Add Dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Type guard to check if an object has a 'data' property
  function isDataObject(obj: unknown): obj is { data: unknown } {
    return typeof obj === 'object' && obj !== null && 'data' in obj;
  }

  const fetchKVData = useCallback(async () => {
    console.log('[KVTable] fetchKVData triggered. Site:', selectedSiteId, 'Search:', filterText, 'Status:', statusFilter); // <-- Log start with search and status
    // Fetch if a site is selected OR a status filter is active
    if (!selectedSiteId && !statusFilter) {
      console.log('[KVTable] No site selected and no status filter active, clearing data.'); // <-- Log no site/status
      setKvData([]);
      setSelectedNames(new Set()); // Clear selection as well
      onSelectionChange(new Set()); // Notify parent about cleared selection
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Add timestamp for cache-busting
      const timestamp = Date.now();
      let url = `/admin/api/kv-keys?_=${timestamp}`;

      // Add siteId OR status filter
      if (selectedSiteId) {
        url += `&siteId=${selectedSiteId}`;
      } else if (statusFilter) {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      // Add search filter (applies after siteId or status filter on backend)
      if (filterText) {
        url += `&search=${encodeURIComponent(filterText)}`;
      }

      console.log('[KVTable] Fetching data from URL:', url); // <-- Log URL
      // Explicitly disable caching for this request
      const response = await authFetch(url, { cache: 'no-store' });
      console.log('[KVTable] Raw response received:', response); // <-- Log raw response
      
      // Handle both array and object response formats
      let items = [];
      if (Array.isArray(response)) {
        items = response;
      } else if (isDataObject(response)) { // Use type guard here
        items = Array.isArray(response.data) ? response.data : [response.data];
      } else {
        console.error('[KVTable] Invalid response format:', response);
        throw new Error('Invalid response format when fetching KV data. Expected array or {data: array}');
      }

      // Define a type for the expected item structure from the API
      type ApiItem = { name?: string; key?: string; value: unknown };

      const data: KVPair[] = items.map((item: ApiItem) => ({
        key: item.name || item.key || 'unknown_key', // Provide a fallback for key
        value: item.value,
      }));
      console.log('[KVTable] Setting KV data:', data); // <-- Log data being set
      setKvData(data); // Set the new data
      // Clear selection when data reloads due to filter changes
      setSelectedNames(new Set());
      onSelectionChange(new Set());
    } catch (err) {
      console.error(`[KVTable] Failed to fetch KV data for site ${selectedSiteId} / status ${statusFilter}:`, err); // <-- Enhanced log
      
      // Special cases for certain error statuses
      if (err instanceof Error) {
        // 404 - treat as empty response
        if (err.message.includes('404')) {
          console.log('[KVTable] 404 response - treating as empty data');
          setKvData([]);
          setSelectedNames(new Set());
          onSelectionChange(new Set());
          setError(null);
          return;
        }
        // 410 - data was intentionally deleted, don't retry
        if (err.message.includes('410')) {
          console.log('[KVTable] 410 response - data was deleted');
          setKvData([]);
          setSelectedNames(new Set());
          onSelectionChange(new Set());
          setError('Data was deleted');
          return;
        }
      }

      const maxRetries = 3;
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setError(`Retry attempt ${retryCountRef.current}/${maxRetries}: Retrying fetch in 2 seconds...`);
        const retryTimer = setTimeout(() => {
          fetchKVData();
        }, 2000);
         
        // Clean up timer on unmount
        return () => clearTimeout(retryTimer);
      } else {
        retryCountRef.current = 0;
        setError(err instanceof Error ? `Failed after ${maxRetries} retries: ${err.message}` : `Failed to load KV data after ${maxRetries} retries.`);
        setKvData([]);
        setSelectedNames(new Set());
        onSelectionChange(new Set());
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedSiteId, filterText, statusFilter, onSelectionChange]); // Dependency: re-create if selectedSiteId, filterText, or statusFilter changes

  useEffect(() => {
    console.log(`[KVTable] useEffect triggered with dependencies: SiteId=${selectedSiteId}, Filter=${filterText}, Status=${statusFilter}`);
    
    // Abort controller for cleanup
    const abortController = new AbortController();
    let mounted = true;
    
    const fetchData = async () => {
      if (!mounted) return;
      if (!isLoading) {
        await fetchKVData();
      } else {
        console.log('[KVTable] Skipping fetch: Data is already loading.');
      }
    };

    // Only fetch if we have a valid siteId or status filter
    if (selectedSiteId || statusFilter) {
      fetchData();
    } else {
      console.log('[KVTable] Skipping fetch: No siteId or status filter selected.');
    }
    
    return () => {
      mounted = false;
      abortController.abort();
    };
  // Added fetchKVData and isLoading to dependency array
  }, [selectedSiteId, filterText, statusFilter, fetchKVData, isLoading]);

  // Client-side filtering removed - backend handles it now

  // --- Selection Handlers ---
  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    const newSelectedNames = new Set<string>();
    if (checked === true) {
      // Select all items currently loaded (already filtered by backend)
      kvData.forEach(item => newSelectedNames.add(item.key));
    }
    // If checked is false or indeterminate, clear selection
    setSelectedNames(newSelectedNames);
    onSelectionChange(newSelectedNames); // Notify parent
  };

  const handleRowSelect = (key: string, checked: boolean) => { // Use key
    const newSelectedNames = new Set(selectedNames);
    if (checked) {
      newSelectedNames.add(key); // Use key
    } else {
      newSelectedNames.delete(key); // Use key
    }
    setSelectedNames(newSelectedNames); // Changed selectedKeys to selectedNames
    onSelectionChange(newSelectedNames); // Notify parent
  };

  // Determine state for the "Select All" checkbox
  const selectAllCheckedState = useMemo(() => {
      if (kvData.length === 0) return false; // Use kvData
      if (selectedNames.size === 0) return false;
      // Check if all loaded items are selected
      if (selectedNames.size === kvData.length) {
          let allMatch = true;
          for (const item of kvData) {
              if (!selectedNames.has(item.key)) {
                  allMatch = false;
                  break;
              }
          }
          if (allMatch) return true;
      }
      // Check if some loaded items are selected
      let someSelected = false;
      for (const item of kvData) {
          if (selectedNames.has(item.key)) {
              someSelected = true;
              break;
          }
      }
      if (someSelected) return 'indeterminate'; // Some, but not all loaded items are selected

      return false; // No loaded items are selected
  }, [selectedNames, kvData]); // Depend on kvData


  // --- Edit Handlers ---
  const handleEditClick = (item: KVPair) => { // Use KVPair
    setEditingItem(item); // Set the item to be edited
    setIsEditDialogOpen(true); // Open the EditKVDialog
  };

  // Remove handleSaveEdit - logic moved to EditKVDialog

  // --- Delete Handlers ---
  const handleDeleteClick = (key: string) => {
    setDeletingItemKey(key);
    setDeleteError(null); // Clear previous errors
    // AlertDialogTrigger handles opening, but we set the key here
  };

  const handleConfirmDelete = async () => {
    if (!deletingItemKey) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      // Use DELETE /admin/api/kv - Ensure siteId is present
      if (!selectedSiteId) {
          console.error("[KVTable] Delete aborted: No siteId selected.");
          setDeleteError("Cannot delete KV pair without a selected site ID.");
          setIsDeleting(false); // Reset deleting state
          return; // Prevent API call
      }
      await authFetch(`/admin/api/kv?siteId=${selectedSiteId}&key=${encodeURIComponent(deletingItemKey)}`, {
        method: 'DELETE',
      });
      setDeletingItemKey(null); // Clear deleting item
      // AlertDialog's onOpenChange handles closing
      // fetchKVData(); // Refresh data using internal function - Replaced by callback
      onDeleteSuccess(); // Call the success callback
      // Optionally show a success toast/message here
    } catch (err) {
      console.error("Failed to delete KV pair:", err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete item.');
      // Keep dialog open on error to show message
    } finally {
      setIsDeleting(false);
    }
  };

  // handleDeleteClick replaces the old placeholder handleDelete

  // --- Render Logic ---
  if (isLoading) return <p>Loading KV data...</p>;
  if (error) return (
    <Alert variant="destructive">
      <Terminal className="h-4 w-4" />
      <AlertTitle>Error Loading KV Data</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  // Adjust initial message based on whether a site or status is selected
  if (!selectedSiteId && !statusFilter) return <p>Please select a site or a status filter to view KV data.</p>;
  if (kvData.length === 0 && !isLoading) {
    return (
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>No KV Data Found</AlertTitle>
        <AlertDescription>
          No KV pairs found{filterText ? ' matching your text filter' : ''}
          {statusFilter ? ` matching status '${statusFilter}'` : ''}
          {selectedSiteId ? ` for site ${selectedSiteId}` : ''}.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {/* Add Button removed - handled in page.tsx */}

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectAllCheckedState}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all rows"
                  disabled={kvData.length === 0} // Disable if no data to select // Use kvData
                />
              </TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="text-right w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kvData.map((item) => ( // Use kvData
              // Explicitly wrap TableCells to avoid direct whitespace children of TableRow/tr
              <TableRow key={item.key} data-state={selectedNames.has(item.key) ? "selected" : undefined}>
                <>
                  <TableCell>
                    <Checkbox
                      checked={selectedNames.has(item.key)}
                      onCheckedChange={(checked) => handleRowSelect(item.key, !!checked)}
                      aria-label={`Select row ${item.key}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.key}</TableCell>
                  <TableCell>
                    {typeof item.value === 'string' && item.value.length > 100
                      ? `${item.value.substring(0, 100)}...`
                      : String(item.value)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {/* Disable Edit button if viewing multiple sites via status filter */}
                    <Button variant="outline" size="sm" onClick={() => handleEditClick(item)} disabled={!selectedSiteId}>Edit</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         {/* Disable Delete button trigger if viewing multiple sites via status filter (deletion requires siteId) */}
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(item.key)} disabled={!selectedSiteId}>Delete</Button>
                      </AlertDialogTrigger>
                      {/* Content managed elsewhere */}
                    </AlertDialog>
                  </TableCell>
                </>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog (Using separate component) */}
      <EditKVDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        kvPair={editingItem}
        siteId={selectedSiteId ?? ''} // Pass empty string if null to satisfy TS, button disabled prevents misuse
        onSuccess={(updatedKV: KVPair) => {
          // Optimistic Update: Update local state immediately
          setKvData(currentData =>
            currentData.map(item =>
              item.key === updatedKV.key ? { ...item, value: updatedKV.value } : item
            )
          );
          // Trigger background refresh for eventual consistency
          onEditSuccess();
          setEditingItem(null); // Clear editing item
        }}
      />

      {/* Delete Confirmation Dialog */}
      {/* Note: AlertDialog state is mostly handled by its trigger, but we control the action */}
      <AlertDialog open={!!deletingItemKey} onOpenChange={(open) => !open && setDeletingItemKey(null)}>
         <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the KV pair with key: <span className="font-semibold">{deletingItemKey}</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
                <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Delete Error</AlertTitle>
                    <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting} onClick={() => setDeletingItemKey(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      {/* Add KV Dialog */}
      {/* AddKVDialog is conditionally rendered based on selectedSiteId in page.tsx,
          but we ensure siteId prop is string here if it were rendered */}
      <AddKVDialog
        siteId={selectedSiteId ?? ''} // Pass empty string if null to satisfy TS
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={onEditSuccess} // Use the parent's refresh handler
      />
    </>
  );
}