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
  StatusBadge,
  Card,
  formatDate,
} from '@shaliach/ui';
import {
  Send,
  Plus,
  Play,
  Pause,
  Sparkles,
  CheckSquare,
  Users,
  Settings2,
} from 'lucide-react';
import Link from 'next/link';

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'AI_GENERATED' | 'MANUAL_TEMPLATE'>('AI_GENERATED');
  const [dailySendLimit, setDailySendLimit] = useState(50);
  const [promptGuidelines, setPromptGuidelines] = useState(
    'Focus on web development, speed optimization, and mobile-responsive conversion for local service businesses.',
  );
  const [templateSubject, setTemplateSubject] = useState('Quick question regarding {{business_name}}');
  const [templateBodyText, setTemplateBodyText] = useState(
    'Hi {{first_name}},\n\nI noticed {{business_name}} has great reviews in {{city}}. I help businesses modernize their websites to convert more local visitors.\n\nBest,\nJoshua Caleb',
  );

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiFetch('/api/campaigns'),
  });

  const createCampaignMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsCreateOpen(false);
      setName('');
    },
    onError: (err: any) => {
      alert(`Failed to create campaign: ${err.message}`);
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiFetch(`/api/campaigns/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const handleCreate = () => {
    if (!name.trim()) return;

    createCampaignMutation.mutate({
      name,
      description,
      mode,
      dailySendLimit,
      promptGuidelines: mode === 'AI_GENERATED' ? promptGuidelines : undefined,
      templateSubject: mode === 'MANUAL_TEMPLATE' ? templateSubject : undefined,
      templateBodyText: mode === 'MANUAL_TEMPLATE' ? templateBodyText : undefined,
      templateBodyHtml: mode === 'MANUAL_TEMPLATE' ? `<p>${templateBodyText.replace(/\n/g, '<br/>')}</p>` : undefined,
    });
  };

  const columns: Column<any>[] = [
    {
      header: 'Campaign Name',
      cell: (campaign) => (
        <div>
          <div className="font-semibold text-foreground text-xs">{campaign.name}</div>
          <div className="text-[11px] text-muted-foreground flex items-center mt-0.5">
            {campaign.mode === 'AI_GENERATED' ? (
              <span className="flex items-center text-purple-600 font-medium">
                <Sparkles className="h-3 w-3 mr-1" /> AI Generated
              </span>
            ) : (
              <span>Manual Template</span>
            )}
            <span className="mx-1.5">·</span>
            <span>Limit: {campaign.dailySendLimit}/day</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (campaign) => <StatusBadge status={campaign.status} />,
    },
    {
      header: 'Recipients / Sends',
      cell: (campaign) => (
        <div className="text-xs">
          <div>{campaign._count?.recipients || 0} recipients</div>
          <div className="text-[11px] text-muted-foreground">
            {campaign._count?.emailMessages || 0} messages generated
          </div>
        </div>
      ),
    },
    {
      header: 'Created Date',
      cell: (campaign) => (
        <span className="text-xs text-muted-foreground">{formatDate(campaign.createdAt)}</span>
      ),
    },
    {
      header: 'Controls',
      cell: (campaign) => (
        <div className="flex space-x-1.5">
          {campaign.status === 'DRAFT' && campaign.mode === 'AI_GENERATED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actionMutation.mutate({ id: campaign.id, action: 'GENERATE_AI' })}
              className="h-7 text-xs text-purple-600 border-purple-200"
              disabled={actionMutation.isPending}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Generate Drafts
            </Button>
          )}

          {campaign.status === 'READY_FOR_REVIEW' && (
            <Link href="/approval">
              <Button size="sm" className="h-7 text-xs">
                <CheckSquare className="h-3 w-3 mr-1" />
                Review Queue
              </Button>
            </Link>
          )}

          {campaign.status === 'RUNNING' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actionMutation.mutate({ id: campaign.id, action: 'PAUSE' })}
              className="h-7 text-xs"
            >
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )}

          {campaign.status === 'PAUSED' && (
            <Button
              size="sm"
              onClick={() => actionMutation.mutate({ id: campaign.id, action: 'RESUME' })}
              className="h-7 text-xs"
            >
              <Play className="h-3 w-3 mr-1" />
              Resume
            </Button>
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
            Outreach Campaigns
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure Groq AI personalization, daily sending rate limits, and dispatch schedules.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Campaign
        </Button>
      </div>

      {/* Campaigns Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="No campaigns created yet"
        emptyDescription="Create your first email outreach campaign to start engaging prospective clients."
      />

      {/* Create Campaign Modal */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => setIsCreateOpen(open)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">New Outreach Campaign</DialogTitle>
            <DialogDescription className="text-xs">
              Set up campaign parameters, personalization mode, and sending limits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Campaign Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Florida HVAC & Plumbing Outreach - Q2"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Campaign Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="AI_GENERATED">Groq AI Personalized (Recommended)</option>
                  <option value="MANUAL_TEMPLATE">Manual Template Variables</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Daily Send Limit</label>
                <Input
                  type="number"
                  value={dailySendLimit}
                  onChange={(e) => setDailySendLimit(parseInt(e.target.value, 10))}
                  min={1}
                  max={2000}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {mode === 'AI_GENERATED' ? (
              <div className="space-y-1 border-t pt-3">
                <label className="font-semibold text-foreground flex items-center">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
                  Groq Personalization Guidelines
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Give instructions on pitch focus, service specialties, or industry angles.
                </p>
                <Textarea
                  value={promptGuidelines}
                  onChange={(e) => setPromptGuidelines(e.target.value)}
                  className="min-h-[80px] text-xs mt-1"
                />
              </div>
            ) : (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-1">
                  <label className="font-semibold">Subject Template</label>
                  <Input
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold">Body Template</label>
                  <Textarea
                    value={templateBodyText}
                    onChange={(e) => setTemplateBodyText(e.target.value)}
                    className="min-h-[90px] text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createCampaignMutation.isPending}
            >
              {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
