'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
  LoadingState,
  formatCurrency,
} from '@shaliach/ui';
import {
  Kanban,
  DollarSign,
  Plus,
  ArrowRight,
  Clock,
  Building,
  CheckCircle2,
} from 'lucide-react';

const PIPELINE_COLUMNS = [
  { stage: 'REPLIED', label: 'Replied', color: 'border-purple-300' },
  { stage: 'INTERESTED', label: 'Interested', color: 'border-blue-400' },
  { stage: 'MEETING_REQUESTED', label: 'Meeting Set', color: 'border-indigo-400' },
  { stage: 'PROPOSAL_SENT', label: 'Proposal Sent', color: 'border-amber-400' },
  { stage: 'WON', label: 'Won & Paid', color: 'border-emerald-500' },
  { stage: 'LOST', label: 'Lost', color: 'border-rose-400' },
];

export default function CrmPipelinePage() {
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [revenueModalLead, setRevenueModalLead] = useState<any | null>(null);
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueDescription, setRevenueDescription] = useState('Web development deposit');

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['crm-summary'],
    queryFn: () => apiFetch('/api/crm/summary'),
  });

  // Fetch leads for key pipeline stages
  const { data: interestedLeads } = useQuery({
    queryKey: ['crm-stage-INTERESTED'],
    queryFn: () => apiFetch('/api/crm/stage/INTERESTED?limit=50'),
  });

  const { data: repliedLeads } = useQuery({
    queryKey: ['crm-stage-REPLIED'],
    queryFn: () => apiFetch('/api/crm/stage/REPLIED?limit=50'),
  });

  const { data: meetingLeads } = useQuery({
    queryKey: ['crm-stage-MEETING_REQUESTED'],
    queryFn: () => apiFetch('/api/crm/stage/MEETING_REQUESTED?limit=50'),
  });

  const { data: proposalLeads } = useQuery({
    queryKey: ['crm-stage-PROPOSAL_SENT'],
    queryFn: () => apiFetch('/api/crm/stage/PROPOSAL_SENT?limit=50'),
  });

  const { data: wonLeads } = useQuery({
    queryKey: ['crm-stage-WON'],
    queryFn: () => apiFetch('/api/crm/stage/WON?limit=50'),
  });

  const { data: lostLeads } = useQuery({
    queryKey: ['crm-stage-LOST'],
    queryFn: () => apiFetch('/api/crm/stage/LOST?limit=50'),
  });

  const leadsMap: Record<string, any[]> = {
    REPLIED: repliedLeads?.items || [],
    INTERESTED: interestedLeads?.items || [],
    MEETING_REQUESTED: meetingLeads?.items || [],
    PROPOSAL_SENT: proposalLeads?.items || [],
    WON: wonLeads?.items || [],
    LOST: lostLeads?.items || [],
  };

  const moveStageMutation = useMutation({
    mutationFn: ({ id, newStage }: { id: string; newStage: string }) =>
      apiFetch(`/api/crm/leads/${id}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ crmStatus: newStage }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-summary'] });
      PIPELINE_COLUMNS.forEach((col) => {
        queryClient.invalidateQueries({ queryKey: [`crm-stage-${col.stage}`] });
      });
    },
  });

  const recordRevenueMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/api/crm/revenue', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-summary'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stage-WON'] });
      setRevenueModalLead(null);
      setRevenueAmount('');
    },
    onError: (err: any) => {
      alert(`Failed to record revenue: ${err.message}`);
    },
  });

  const handleRecordRevenue = () => {
    const amountNum = parseFloat(revenueAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    recordRevenueMutation.mutate({
      leadId: revenueModalLead.id,
      amount: amountNum,
      currency: 'USD',
      description: revenueDescription,
    });
  };

  if (isSummaryLoading) {
    return <LoadingState message="Loading CRM pipeline..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Revenue Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <Kanban className="h-6 w-6 mr-2 text-primary" />
            Sales Pipeline &amp; Revenue Tracking
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage deal stages from first prospect reply to closed project revenue.
          </p>
        </div>
        <div className="flex items-center space-x-3 bg-card border rounded-lg p-3 shadow-sm">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Total Confirmed Revenue
            </div>
            <div className="text-lg font-black text-emerald-600">
              {formatCurrency(summary?.totalConfirmedRevenue)}
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[600px]">
        {PIPELINE_COLUMNS.map((col) => {
          const leads = leadsMap[col.stage] || [];

          return (
            <div
              key={col.stage}
              className={`w-72 shrink-0 rounded-lg border bg-muted/20 flex flex-col max-h-[700px] ${col.color}`}
            >
              {/* Column Header */}
              <div className="p-3 border-b bg-card rounded-t-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs text-foreground">{col.label}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {leads.length}
                  </Badge>
                </div>
              </div>

              {/* Column Cards */}
              <div className="p-2 flex-1 overflow-y-auto space-y-2">
                {leads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No leads in {col.label}
                  </div>
                ) : (
                  leads.map((lead: any) => (
                    <Card
                      key={lead.id}
                      className="p-3 shadow-sm hover:shadow transition bg-card border text-xs space-y-2"
                    >
                      <div className="font-bold text-foreground truncate">
                        {lead.businessName}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono">
                        {lead.email}
                      </div>

                      {lead.confirmedRevenue > 0 && (
                        <div className="font-black text-emerald-600 text-xs">
                          {formatCurrency(lead.confirmedRevenue)}
                        </div>
                      )}

                      {/* Stage transition controls */}
                      <div className="flex items-center justify-between pt-1 border-t">
                        <select
                          value={lead.crmStatus}
                          onChange={(e) =>
                            moveStageMutation.mutate({
                              id: lead.id,
                              newStage: e.target.value,
                            })
                          }
                          className="h-6 text-[10px] rounded border border-input bg-background px-1"
                        >
                          {PIPELINE_COLUMNS.map((c) => (
                            <option key={c.stage} value={c.stage}>
                              {c.label}
                            </option>
                          ))}
                        </select>

                        {lead.crmStatus !== 'WON' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevenueModalLead(lead)}
                            className="h-6 px-1.5 text-[10px] text-emerald-600 font-semibold"
                          >
                            <DollarSign className="h-3 w-3 mr-0.5" />
                            Record $
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Record Revenue Modal */}
      {revenueModalLead && (
        <Dialog open={!!revenueModalLead} onOpenChange={() => setRevenueModalLead(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Record Project Revenue for {revenueModalLead.businessName}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Log confirmed payment amount to update FixHubTech sales metrics.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold">Payment Amount (USD) *</label>
                <Input
                  type="number"
                  value={revenueAmount}
                  onChange={(e) => setRevenueAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="h-8 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Description</label>
                <Input
                  value={revenueDescription}
                  onChange={(e) => setRevenueDescription(e.target.value)}
                  placeholder="e.g. 50% Website Redesign Deposit"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="border-t pt-3">
              <Button variant="outline" onClick={() => setRevenueModalLead(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleRecordRevenue}
                disabled={!revenueAmount || recordRevenueMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {recordRevenueMutation.isPending ? 'Recording...' : 'Record Payment & Mark Won'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
