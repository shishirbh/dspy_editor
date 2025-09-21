import { useCallback, useMemo, useState } from 'react';
import ChatHistory from './components/ChatHistory';
import MessageInput from './components/MessageInput';
import type { ChatMessage } from './types';

const createId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

const App = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const markMessage = useCallback(
    (id: string, changes: Partial<ChatMessage>) => {
      setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, ...changes } : message)));
    },
    []
  );

  const handleSend = useCallback(
    async (prompt: string) => {
      const userMessage: ChatMessage = {
        id: createId('user'),
        role: 'user',
        content: prompt,
        status: 'ready'
      };

      const botMessageId = createId('bot');
      const botMessage: ChatMessage = {
        id: botMessageId,
        role: 'bot',
        content: '',
        status: 'streaming'
      };

      setMessages((prev) => [...prev, userMessage, botMessage]);
      setIsGenerating(true);
      setErrorMessage(null);

      try {
        const response = await fetch('/generate_response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
          throw new Error(`Unable to generate response (${response.status})`);
        }

        const contentType = response.headers.get('content-type');
        let finalContent = '';
        let turnId = response.headers.get('x-turn-id') ?? undefined;

        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (typeof data?.response === 'string') {
            finalContent = data.response;
          } else {
            finalContent = JSON.stringify(data);
          }
          if (!turnId && data?.turn_id) {
            turnId = String(data.turn_id);
          }
        } else if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let aggregate = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            aggregate += decoder.decode(value, { stream: true });
            markMessage(botMessageId, { content: aggregate, status: 'streaming' });
          }
          aggregate += decoder.decode();
          finalContent = aggregate;
        } else {
          finalContent = await response.text();
        }

        markMessage(botMessageId, {
          content: finalContent,
          status: 'ready',
          turnId,
          error: undefined
        });
      } catch (error) {
        const err = error instanceof Error ? error.message : 'Unexpected error';
        markMessage(botMessageId, {
          content: '',
          status: 'error',
          error: err
        });
        setErrorMessage(err);
      } finally {
        setIsGenerating(false);
      }
    },
    [markMessage]
  );

  const handleSaveEdit = useCallback(
    async (messageId: string, content: string) => {
      const targetMessage = messages.find((message) => message.id === messageId);
      if (!targetMessage?.turnId) {
        throw new Error('Missing turn ID for this message.');
      }

      markMessage(messageId, { status: 'saving-edit' });

      try {
        const response = await fetch('/save_edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ turn_id: targetMessage.turnId, content })
        });

        if (!response.ok) {
          throw new Error(`Unable to save edit (${response.status})`);
        }

        let updatedContent = content;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json();
            if (typeof data?.response === 'string') {
              updatedContent = data.response;
            }
          } catch (parseError) {
            console.warn('Unable to parse JSON response from save_edit', parseError);
          }
        }

        markMessage(messageId, {
          content: updatedContent,
          status: 'ready',
          error: undefined
        });
      } catch (error) {
        const err = error instanceof Error ? error.message : 'Unexpected error while saving edit.';
        markMessage(messageId, { status: 'ready', error: err });
        throw error;
      }
    },
    [markMessage, messages]
  );

  const sortedMessages = useMemo(() => [...messages], [messages]);

  return (
    <div className="app-shell">
      <ChatHistory messages={sortedMessages} onSaveEdit={handleSaveEdit} isBusy={isGenerating} />
      <MessageInput
        disabled={isGenerating}
        onSend={handleSend}
        error={errorMessage}
        onClearError={() => setErrorMessage(null)}
      />
    </div>
  );
};

export default App;
