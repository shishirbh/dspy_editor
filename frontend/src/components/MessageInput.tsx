import type { FC, FormEvent } from 'react';
import { useState } from 'react';

interface MessageInputProps {
  disabled?: boolean;
  onSend: (content: string) => Promise<void> | void;
  error?: string | null;
  onClearError: () => void;
}

const MessageInput: FC<MessageInputProps> = ({ disabled, onSend, error, onClearError }) => {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() || isSubmitting) {
      return;
    }

    onClearError();
    setIsSubmitting(true);
    try {
      await onSend(prompt.trim());
      setPrompt('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="panel input-panel" onSubmit={handleSubmit}>
      {error ? <div className="error-banner" role="status">{error}</div> : null}
      <textarea
        className="prompt-input"
        placeholder="Ask the model anything…"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        disabled={disabled || isSubmitting}
        aria-label="Prompt"
      />
      <div className="submit-row">
        <span>{isSubmitting ? 'Sending…' : 'Shift + Enter for new line'}</span>
        <button type="submit" disabled={disabled || isSubmitting}>
          Send
        </button>
      </div>
    </form>
  );
};

export default MessageInput;
