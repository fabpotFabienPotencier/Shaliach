'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  Button,
  Input,
  Textarea,
  StatusBadge,
  Badge,
  Card,
  LoadingState,
  EmptyState,
  formatDate,
} from '@shaliach/ui';
import {
  Inbox,
  Send,
  Sparkles,
  User,
  Clock,
  CheckCircle,
  Building,
  Mail,
  ShieldBan,
} from 'lucide-react';

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [targetCrmStage, setTargetCrmStage] = useState('INTERESTED');

  const { data: conversationsData, isLoading: isListLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiFetch('/api/inbox'),
    refetchInterval: 10000,
  });

  const { data: activeConversation, isLoading: isThreadLoading } = useQuery({
    queryKey: ['conversation', selectedConversationId],
    queryFn: () => apiFetch(`/api/inbox/${selectedConversationId}`),
    enabled: !!selectedConversationId,
  });

  // Auto-populate AI reply draft when selecting a conversation
  React.useEffect(() => {
    if (activeConversation) {
      const latestInbound =
        activeConversation.inboundMessages?.[activeConversation.inboundMessages.length - 1];
      const draft = latestInbound?.draftReply;

      setReplySubject(draft?.subject || `Re: ${activeConversation.subject}`);
      setReplyBody(draft?.textBody || '');
    }
  }, [activeConversation]);

  const sendReplyMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/api/inbox/${selectedConversationId}/reply`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      alert('Reply sent successfully via Resend!');
    },
    onError: (err: any) => {
      alert(`Failed to send reply: ${err.message}`);
    },
  });

  const handleSendReply = () => {
    if (!replyBody.trim()) return;

    sendReplyMutation.mutate({
      subject: replySubject,
      bodyText: replyBody,
      bodyHtml: `<p>${replyBody.replace(/\n/g, '<br/>')}</p>`,
      crmStatus: targetCrmStage,
    });
  };

  const conversations = conversationsData?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
          <Inbox className="h-6 w-6 mr-2 text-primary" />
          Inbound Communications &amp; AI Reply Assistant
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Prospect email threads with automated Groq intent classification and drafted contextual replies.
        </p>
      </div>

      {/* Split Inbox Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[720px]">
        {/* Left Column: Conversation List */}
        <Card className="md:col-span-4 flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 border-b bg-muted/30">
            <span className="text-xs font-bold text-foreground">
              Prospect Conversations ({conversations.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {isListLoading ? (
              <LoadingState message="Loading threads..." />
            ) : conversations.length === 0 ? (
              <EmptyState
                title="No active conversations"
                description="When prospects reply to your outreach, their messages and AI drafts will appear here."
              />
            ) : (
              conversations.map((c: any) => {
                const latest = c.inboundMessages?.[0];
                const isSelected = selectedConversationId === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConversationId(c.id)}
                    className={`w-full text-left p-3 text-xs transition-colors hover:bg-muted/50 ${
                      isSelected ? 'bg-muted border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground truncate">
                        {c.lead?.businessName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                      {c.lead?.email}
                    </div>
                    {latest?.classification && (
                      <div className="mt-2">
                        <StatusBadge status={latest.classification} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Column: Thread & Reply Assistant */}
        <Card className="md:col-span-8 flex flex-col overflow-hidden shadow-sm">
          {!selectedConversationId ? (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState
                icon={Mail}
                title="Select a conversation"
                description="Choose an email thread on the left to review messages and send AI-assisted replies."
              />
            </div>
          ) : isThreadLoading ? (
            <LoadingState message="Loading thread messages..." />
          ) : (
            <div className="flex flex-col h-full">
              {/* Thread Header */}
              <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {activeConversation?.lead?.businessName}
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    {activeConversation?.lead?.email} · CRM:{' '}
                    <StatusBadge status={activeConversation?.lead?.crmStatus} />
                  </div>
                </div>
              </div>

              {/* Message History Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 dark:bg-slate-950/40">
                {/* Outgoing Outreach Messages */}
                {activeConversation?.emailMessages?.map((m: any) => (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-lg rounded-xl bg-primary text-primary-foreground p-3.5 text-xs shadow-sm">
                      <div className="font-bold mb-1 flex items-center justify-between">
                        <span>Joshua Caleb (FixHubTech)</span>
                        <span className="text-[10px] opacity-80">{formatDate(m.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-line font-sans">{m.textBody}</p>
                    </div>
                  </div>
                ))}

                {/* Inbound Prospect Replies */}
                {activeConversation?.inboundMessages?.map((inbound: any) => (
                  <div key={inbound.id} className="flex justify-start">
                    <div className="max-w-lg rounded-xl border bg-card p-3.5 text-xs shadow-sm space-y-2">
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <span className="font-bold text-foreground">
                          {activeConversation.lead.businessName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(inbound.receivedAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-foreground font-sans">
                        {inbound.body}
                      </p>
                      {inbound.classification && (
                        <div className="pt-1 flex items-center space-x-2">
                          <span className="text-[10px] text-muted-foreground">Classified:</span>
                          <StatusBadge status={inbound.classification} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Groq AI Reply Assistant Composer */}
              <div className="p-4 border-t bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
                    Groq AI Contextual Reply Draft
                  </span>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-muted-foreground">Set CRM Stage:</span>
                    <select
                      value={targetCrmStage}
                      onChange={(e) => setTargetCrmStage(e.target.value)}
                      className="h-7 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="INTERESTED">INTERESTED</option>
                      <option value="MEETING_REQUESTED">MEETING_REQUESTED</option>
                      <option value="PROPOSAL_SENT">PROPOSAL_SENT</option>
                      <option value="WON">WON</option>
                      <option value="LOST">LOST</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder="Subject..."
                    className="h-8 text-xs font-medium"
                  />
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type your reply or review the AI generated response..."
                    className="min-h-[100px] text-xs font-mono"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    size="sm"
                    onClick={handleSendReply}
                    disabled={!replyBody.trim() || sendReplyMutation.isPending}
                    className="shadow"
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {sendReplyMutation.isPending ? 'Sending via Resend...' : 'Send Approved Reply'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
