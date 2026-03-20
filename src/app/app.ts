import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

interface AssistantProfile {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'busy' | 'offline';
  accentStart: string;
  accentEnd: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  assistantId?: string;
}

const FAQ_ASSISTANT: AssistantProfile = {
  id: 'faq-assistant',
  name: 'FAQ Assistant',
  role: 'Knowledge Base Support',
  avatar: 'https://github.com/shadcn.png',
  status: 'online',
  accentStart: 'rgba(34, 197, 94, 0.2)',
  accentEnd: 'rgba(16, 185, 129, 0.2)',
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private nextMessageId = 1;
  private readonly pendingReplies: string[] = [];

  @ViewChild('messageArea') private messageArea?: ElementRef<HTMLDivElement>;

  protected readonly isOpen = signal(true);
  protected readonly draftMessage = signal('');
  protected readonly isBotTyping = signal(false);
  protected readonly assistant = computed(() => FAQ_ASSISTANT);
  protected readonly inputPlaceholder = computed(
    () => `Message ${this.assistant().name}...`
  );
  protected readonly widgetStyles = computed(() => ({
    '--agent-gradient-start': this.assistant().accentStart,
    '--agent-gradient-end': this.assistant().accentEnd,
  }));
  protected readonly messages = signal<ChatMessage[]>([
    {
      id: 0,
      role: 'bot',
      text: "Hello! I'm FAQ Assistant. How can I help you today?",
      timestamp: new Date(),
      assistantId: FAQ_ASSISTANT.id,
    },
  ]);

  protected toggleOpen(): void {
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);

    if (nextState) {
      this.scrollToBottom();
    }
  }

  protected setDraftMessage(value: string): void {
    this.draftMessage.set(value);
  }

  protected sendTextMessage(): void {
    const text = this.draftMessage().trim();
    if (!text) {
      return;
    }

    this.addMessage({
      role: 'user',
      text,
    });
    this.pendingReplies.push(text);
    this.draftMessage.set('');

    if (!this.isBotTyping()) {
      void this.processReplies();
    }
  }

  protected trackByMessageId(_: number, message: ChatMessage): number {
    return message.id;
  }

  private addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): void {
    this.messages.update((messages) => [
      ...messages,
      {
        id: this.nextMessageId,
        timestamp: new Date(),
        ...message,
      },
    ]);
    this.nextMessageId += 1;
    this.scrollToBottom();
  }

  private async processReplies(): Promise<void> {
    const nextPrompt = this.pendingReplies.shift();
    if (!nextPrompt) {
      return;
    }

    this.isBotTyping.set(true);
    this.scrollToBottom();
    await new Promise((resolve) => setTimeout(resolve, 700));

    const currentMessages = this.messages();
    if (currentMessages.length === 0) {
      this.isBotTyping.set(false);
      return;
    }

    const userMessage = currentMessages[currentMessages.length - 1].text;
    const history = currentMessages.slice(0, currentMessages.length - 1).map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : 'user',
      content: msg.text
    }));

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history: history,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Network response was not ok');
      }

      this.isBotTyping.set(false);
      this.addMessage({ role: 'bot', text: '', assistantId: FAQ_ASSISTANT.id });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.text) {
                this.messages.update((msgs) => {
                  const newMsgs = [...msgs];
                  const lastIdx = newMsgs.length - 1;
                  newMsgs[lastIdx] = {
                    ...newMsgs[lastIdx],
                    text: newMsgs[lastIdx].text + data.text
                  };
                  return newMsgs;
                });
                this.scrollToBottom();
              }
            } catch (e) {
              console.error('Error parsing NDJSON line', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching bot reply:', error);
      this.isBotTyping.set(false);
      this.addMessage({ role: 'bot', text: 'Error: Unable to connect to the assistant server. Ensure FastAPI is running on port 8000.', assistantId: FAQ_ASSISTANT.id });
    }
  }

  private scrollToBottom(): void {
    // Small timeout to allow DOM to update with new message
    setTimeout(() => {
      if (this.messageArea) {
        const el = this.messageArea.nativeElement;
        el.scrollTo({
          top: el.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 50);
  }
}
