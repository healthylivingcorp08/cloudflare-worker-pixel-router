'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFetch } from '@/lib/api'; // Import the authFetch utility

interface Site {
  id: string;
  name: string; // Assuming the API returns at least id and name
}

interface SiteSelectorProps {
  onSiteSelected: (siteId: string | null) => void; // Callback prop
  refreshCounter: number; // Added refresh counter prop
}

export default function SiteSelector({ onSiteSelected, refreshCounter }: SiteSelectorProps) { // Added refreshCounter to props
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSites = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // API returns { success: boolean, data: string[] }, extract data
        const response = await authFetch('/admin/api/config/sites');
        if (!response || !response.success || !Array.isArray(response.data)) {
          throw new Error('Invalid response format from API');
        }
        const siteIds: string[] = response.data;
        const formattedSites: Site[] = (siteIds || []).map(id => ({ id: id, name: id })); // Use ID as name for now
        setSites(formattedSites);
      } catch (err) {
        console.error("Failed to fetch sites:", err);
        setError(err instanceof Error ? err.message : 'Failed to load sites.');
        setSites([]); // Clear sites on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchSites();
  }, [refreshCounter]); // Add refreshCounter to dependency array

  const handleValueChange = (value: string) => {
    const newSelectedSiteId = value === 'none' ? null : value;
    setSelectedSiteId(newSelectedSiteId);
    onSiteSelected(newSelectedSiteId); // Call the callback prop
  };

  if (isLoading) {
    return <p>Loading sites...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error loading sites: {error}</p>;
  }

  return (
    <Select
      onValueChange={handleValueChange}
      value={selectedSiteId ?? 'none'} // Use 'none' or similar for the placeholder state
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a site" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">-- Select a Site --</SelectItem>
        {sites.length > 0 ? (
          sites.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              {site.name} {/* Display only name/ID */}
            </SelectItem>
          ))
        ) : (
          <SelectItem value="no-sites" disabled>
            No sites found
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}