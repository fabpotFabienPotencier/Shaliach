'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  DataTable,
  Column,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Card,
  formatDate,
} from '@shaliach/ui';
import { ShieldBan, Plus, Trash2, Download, Search } from 'lucide-react';

export default function SuppressionPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [emailToAdd, setEmailToAdd] = useState('');
  const [reasonToAdd, setReasonToAdd] = useState('MANUAL_SUPPRESSION');

  const { data, isLoading } = useQuery({
    queryKey: ['suppression', search],
    queryFn: () => apiFetch(`/api/suppression?search=${encodeURIComponent(search)}`),
  });

  const addMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/api/suppression', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppression'] });
      setIsAddOpen(false);
      setEmailToAdd('');
    },
    onError: (err: any) => {
      alert(`Failed to suppress email: ${err.message}`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/suppression/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppression'] });
    },
  });

  const columns: Column<any>[] = [
    {
      header: 'Suppressed Email',
      cell: (entry) => <span className="font-mono text-xs font-semibold">{entry.normalizedEmail}</span>,
    },
    {
      header: 'Reason',
      cell: (entry) => <span className="text-xs text-muted-foreground">{entry.reason}</span>,
    },
    {
      header: 'Source',
      cell: (entry) => <span className="text-xs font-mono">{entry.source}</span>,
    },
    {
      header: 'Suppressed Date',
      cell: (entry) => (
        <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
      ),
    },
    {
      header: 'Action',
      cell: (entry) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Remove ${entry.normalizedEmail} from suppression list?`)) {
              removeMutation.mutate(entry.id);
            }
          }}
          className="h-7 text-xs text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <ShieldBan className="h-6 w-6 mr-2 text-destructive" />
            Global Suppression List
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Addresses in this list are strictly barred from receiving automated or manual communications.
          </p>
        </div>
        <div className="flex space-x-2">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/suppression/export`}
            download
          >
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1.5" />
              Export Suppression CSV
            </Button>
          </a>
          <Button size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Suppression
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <Card className="p-3 shadow-sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppressed emails..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </Card>

      {/* Suppression Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="Suppression list is empty"
        emptyDescription="Any bounced, complained, or unsubscribed email addresses will appear here automatically."
      />

      {/* Add Suppression Modal */}
      <Dialog open={isAddOpen} onOpenChange={(open) => setIsAddOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Address to Suppression List</DialogTitle>
            <DialogDescription className="text-xs">
              Prevents any future emails from being dispatched to this recipient.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Email Address *</label>
              <Input
                type="email"
                value={emailToAdd}
                onChange={(e) => setEmailToAdd(e.target.value)}
                placeholder="prospect@company.com"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Reason</label>
              <Input
                value={reasonToAdd}
                onChange={(e) => setReasonToAdd(e.target.value)}
                placeholder="e.g. Unsubscribe request / Competitor"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMutation.mutate({ email: emailToAdd, reason: reasonToAdd })}
              disabled={!emailToAdd.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? 'Adding...' : 'Add to Suppression'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
