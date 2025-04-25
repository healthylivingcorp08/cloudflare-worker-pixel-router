'use client'; // Required for useState, useEffect, and event handlers

import React, { useState } from 'react';
import AuthWrapper from '@/components/AuthWrapper';
import Header from '@/components/Header';
import SiteSelector from '@/components/SiteSelector'; // Placeholder import
import KVTable from '@/components/KVTable';       // Placeholder import
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AddKVDialog from '@/components/AddKVDialog';
import { CreateSiteDialog } from '@/components/CreateSiteDialog'; // Corrected import (assuming named export)
import DeleteKVDialog from '@/components/DeleteKVDialog'; // Import the DeleteKVDialog
import { DeleteSiteDialog } from '@/components/DeleteSiteDialog'; // Import the DeleteSiteDialog

export default function DashboardPage() {
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
    const [filterText, setFilterText] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>(''); // State for status filter ('', 'active', 'inactive', 'pending')
    const [refreshCounter, setRefreshCounter] = useState<number>(0); // State to trigger refresh in KVTable and SiteSelector
    const [isAddKvDialogOpen, setIsAddKvDialogOpen] = useState<boolean>(false); // Renamed state
    const [isCreateSiteDialogOpen, setIsCreateSiteDialogOpen] = useState<boolean>(false); // State for CreateSiteDialog
    const [isDeleteKvDialogOpen, setIsDeleteKvDialogOpen] = useState<boolean>(false); // State for DeleteKVDialog
    const [isDeleteSiteDialogOpen, setIsDeleteSiteDialogOpen] = useState<boolean>(false); // State for DeleteSiteDialog
    const [selectedKvNames, setSelectedKvNames] = useState<Set<string>>(new Set()); // State for selected KV names

    const handleSiteSelected = (siteId: string | null) => {
        console.log("Site selected:", siteId);
        setSelectedSiteId(siteId);
        setFilterText(''); // Reset text filter when site changes
        setStatusFilter(''); // Reset status filter when site changes
        setSelectedKvNames(new Set()); // Reset selection when site changes
    };

    const handleKvSelectionChange = (selectedNames: Set<string>) => {
        setSelectedKvNames(selectedNames);
        // console.log("Selected KV Names:", selectedNames); // Optional: for debugging
    };

    const handleRefresh = () => {
      console.log('[page.tsx] handleRefresh called, incrementing refreshCounter'); // <-- Add log
      setRefreshCounter(prev => prev + 1); // Increment counter to trigger useEffect in KVTable
    };

    return (
        <AuthWrapper>
            <div className="flex flex-col h-screen">
                <Header />
                <main className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-2"> {/* Group SiteSelector and Create button */}
                            <SiteSelector
                                onSiteSelected={handleSiteSelected}
                                refreshCounter={refreshCounter} // Pass refresh counter
                            />
                            <Button variant="outline" onClick={() => setIsCreateSiteDialogOpen(true)}>
                                Create New Site
                            </Button>
                            {/* Add Delete Site Button */}
                            <Button
                                variant="destructive"
                                onClick={() => setIsDeleteSiteDialogOpen(true)}
                                disabled={!selectedSiteId} // Disable if no site is selected
                            >
                                Delete Selected Site
                            </Button>
                        </div>
                        <div className="flex gap-2">
                             <Button onClick={() => setIsAddKvDialogOpen(true)} disabled={!selectedSiteId}>
                                Add New KV Pair
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => setIsDeleteKvDialogOpen(true)} // Open the delete dialog
                                disabled={!selectedSiteId || selectedKvNames.size === 0} // Disable if no site or no selection
                            >
                                Delete Selected ({selectedKvNames.size})
                            </Button>
                        </div>
                    </div>

                    {selectedSiteId && (
                        <>
                            <div className="flex gap-2 items-center"> {/* Container for filters */}
                                <Input
                                    type="text"
                                    placeholder="Filter keys..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="max-w-xs" // Adjusted width
                                    disabled={!!statusFilter} // Disable text filter if status filter is active
                                />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setSelectedSiteId(null); // Clear site selection when status filter changes
                                        setFilterText(''); // Clear text filter when status filter changes
                                    }}
                                    className="border border-gray-300 rounded-md p-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" // Basic styling, adjust as needed
                                    // disabled={!!selectedSiteId} // Status filter applies across sites, don't disable based on siteId
                                >
                                    <option value="">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="pending">Pending</option>
                                    {/* Add more statuses if needed */}
                                </select>
                            </div>
                            <KVTable
                                selectedSiteId={selectedSiteId} // Pass selectedSiteId (can be null)
                                filterText={filterText}
                                statusFilter={statusFilter} // Pass status filter
                                refreshCounter={refreshCounter} // Pass refresh counter
                                onEditSuccess={handleRefresh} // Pass refresh handler
                                onDeleteSuccess={handleRefresh} // Pass refresh handler
                                onSelectionChange={handleKvSelectionChange} // Pass selection handler
                            />
                        </>
                    )}
                     {!selectedSiteId && (
                        <p className="text-muted-foreground text-center mt-8">
                            Please select a site to view its KV data.
                        </p>
                    )}
                </main>
            </div>
            {/* Add KV Dialog */}
            {selectedSiteId && (
                 <AddKVDialog
                    siteId={selectedSiteId}
                    open={isAddKvDialogOpen} // Use renamed state
                    onOpenChange={setIsAddKvDialogOpen} // Use renamed state setter
                    onSuccess={handleRefresh}
                />
            )}
            {/* Create Site Dialog */}
            <CreateSiteDialog
                open={isCreateSiteDialogOpen}
                onOpenChange={setIsCreateSiteDialogOpen}
                onSuccess={handleRefresh} // Refresh site list on success
            />
            {/* Delete KV Dialog */}
            <DeleteKVDialog
                open={isDeleteKvDialogOpen}
                onOpenChange={setIsDeleteKvDialogOpen}
                siteId={selectedSiteId}
                keysToDelete={selectedKvNames}
                onSuccess={() => {
                    handleRefresh(); // Refresh KV list
                    setSelectedKvNames(new Set()); // Clear selection after successful deletion
                }}
            />
            {/* Delete Site Dialog */}
            <DeleteSiteDialog
                open={isDeleteSiteDialogOpen}
                onOpenChange={setIsDeleteSiteDialogOpen}
                siteId={selectedSiteId}
                onSuccess={() => {
                    handleRefresh(); // Refresh site list
                    setSelectedSiteId(null); // Deselect site after deletion
                }}
            />
        </AuthWrapper>
    );
}
