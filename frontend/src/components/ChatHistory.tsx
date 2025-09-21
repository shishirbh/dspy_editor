import { Fragment, type FC, useState } from 'react';
import LoadingIndicator from './LoadingIndicator';
import type { ChatMessage } from '../types';

interface ChatHistoryProps {
  messages: ChatMessage[];
  onSaveEdit: (messageId: string, content: string) => Promise<void>;
  isBusy?: boolean;
}

const ChatHistory: FC<ChatHistoryProps> = ({ messages, onSaveEdit, isBusy }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savedIndicator, setSavedIndicator] = useState<Record<string, boolean>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const startEditing = (message: ChatMessage) => {
    setEditingId(message.id);
    setDraft(message.content);
    setLocalError(null);
    setSavedIndicator((prev) => ({ ...prev, [message.id]: false }));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft('');
    setLocalError(null);
  };

  const handleSave = async (message: ChatMessage) => {
    if (!draft.trim()) {
      setLocalError('Response cannot be empty.');
      return;
    }

    try {
      setLocalError(null);
      await onSaveEdit(message.id, draft.trim());
      setEditingId(null);
      setDraft('');
      setSavedIndicator((prev) => ({ ...prev, [message.id]: true }));
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Unable to save edit.';
      setLocalError(err);
    }
  };

  return (
    <div className="panel chat-history" role="log" aria-live="polite">
      {messages.length === 0 ? (
        <div className="message bot" style={{ alignSelf: 'center', textAlign: 'center' }}>
          Start the conversation by sending a prompt.
        </div>
      ) : null}
      {messages.map((message) => {
        const isEditing = editingId === message.id;
        const showSavedIndicator = savedIndicator[message.id];
        return (
          <Fragment key={message.id}>
            <article className={`message ${message.role}`}>
              <div className="message-header">
                <strong>{message.role === 'user' ? 'You' : 'DSPy Bot'}</strong>
                <div className="message-actions">
                  {message.role === 'bot' && message.turnId ? (
                    isEditing ? (
                      <>
                        <button
                          type="button"
                          className="secondary"
                          onClick={cancelEditing}
                          disabled={message.status === 'saving-edit'}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => handleSave(message)}
                          disabled={message.status === 'saving-edit'}
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => startEditing(message)}
                          disabled={isBusy}
                        >
                          Edit
                        </button>
                        {showSavedIndicator ? (
                          <button type="button" className="success" disabled>
                            ✅ Saved
                          </button>
                        ) : null}
                      </>
                    )
                  ) : null}
                </div>
              </div>
              {isEditing ? (
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-label="Edit response"
                />
              ) : (
                <p>{message.content}</p>
              )}
              {message.status === 'streaming' ? <LoadingIndicator label="Generating response…" /> : null}
              {message.error ? <div className="error-banner">{message.error}</div> : null}
              {isEditing && localError ? <div className="error-banner">{localError}</div> : null}
            </article>
          </Fragment>
        );
      })}
    </div>
  );
};

export default ChatHistory;
