'use client';

import React, { useState, useMemo } from 'react';
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
  Paperclip,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';

const getLeadDisplayName = (lead: any, fallbackEmail?: string) => {
  if (!lead) {
    if (fallbackEmail) {
      const prefix = fallbackEmail.split('@')[0];
      return prefix.replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return 'Prospect';
  }
  const isGeneric =
    !lead.businessName ||
    lead.businessName.toLowerCase().includes('.com') ||
    lead.businessName.toLowerCase() === 'unknown business' ||
    lead.businessName.toLowerCase() === 'prospect business';

  if (lead.firstName && !isGeneric) {
    return `${lead.firstName} (${lead.businessName})`;
  }
  if (!isGeneric) {
    return lead.businessName;
  }
  if (lead.firstName) return lead.firstName;
  if (lead.email) {
    const prefix = lead.email.split('@')[0];
    return prefix.replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
  return 'Prospect';
};

const getInitials = (name: string) => {
  if (!name) return 'P';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export default function InboxPage() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [targetCrmStage, setTargetCrmStage] = useState('INTERESTED');
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});

  const toggleQuote = (msgId: string) => {
    setExpandedQuotes((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

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
      const draft =
        latestInbound?.draftReply ||
        (typeof latestInbound?.aiDraftReply === 'string' && latestInbound.aiDraftReply.startsWith('{')
          ? JSON.parse(latestInbound.aiDraftReply)
          : { textBody: latestInbound?.aiDraftReply });

      setReplySubject(draft?.subject || `Re: ${activeConversation.subject}`);
      setReplyBody(draft?.textBody || (typeof draft === 'string' ? draft : ''));
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

  // Merge outgoing and inbound messages chronologically
  const timeline = useMemo(() => {
    if (!activeConversation) return [];
    const outbox = (activeConversation.emailMessages || []).map((m: any) => ({
      ...m,
      isOutgoing: true,
      timestamp: new Date(m.sentAt || m.createdAt || 0).getTime(),
    }));
    const inbox = (activeConversation.inboundMessages || []).map((m: any) => ({
      ...m,
      isOutgoing: false,
      timestamp: new Date(m.receivedAt || m.createdAt || 0).getTime(),
    }));
    return [...outbox, ...inbox].sort((a, b) => a.timestamp - b.timestamp);
  }, [activeConversation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
          <Inbox className="h-6 w-6 mr-2 text-primary" />
          Inbound Communications &amp; AI Reply Assistant
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time prospect email threads with automated Groq intent classification and drafted replies.
        </p>
      </div>

      {/* Split Inbox Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[760px]">
        {/* Left Column: Conversation List */}
        <Card className="md:col-span-4 flex flex-col overflow-hidden shadow-sm border border-border/80">
          <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Conversations ({conversations.length})
            </span>
            <span className="text-[10px] text-muted-foreground">Auto-syncing</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {isListLoading ? (
              <LoadingState message="Loading threads..." />
            ) : conversations.length === 0 ? (
              <EmptyState
                title="No active conversations"
                description="When prospects reply to your outreach, their messages and AI drafts will appear here."
              />
            ) : (
              conversations.map((c: any) => {
                const latest = c.inboundMessages?.[c.inboundMessages.length - 1];
                const isSelected = selectedConversationId === c.id;
                const displayName = getLeadDisplayName(c.lead);
                const initials = getInitials(displayName);

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConversationId(c.id)}
                    className={`w-full text-left p-3.5 text-xs transition-colors hover:bg-muted/60 flex items-start space-x-3 ${
                      isSelected ? 'bg-muted border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate max-w-[150px]">
                          {displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDate(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-foreground/80 font-medium truncate mt-0.5">
                        {c.subject || 'No subject'}
                      </div>
                      {latest?.textBody && (
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5 font-sans">
                          {latest.textBody}
                        </div>
                      )}
                      {latest?.classification && (
                        <div className="mt-2 flex items-center space-x-1.5">
                          <StatusBadge status={latest.classification} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Column: Thread & Reply Assistant */}
        <Card className="md:col-span-8 flex flex-col overflow-hidden shadow-sm border border-border/80">
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
              <div className="p-4 border-b bg-card flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center">
                    {getInitials(getLeadDisplayName(activeConversation?.lead))}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {getLeadDisplayName(activeConversation?.lead)}
                    </h3>
                    <div className="text-xs text-muted-foreground flex items-center space-x-2">
                      <span>{activeConversation?.lead?.email}</span>
                      <span>·</span>
                      <span className="font-medium">Stage:</span>
                      <StatusBadge status={activeConversation?.lead?.crmStatus} />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground font-mono">
                  {timeline.length} message{timeline.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Message History Stream — Chronologically Interleaved */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
                {timeline.map((m: any) => {
                  if (m.isOutgoing) {
                    return (
                      <div key={`out-${m.id}`} className="flex justify-end items-end space-x-2">
                        <div className="max-w-xl rounded-2xl rounded-br-sm bg-primary text-primary-foreground p-4 text-xs shadow-sm space-y-2">
                          <div className="flex items-center justify-between border-b border-primary-foreground/20 pb-1.5 font-medium">
                            <span className="font-semibold text-xs flex items-center">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
                              Joshua Caleb (FixHubTech)
                            </span>
                            <span className="text-[10px] opacity-80">
                              {formatDate(m.sentAt || m.createdAt)}
                            </span>
                          </div>
                          <p className="whitespace-pre-line font-sans leading-relaxed text-xs">
                            {m.textBody}
                          </p>

                          {m.attachments && m.attachments.length > 0 && (
                            <div className="pt-2 border-t border-primary-foreground/20 mt-2 space-y-1.5">
                              <span className="text-[10px] font-semibold opacity-90 flex items-center">
                                <Paperclip className="h-3 w-3 mr-1" />
                                Attachments ({m.attachments.length}):
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {m.attachments.map((att: any, idx: number) => (
                                  <a
                                    key={idx}
                                    href={att.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={att.filename}
                                    className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-xs font-medium transition-colors text-primary-foreground"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    <span className="truncate max-w-[160px]">{att.filename}</span>
                                    <Download className="h-3 w-3 opacity-80 ml-1" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Inbound Message
                  const senderDisplay =
                    m.fromName ||
                    getLeadDisplayName(activeConversation?.lead, m.fromEmail);

                  return (
                    <div key={`in-${m.id}`} className="flex justify-start items-end space-x-2">
                      <div className="max-w-xl rounded-2xl rounded-bl-sm border bg-card p-4 text-xs shadow-sm space-y-2">
                        <div className="flex items-center justify-between border-b pb-1.5">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center uppercase">
                              {getInitials(senderDisplay)}
                            </div>
                            <div>
                              <span className="font-bold text-foreground">
                                {senderDisplay}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">
                                &lt;{m.fromEmail}&gt;
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(m.receivedAt || m.createdAt)}
                          </span>
                        </div>

                        {/* Clean Message Body */}
                        <p className="whitespace-pre-line text-foreground font-sans leading-relaxed text-xs">
                          {m.textBody || m.body}
                        </p>

                        {/* Collapsible Quoted Email History */}
                        {m.quotedText && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => toggleQuote(m.id)}
                              className="inline-flex items-center space-x-1 text-[10px] text-muted-foreground hover:text-foreground font-mono bg-muted/60 hover:bg-muted px-2 py-0.5 rounded transition-colors"
                              title="Toggle previous email history"
                            >
                              <span>···</span>
                              <span className="text-[10px] font-sans">
                                {expandedQuotes[m.id] ? 'Hide quoted text' : 'Show quoted history'}
                              </span>
                            </button>
                            {expandedQuotes[m.id] && (
                              <div className="mt-2 p-2.5 rounded-lg border-l-2 border-primary/40 bg-muted/30 text-[11px] text-muted-foreground whitespace-pre-line font-mono leading-relaxed">
                                {m.quotedText}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Attachments */}
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="pt-2 border-t mt-2 space-y-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground flex items-center">
                              <Paperclip className="h-3 w-3 mr-1 text-primary" />
                              Attachments ({m.attachments.length}):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {m.attachments.map((att: any, idx: number) => (
                                <a
                                  key={idx}
                                  href={att.url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={att.filename}
                                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border bg-muted/40 hover:bg-muted text-xs font-medium transition-colors text-foreground"
                                >
                                  <FileText className="h-3.5 w-3.5 text-primary" />
                                  <span className="truncate max-w-[160px]">{att.filename}</span>
                                  {att.size && (
                                    <span className="text-[10px] text-muted-foreground">
                                      ({Math.round(att.size / 1024)} KB)
                                    </span>
                                  )}
                                  <Download className="h-3 w-3 text-muted-foreground ml-1" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Classification Badge */}
                        {m.classification && (
                          <div className="pt-1.5 flex items-center space-x-2 border-t mt-1.5">
                            <span className="text-[10px] text-muted-foreground font-medium">AI Classification:</span>
                            <StatusBadge status={m.classification} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Groq AI Reply Assistant Composer */}
              <div className="p-4 border-t bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
                    Groq AI Contextual Reply Draft
                  </span>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-muted-foreground font-medium">Set CRM Stage:</span>
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
                    className="text-xs font-semibold"
                  />
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write your reply or refine AI draft..."
                    className="min-h-[100px] text-xs font-sans leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Sends instantly via Resend API</span>
                  </div>

                  <Button
                    onClick={handleSendReply}
                    disabled={sendReplyMutation.isPending || !replyBody.trim()}
                    className="h-8 px-4 text-xs font-medium"
                  >
                    {sendReplyMutation.isPending ? (
                      'Sending...'
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1.5" />
                        Send Reply
                      </>
                    )}
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
