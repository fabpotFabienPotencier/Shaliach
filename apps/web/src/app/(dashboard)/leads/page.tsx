'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  DataTable,
  Column,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  StatusBadge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Card,
  formatDate,
  formatCurrency,
} from '@shaliach/ui';
import {
  Search,
  Download,
  Filter,
  Eye,
  ShieldBan,
  CheckCircle,
  X,
  Building,
  Mail,
  Globe,
  MapPin,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [validationFilter, setValidationFilter] = useState('ALL');
  const [crmFilter, setCrmFilter] = useState('ALL');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Free Lead Discovery Modal State
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);
  const [discoverNiche, setDiscoverNiche] = useState('Plumbers');
  const [discoverLocation, setDiscoverLocation] = useState('Boston, MA');
  const [discoverLimit, setDiscoverLimit] = useState(20);
  const [discoverResult, setDiscoverResult] = useState<any | null>(null);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  if (validationFilter !== 'ALL') queryParams.set('validationStatus', validationFilter);
  if (crmFilter !== 'ALL') queryParams.set('crmStatus', crmFilter);
  if (cursor) queryParams.set('cursor', cursor);
  queryParams.set('limit', '25');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', queryParams.toString()],
    queryFn: () => apiFetch(`/api/leads?${queryParams.toString()}`),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      apiFetch(`/api/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (selectedLead) {
        setSelectedLead((prev: any) => ({ ...prev }));
      }
    },
  });

  const discoverMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/api/leads/discover', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (res: any) => {
      setDiscoverResult(res);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      refetch();
    },
    onError: (err: any) => {
      alert(`Discovery failed: ${err.message}`);
    },
  });

  const handleStartDiscovery = () => {
    setDiscoverResult(null);
    discoverMutation.mutate({
      niche: discoverNiche,
      location: discoverLocation,
      limit: Number(discoverLimit) || 20,
      saveToDb: true,
    });
  };

  const columns: Column<any>[] = [
    {
      header: 'Business Name',
      cell: (lead) => (
        <div>
          <div className="font-semibold text-foreground text-xs">{lead.businessName}</div>
          {lead.website && (
            <a
              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary hover:underline block truncate max-w-[180px]"
            >
              {lead.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      ),
    },
    {
      header: 'Contact Email',
      cell: (lead) => (
        <div>
          <div className="text-xs font-mono">{lead.email}</div>
          {lead.firstName && (
            <div className="text-[11px] text-muted-foreground">{lead.firstName}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Location / Category',
      cell: (lead) => (
        <div className="text-xs">
          <div>{[lead.city, lead.state].filter(Boolean).join(', ') || '-'}</div>
          <div className="text-[11px] text-muted-foreground">{lead.category || 'General'}</div>
        </div>
      ),
    },
    {
      header: 'Validation',
      cell: (lead) => <StatusBadge status={lead.validationStatus} />,
    },
    {
      header: 'CRM Stage',
      cell: (lead) => <StatusBadge status={lead.crmStatus} />,
    },
    {
      header: 'Actions',
      cell: (lead) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLead(lead);
          }}
          className="h-7 text-xs"
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Button>
      ),
    },
  ];

  const handleNextPage = () => {
    if (data?.nextCursor) {
      if (cursor) setCursorHistory((prev) => [...prev, cursor]);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    const prevHistory = [...cursorHistory];
    const prevCursor = prevHistory.pop();
    setCursorHistory(prevHistory);
    setCursor(prevCursor);
  };

  const handleExportCsv = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/leads/export?${queryParams.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Lead Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage, filter, and inspect verified prospect business records.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={() => setIsDiscoverModalOpen(true)} className="bg-primary text-primary-foreground font-medium shadow-sm">
            <Sparkles className="h-4 w-4 mr-1.5 text-amber-300" />
            Find Leads (Free)
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1.5" />
            Export Cleaned CSV
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search business, email, city..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursor(undefined);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div>
            <select
              value={validationFilter}
              onChange={(e) => {
                setValidationFilter(e.target.value);
                setCursor(undefined);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Validation Statuses</option>
              <option value="VALID">VALID Only</option>
              <option value="RISKY">RISKY</option>
              <option value="INVALID">INVALID</option>
              <option value="SUPPRESSED">SUPPRESSED</option>
            </select>
          </div>

          <div>
            <select
              value={crmFilter}
              onChange={(e) => {
                setCrmFilter(e.target.value);
                setCursor(undefined);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All CRM Stages</option>
              <option value="IMPORTED">IMPORTED</option>
              <option value="VALIDATED">VALIDATED</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="REPLIED">REPLIED</option>
              <option value="INTERESTED">INTERESTED</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>
          </div>

          {(search || validationFilter !== 'ALL' || crmFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setValidationFilter('ALL');
                setCrmFilter('ALL');
                setCursor(undefined);
              }}
              className="h-9 text-xs text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" /> Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        onRowClick={(lead) => setSelectedLead(lead)}
        emptyTitle="No leads match your filter"
        emptyDescription="Try broadening your search query or uploading a new CSV lead list."
        pagination={{
          totalCount: data?.totalCount,
          hasNextPage: data?.hasMore,
          hasPreviousPage: cursorHistory.length > 0 || !!cursor,
          onNextPage: handleNextPage,
          onPreviousPage: handlePrevPage,
        }}
      />

      {/* Lead Detail Modal */}
      {selectedLead && (
        <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {selectedLead.businessName}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Lead ID: #{selectedLead.id}
                  </DialogDescription>
                </div>
                <div className="flex space-x-2">
                  <StatusBadge status={selectedLead.validationStatus} />
                  <StatusBadge status={selectedLead.crmStatus} />
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground flex items-center">
                  <Mail className="h-3.5 w-3.5 mr-1" /> Email Address
                </span>
                <p className="font-mono text-foreground font-medium">{selectedLead.email}</p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground flex items-center">
                  <Globe className="h-3.5 w-3.5 mr-1" /> Website
                </span>
                <p className="text-foreground font-medium">
                  {selectedLead.website ? (
                    <a
                      href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      {selectedLead.website}
                    </a>
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1" /> Location
                </span>
                <p className="text-foreground">
                  {[selectedLead.city, selectedLead.state, selectedLead.country]
                    .filter(Boolean)
                    .join(', ') || 'N/A'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground flex items-center">
                  <Building className="h-3.5 w-3.5 mr-1" /> Category / Industry
                </span>
                <p className="text-foreground">{selectedLead.category || 'General Business'}</p>
              </div>

              <div className="col-span-2 space-y-1 border-t pt-3">
                <span className="font-semibold text-muted-foreground">Notes &amp; Context</span>
                <p className="text-foreground bg-muted/40 p-2.5 rounded-md min-h-[50px]">
                  {selectedLead.notes || 'No notes provided for this lead.'}
                </p>
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between border-t pt-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  apiFetch('/api/leads/bulk', {
                    method: 'POST',
                    body: JSON.stringify({
                      leadIds: [selectedLead.id],
                      action: 'SUPPRESS',
                      suppressionReason: 'MANUAL_LEAD_VIEW_SUPPRESSION',
                    }),
                  }).then(() => {
                    refetch();
                    setSelectedLead(null);
                  });
                }}
              >
                <ShieldBan className="h-4 w-4 mr-1.5" />
                Suppress Email
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Free Lead Discovery Modal */}
      <Dialog open={isDiscoverModalOpen} onOpenChange={setIsDiscoverModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-lg font-bold">
              <Sparkles className="h-5 w-5 mr-2 text-primary" />
              Autonomous Lead Discovery ($0.00)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Search open business registries and deeply crawl company websites to extract verified emails and owner names with zero subscriptions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Target Business Niche
              </label>
              <Input
                value={discoverNiche}
                onChange={(e) => setDiscoverNiche(e.target.value)}
                placeholder="e.g. Plumbers, Accountants, Dentists, Roofers"
                className="text-xs"
                disabled={discoverMutation.isPending}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                City / Location
              </label>
              <Input
                value={discoverLocation}
                onChange={(e) => setDiscoverLocation(e.target.value)}
                placeholder="e.g. Boston, MA or Dallas, TX or Miami, FL"
                className="text-xs"
                disabled={discoverMutation.isPending}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Max Leads to Extract
              </label>
              <Input
                type="number"
                min={5}
                max={100}
                value={discoverLimit}
                onChange={(e) => setDiscoverLimit(Number(e.target.value))}
                className="text-xs"
                disabled={discoverMutation.isPending}
              />
            </div>

            {discoverMutation.isPending && (
              <div className="p-4 rounded-xl border bg-muted/40 text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                <div className="text-xs font-semibold text-foreground">
                  Searching open registries & crawling websites...
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Deeply inspecting contact pages and extracting verified emails. This takes 10–25 seconds.
                </div>
              </div>
            )}

            {discoverResult && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 space-y-2">
                <div className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4 mr-1.5" />
                  Extraction Complete!
                </div>
                <div className="text-xs">
                  Found <strong>{discoverResult.totalFound}</strong> verified businesses.
                  {discoverResult.savedToDatabase > 0 && (
                    <span> <strong>{discoverResult.savedToDatabase}</strong> new leads were added directly to your database!</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDiscoverModalOpen(false);
                setDiscoverResult(null);
              }}
              disabled={discoverMutation.isPending}
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleStartDiscovery}
              disabled={discoverMutation.isPending || !discoverNiche.trim() || !discoverLocation.trim()}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {discoverMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Scraping Leads...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-300" />
                  Find Leads Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
