'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import {
  Button,
  Input,
  Textarea,
  StatusBadge,
  Badge,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Briefcase,
  DollarSign,
  HelpCircle,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INTERESTED' | 'MEETING_REQUEST' | 'PRICING_REQUEST'>('ALL');
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [targetCrmStage, setTargetCrmStage] = useState('INTERESTED');
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeCrmStage, setComposeCrmStage] = useState('CONTACTED');

  const toggleQuote = (msgId: string) => {
    setExpandedQuotes((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const { data: conversationsData, isLoading: isListLoading, refetch, isFetching } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiFetch('/api/inbox'),
    refetchInterval: 12000,
  });

  const { data: activeConversation, isLoading: isThreadLoading } = useQuery({
    queryKey: ['conversation', selectedConversationId],
    queryFn: () => apiFetch(`/api/inbox/${selectedConversationId}`),
    enabled: !!selectedConversationId,
  });

  // Auto-populate AI reply draft when selecting a conversation
  useEffect(() => {
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
      if (activeConversation.lead?.crmStatus) {
        setTargetCrmStage(activeConversation.lead.crmStatus);
      }
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
      alert('Reply sent successfully!');
    },
    onError: (err: any) => {
      alert(`Failed to send reply: ${err.message}`);
    },
  });

  const composeMessageMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/api/inbox/compose', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setIsComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      if (res?.conversationId) {
        setSelectedConversationId(res.conversationId);
      }
      alert('Email sent successfully via Resend!');
    },
    onError: (err: any) => {
      alert(`Failed to send email: ${err.message}`);
    },
  });

  const updateLeadStageMutation = useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: string }) =>
      apiFetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ crmStatus: status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const suppressLeadMutation = useMutation({
    mutationFn: (leadId: string) =>
      apiFetch('/api/leads/bulk', {
        method: 'POST',
        body: JSON.stringify({
          leadIds: [leadId],
          action: 'SUPPRESS',
          suppressionReason: 'MANUAL_INBOX_OPT_OUT',
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      alert('Lead suppressed. No further outreach will be sent.');
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

  const handleSendCompose = () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;

    composeMessageMutation.mutate({
      toEmail: composeTo.trim(),
      subject: composeSubject.trim(),
      bodyText: composeBody.trim(),
      crmStatus: composeCrmStage,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const applyQuickTemplate = (template: string) => {
    setReplyBody((prev) => {
      if (!prev.trim()) return template;
      return `${prev.trim()}\n\n${template}`;
    });
  };

  const allConversations = conversationsData?.items || [];

  // Filter conversations based on search and classification filter
  const filteredConversations = useMemo(() => {
    return allConversations.filter((c: any) => {
      const displayName = getLeadDisplayName(c.lead).toLowerCase();
      const email = (c.lead?.email || '').toLowerCase();
      const subject = (c.subject || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || displayName.includes(q) || email.includes(q) || subject.includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;

      const latest = c.inboundMessages?.[c.inboundMessages.length - 1];
      const cls = latest?.classification || '';
      return cls === statusFilter;
    });
  }, [allConversations, searchQuery, statusFilter]);

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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center">
            <Inbox className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-primary" />
            Inbox &amp; Direct Messaging
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time conversations, AI reply drafting, and direct B2B outreach messaging.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs"
            title="Refresh inbox"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsComposeOpen(true)}
            className="bg-primary text-primary-foreground font-semibold h-8 text-xs shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Message
          </Button>
        </div>
      </div>

      {/* Main Mailbox Container — Device-Friendly Responsive Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-140px)] min-h-[620px]">
        {/* Left Column: Conversation Sidebar (Hidden on mobile if a thread is active) */}
        <Card
          className={`flex flex-col overflow-hidden shadow-sm border border-border/80 ${
            selectedConversationId ? 'hidden md:flex md:col-span-4 lg:col-span-4' : 'flex md:col-span-4 lg:col-span-4'
          }`}
        >
          {/* Search & Filter Header */}
          <div className="p-3 border-b bg-muted/20 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, subject..."
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Classification Quick Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px]">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                All ({allConversations.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('INTERESTED')}
                className={`px-2 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'INTERESTED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                Interested
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('MEETING_REQUEST')}
                className={`px-2 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'MEETING_REQUEST'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20'
                }`}
              >
                Meeting
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PRICING_REQUEST')}
                className={`px-2 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'PRICING_REQUEST'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                Pricing
              </button>
            </div>
          </div>

          {/* Conversation List Stream */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {isListLoading ? (
              <LoadingState message="Loading threads..." />
            ) : filteredConversations.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No messages found"
                description={
                  searchQuery || statusFilter !== 'ALL'
                    ? 'Try clearing your search query or filters.'
                    : 'When prospects reply or when you compose messages, they will appear here.'
                }
              />
            ) : (
              filteredConversations.map((c: any) => {
                const latest = c.inboundMessages?.[c.inboundMessages.length - 1];
                const isSelected = selectedConversationId === c.id;
                const displayName = getLeadDisplayName(c.lead);
                const initials = getInitials(displayName);

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConversationId(c.id)}
                    className={`w-full text-left p-3.5 text-xs transition-colors hover:bg-muted/60 flex items-start space-x-3 ${
                      isSelected ? 'bg-muted/80 border-l-4 border-l-primary font-medium' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground truncate max-w-[140px]">
                          {displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
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

        {/* Right Column: Thread & Reply Assistant (Visible on desktop, or on mobile when thread is selected) */}
        <Card
          className={`flex flex-col overflow-hidden shadow-sm border border-border/80 ${
            selectedConversationId ? 'flex md:col-span-8 lg:col-span-8' : 'hidden md:flex md:col-span-8 lg:col-span-8'
          }`}
        >
          {!selectedConversationId ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <EmptyState
                icon={Mail}
                title="Select a conversation"
                description="Choose an email thread from the left or click 'New Message' to send a direct email."
              />
            </div>
          ) : isThreadLoading ? (
            <LoadingState message="Loading thread messages..." />
          ) : (
            <div className="flex flex-col h-full">
              {/* Thread Header with Mobile Back Button & Controls */}
              <div className="p-3 sm:p-4 border-b bg-card flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                  {/* Mobile Back Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedConversationId(null)}
                    className="md:hidden h-8 px-2 text-xs text-muted-foreground"
                    title="Back to conversation list"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>

                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/15 text-primary font-bold text-xs sm:text-sm flex items-center justify-center shrink-0">
                    {getInitials(getLeadDisplayName(activeConversation?.lead))}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h3 className="font-bold text-xs sm:text-sm text-foreground truncate">
                        {getLeadDisplayName(activeConversation?.lead)}
                      </h3>
                      {activeConversation?.lead?.email && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeConversation.lead.email)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                          title="Copy email address"
                        >
                          {copiedEmail ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center space-x-1.5 truncate">
                      <span className="truncate">{activeConversation?.lead?.email}</span>
                      <span>·</span>
                      <span className="font-medium">Stage:</span>
                      <StatusBadge status={activeConversation?.lead?.crmStatus} />
                    </div>
                  </div>
                </div>

                {/* Header Action Controls */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  {activeConversation?.lead && (
                    <select
                      value={activeConversation.lead.crmStatus || 'IMPORTED'}
                      onChange={(e) =>
                        updateLeadStageMutation.mutate({
                          leadId: activeConversation.lead.id,
                          status: e.target.value,
                        })
                      }
                      className="h-7 text-[11px] rounded border border-input bg-background px-1.5 text-foreground shadow-sm"
                      title="Update prospect stage"
                    >
                      <option value="IMPORTED">IMPORTED</option>
                      <option value="VALIDATED">VALIDATED</option>
                      <option value="CONTACTED">CONTACTED</option>
                      <option value="INTERESTED">INTERESTED</option>
                      <option value="MEETING_REQUESTED">MEETING_REQUESTED</option>
                      <option value="PROPOSAL_SENT">PROPOSAL_SENT</option>
                      <option value="WON">WON</option>
                      <option value="LOST">LOST</option>
                    </select>
                  )}

                  {activeConversation?.lead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Opt-out and suppress future outreach to ${activeConversation.lead.email}?`)) {
                          suppressLeadMutation.mutate(activeConversation.lead.id);
                        }
                      }}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                      title="Suppress contact"
                    >
                      <ShieldBan className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Message History Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
                {timeline.map((m: any) => {
                  if (m.isOutgoing) {
                    return (
                      <div key={`out-${m.id}`} className="flex justify-end items-end space-x-2">
                        <div className="max-w-xl rounded-2xl rounded-br-sm bg-primary text-primary-foreground p-3.5 sm:p-4 text-xs shadow-sm space-y-2">
                          <div className="flex items-center justify-between border-b border-primary-foreground/20 pb-1.5 font-medium">
                            <span className="font-semibold text-xs flex items-center">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" />
                              Joshua Caleb (FixHubTech)
                            </span>
                            <span className="text-[10px] opacity-80 font-mono">
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
                      <div className="max-w-xl rounded-2xl rounded-bl-sm border bg-card p-3.5 sm:p-4 text-xs shadow-sm space-y-2">
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
                          <span className="text-[10px] text-muted-foreground font-mono">
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

                        {/* Classification Badge */}
                        {m.classification && (
                          <div className="pt-1.5 flex items-center space-x-2 border-t mt-1.5">
                            <span className="text-[10px] text-muted-foreground font-medium">AI Intent:</span>
                            <StatusBadge status={m.classification} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Assistant & Composer */}
              <div className="p-3 sm:p-4 border-t bg-card space-y-2.5">
                {/* Header & Quick Reply Presets */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
                    Groq AI Reply Draft &amp; Presets
                  </span>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        applyQuickTemplate(
                          "Thanks for getting back to me! I'd love to show you how we can help. Do you have 10-15 minutes this Thursday or Friday for a quick intro call?"
                        )
                      }
                      className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted text-foreground transition-colors whitespace-nowrap"
                    >
                      <Calendar className="h-3 w-3 mr-1 text-purple-600" />
                      Book Call
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyQuickTemplate(
                          "Thanks for reaching out! You can view our latest client case studies and website redesigns at https://fixhubtech.com. Would you like me to walk you through a specific example relevant to your industry?"
                        )
                      }
                      className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted text-foreground transition-colors whitespace-nowrap"
                    >
                      <Briefcase className="h-3 w-3 mr-1 text-blue-600" />
                      Portfolio
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        applyQuickTemplate(
                          "Thanks for asking! Our web development and speed optimization packages typically start at reasonable project-based rates with no long-term lock-in. Could you share what you're looking to achieve so I can send an exact quote?"
                        )
                      }
                      className="inline-flex items-center px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted text-foreground transition-colors whitespace-nowrap"
                    >
                      <DollarSign className="h-3 w-3 mr-1 text-emerald-600" />
                      Pricing
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder="Subject..."
                    className="text-xs font-semibold h-8"
                  />
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write your response or edit the AI draft..."
                    className="min-h-[85px] sm:min-h-[105px] text-xs font-sans leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Dispatches directly via Resend</span>
                  </div>

                  <Button
                    onClick={handleSendReply}
                    disabled={sendReplyMutation.isPending || !replyBody.trim()}
                    className="h-8 px-4 text-xs font-semibold bg-primary text-primary-foreground shadow-sm"
                  >
                    {sendReplyMutation.isPending ? (
                      'Sending...'
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1.5" />
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

      {/* Compose Direct Message Modal */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center">
              <Mail className="h-5 w-5 mr-2 text-primary" />
              Compose Direct Email
            </DialogTitle>
            <DialogDescription className="text-xs">
              Send a 1-to-1 personalized email directly to any prospect or client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Recipient Email *</label>
              <Input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="e.g. prospect@business.com"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Subject *</label>
              <Input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="e.g. Quick question regarding your website"
                className="h-8 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Message Body *</label>
              <Textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Hi [Name],&#10;&#10;I noticed your business online and wanted to reach out..."
                className="min-h-[140px] text-xs font-sans leading-relaxed"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Set Initial CRM Stage</label>
              <select
                value={composeCrmStage}
                onChange={(e) => setComposeCrmStage(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="CONTACTED">CONTACTED</option>
                <option value="INTERESTED">INTERESTED</option>
                <option value="MEETING_REQUESTED">MEETING_REQUESTED</option>
              </select>
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSendCompose}
              disabled={composeMessageMutation.isPending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {composeMessageMutation.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
