import { Download, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { drawAchievement, type CardContent } from '../../lib/achievementCard';
import { goalProgress } from '../../lib/goals';
import { haptic } from '../../lib/haptics';
import { savingsRate } from '../../lib/insights';
import { progressOf } from '../../lib/levels';
import { APP_URL } from '../../lib/links';
import { roundMoney } from '../../lib/ledger';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';

type Kind = 'savings' | 'goal' | 'level';

/**
 * A ready-made image of an achievement to share: the savings rate, a reached goal or a level.
 * Amounts stay off the card unless the user turns them on.
 */
export function AchievementSheet({
  open,
  initial,
  goalId,
  onClose,
}: {
  open: boolean;
  initial?: Kind;
  goalId?: string;
  onClose: () => void;
}) {
  const { t, money, lang, dir, monthLabel, info } = useI18n();
  const { transactions, budget } = useWallet();
  const { goals } = usePlanner();
  const toast = useToast();
  const rate = useMemo(() => savingsRate(transactions), [transactions]);
  const reachedGoals = useMemo(() => goals.filter((g) => goalProgress(g, transactions).reached), [goals, transactions]);
  const progress = useMemo(
    () => progressOf(transactions, budget, reachedGoals.length, info.weekStartsOn),
    [transactions, budget, reachedGoals.length, info.weekStartsOn],
  );

  const kinds: Kind[] = [
    ...(rate.rate !== null && rate.rate > 0 ? (['savings'] as Kind[]) : []),
    ...(reachedGoals.length ? (['goal'] as Kind[]) : []),
    'level',
  ];
  const [kind, setKind] = useState<Kind>('level');
  const [format, setFormat] = useState<'story' | 'square'>('story');
  const [amounts, setAmounts] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [chosenGoal, setChosenGoal] = useState<string | undefined>(goalId);

  useEffect(() => {
    if (!open) return;
    setKind(initial && kinds.includes(initial) ? initial : kinds[0]);
    setChosenGoal(goalId ?? reachedGoals[0]?.id);
    setAmounts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const content = useMemo((): CardContent => {
    const base = { dir, lang, link: APP_URL };
    // Amounts stay left-to-right inside an Arabic sentence ("2,400 €", not "€ 2,400").
    const amount = (v: number) => `⁦${money(v)}⁩`;
    if (kind === 'savings' && rate.rate !== null) {
      const pct = Math.round(rate.rate);
      return {
        ...base,
        eyebrow: monthLabel(new Date()),
        headline: `${pct}%`,
        title: t('achievement.savingsTitle', { pct }),
        detail: amounts
          ? t('achievement.savingsDetail', { saved: amount(roundMoney(rate.income - rate.expense)), income: amount(rate.income) })
          : undefined,
      };
    }
    if (kind === 'goal') {
      const goal = reachedGoals.find((g) => g.id === chosenGoal) ?? reachedGoals[0];
      if (goal) {
        return {
          ...base,
          eyebrow: t('achievement.goalEyebrow'),
          headline: '100%',
          title: t('achievement.goalTitle', { name: goal.name }),
          detail: amounts ? amount(goal.target) : undefined,
          photo: goal.photo,
        };
      }
    }
    return {
      ...base,
      eyebrow: t('achievement.levelEyebrow'),
      headline: String(progress.level.index + 1),
      title: t('achievement.levelTitle', { level: t(progress.level.key) }),
      detail: t('achievement.points', { points: progress.points }),
    };
  }, [kind, rate, reachedGoals, chosenGoal, progress, amounts, dir, lang, money, monthLabel, t]);

  // Redraw whenever the card changes.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    let made: string | null = null;
    void drawAchievement(content, format).then((canvas) =>
      canvas.toBlob((b) => {
        if (!alive || !b) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      }, 'image/png'),
    );
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [open, content, format]);

  const fileName = `penniq-${kind}-${format}.png`;
  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    haptic('success');
  };
  const share = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${content.title} — Penniq ${APP_URL}` });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    download();
    toast.show({ message: t('achievement.downloaded') });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('achievement.title')}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={download}
            className="press flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px] font-medium hover:bg-surface-2"
          >
            <Download className="size-5" aria-hidden />
            {t('achievement.download')}
          </button>
          <button
            type="button"
            onClick={() => void share()}
            className="foil press flex min-h-13 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold"
          >
            <Share2 className="size-5" aria-hidden />
            {t('achievement.shareBtn')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {kinds.length > 1 && (
          <Segmented
            label={t('achievement.kind')}
            value={kind}
            onChange={setKind}
            options={kinds.map((k) => ({ value: k, label: t(`achievement.kind.${k}`) }))}
          />
        )}
        {kind === 'goal' && reachedGoals.length > 1 && (
          <select
            value={chosenGoal}
            onChange={(e) => setChosenGoal(e.target.value)}
            className="field min-h-11 py-0 text-[14px]"
            aria-label={t('goal.title')}
          >
            {reachedGoals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
        <Segmented
          label={t('achievement.format')}
          value={format}
          onChange={setFormat}
          options={[
            { value: 'story', label: t('achievement.story') },
            { value: 'square', label: t('achievement.square') },
          ]}
        />
        <div className="flex justify-center rounded-2xl bg-surface-2 p-3">
          {url ? (
            <img
              src={url}
              alt={content.title}
              className={`rounded-xl shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)] ${format === 'story' ? 'h-[min(52dvh,420px)]' : 'h-[min(40dvh,300px)]'}`}
            />
          ) : (
            <div
              className={`animate-pulse rounded-xl bg-surface ${format === 'story' ? 'h-[min(52dvh,420px)] aspect-[9/16]' : 'h-[min(40dvh,300px)] aspect-square'}`}
            />
          )}
        </div>
        {kind !== 'level' && (
          <button
            type="button"
            role="switch"
            aria-checked={amounts}
            onClick={() => setAmounts((x) => !x)}
            className="press flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line px-4 text-start"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{t('achievement.showAmounts')}</span>
              <span className="block text-[12px] text-ink-3">{t('achievement.showAmountsHint')}</span>
            </span>
            <Switch on={amounts} />
          </button>
        )}
      </div>
    </Sheet>
  );
}
