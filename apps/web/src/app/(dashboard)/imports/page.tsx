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
  Progress,
  Badge,
  Card,
  formatDate,
} from '@shaliach/ui';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  ArrowRight,
} from 'lucide-react';

export default function ImportsPage() {
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState<any | null>(null);
  const [leadListName, setLeadListName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    email: '',
    businessName: '',
    firstName: '',
    website: '',
    category: '',
    city: '',
    state: '',
    country: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['imports'],
    queryFn: () => apiFetch('/api/imports'),
    refetchInterval: 5000, // Poll every 5s while jobs are active
  });

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/api/imports/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadData(res);

      // Auto-detect matching headers
      const headers: string[] = res.headers || [];
      const newMapping: Record<string, string> = {};

      headers.forEach((h) => {
        const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lower.includes('email')) newMapping.email = h;
        else if (lower.includes('business') || lower.includes('company')) newMapping.businessName = h;
        else if (lower.includes('name') || lower.includes('first')) newMapping.firstName = h;
        else if (lower.includes('website') || lower.includes('url') || lower.includes('site')) newMapping.website = h;
        else if (lower.includes('category') || lower.includes('industry')) newMapping.category = h;
        else if (lower.includes('city')) newMapping.city = h;
        else if (lower.includes('state')) newMapping.state = h;
        else if (lower.includes('country')) newMapping.country = h;
        else if (lower.includes('note')) newMapping.notes = h;
      });

      setColumnMapping((prev) => ({ ...prev, ...newMapping }));
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const createJobMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/api/imports', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imports'] });
      setIsUploadOpen(false);
      setFile(null);
      setUploadData(null);
    },
    onError: (err: any) => {
      alert(`Failed to start import: ${err.message}`);
    },
  });

  const handleStartImport = () => {
    if (!columnMapping.email) {
      alert('Email column mapping is required.');
      return;
    }

    createJobMutation.mutate({
      fileKey: uploadData.fileKey,
      originalFilename: uploadData.originalFilename,
      leadListName: leadListName || uploadData.originalFilename.replace(/\.csv$/i, ''),
      columnMapping,
    });
  };

  const columns: Column<any>[] = [
    {
      header: 'File / List Name',
      cell: (job) => (
        <div>
          <div className="font-semibold text-foreground text-xs flex items-center">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-primary" />
            {job.originalFilename}
          </div>
          {job.leadList && (
            <div className="text-[11px] text-muted-foreground ml-5">
              List: {job.leadList.name}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (job) => {
        let variant: any = 'secondary';
        if (job.status === 'COMPLETED') variant = 'success';
        if (job.status === 'PROCESSING') variant = 'info';
        if (job.status === 'FAILED') variant = 'destructive';

        return <Badge variant={variant}>{job.status}</Badge>;
      },
    },
    {
      header: 'Progress',
      cell: (job) => {
        const percent =
          job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;
        return (
          <div className="w-28 space-y-1">
            <Progress value={job.status === 'COMPLETED' ? 100 : percent} />
            <div className="text-[10px] text-muted-foreground text-right">
              {job.processedRows} / {job.totalRows || '—'} ({percent}%)
            </div>
          </div>
        );
      },
    },
    {
      header: 'Validation Breakdown',
      cell: (job) => (
        <div className="text-[11px] space-y-0.5">
          <span className="text-emerald-600 font-semibold">{job.validRows} valid</span> ·{' '}
          <span className="text-rose-600 font-medium">{job.invalidRows} invalid</span> ·{' '}
          <span className="text-purple-600 font-medium">{job.duplicateRows} dup</span> ·{' '}
          <span className="text-slate-500">{job.suppressedRows} suppressed</span>
        </div>
      ),
    },
    {
      header: 'Created Date',
      cell: (job) => (
        <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
      ),
    },
    {
      header: 'Actions',
      cell: (job) => (
        <div className="flex space-x-2">
          {(job.invalidRows > 0 || job.suppressedRows > 0 || job.duplicateRows > 0) && (
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/imports/${job.id}/export-rejected`}
              download
            >
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Rejected
              </Button>
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            CSV Import Engine
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Stream, map, validate, and deduplicate business lead CSVs into Shaliach AI.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsUploadOpen(true)}>
          <UploadCloud className="h-4 w-4 mr-1.5" />
          Import New Leads CSV
        </Button>
      </div>

      {/* Import History Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="No import jobs yet"
        emptyDescription="Upload your first CSV file containing prospect business leads to begin."
      />

      {/* Upload & Column Mapping Wizard Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => setIsUploadOpen(open)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Import Business Leads</DialogTitle>
            <DialogDescription className="text-xs">
              Upload a CSV file. The file is securely streamed and verified in chunks.
            </DialogDescription>
          </DialogHeader>

          {!uploadData ? (
            /* Step 1: File Selection */
            <form onSubmit={handleFileUpload} className="space-y-4 py-4">
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center bg-muted/20 hover:bg-muted/40 transition">
                <FileSpreadsheet className="h-10 w-10 text-primary mb-3" />
                <p className="text-sm font-semibold">Choose a CSV file to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .csv up to 50MB (millions of rows supported)
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-4 text-xs"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!file || isUploading}>
                  {isUploading ? 'Streaming to Storage...' : 'Continue to Column Mapping'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            /* Step 2: Column Mapping */
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Lead List Name</label>
                <Input
                  value={leadListName}
                  onChange={(e) => setLeadListName(e.target.value)}
                  placeholder="e.g. Florida Plumbers May 2026"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-2 border-t pt-3">
                <span className="text-xs font-bold text-foreground">Map CSV Columns</span>
                <p className="text-[11px] text-muted-foreground">
                  Match each lead field to the corresponding header in your file.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { key: 'email', label: 'Email Address *' },
                    { key: 'businessName', label: 'Business Name' },
                    { key: 'firstName', label: 'First Name' },
                    { key: 'website', label: 'Website' },
                    { key: 'category', label: 'Category / Industry' },
                    { key: 'city', label: 'City' },
                    { key: 'state', label: 'State' },
                    { key: 'country', label: 'Country' },
                    { key: 'notes', label: 'Notes' },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[11px] font-medium text-foreground">
                        {field.label}
                      </label>
                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
                      >
                        <option value="">-- Skip / Unmapped --</option>
                        {uploadData.headers.map((h: string) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="border-t pt-3">
                <Button variant="outline" onClick={() => setUploadData(null)}>
                  Back
                </Button>
                <Button
                  onClick={handleStartImport}
                  disabled={!columnMapping.email || createJobMutation.isPending}
                >
                  {createJobMutation.isPending ? 'Starting Import...' : 'Start Import Job'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
