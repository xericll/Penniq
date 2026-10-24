import { Plus, Trash2, Wand2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { CATEGORIES, categoryById, type CategoryId } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { newId } from '../../lib/ledger';
import { MAX_CONDITIONS, type Condition, type ConditionField, type Rule } from '../../lib/rules';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import type { AccountType } from '../../types';
import { TextField } from '../ui/Pickers';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Switch } from '../ui/Switch';
import { isolate } from '../../lib/bidi';

/** One line in words: "Description contains Lidl → Groceries". */
function useRuleSummary() {
  const { t, accountName, money } = useI18n();
  return (rule: Rule) => {
    const when = rule.conditions
      .map((c) =>
        c.field === 'description'
          ? t('rules.sum.contains', { text: c.value })
          : c.field === 'account'
            ? t('rules.sum.account', { account: accountName(c.value as AccountType) })
            : t(c.field === 'amountGt' ? 'rules.sum.gt' : 'rules.sum.lt', {
                amount: isolate(money(Number(c.value.replace(',', '.')) || 0)),
              }),
      )
      .join(t('rules.sum.and'));
    const then = [
      rule.actions.category && t(categoryById(rule.actions.category).labelKey),
      rule.actions.account && accountName(rule.actions.account),
      rule.actions.note && `“${rule.actions.note}”`,
    ]
      .filter(Boolean)
      .join(' · ');
    return { when, then };
  };
}

