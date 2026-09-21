'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  DataTable,
  Column,
  Button,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
  Card,
  formatDate,
} from '@shaliach/ui';
import {
  CheckSquare,
  CheckCircle,
  RotateCcw,
  SkipForward,
  ShieldBan,
  Edit,
  Sparkles,
  AlertTriangle,
  Mail,
  Building,
} from 'lucide-react';

export default function ApprovalQueuePage() {
  const queryClient = useQueryClient();
  const [selectedRecipient, setSelectedRecipient] = useState<any | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBodyText, setEditBodyText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['approval-queue'],
    queryFn: () => apiFetch('/api/approval'),
    refetchInterval: 10000,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/api/approval/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      setSelectedRecipient(null);
    },
    onError: (err: any) => {
      alert(`Action failed: ${err.message}`);
    },
  });

  const editDraftMutation = useMutation({
    mutationFn: ({ id, subject, bodyText }: { id: string; subject: string; bodyText: string }) =>
      apiFetch(`/api/approval/${id}/draft`, {
        method: 'PUT',
        body: JSON.stringify({
          subject,
          bodyText,
          bodyHtml: `<p>${bodyText.replace(/\n/g, '<br/>')}</p>`,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
      setIsEditOpen(false);
    },
    onError: (err: any) => {
      alert(`Edit draft failed: ${err.message}`);
    },
  });

  const handleOpenEdit = (recipient: any) => {
    const draft = recipient.emailMessages?.[0];
    setEditSubject(draft?.subject || '');
    setEditBodyText(draft?.textBody || '');
    setSelectedRecipient(recipient);
    setIsEditOpen(true);
  };

  const columns: Column<any>[] = [
    {
      header: 'Prospect Business',
      cell: (r) => (
        <div>
          <div className="font-semibold text-foreground text-xs">{r.lead?.businessName}</div>
          <div className="text-[11px] text-muted-foreground">{r.lead?.email}</div>
        </div>
      ),
    },
    {
      header: 'Generated Subject & Preview',
      cell: (r) => {
        const draft = r.emailMessages?.[0];
        return (
          <div className="max-w-md">
            <div className="font-semibold text-foreground text-xs truncate">
              {draft?.subject || 'Drafting subject...'}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
              {draft?.textBody || 'Draft content...'}
            </div>
          </div>
        );
      },
    },
    {
      header: 'AI Confidence / Notes',
      cell: (r) => {
        const ai = r.aiGeneration;
        if (!ai) return <span className="text-xs text-muted-foreground">-</span>;

        const conf = Math.round((ai.confidence || 0.8) * 100);
        return (
          <div className="space-y-1">
            <Badge
              variant={conf >= 80 ? 'success' : conf >= 60 ? 'warning' : 'destructive'}
              className="text-[10px]"
            >
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              {conf}% Confidence
            </Badge>
            {ai.warnings && ai.warnings.length > 0 && (
              <div className="text-[10px] text-amber-600 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {ai.warnings[0]}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Review Actions',
      cell: (r) => (
        <div className="flex items-center space-x-1.5">
          <Button
            size="sm"
            onClick={() => actionMutation.mutate({ id: r.id, action: 'APPROVE' })}
            disabled={actionMutation.isPending}
            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Approve
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(r)}
            className="h-7 px-2 text-xs"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => actionMutation.mutate({ id: r.id, action: 'REGENERATE' })}
            title="Regenerate with Groq"
            className="h-7 px-2 text-xs text-purple-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => actionMutation.mutate({ id: r.id, action: 'SKIP' })}
            title="Skip recipient"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <CheckSquare className="h-6 w-6 mr-2 text-primary" />
            Outreach Approval Queue
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Strict human review requirement: inspect, refine, and approve Groq AI personalized emails before dispatch.
          </p>
        </div>
      </div>

      {/* Queue Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="Approval queue is empty"
        emptyDescription="All generated outreach emails have been reviewed, or no campaign is currently generating."
      />

      {/* Edit Draft Modal */}
      {selectedRecipient && (
        <Dialog open={isEditOpen} onOpenChange={(open) => setIsEditOpen(open)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Edit Outreach Message for {selectedRecipient.lead?.businessName}
              </DialogTitle>
              <DialogDescription className="text-xs">
                To: {selectedRecipient.lead?.email} · From: Joshua Caleb (FixHubTech)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Subject Line</label>
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Message Body</label>
                <Textarea
                  value={editBodyText}
                  onChange={(e) => setEditBodyText(e.target.value)}
                  className="min-h-[160px] text-xs font-mono"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground block mb-1">
                  FixHubTech Signature &amp; Unsubscribe:
                </span>
                The CAN-SPAM compliant footer and Joshua Caleb business signature are automatically appended to the final email.
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between border-t pt-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  actionMutation.mutate({ id: selectedRecipient.id, action: 'SUPPRESS' });
                  setIsEditOpen(false);
                }}
              >
                <ShieldBan className="h-4 w-4 mr-1" />
                Suppress Lead
              </Button>

              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    editDraftMutation.mutate({
                      id: selectedRecipient.id,
                      subject: editSubject,
                      bodyText: editBodyText,
                    })
                  }
                  disabled={editDraftMutation.isPending}
                >
                  {editDraftMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
