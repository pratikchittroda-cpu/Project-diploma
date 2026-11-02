import { useEffect, useMemo, useRef, useState } from 'react';

export const confirmationButtons = (onConfirm, onCancel, options = {}) => {
  const defaults = [{ text: options.cancelButtonText || 'Cancel', style: 'cancel', onPress: onCancel },
    { text: options.confirmButtonText || 'Confirm', color: options.confirmButtonColor, onPress: onConfirm }];
  return (options.buttons || defaults).map((button) => ({ ...button,
    onPress: typeof button.onPress === 'function' ? button.onPress : button.style === 'cancel' ? onCancel : onConfirm,
  }));
};

// Identity-bound dismissal prevents an old timer or async handler from hiding a newer prompt.
export const createMessageQueue = (publish) => {
  let nextId = 0;
  let queue = [];
  let disposed = false;
  const render = () => publish(queue[0]?.config || { visible: false });
  const reportError = () => show({ type: 'error', title: 'Action failed', message: 'The action could not be completed. Please try again.' });
  const invoke = async (callback, value) => {
    try { await callback?.(value); } catch (_) { if (!disposed) reportError(); }
  };
  const dismiss = (id = queue[0]?.id) => {
    const index = queue.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [item] = queue.splice(index, 1);
    render();
    void invoke(item.onDismiss);
  };
  const show = (config) => {
    if (disposed) return;
    const id = ++nextId;
    const item = { id, onDismiss: config.onDismiss, pressed: false };
    item.config = { autoHide: false, buttons: [], ...config, id, visible: true, onDismiss: () => dismiss(id),
      buttons: (config.buttons || []).map((button) => ({ ...button, onPress: async (value) => {
        if (item.pressed || !queue.some((entry) => entry.id === id)) return;
        item.pressed = true;
        // Remove before invoking: nested prompts are queued after already pending messages.
        if (button.dismissOnPress !== false) dismiss(id);
        await invoke(button.onPress, value);
        item.pressed = false;
      } })),
    };
    if (config.replace && queue.length) {
      const previous = queue.shift();
      queue.unshift(item);
      render();
      void invoke(previous.onDismiss);
    } else { queue.push(item); render(); }
    return id;
  };
  return { showMessage: show, hideMessage: dismiss,
    clear: () => { queue = []; render(); },
    dispose: () => { disposed = true; queue = []; } };
};

export const useThemedMessageBox = () => {
  const [messageBoxConfig, setMessageBoxConfig] = useState({ visible: false });
  const queue = useRef(null);
  if (!queue.current) queue.current = createMessageQueue(setMessageBoxConfig);
  useEffect(() => () => queue.current.dispose(), []);
  return useMemo(() => ({ ...queue.current, messageBoxConfig }), [messageBoxConfig]);
};
