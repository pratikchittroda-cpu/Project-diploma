import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { Icon } from '../../constants/Icons';
import { auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import aiService from '../../services/aiService';
import { PERSONAL_EXPENSES, COMPANY_EXPENSES, MAX_MONEY, formatMoney, fromMinor, toMinor } from '../../utils/finance';
import { Button, Card, Copy, Field, categoryDetails, useFinanceColors } from './FinanceUI';

const CANCEL_NOTE = 'Request cancelled. Data already sent cannot be recalled; another attempt sends a new request.';
function toolError(code, message) {
  if (code === 'backend/timeout') return 'The secure AI service timed out. It may have processed the request; trying again sends a new request.';
  if (code === 'backend/cancelled') return CANCEL_NOTE;
  return message || 'No AI result was received. Check your connection and try again.';
}

const AITransactionTools = forwardRef(function AITransactionTools({
  company = false, draft, getDraftSnapshot, isSaving, disabled = false, onApplyCategory, onApplyReceiptItem,
}, ref) {
  const { user, userData, profileStatus, initializing } = useAuth();
  const profileComplete = userData?.profileComplete;
  const ready = profileStatus === 'ready' && !initializing && Boolean(user)
    && (profileComplete === undefined || profileComplete === true)
    && userData?.userType === (company ? 'company' : 'personal') && auth.currentUser === user;
  const contextRef = useRef(null);
  contextRef.current = { user, ready, disabled, getDraftSnapshot, isSaving, onApplyCategory, onApplyReceiptItem };
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const requestRef = useRef(null);
  const consentRef = useRef(null);
  const receiptTextRef = useRef('');
  const inputRevisionRef = useRef(0);
  const categoryRef = useRef(null);
  const receiptReviewRef = useRef(null);
  const selectionRef = useRef(null);
  const [consent, setConsent] = useState(false);
  const [receiptText, setReceiptText] = useState('');
  const [pendingKind, setPendingKind] = useState(null);
  const [categorySuggestion, setCategorySuggestion] = useState(null);
  const [receiptReview, setReceiptReview] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [message, setMessage] = useState('');
  const allowedCategories = company ? COMPANY_EXPENSES : PERSONAL_EXPENSES;

  const invalidateDraft = useCallback((notice = '') => {
    const pending = requestRef.current;
    requestRef.current = null;
    busyRef.current = false;
    inputRevisionRef.current += 1;
    categoryRef.current = null;
    receiptReviewRef.current = null;
    selectionRef.current = null;
    pending?.controller.abort();
    if (!mountedRef.current) return;
    setPendingKind(null); setCategorySuggestion(null); setReceiptReview(null); setSelectedItem(null);
    setMessage(notice || (pending ? 'Draft changed. The pending request was cancelled; data already sent cannot be recalled.' : ''));
  }, []);
  const reset = useCallback(() => {
    consentRef.current = null;
    receiptTextRef.current = '';
    invalidateDraft();
    if (mountedRef.current) { setConsent(false); setReceiptText(''); setMessage(''); }
  }, [invalidateDraft]);
  useImperativeHandle(ref, () => ({ invalidateDraft, reset }), [invalidateDraft, reset]);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      if (nextUser !== contextRef.current.user) reset();
    });
    return () => {
      mountedRef.current = false;
      consentRef.current = null;
      receiptTextRef.current = '';
      invalidateDraft();
      unsubscribe();
    };
  }, [invalidateDraft, reset]);
  useEffect(() => { reset(); }, [user, profileStatus, initializing, company, ready, reset]);
  useEffect(() => {
    const snapshots = [requestRef.current?.snapshot, categoryRef.current?.snapshot, receiptReviewRef.current?.snapshot];
    if (snapshots.some(snapshot => snapshot && snapshot.revision !== draft.revision)) invalidateDraft();
  }, [draft.revision, invalidateDraft]);

  const sameAccount = () => {
    const current = contextRef.current;
    return mountedRef.current && current.ready && auth.currentUser === current.user
      && !current.disabled && !current.isSaving();
  };
  const currentResult = snapshot => sameAccount() && consentRef.current === snapshot.user
    && auth.currentUser === snapshot.user && contextRef.current.getDraftSnapshot().revision === snapshot.revision;
  const currentRequest = pending => requestRef.current === pending && !pending.controller.signal.aborted
    && inputRevisionRef.current === pending.inputRevision && currentResult(pending.snapshot);

  const changeConsent = () => {
    if (!sameAccount()) return;
    const next = consentRef.current !== user;
    consentRef.current = next ? user : null;
    setConsent(next);
    if (!next) invalidateDraft(requestRef.current ? CANCEL_NOTE : 'Sharing consent revoked.');
    else setMessage('');
  };
  const editReceiptText = value => {
    if (!sameAccount()) return;
    invalidateDraft();
    receiptTextRef.current = value;
    setReceiptText(value);
  };
  const runTool = async kind => {
    if (busyRef.current) return;
    if (!sameAccount()) { setMessage('Finish signing in to your ready account before using AI tools.'); return; }
    if (consentRef.current !== user) { setMessage('Review data sharing and agree for this form before requesting AI assistance.'); return; }
    const currentDraft = contextRef.current.getDraftSnapshot();
    if (currentDraft.type !== 'expense') return;
    const text = kind === 'category' ? currentDraft.description : receiptTextRef.current;
    const maxLength = kind === 'category' ? 500 : 6000;
    if (typeof text !== 'string' || text.trim().length < 2 || text.length > maxLength) {
      setMessage(kind === 'category' ? 'Enter a description of 2–500 characters first.' : 'Paste receipt text of 2–6000 characters first.');
      return;
    }
    busyRef.current = true;
    const pending = { controller: new AbortController(), snapshot: { ...currentDraft, user }, inputRevision: inputRevisionRef.current };
    requestRef.current = pending;
    setMessage(''); setPendingKind(kind);
    categoryRef.current = null; receiptReviewRef.current = null; selectionRef.current = null;
    setCategorySuggestion(null); setReceiptReview(null); setSelectedItem(null);
    try {
      if (kind === 'category') {
        const result = await aiService.categorizeTransaction(text, { consent: true, signal: pending.controller.signal });
        if (!currentRequest(pending)) return;
        const source = result?.aiSuggested === true && result.source === 'ai' ? 'ai' : 'local';
        if (!allowedCategories.includes(result?.category)) {
          setMessage(`${result?.errorMessage ? `${result.errorMessage} ` : ''}No compatible ${source === 'ai' ? 'AI' : 'local'} expense category was returned for this account. Choose a category manually.`);
          return;
        }
        const suggestion = { ...result, source, snapshot: pending.snapshot };
        categoryRef.current = suggestion;
        setCategorySuggestion(suggestion);
        if (result.error) setMessage(toolError(result.error, result.errorMessage));
      } else {
        const result = await aiService.parseReceiptTextWithAI(text, { consent: true, signal: pending.controller.signal });
        if (!currentRequest(pending)) return;
        if (!result?.success) { setMessage(toolError(result?.code, result?.error)); return; }
        const review = { items: result.items, snapshot: pending.snapshot };
        receiptReviewRef.current = review;
        setReceiptReview(review);
      }
    } catch (error) {
      if (currentRequest(pending)) setMessage(toolError(error?.code || (error?.name === 'AbortError' ? 'backend/cancelled' : null), error?.message));
    } finally {
      if (requestRef.current === pending) {
        requestRef.current = null;
        busyRef.current = false;
        if (mountedRef.current) setPendingKind(null);
      }
    }
  };
  const applyCategory = () => {
    const suggestion = categoryRef.current;
    if (!suggestion || !currentResult(suggestion.snapshot) || busyRef.current) return;
    if (!contextRef.current.onApplyCategory(suggestion, suggestion.snapshot)) { invalidateDraft('The draft changed. Request a fresh suggestion or choose a category manually.'); return; }
    setMessage('Category applied to the unsaved form. Review it before tapping Save transaction.');
  };
  const applyReceiptItem = () => {
    const review = receiptReviewRef.current;
    if (!review || !currentResult(review.snapshot) || busyRef.current || selectionRef.current === null) return;
    const item = review.items[selectionRef.current];
    if (!item) return;
    try {
      if (!contextRef.current.onApplyReceiptItem(item, review.snapshot)) { invalidateDraft('The draft changed. Parse the text again before applying an item.'); return; }
      setMessage('Item applied to the unsaved amount and description. Check the amount, category and date, then tap Save transaction.');
    } catch (error) { setMessage(error.message || 'This item could not be applied. Review the receipt manually.'); }
  };

  if (draft.type !== 'expense') return null;
  const controlsDisabled = !ready || disabled || Boolean(pendingKind);
  const visibleCategory = categorySuggestion && currentResult(categorySuggestion.snapshot) ? categorySuggestion : null;
  const visibleReceipt = receiptReview && currentResult(receiptReview.snapshot) ? receiptReview : null;
  const selected = visibleReceipt && selectedItem !== null ? visibleReceipt.items[selectedItem] : null;
  const selectedTotal = selected ? toMinor(selected.price) * selected.quantity : null;
  return <Card>
    <Copy heading>AI transaction tools</Copy>
    <Copy>Choose when to share. “Suggest category” sends only this description (up to 500 characters); “Parse receipt text” sends only the text you paste below (up to 6000 characters) through the secure API to hosted NVIDIA AI.</Copy>
    <Copy caption muted>No background sends. Account authentication is handled by the API; your ledger, amount, date and department are not included in these tool requests. Service and provider privacy policies apply to text you send.</Copy>
    <SharingConsent allowed={consent && ready} disabled={!ready || disabled} onPress={changeConsent} />
    <Copy caption muted>Consent applies only to this form and account. Clearing the tools, saving, leaving this form or changing accounts resets it. AI results need your review; applying a result does not save anything.</Copy>
    {!ready && <Copy caption accessibilityRole="alert">Finish account setup and sign in before using AI tools.</Copy>}
    <Button title="Suggest category" icon="tag-outline" showLabel disabled={controlsDisabled || !consent} onPress={() => runTool('category')} />
    {visibleCategory && <View style={styles.review}>
      <Copy heading>{visibleCategory.source === 'ai' ? 'AI category suggestion' : 'Local keyword suggestion · not an AI reply'}</Copy>
      <Copy>{categoryDetails(visibleCategory.category).label}{visibleCategory.source === 'ai' ? ` · ${Math.round(visibleCategory.confidence * 100)}% confidence` : ''}</Copy>
      <Copy caption muted>Choose this suggestion or use the category picker above. Nothing changes until you choose.</Copy>
      <Button title={visibleCategory.source === 'ai' ? 'Use suggested category' : 'Use local category'} icon="check-outline" showLabel disabled={controlsDisabled} onPress={applyCategory} />
    </View>}
    <Field label="Receipt text" value={receiptText} onChangeText={editReceiptText} maxLength={6000} multiline autoCorrect={false}
      placeholder="Paste receipt line items here" editable={ready && !disabled} />
    <Copy caption muted>Paste text only. Remove any private details you do not want to send. Names, quantities and unit prices must be checked against your receipt.</Copy>
    <Button title="Parse receipt text" icon="receipt-text-outline" showLabel disabled={controlsDisabled || !consent} onPress={() => runTool('receipt')} />
    {pendingKind && <View style={styles.review}>
      <ActivityIndicator accessibilityLabel={pendingKind === 'category' ? 'Requesting category suggestion' : 'Parsing receipt text'} />
      <Copy accessibilityLiveRegion="polite">{pendingKind === 'category' ? 'Requesting a category suggestion…' : 'Parsing receipt text…'}</Copy>
      <Button title="Cancel AI request" icon="close-circle-outline" showLabel onPress={() => invalidateDraft(CANCEL_NOTE)} />
    </View>}
    {visibleReceipt && <View style={styles.review}>
      <Copy heading>Review receipt items</Copy>
      <Copy caption muted>Verify each name, quantity and INR unit price. Select one item to fill the unsaved amount (quantity × unit price) and description. This does not save a transaction.</Copy>
      <ReceiptChoices items={visibleReceipt.items} selected={selectedItem} disabled={controlsDisabled}
        onSelect={index => { if (!currentResult(visibleReceipt.snapshot) || busyRef.current) return; selectionRef.current = index; setSelectedItem(index); }} />
      <Button title="Apply selected item" icon="check-outline" showLabel disabled={controlsDisabled || !selected || selectedTotal > toMinor(MAX_MONEY)} onPress={applyReceiptItem} />
      {selectedTotal > toMinor(MAX_MONEY) && <Copy caption accessibilityRole="alert">This item total exceeds the supported transaction amount. Enter the transaction manually.</Copy>}
    </View>}
    {message && <Copy accessibilityRole="alert" accessibilityLiveRegion="polite">{message}</Copy>}
    <Button title="Clear AI tools" icon="delete-outline" showLabel disabled={disabled} onPress={reset} />
  </Card>;
});

