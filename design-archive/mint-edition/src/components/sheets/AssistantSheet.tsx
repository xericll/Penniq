import { ArrowUp, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import {
  HISTORY_TURNS,
  QUESTION_MAX_LENGTH,
  TOPICS,
  answer,
  askAssistant,
  assistantReady,
  linesText,
  matchTopic,
  walletDigest,
  type Line,
  type Topic,
  type Turn,
  type WalletView,
} from '../../lib/assistant';
import { haptic } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../state/AuthContext';
import { useWallet } from '../../state/WalletContext';
import { Guilloche } from '../ui/Engraving';
import { Logo } from '../ui/Logo';
import { Money } from '../ui/Money';
import { Sheet } from '../ui/Sheet';

interface Message {
  id: number;
  from: 'user' | 'bot';
  lines: Line[];
  /** Left out of what the model is shown: an error line is not part of the conversation. */
  aside?: boolean;
}

const NUMBER = /(\d+(?:[.,٬٫]\d+)*)/;

/** Figures inside running text stay left-to-right and blur with the amounts in privacy mode. */
function Text({ text }: { text: string }) {
  return (
    <>
      {text.split(NUMBER).map((chunk, i) =>
        i % 2 ? (
          <span key={i} dir="ltr" className="money tabular">
            {chunk}
          </span>
        ) : (
          chunk
        ),
      )}
    </>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.from === 'user') {
    return (
      <li
        className="ms-auto w-fit max-w-[85%] rounded-[20px] rounded-ee-md bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-bg"
        dir="auto"
      >
        {message.lines.map((line, i) => (
          <p key={i}>{line.map((part) => (typeof part === 'string' ? part : ''))}</p>
        ))}
      </li>
    );
  }
  return (
    <li className="flex max-w-[94%] items-end gap-2">
      <Logo variant="mark" size={26} className="mb-0.5" />
      <div className="min-w-0 space-y-1.5 rounded-[20px] rounded-es-md border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed">
        {message.lines.map((line, i) => (
          <p key={i} className="min-h-2 break-words">
            {line.map((part, j) =>
              typeof part === 'string' ? (
                <Text key={j} text={part} />
              ) : (
                <Money key={j} value={part.money} sign={part.sign} className="font-semibold" />
              ),
            )}
          </p>
        ))}
      </div>
    </li>
  );
}

/**
 * The assistant: ready-made questions answered on the device from the ledger, and a free
 * text box. Free questions go to the model once the cloud function has a key; until then
 * they are matched to the nearest ready-made answer. The conversation lives in memory only.
 */
export function AssistantSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const i18n = useI18n();
  const { t, lang, money, currency } = i18n;
  const { transactions, balances, budget, essentials } = useWallet();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  /** Whether free questions reach the model: unknown until the function has been asked. */
  const [model, setModel] = useState<'unknown' | 'on' | 'off'>('unknown');
  const counter = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const view = useMemo<WalletView>(() => ({ transactions, balances, budget, essentials }), [transactions, balances, budget, essentials]);

  // The conversation is about one wallet: it ends when the account changes.
  useEffect(() => {
    setMessages([]);
    setModel('unknown');
  }, [userId]);

  useEffect(() => {
    if (!open || !supabase || !userId || model === 'on') return;
    let stale = false;
    assistantReady(supabase)
      .then((ready) => !stale && setModel(ready ? 'on' : 'off'))
      .catch(() => !stale && setModel('off'));
    return () => {
      stale = true;
    };
    // Asked again each time the sheet opens until the model answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages, busy]);

  const push = (from: Message['from'], lines: Line[], aside = false) =>
    setMessages((list) => [...list, { id: ++counter.current, from, lines, aside }]);

  const askTopic = (topic: Topic) => {
    if (busy) return;
    haptic('tap');
    push('user', [[t(`assistant.q.${topic}`)]]);
    push('bot', answer(topic, view, i18n));
  };

  const askText = async () => {
    const text = draft.trim().slice(0, QUESTION_MAX_LENGTH);
    if (!text || busy) return;
    haptic('tap');
    setDraft('');
    const before = messagesRef.current;
    push('user', [[text]]);

    const topic = matchTopic(text);
    const local = () => push('bot', topic ? answer(topic, view, i18n) : [[t('assistant.a.unknown')]]);
    if (!supabase || !userId || model !== 'on') return local();

    const turns: Turn[] = before
      .filter((m) => !m.aside)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: linesText(m.lines, money) }));
    while (turns[0]?.role === 'assistant') turns.shift();

    setBusy(true);
    const result = await askAssistant(supabase, {
      lang,
      turns: [...turns, { role: 'user', content: text }],
      wallet: walletDigest(view, currency),
    });
    setBusy(false);
    if (result.ok)
      return push(
        'bot',
        result.text.split('\n').map((line): Line => [line]),
      );
    if (result.reason === 'off') {
      setModel('off');
      return local();
    }
    // Without a connection the nearest ready-made answer is better than an error.
    if (result.reason === 'network' && topic) return local();
    push('bot', [[t(`assistant.err.${result.reason}`)]], true);
  };

  const chip = (topic: Topic, className: string) => (
    <button key={topic} type="button" onClick={() => askTopic(topic)} disabled={busy} className={className}>
      {t(`assistant.q.${topic}`)}
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Penniq"
      title={t('assistant.title')}
      className="lg:max-w-xl"
      headerExtra={
        messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="press grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
            aria-label={t('assistant.clear')}
            title={t('assistant.clear')}
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
        )
      }
      footer={
        <div className="space-y-2.5">
          {messages.length > 0 && (
            <div
              className="no-scrollbar rail-fade -mx-5 flex gap-2 overflow-x-auto px-5"
              role="group"
              aria-label={t('assistant.suggestions')}
            >
              {TOPICS.map((topic) => chip(topic, 'chip press shrink-0 disabled:opacity-50'))}
            </div>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void askText();
            }}
          >
            <input
              className="field"
              value={draft}
              maxLength={QUESTION_MAX_LENGTH}
              enterKeyHint="send"
              autoComplete="off"
              placeholder={t('assistant.placeholder')}
              aria-label={t('assistant.placeholder')}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={t('assistant.send')}
              className="foil press grid size-12 shrink-0 place-items-center rounded-full disabled:opacity-50"
            >
              <ArrowUp className="size-5" strokeWidth={2.4} aria-hidden />
            </button>
          </form>
          <p className="text-center text-[12px] leading-snug text-ink-3">
            {t(model === 'on' ? 'assistant.modelNote' : 'assistant.localNote')}
          </p>
        </div>
      }
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center pt-1 pb-2 text-center">
          <Guilloche className="size-24 text-foil opacity-60" density="light" spin />
          <h3 className="-mt-1 text-[18px] font-semibold">{t('assistant.hello')}</h3>
          <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-ink-2">{t('assistant.intro')}</p>
          <div className="mt-5 grid w-full grid-cols-2 gap-2" role="group" aria-label={t('assistant.suggestions')}>
            {TOPICS.map((topic) =>
              chip(
                topic,
                'press flex min-h-[52px] items-center justify-center rounded-2xl border border-line-strong px-3 py-2 text-[14px] leading-snug font-medium text-ink-2 hover:bg-surface-2 hover:text-ink',
              ),
            )}
          </div>
        </div>
      ) : (
        <ul className="space-y-3 pt-1" role="log" aria-live="polite">
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {busy && (
            <li className="flex items-end gap-2" role="status" aria-label={t('assistant.typing')}>
              <Logo variant="mark" size={26} className="mb-0.5" />
              <span className="flex gap-1 rounded-[20px] rounded-es-md border border-line bg-surface px-4 py-4">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${i * 140}ms` }} />
                ))}
              </span>
            </li>
          )}
        </ul>
      )}
      <div ref={endRef} />
    </Sheet>
  );
}
