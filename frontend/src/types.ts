export type Role = 'user' | 'bot';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  turnId?: string;
  status?: 'streaming' | 'ready' | 'saving-edit' | 'error';
  error?: string;
}