/** If … then …: the rules applied to every new entry, in list order. */
export function RulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { rules, setRules } = usePlanner();
  const toast = useToast();
  const summary = useRuleSummary();
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('rules.title')}
      footer={
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="foil press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
        >
          <Plus className="size-5" aria-hidden />
          {t('rules.add')}
        </button>
      }
    >
      <p className="mb-4 text-[14px] leading-relaxed text-ink-2">{t('rules.intro')}</p>
      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Wand2 className="size-7 text-foil" aria-hidden />
          <p className="max-w-xs text-[14px] text-ink-3">{t('rules.none')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => {
            const s = summary(rule);
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-2 rounded-2xl border border-line ps-4 pe-2 ${rule.enabled ? '' : 'opacity-60'}`}
              >
                <button type="button" onClick={() => setEditing(rule)} className="press min-h-[64px] min-w-0 flex-1 py-2.5 text-start">
                  <span className="block text-[14px] leading-snug text-ink-2">
                    <span className="font-semibold text-ink">{t('rules.if')}</span> {s.when}
                  </span>
                  <span className="mt-0.5 block text-[14px] leading-snug text-ink-2">
                    <span className="font-semibold text-ink">{t('rules.then')}</span> {s.then || '—'}
                  </span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={t('rules.enabled')}
                  onClick={() => {
                    haptic('select');
                    setRules(rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
                  }}
                  className="press shrink-0 p-1"
                >
                  <Switch on={rule.enabled} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <RuleEditor
        open={editing !== null}
        rule={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(rule) => {
          setRules(editing === 'new' ? [...rules, rule] : rules.map((r) => (r.id === rule.id ? rule : r)));
          haptic('success');
          setEditing(null);
        }}
        onDelete={(rule) => {
          const before = rules;
          setRules(rules.filter((r) => r.id !== rule.id));
          toast.show({ message: t('rules.removed'), action: { label: t('common.undo'), onAction: () => setRules(before) } });
          setEditing(null);
        }}
      />
    </Sheet>
  );
}

const FIELDS: ConditionField[] = ['description', 'amountGt', 'amountLt', 'account'];

function RuleEditor({
  open,
  rule,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  rule: Rule | null;
  onClose: () => void;
  onSave: (r: Rule) => void;
  onDelete: (r: Rule) => void;
}) {
  const { t, accountName, currencySymbol } = useI18n();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [account, setAccount] = useState<AccountType | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setConditions(rule?.conditions ?? [{ field: 'description', value: '' }]);
    setCategory(rule?.actions.category ?? '');
    setAccount(rule?.actions.account ?? '');
    setNote(rule?.actions.note ?? '');
    setError('');
  }, [open, rule]);

  const setCond = (i: number, patch: Partial<Condition>) => setConditions((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const save = () => {
    const clean = conditions
      .map((c) => ({ ...c, value: c.value.trim() }))
      .filter((c) => c.value && (c.field === 'description' || c.field === 'account' || Number.isFinite(Number(c.value.replace(',', '.')))));
    if (!clean.length) return setError(t('rules.err.condition'));
    if (!category && !account && !note.trim()) return setError(t('rules.err.action'));
    onSave({
      id: rule?.id ?? newId(),
      enabled: rule?.enabled ?? true,
      conditions: clean,
      actions: { category: category || undefined, account: account || undefined, note: note.trim() || undefined },
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={rule ? t('rules.edit') : t('rules.add')}
      footer={
        <div className="flex gap-2">
          {rule && (
            <button
              type="button"
              onClick={() => onDelete(rule)}
              aria-label={t('common.delete')}
              className="press grid min-h-13 w-14 shrink-0 place-items-center rounded-2xl border border-line-strong text-out hover:bg-surface-2"
            >
              <Trash2 className="size-5" />
            </button>
          )}
          <button type="button" onClick={save} className="foil press min-h-13 flex-1 rounded-2xl text-[16px] font-semibold">
            {t('common.save')}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="eyebrow mb-2">{t('rules.if')}</h3>
          <ul className="space-y-2">
            {conditions.map((c, i) => (
              <li key={i} className="rounded-2xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <select
                    value={c.field}
                    onChange={(e) =>
                      setCond(i, { field: e.target.value as ConditionField, value: e.target.value === 'account' ? 'cash' : '' })
                    }
                    className="field min-h-11 min-w-0 flex-1 py-0 text-[14px]"
                    aria-label={t('rules.field')}
                  >
                    {FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {t(`rules.field.${f}`)}
                      </option>
                    ))}
                  </select>
                  {conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setConditions((cs) => cs.filter((_, j) => j !== i))}
                      aria-label={t('common.delete')}
                      className="press grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2">
                  {c.field === 'account' ? (
                    <Segmented
                      label={t('rules.field.account')}
                      value={c.value === 'bank' ? 'bank' : 'cash'}
                      onChange={(v) => setCond(i, { value: v })}
                      options={[
                        { value: 'cash', label: accountName('cash') },
                        { value: 'bank', label: accountName('bank') },
                      ]}
                    />
                  ) : (
                    <TextField
                      label={c.field === 'description' ? t('rules.text') : t('rules.amount')}
                      value={c.value}
                      onChange={(v) => setCond(i, { value: v })}
                      inputMode={c.field === 'description' ? 'text' : 'decimal'}
                      dir={c.field === 'description' ? undefined : 'ltr'}
                      placeholder={c.field === 'description' ? 'Lidl' : '50'}
                      trailing={c.field === 'description' ? undefined : currencySymbol}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
          {conditions.length < MAX_CONDITIONS && (
            <button
              type="button"
              onClick={() => setConditions((cs) => [...cs, { field: 'amountGt', value: '' }])}
              className="press mt-2 flex min-h-11 items-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-4 text-[14px] font-medium text-ink-2 hover:bg-surface-2"
            >
              <Plus className="size-4" aria-hidden />
              {t('rules.addCondition')}
            </button>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="eyebrow">{t('rules.then')}</h3>
          <label className="block">
            <span className="eyebrow mb-2 block">{t('rules.action.category')}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId | '')}
              className="field min-h-12 py-0 text-[15px]"
            >
              <option value="">{t('rules.noChange')}</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="eyebrow mb-2 block">{t('rules.action.account')}</span>
            <Segmented
              label={t('rules.action.account')}
              value={account || 'none'}
              onChange={(v) => setAccount(v === 'none' ? '' : (v as AccountType))}
              options={[
                { value: 'none', label: t('rules.noChange') },
                { value: 'cash', label: accountName('cash') },
                { value: 'bank', label: accountName('bank') },
              ]}
            />
          </div>
          <TextField label={`${t('rules.action.note')} · ${t('common.optional')}`} value={note} onChange={setNote} maxLength={40} />
        </section>

        {error && (
          <p role="alert" className="text-[13px] font-medium text-out">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
