import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../constants/Icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import aiService from '../services/aiService';
import MessageService from '../services/MessageService';

const QUICK_QUESTIONS = [
  'How can I reduce my spending this month?',
  'What category is costing me the most?',
  'Give me a short savings plan based on my data.',
  'Am I staying within budget this month?',
];

export default function AIChatScreen({ navigation }) {
  const { theme, isLoading, currentThemeId, themeConfigs } = useTheme();
  const { user, userData } = useAuth();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const scrollViewRef = useRef(null);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Ask me anything about your spending, budget, cash flow, savings, or financial patterns. I will only answer finance-related questions based on your account data.',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const themeConfig = themeConfigs[currentThemeId] || themeConfigs.default;
  const gradientColors = themeConfig.colors;

  const headerTextColor = theme.text;
  const headerSubtextColor = theme.textSecondary;
  const headerButtonBackground = theme.inputBackgroundFocused || theme.inputBackground;
  const headerIconColor = theme.text;

  const styles = createStyles(
    theme,
    insets,
    keyboardHeight,
    headerTextColor,
    headerSubtextColor,
    headerButtonBackground
  );

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleShow = (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
      scrollToEnd();
    };

    const handleHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleAsk = async (rawQuestion = question) => {
    const trimmedQuestion = rawQuestion.trim();
    if (!trimmedQuestion || submitting) return;

    setShowQuickQuestions(false);

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedQuestion,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setQuestion('');
    setSubmitting(true);
    scrollToEnd();

    const conversationHistory = nextMessages
      .filter((message) => message.id !== 'welcome')
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const result = await aiService.getFinancialChatResponse({
      question: trimmedQuestion,
      user,
      userData,
      transactions,
      conversationHistory,
    });

    if (result.success) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.answer,
        },
      ]);
      scrollToEnd();
    } else {
      MessageService.showError('AI Chat', result.error || 'Unable to answer right now.');
      setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
      setQuestion(trimmedQuestion);
    }

    setSubmitting(false);
  };

  if (isLoading || !theme) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={theme.isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.safeArea}>
          <View style={styles.headerWrap}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={22} color={headerIconColor} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Financial AI Chat</Text>
              <Text style={styles.headerSubtitle}>Answers based on your account data only</Text>
            </View>
          </View>
          </View>

          <KeyboardAvoidingView
            style={styles.chatShellWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 18}
            enabled
          >
            <View style={styles.chatShell}>
              <View style={styles.dataBadge}>
                <Icon name="database-outline" size={16} color={theme.primary} />
                <Text style={styles.dataBadgeText}>
                  {transactionsLoading ? 'Loading finance data...' : `${transactions.length} transactions loaded`}
                </Text>
              </View>

              <ScrollView
                ref={scrollViewRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageBubble,
                      message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        { color: message.role === 'user' ? 'white' : theme.text },
                      ]}
                    >
                      {message.content}
                    </Text>
                  </View>
                ))}

                {submitting && (
                  <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={styles.loadingText}>Thinking about your finances...</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.footer}>
                {showQuickQuestions && (
                  <View style={styles.quickQuestionRow}>
                    {QUICK_QUESTIONS.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={styles.quickChip}
                        onPress={() => handleAsk(item)}
                        disabled={submitting}
                      >
                        <Text style={styles.quickChipText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.input}
                    value={question}
                    onChangeText={setQuestion}
                    placeholder="Ask a question about your finances"
                    placeholderTextColor={theme.placeholderText}
                    multiline
                    textAlignVertical="top"
                    onFocus={scrollToEnd}
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, (!question.trim() || submitting) && styles.sendButtonDisabled]}
                    onPress={() => handleAsk()}
                    disabled={!question.trim() || submitting}
                  >
                    <Icon name="send" size={18} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (
  theme,
  insets,
  keyboardHeight,
  headerTextColor,
  headerSubtextColor,
  headerButtonBackground
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme?.primary || '#667eea',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerWrap: {
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: headerButtonBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: headerTextColor,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: headerSubtextColor,
  },
  chatShellWrap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  chatShell: {
    flex: 1,
    backgroundColor: theme.isDarkMode ? 'rgba(15, 15, 15, 0.92)' : 'rgba(255, 255, 255, 0.94)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    paddingBottom: 0,
  },
  dataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: theme.inputBackground,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  dataBadgeText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 12,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '88%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: theme.inputBackground,
    borderTopLeftRadius: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: theme.primary,
    borderTopRightRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  quickQuestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  quickChip: {
    backgroundColor: theme.inputBackground,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickChipText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: Math.max(12, (insets?.bottom || 0) + 8),
    marginBottom: Platform.OS === 'android' && keyboardHeight > 0
      ? Math.max(0, keyboardHeight - (insets?.bottom || 0) - 8)
      : 0,
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    backgroundColor: theme.inputBackground,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 15,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
