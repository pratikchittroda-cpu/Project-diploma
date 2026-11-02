import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { onAuthStateChanged } from 'firebase/auth';
import GlassCard from '../../components/GlassCard';
import { Icon } from '../../constants/Icons';
import { lightTheme, useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../config/firebase';
import { AI_FEATURES_ENABLED, SERVER_FEATURES_ENABLED } from '../../config/releaseFeatures';
import { AI_API_BASE_URL, API_BASE_URL } from '../../config/publicConfig';
import aiService from '../../services/aiService';

const AI_CONNECTION_ENABLED = AI_FEATURES_ENABLED || SERVER_FEATURES_ENABLED;
const AI_CONNECTION_CONFIGURED = Boolean(AI_API_BASE_URL || API_BASE_URL);

const QUICK_QUESTIONS = [
  'How can I reduce my spending this month?',
  'What category is costing me the most?',
  'How can I plan a realistic savings goal?',
  'Am I staying within budget this month?',
];

function requestError(result) {
  switch (result?.code) {
    case 'backend/disabled':
      return 'The secure AI connection is not enabled in this build. Enable the AI connection and configure its HTTPS service before sending.';
    case 'backend/not-configured':
      return 'The secure AI service is not configured. Set its HTTPS API connection before sending.';
    case 'ai/disabled':
      return 'The hosted AI service is still being configured. No AI reply was returned; try again after setup is complete.';
    case 'backend/timeout':
      return 'The secure service timed out without returning a reply. It may have processed the question; retrying sends a new request.';
    case 'backend/cancelled':
      return 'Request cancelled. No reply was added. Cancellation cannot recall data that was already sent.';
    case 'account/incomplete':
      return 'Your account setup is incomplete. Finish setup before sending a financial question.';
    default:
      return result?.error || 'Unable to reach the secure AI service. Check your connection and try again.';
  }
}

export default function AIChatScreen({ navigation }) {
  const { user, userData, profileStatus, initializing } = useAuth();
  const [authSession, setAuthSession] = useState(() => ({ user: auth.currentUser, revision: 0 }));

  // Observe identity only; authentication and tokens remain in the service layer.
  useEffect(() => onAuthStateChanged(auth, nextUser => {
    setAuthSession(previous => previous.user === nextUser ? previous
      : { user: nextUser, revision: previous.revision + 1 });
  }), []);
  const profileComplete = userData?.profileComplete;
  const ownerUid = profileStatus === 'ready' && !initializing && (profileComplete === undefined || profileComplete === true) && user?.uid
    && authSession.user === user && auth.currentUser === user
    ? user.uid : null;

  // A new account gets a fresh, memory-only conversation and fresh consent.
  return <ChatConversation key={`${ownerUid || 'signed-out'}:${authSession.revision}`} navigation={navigation}
    ownerUid={ownerUid} ownerUser={ownerUid ? user : null} />;
}

function ChatConversation({ navigation, ownerUid, ownerUser }) {
  const { theme, isDarkMode, currentThemeId, themeConfigs } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const inputRef = useRef(null);
  const sharingYRef = useRef(0);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const requestRef = useRef(null);
  const requestSequence = useRef(0);
  const draftRef = useRef('');
  const consentRef = useRef(false);
  const messagesRef = useRef([]);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastFailure, setLastFailure] = useState(null);
  const [inputError, setInputError] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const palette = theme || lightTheme;
  const dark = isDarkMode ?? palette.isDarkMode;
  const gradientColors = themeConfigs?.[currentThemeId]?.colors
    || themeConfigs?.default?.colors
    || [palette.primary, palette.primaryLight || palette.primary];
  const bottomInset = keyboardVisible ? 0 : insets.bottom;
  const styles = useMemo(() => createStyles(palette, dark, bottomInset), [palette, dark, bottomInset]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      if (mountedRef.current) scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => { setKeyboardVisible(true); scrollToEnd(); });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      mountedRef.current = false;
      const pending = requestRef.current;
      requestRef.current = null;
      busyRef.current = false;
      consentRef.current = false;
      pending?.controller.abort();
      show.remove();
      hide.remove();
    };
  }, [scrollToEnd]);

  useEffect(() => {
    if (messages.length || submitting || lastFailure) scrollToEnd();
  }, [messages, submitting, lastFailure, scrollToEnd]);

  const writeDraft = (value) => {
    draftRef.current = value;
    setQuestion(value);
    setInputError(null);
  };
  const updateMessages = (next) => {
    messagesRef.current = next;
    setMessages(next);
  };
  const sameAccount = () => Boolean(mountedRef.current && ownerUid && auth.currentUser === ownerUser);
  const currentRequest = (pending) => sameAccount()
    && requestRef.current === pending && auth.currentUser === pending.user;

  const cancelPending = () => {
    const pending = requestRef.current;
    if (!pending) return;
    // Invalidate synchronously before aborting; a late result cannot add a reply.
    requestRef.current = null;
    busyRef.current = false;
    pending.controller.abort();
    if (!sameAccount()) return;
    updateMessages(messagesRef.current.filter(message => message.id !== pending.messageId));
    if (!draftRef.current) writeDraft(pending.question);
    setSubmitting(false);
    setLastFailure({ question: pending.question, code: 'backend/cancelled', message: requestError({ code: 'backend/cancelled' }) });
  };

  const changeConsent = () => {
    if (!sameAccount()) return;
    const next = !consentRef.current;
    consentRef.current = next;
    setConsent(next);
    setInputError(null);
    if (!next) cancelPending();
  };

  const reviewSharing = () => {
    Keyboard.dismiss();
    scrollViewRef.current?.scrollTo({ y: Math.max(0, sharingYRef.current - 12), animated: true });
  };

  const clearConversation = () => {
    const pending = requestRef.current;
    requestRef.current = null;
    busyRef.current = false;
    consentRef.current = false;
    pending?.controller.abort();
    updateMessages([]);
    writeDraft('');
    setConsent(false);
    setSubmitting(false);
    setLastFailure(null);
    Keyboard.dismiss();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleAsk = async (rawQuestion = draftRef.current) => {
    if (busyRef.current) return;
    const trimmedQuestion = typeof rawQuestion === 'string' ? rawQuestion.trim() : '';
    if (trimmedQuestion.length < 2 || rawQuestion.length > 2000) {
      setInputError('Enter a finance-related question of 2–2000 characters.');
      return;
    }
    if (!sameAccount()) {
      setInputError('Finish signing in to your account before sending.');
      return;
    }
    if (!consentRef.current) {
      setInputError('Review data sharing and agree for this conversation before sending.');
      reviewSharing();
      return;
    }

    busyRef.current = true;
    const sequence = ++requestSequence.current;
    const pending = {
      controller: new AbortController(), user: auth.currentUser,
      question: trimmedQuestion, messageId: `user-${sequence}`,
    };
    requestRef.current = pending;
    const conversationHistory = messagesRef.current.slice(-8)
      .map(({ role, content }) => ({ role, content }));
    updateMessages([...messagesRef.current, { id: pending.messageId, role: 'user', content: trimmedQuestion }]);
    if (draftRef.current.trim() === trimmedQuestion) writeDraft('');
    setLastFailure(null);
    setInputError(null);
    setSubmitting(true);

    try {
      const result = await aiService.getFinancialChatResponse({
        question: trimmedQuestion, conversationHistory, consent: true, signal: pending.controller.signal,
      });
      if (!currentRequest(pending) || pending.controller.signal.aborted) return;
      if (!result?.success || typeof result.answer !== 'string' || !result.answer.trim()) {
        updateMessages(messagesRef.current.filter(message => message.id !== pending.messageId));
        if (!draftRef.current) writeDraft(trimmedQuestion);
        setLastFailure({ question: trimmedQuestion, code: result?.code, message: requestError(result) });
        return;
      }
      // Keep the full service-validated answer in the bubble, not a truncated excerpt.
      updateMessages([...messagesRef.current, {
        id: `assistant-${sequence}`, role: 'assistant', content: result.answer, context: result.context,
      }]);
    } catch (error) {
      if (!currentRequest(pending) || pending.controller.signal.aborted) return;
      updateMessages(messagesRef.current.filter(message => message.id !== pending.messageId));
      if (!draftRef.current) writeDraft(trimmedQuestion);
      const code = error?.name === 'AbortError' ? 'backend/cancelled' : error?.code;
      setLastFailure({ question: trimmedQuestion, code, message: requestError({ code, error: error?.message }) });
    } finally {
      if (requestRef.current === pending) {
        requestRef.current = null;
        busyRef.current = false;
        if (sameAccount()) setSubmitting(false);
      }
    }
  };

  const canSend = Boolean(sameAccount() && consent && !submitting && question.trim().length >= 2 && question.length <= 2000);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <GlassCard style={styles.headerCard} borderRadius={24} padding={14}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={22} color={palette.text} accessible={false} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={styles.headerTitle}>Financial AI Chat</Text>
              <Text style={styles.headerSubtitle}>
                {AI_CONNECTION_ENABLED && AI_CONNECTION_CONFIGURED ? 'Secure finance conversation' : 'AI connection setup required'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.privacyButton}
              accessibilityRole="button"
              accessibilityLabel="Open Privacy & data"
              onPress={() => navigation.navigate('Privacy')}
            >
              <Icon name="shield-lock-outline" size={19} color={palette.text} accessible={false} />
              <Text style={styles.privacyText}>Privacy</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerToolbar}>
            <Text style={styles.sessionNote}>Session-only chat history</Text>
            <TouchableOpacity
              testID="ai-clear-chat"
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear conversation, draft and data-sharing consent"
              onPress={clearConversation}
            >
              <Icon name="delete-outline" size={18} color={palette.text} accessible={false} />
              <Text style={styles.clearText}>Clear chat</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
        <KeyboardAvoidingView
          style={styles.chatShell}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {(!AI_CONNECTION_ENABLED || !AI_CONNECTION_CONFIGURED) && <View testID="ai-connection-notice" style={styles.unavailableNotice}>
              <View style={styles.noticeHeading}>
                <Icon name="connection" size={22} color={palette.text} accessible={false} />
                <Text accessibilityRole="header" style={styles.noticeTitle}>
                  Secure AI setup required
                </Text>
              </View>
              <Text style={styles.noticeBody}>
                {AI_CONNECTION_ENABLED
                  ? 'The secure AI API connection has not been configured. You can prepare a question while connection setup is completed.'
                  : 'The secure AI connection is not enabled in this build. You can prepare a question while AI connection setup is completed.'}
              </Text>
              <Text style={styles.noticeDetail}>
                Live replies require the hosted HTTPS AI service and your sharing consent.
              </Text>
            </View>}

            <View style={styles.sharingCard} onLayout={event => { sharingYRef.current = event.nativeEvent.layout.y; }}>
              <View style={styles.noticeHeading}>
                <Icon name="shield-lock-outline" size={20} color={palette.primary} accessible={false} />
                <Text accessibilityRole="header" style={styles.sharingTitle}>Choose what you share</Text>
              </View>
              <Text style={styles.noticeBody}>
                Only after you agree and tap Send, the secure API shares your question (2–2000 characters), up to 8 recent chat excerpts (4000 characters total), and aggregate month-to-date finance and budget context with hosted NVIDIA AI.
              </Text>
              <Text style={styles.sharingDetail}>
                Finance context comes from a complete, verified server snapshot; raw ledger descriptions and identifiers are not shared with NVIDIA. No data is sent automatically. Chat history is kept in memory on this screen, not saved locally; service and provider privacy policies still apply to sent data.
              </Text>
              <TouchableOpacity
                testID="ai-data-consent"
                style={[styles.consentButton, consent && styles.consentButtonSelected, !ownerUid && styles.controlDisabled]}
                accessibilityRole="checkbox"
                accessibilityLabel="Allow bounded data sharing for this conversation when I tap Send"
                accessibilityState={{ checked: consent, disabled: !ownerUid }}
                accessibilityHint="Consent is required for sending and resets when chat is cleared or your account changes. Revoking cancels any pending request."
                disabled={!ownerUid}
                onPress={changeConsent}
              >
                <Icon name={consent ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} size={22} color={palette.primary} accessible={false} />
                <Text style={styles.consentText}>{consent ? 'Sharing allowed · tap to revoke' : 'I agree for this conversation'}</Text>
              </TouchableOpacity>
              <Text style={styles.sharingDetail}>
                {ownerUid ? 'Clear chat or change accounts to reset consent. Cancellation cannot recall data already sent.' : 'You can prepare a draft. Finish signing in before consenting or sending.'}
              </Text>
            </View>

            <View style={[styles.messageBubble, styles.assistantBubble]}>
              <View style={styles.assistantHeading}>
                <View style={styles.assistantAvatar}>
                  <Icon name="robot-outline" size={22} color={palette.text} accessible={false} />
                </View>
                <View style={styles.assistantCopy}>
                  <Text style={styles.assistantName}>Financial AI</Text>
                  <Text style={styles.messageLabel}>Getting started · app message</Text>
                </View>
              </View>
              <Text style={styles.messageText}>
                Ask about spending, budgets, cash flow or savings. Pick an idea to edit, or write your own question. Review data sharing before sending. Replies require the secure AI connection.
              </Text>
            </View>

            {messages.map(message => (
              <View key={message.id} testID={`ai-message-${message.role}`}
                style={[styles.messageBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.messageLabel, message.role === 'user' && styles.userMessageLabel]}>
                  {message.role === 'user' ? 'You' : 'Financial AI'}
                </Text>
                <Text selectable style={[styles.messageText, message.role === 'user' && styles.userMessageText]}>
                  {message.content}
                </Text>
                {message.role === 'assistant' && message.context?.complete === true && (
                  <Text style={styles.contextNote}>Verified month-to-date context · {message.context.transactionCount} entries</Text>
                )}
              </View>
            ))}

            {submitting && <View testID="ai-chat-loading" style={[styles.messageBubble, styles.assistantBubble]}>
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={palette.primary} accessibilityLabel="Waiting for the secure service" />
                <Text accessibilityLiveRegion="polite" style={styles.loadingText}>Waiting for the secure service…</Text>
              </View>
              <TouchableOpacity testID="ai-cancel-request" style={styles.inlineButton} accessibilityRole="button"
                accessibilityLabel="Cancel AI request" onPress={cancelPending}>
                <Icon name="close-circle-outline" size={18} color={palette.text} accessible={false} />
                <Text style={styles.inlineButtonText}>Cancel request</Text>
              </TouchableOpacity>
            </View>}

            {lastFailure && <View testID="ai-chat-error" style={styles.errorCard}>
              <View style={styles.noticeHeading}>
                <Icon name={lastFailure.code === 'backend/cancelled' ? 'close-circle-outline' : 'alert-circle-outline'} size={20} color={palette.text} accessible={false} />
                <Text accessibilityRole="header" style={styles.sharingTitle}>
                  {lastFailure.code === 'backend/cancelled' ? 'Request cancelled' : 'No reply received'}
                </Text>
              </View>
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.noticeBody}>{lastFailure.message}</Text>
              <Text style={styles.sharingDetail}>Your question is available to edit or retry. Retrying sends a new request.</Text>
              <View style={styles.errorActions}>
                <TouchableOpacity testID="ai-retry-request" style={[styles.inlineButton, (!consent || !ownerUid || submitting) && styles.controlDisabled]}
                  accessibilityRole="button" accessibilityLabel="Retry previous question"
                  accessibilityState={{ disabled: !consent || !ownerUid || submitting }}
                  disabled={!consent || !ownerUid || submitting} onPress={() => handleAsk(lastFailure.question)}>
                  <Icon name="refresh" size={18} color={palette.primary} accessible={false} />
                  <Text style={styles.inlineButtonText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="ai-edit-failed-question" style={styles.inlineButton} accessibilityRole="button"
                  accessibilityLabel="Edit previous question" onPress={() => { writeDraft(lastFailure.question); inputRef.current?.focus(); }}>
                  <Icon name="pencil-outline" size={18} color={palette.text} accessible={false} />
                  <Text style={styles.inlineButtonText}>Edit question</Text>
                </TouchableOpacity>
              </View>
            </View>}

            {messages.length === 0 && !submitting && <View style={styles.suggestions}>
              <Text accessibilityRole="header" style={styles.suggestionsTitle}>Try a question</Text>
              <Text style={styles.suggestionsHint}>Tap to fill your draft. Edit it before sending.</Text>
              <View style={styles.quickQuestionRow}>
                {QUICK_QUESTIONS.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    style={styles.quickChip}
                    accessibilityRole="button"
                    accessibilityLabel={suggestion}
                    accessibilityHint="Fills the editable draft without sending it."
                    onPress={() => { writeDraft(suggestion); inputRef.current?.focus(); }}
                  >
                    <Icon name="chat-outline" size={16} color={palette.primary} accessible={false} />
                    <Text style={styles.quickChipText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity testID="ai-review-sharing" style={styles.sharingStatus} accessibilityRole="button"
              accessibilityLabel={consent ? 'Revoke data-sharing consent for this conversation' : 'Review data sharing before sending'}
              onPress={consent ? changeConsent : reviewSharing}>
              <Icon name={consent ? 'shield-check-outline' : 'shield-lock-outline'} size={18} color={palette.primary} accessible={false} />
              <Text style={styles.sharingStatusText}>{consent ? 'Sharing allowed · revoke' : 'Review data sharing to send'}</Text>
              <Icon name="chevron-up" size={18} color={palette.textSecondary} accessible={false} />
            </TouchableOpacity>
            <View style={styles.inputBar}>
              <TextInput
                ref={inputRef}
                testID="ai-question-input"
                style={styles.input}
                value={question}
                onChangeText={writeDraft}
                placeholder="Ask about your finances"
                placeholderTextColor={palette.placeholderText || palette.textSecondary}
                maxLength={2000}
                multiline
                textAlignVertical="top"
                onFocus={scrollToEnd}
                accessibilityLabel="Your financial question"
                accessibilityHint="Editable draft, 2 to 2000 characters. Nothing is sent until you consent and tap Send."
              />
              <TouchableOpacity
                testID="ai-send-question"
                style={[styles.sendButton, !canSend && styles.controlDisabled]}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send question"
                accessibilityState={{ disabled: !canSend, busy: submitting }}
                accessibilityHint="Sends through the secure AI service only with your data-sharing consent. An unconfigured connection reports a setup error."
                onPress={() => handleAsk()}
              >
                {submitting ? <ActivityIndicator size="small" color="white" /> : <Icon name="send" size={20} color="white" accessible={false} />}
              </TouchableOpacity>
            </View>
            <View style={styles.composerMeta}>
              <Text accessibilityLiveRegion="polite" style={styles.composerHint}>
                {inputError || (question.trim().length === 1 ? 'Use at least 2 characters.' : submitting ? 'You can prepare your next draft while waiting.' : 'Sent only with consent and your tap on Send.')}
              </Text>
              <Text style={styles.characterCount}>{question.length}/2000</Text>
            </View>
            <Text style={styles.footerNoticeText}>AI can make mistakes. General information only, not professional financial advice.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme, isDarkMode, bottomInset) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  background: { ...StyleSheet.absoluteFillObject },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  headerCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    backgroundColor: isDarkMode ? 'rgba(15, 15, 15, 0.8)' : 'rgba(255, 255, 255, 0.88)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.inputBackgroundFocused || theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: theme.text },
  headerSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 18, color: theme.textSecondary },
  privacyButton: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: theme.inputBackgroundFocused || theme.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  privacyText: { fontSize: 12, fontWeight: '600', color: theme.text },
  headerToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  sessionNote: { flex: 1, fontSize: 12, lineHeight: 18, color: theme.textSecondary },
  clearButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, minWidth: 44, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: theme.inputBackgroundFocused || theme.inputBackground,
  },
  clearText: { fontSize: 12, fontWeight: '600', color: theme.text },
  chatShell: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: isDarkMode ? 'rgba(15, 15, 15, 0.92)' : 'rgba(255, 255, 255, 0.94)',
  },
  messages: { flex: 1 },
  messagesContent: { flexGrow: 1, padding: 18, paddingBottom: 24, gap: 16 },
  unavailableNotice: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.5)' : theme.warning,
    backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : theme.warningLight,
    gap: 8,
  },
  noticeHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeTitle: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: '700', color: theme.text },
  noticeBody: { fontSize: 14, lineHeight: 21, color: theme.text },
  noticeDetail: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: theme.textSecondary },
  sharingCard: {
    padding: 16, borderRadius: 18, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.inputBackground, gap: 10,
  },
  sharingTitle: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: '700', color: theme.text },
  sharingDetail: { fontSize: 13, lineHeight: 20, color: theme.textSecondary },
  consentButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, minWidth: 44,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  },
  consentButtonSelected: { borderColor: theme.primary, backgroundColor: theme.primaryContainer || theme.inputBackground },
  consentText: { flex: 1, color: theme.text, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  messageBubble: {
    maxWidth: '92%', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 18, gap: 6,
  },
  assistantBubble: { alignSelf: 'flex-start', borderTopLeftRadius: 6, backgroundColor: theme.inputBackground },
  userBubble: { alignSelf: 'flex-end', borderTopRightRadius: 6, backgroundColor: theme.primary },
  assistantHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  assistantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assistantCopy: { flex: 1 },
  assistantName: { fontSize: 15, fontWeight: '700', color: theme.text },
  messageLabel: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: theme.textSecondary },
  userMessageLabel: { color: 'rgba(255,255,255,0.84)' },
  userMessageText: { color: 'white' },
  messageText: { fontSize: 15, lineHeight: 22, color: theme.text },
  contextNote: { fontSize: 12, lineHeight: 18, color: theme.textSecondary, marginTop: 6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { flexShrink: 1, fontSize: 14, lineHeight: 21, color: theme.textSecondary },
  inlineButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  },
  inlineButtonText: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: theme.text },
  errorCard: {
    padding: 16, borderRadius: 18, borderWidth: 1, borderColor: theme.warning,
    backgroundColor: isDarkMode ? 'rgba(245,158,11,0.1)' : theme.warningLight, gap: 10,
  },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  suggestions: { marginTop: 4, gap: 8 },
  suggestionsTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  suggestionsHint: { fontSize: 13, color: theme.textSecondary },
  quickQuestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.inputBackground,
  },
  quickChipText: { flexShrink: 1, fontSize: 13, lineHeight: 20, fontWeight: '600', color: theme.text },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: Math.max(16, bottomInset + 8),
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
    gap: 8,
  },
  sharingStatus: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sharingStatusText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '600', color: theme.textSecondary },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  input: {
    flex: 1,
    minHeight: 56,
    maxHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.inputBackground,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
    color: theme.text,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDisabled: { opacity: 0.45 },
  composerMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  composerHint: { flex: 1, fontSize: 11, lineHeight: 16, color: theme.textSecondary },
  characterCount: { fontSize: 11, lineHeight: 16, color: theme.textSecondary },
  footerNoticeText: { fontSize: 11, lineHeight: 16, color: theme.textSecondary },
});
