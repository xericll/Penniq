import { Reorder, useDragControls } from 'motion/react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { categoryById, type CategoryId } from '../../lib/categories';
import { haptic } from '../../lib/haptics';
import { newId, roundMoney } from '../../lib/ledger';
import { MAX_TEMPLATES, type Template } from '../../lib/templates';
import { usePlanner } from '../../state/PlannerContext';
import { useToast } from '../../state/ToastContext';
import type { AccountType } from '../../types';
import { AmountField } from '../ui/AmountField';
import { Money } from '../ui/Money';
import { AccountPicker, CategoryGrid, TextField, TypePicker, parseNumber } from '../ui/Pickers';
import { Sheet } from '../ui/Sheet';

/** The list of quick buttons: add, edit, delete, drag to reorder. */
export function TemplatesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { templates, setTemplates } = usePlanner();
  const toast = useToast();
  const [editing, setEditing] = useState<Template | 'new' | null>(null);

  const removeOne = (tpl: Template) => {
    const before = templates;
    setTemplates(templates.filter((x) => x.id !== tpl.id));
    toast.show({
      message: t('templates.removed', { name: tpl.name }),
      action: { label: t('common.undo'), onAction: () => setTemplates(before) },
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('templates.title')}
      footer={
        templates.length < MAX_TEMPLATES ? (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="foil press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
          >
            <Plus className="size-5" aria-hidden />
            {t('templates.add')}
          </button>
        ) : undefined
      }
    >
      <p className="mb-4 text-[14px] leading-relaxed text-ink-2">{t('templates.intro')}</p>
      {templates.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ink-3">{t('templates.none')}</p>
      ) : (
        <Reorder.Group axis="y" values={templates} onReorder={setTemplates} className="space-y-2">
          {templates.map((tpl) => (
            <TemplateItem key={tpl.id} tpl={tpl} onEdit={() => setEditing(tpl)} onRemove={() => removeOne(tpl)} />
          ))}
        </Reorder.Group>
      )}
      <TemplateEditor
        open={editing !== null}
        template={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(tpl) => {
          setTemplates(editing === 'new' ? [...templates, tpl] : templates.map((x) => (x.id === tpl.id ? tpl : x)));
          setEditing(null);
          haptic('success');
        }}
      />
    </Sheet>
  );
}

function TemplateItem({ tpl, onEdit, onRemove }: { tpl: Template; onEdit: () => void; onRemove: () => void }) {
  const { t, accountName } = useI18n();
  const controls = useDragControls();
  const cat = tpl.type === 'expense' ? categoryById(tpl.category ?? 'other') : null;
  return (
    <Reorder.Item
      value={tpl}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-1 rounded-2xl border border-line bg-surface ps-1 pe-1"
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-ink-3 active:cursor-grabbing"
        aria-hidden
      >
        <GripVertical className="size-4" />
      </span>
      <button type="button" onClick={onEdit} className="press flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 text-start">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{tpl.name}</span>
          <span className="block truncate text-[13px] text-ink-3">
            {cat ? t(cat.labelKey) : t('common.income')} · {accountName(tpl.account)}
          </span>
        </span>
        <Money value={tpl.type === 'expense' ? -tpl.amount : tpl.amount} sign tone className="shrink-0 text-[15px] font-semibold" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('common.delete')}
        className="press grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-out"
      >
        <Trash2 className="size-4" />
      </button>
    </Reorder.Item>
  );
}

function TemplateEditor({
  open,
  template,
  onClose,
  onSave,
}: {
  open: boolean;
  template: Template | null;
  onClose: () => void;
  onSave: (tpl: Template) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [account, setAccount] = useState<AccountType>('cash');
  const [category, setCategory] = useState<CategoryId>('dining');
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? '');
    setAmount(template ? String(template.amount) : '');
    setType(template?.type ?? 'expense');
    setAccount(template?.account ?? 'cash');
    setCategory(template?.category ?? 'dining');
    setErrors({});
  }, [open, template]);

  const save = () => {
    const value = parseNumber(amount);
    const e: typeof errors = {};
    if (!name.trim()) e.name = t('edit.errReason');
    if (!Number.isFinite(value) || value <= 0) e.amount = t('edit.errAmount');
    setErrors(e);
    if (e.name || e.amount) return haptic('warning');
    onSave({
      id: template?.id ?? newId(),
      name: name.trim(),
      amount: roundMoney(value),
      type,
      account,
      category: type === 'expense' ? category : undefined,
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={template ? t('templates.edit') : t('templates.add')}
      footer={
        <button type="button" onClick={save} className="foil press min-h-13 w-full rounded-2xl text-[16px] font-semibold">
          {t('common.save')}
        </button>
      }
    >
      <div className="space-y-5">
        <TypePicker value={type} onChange={setType} />
        <TextField
          label={t('templates.name')}
          value={name}
          onChange={setName}
          error={errors.name}
          placeholder={t('templates.namePlaceholder')}
          maxLength={40}
        />
        <AmountField label={t('composer.amount')} value={amount} onChange={setAmount} error={errors.amount} />
        <AccountPicker value={account} onChange={setAccount} />
        {type === 'expense' && <CategoryGrid value={category} onChange={setCategory} />}
      </div>
    </Sheet>
  );
}
