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

    this.addMessage({
      role: 'bot',
      text: this.buildReply(nextPrompt),
      assistantId: FAQ_ASSISTANT.id,
    });
    this.isBotTyping.set(false);

    if (this.pendingReplies.length > 0) {
      void this.processReplies();
    }
  }

  private buildReply(prompt: string): string {
    const normalizedPrompt = prompt.toLowerCase();

    if (normalizedPrompt.includes('faq') || normalizedPrompt.includes('help')) {
      return 'FAQ Assistant can help with common product and support questions. Share the topic you want to cover and I will keep the answer focused.';
    }

    if (normalizedPrompt.includes('design') || normalizedPrompt.includes('ui')) {
      return 'FAQ Assistant can help clarify the user-facing flow. Tell me which section should feel clearer and I will help refine it.';
    }

    if (normalizedPrompt.includes('bug') || normalizedPrompt.includes('issue')) {
      return 'FAQ Assistant can help narrow the issue. Describe the behavior you expected and what happened instead.';
    }

    const genericReplies = [
      'FAQ Assistant is ready. Give me one more detail and I will turn it into the next helpful step.',
      'FAQ Assistant can help with that. Describe the exact outcome you want and I will keep the response practical.',
      'FAQ Assistant has the context. Share the specific question or flow you want to improve and I will focus there.',
    ];

    return genericReplies[prompt.length % genericReplies.length];
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (!this.messageArea) {
        return;
      }

      const element = this.messageArea.nativeElement;
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth',
      });
    }, 40);
  }
}