function SharingConsent({ allowed, disabled, onPress }) {
  const colors = useFinanceColors();
  return <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel="Allow description or receipt text sharing with hosted NVIDIA AI when I request a tool"
    accessibilityState={{ checked: allowed, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.consent, { borderColor: allowed ? colors.accent : colors.border, backgroundColor: colors.surface, opacity: disabled ? 0.55 : 1 }]}>
    <Icon name={allowed ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} size={24} color={colors.accent} />
    <Copy style={styles.flex}>{allowed ? 'Sharing allowed · tap to revoke' : 'I agree for this form'}</Copy>
  </TouchableOpacity>;
}

function ReceiptChoices({ items, selected, disabled, onSelect }) {
  const colors = useFinanceColors();
  return <View style={styles.review}>{items.map((item, index) => {
    const total = fromMinor(toMinor(item.price) * item.quantity);
    const active = selected === index;
    return <TouchableOpacity key={index} accessibilityRole="radio" accessibilityLabel={`${item.name}, quantity ${item.quantity}, unit price ${formatMoney(item.price)}, total ${formatMoney(total)}`}
      accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={() => onSelect(index)}
      style={[styles.receiptItem, { borderColor: active ? colors.accent : colors.border, backgroundColor: colors.surface, opacity: disabled ? 0.55 : 1 }]}>
      <Icon name={active ? 'radiobox-marked' : 'radiobox-blank'} size={24} color={colors.accent} />
      <View style={styles.flex}><Copy style={styles.itemName}>{item.name}</Copy><Copy caption muted>{item.quantity} × {formatMoney(item.price)} = {formatMoney(total)}</Copy></View>
    </TouchableOpacity>;
  })}</View>;
}

const styles = StyleSheet.create({
  review: { gap: 12 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, padding: 14, borderWidth: 1, borderRadius: 14 },
  receiptItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 14, borderWidth: 1, borderRadius: 14 },
  flex: { flex: 1 },
  itemName: { fontWeight: '600' },
});

export default AITransactionTools;
