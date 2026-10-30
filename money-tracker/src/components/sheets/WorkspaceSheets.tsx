import {
  ArrowLeftRight,
  Briefcase,
  Car,
  Check,
  ChevronDown,
  GraduationCap,
  Heart,
  House,
  Plane,
  Plus,
  Store,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { haptic } from '../../lib/haptics';
import { MAIN_WORKSPACE, MAX_WORKSPACES, WORKSPACE_ICONS, WORKSPACE_TONES, type Workspace, type WorkspaceIcon } from '../../lib/workspaces';
import { useToast } from '../../state/ToastContext';
import { useWallet } from '../../state/WalletContext';
import { TextField } from '../ui/Pickers';
import { Sheet } from '../ui/Sheet';

const ICON_MAP: Record<WorkspaceIcon, LucideIcon> = {
  wallet: Wallet,
  home: House,
  briefcase: Briefcase,
  store: Store,
  car: Car,
  plane: Plane,
  study: GraduationCap,
  heart: Heart,
};

export function useWorkspaceName() {
  const { t } = useI18n();
  return (ws: Workspace) => ws.name || t(ws.id === MAIN_WORKSPACE ? 'ws.main' : 'ws.unnamed');
}

/** The workspace's icon on a tile of its colour. */
export function WorkspaceMark({ icon, tone, size = 36 }: { icon: WorkspaceIcon; tone: number; size?: number }) {
  const Icon = ICON_MAP[icon];
  const hue = WORKSPACE_TONES[tone] ?? WORKSPACE_TONES[0];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl"
      style={{ width: size, height: size, color: hue, background: `color-mix(in oklab, ${hue} 16%, transparent)` }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} />
    </span>
  );
}

/* ---------- Create or edit ---------- */

/** `workspace` null creates a new one (and opens it). */
export function WorkspaceSheet({ open, workspace, onClose }: { open: boolean; workspace: Workspace | null; onClose: () => void }) {
  const { t } = useI18n();
  const { workspaces, workspace: current, setWorkspace, addWorkspace, editWorkspace } = useWallet();
  const nameOf = useWorkspaceName();
  const toast = useToast();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<WorkspaceIcon>('briefcase');
  const [tone, setTone] = useState(1);
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<Workspace | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(workspace ? (workspace.name ?? '') : '');
    setIcon(workspace?.icon ?? 'briefcase');
    setTone(workspace?.tone ?? workspaces.length % WORKSPACE_TONES.length);
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspace]);

  const isMain = workspace?.id === MAIN_WORKSPACE;

  const save = () => {
    // The first workspace may go back to its default name; a new one needs a name of its own.
    if (!name.trim() && !isMain) {
      setError(t('ws.err.name'));
      return haptic('warning');
    }
    if (workspace) {
      editWorkspace({ ...workspace, name, icon, tone });
      toast.show({ message: t('toast.updated') });
    } else {
      const made = addWorkspace({ name, icon, tone });
      if (!made) {
        toast.show({ message: t('ws.limit', { count: MAX_WORKSPACES }) });
        return haptic('warning');
      }
      toast.show({ message: t('ws.toast.created', { name: made.name }) });
    }
    haptic('success');
    onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={workspace ? t('ws.edit') : t('ws.new')}
        footer={
          <div className="flex gap-2">
            {workspace && !isMain && (
              <button
                type="button"
                onClick={() => {
                  setDeleting(workspace);
                  onClose();
                }}
                aria-label={t('ws.delete')}
                title={t('ws.delete')}
                className="press grid min-h-13 w-14 shrink-0 place-items-center rounded-2xl border border-line-strong text-out hover:bg-surface-2"
              >
                <Trash2 className="size-5" />
              </button>
            )}
            <button type="button" onClick={save} className="foil press min-h-13 flex-1 rounded-2xl text-[16px] font-semibold">
              {workspace ? t('ws.save') : t('ws.create')}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex justify-center pt-1">
            <WorkspaceMark icon={icon} tone={tone} size={72} />
          </div>

          <TextField
            label={t('ws.name')}
            value={name}
            onChange={(v) => {
              setName(v);
              setError(undefined);
            }}
            error={error}
            placeholder={isMain ? t('ws.main') : t('ws.namePlaceholder')}
            maxLength={40}
          />

          <fieldset>
            <legend className="eyebrow mb-2">{t('ws.icon')}</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {WORKSPACE_ICONS.map((id) => {
                const Icon = ICON_MAP[id];
                const active = icon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    aria-label={t(`ws.icon.${id}`)}
                    title={t(`ws.icon.${id}`)}
                    onClick={() => {
                      haptic('select');
                      setIcon(id);
                    }}
                    className={`press grid aspect-square place-items-center rounded-2xl border ${active ? 'coin border-transparent' : 'border-line text-ink-2 hover:border-line-strong'}`}
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="eyebrow mb-2">{t('ws.tone')}</legend>
            <div className="flex gap-3">
              {WORKSPACE_TONES.map((hue, i) => (
                <button
                  key={hue}
                  type="button"
                  aria-pressed={tone === i}
                  aria-label={`${t('ws.tone')} ${i + 1}`}
                  onClick={() => {
                    haptic('select');
                    setTone(i);
                  }}
                  className={`press grid size-10 place-items-center rounded-full border-2 ${tone === i ? 'border-ink' : 'border-transparent'}`}
                >
                  <span className="grid size-7 place-items-center rounded-full text-bg" style={{ background: hue }}>
                    {tone === i && <Check className="size-4" strokeWidth={3} aria-hidden />}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {isMain && <p className="text-[13px] leading-relaxed text-ink-3">{t('ws.mainNote')}</p>}

          {workspace && workspace.id !== current.id && (
            <button
              type="button"
              onClick={() => {
                setWorkspace(workspace.id);
                haptic('select');
                toast.show({ message: t('ws.toast.switched', { name: nameOf(workspace) }) });
                onClose();
              }}
              className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong text-[15px] font-semibold hover:bg-surface-2"
            >
              <ArrowLeftRight className="size-[18px]" aria-hidden />
              {t('ws.open')}
            </button>
          )}
        </div>
      </Sheet>
      <DeleteWorkspaceSheet workspace={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}

/* ---------- Delete ---------- */

function DeleteWorkspaceSheet({ workspace, onClose }: { workspace: Workspace | null; onClose: () => void }) {
  const { t } = useI18n();
  const { removeWorkspace, workspaceCount } = useWallet();
  const nameOf = useWorkspaceName();
  const toast = useToast();
  const [shown, setShown] = useState(workspace);

  // Keep the name on screen while the sheet animates out.
  useEffect(() => {
    if (workspace) setShown(workspace);
  }, [workspace]);

  const name = shown ? nameOf(shown) : '';

  const confirm = () => {
    if (!shown) return;
    removeWorkspace(shown.id);
    haptic('warning');
    toast.show({ message: t('ws.toast.deleted', { name }), tone: 'out' });
    onClose();
  };

  return (
    <Sheet
      open={workspace !== null}
      onClose={onClose}
      title={t('ws.delete.title', { name })}
      footer={
        <button
          type="button"
          onClick={confirm}
          className="press flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-out text-[16px] font-semibold text-bg"
        >
          <Trash2 className="size-5" aria-hidden />
          {t('ws.delete.confirm')}
        </button>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink-2">{t('ws.delete.body', { count: shown ? workspaceCount(shown.id) : 0 })}</p>
    </Sheet>
  );
}

/* ---------- Switch ---------- */

/** Every workspace, the open one ticked, and the way to a new one. */
export function WorkspaceSwitchSheet({ open, onClose, onNew }: { open: boolean; onClose: () => void; onNew: () => void }) {
  const { t } = useI18n();
  const { workspaces, workspace, setWorkspace, workspaceCount } = useWallet();
  const nameOf = useWorkspaceName();
  const toast = useToast();

  const choose = (ws: Workspace) => {
    if (ws.id !== workspace.id) {
      setWorkspace(ws.id);
      haptic('select');
      toast.show({ message: t('ws.toast.switched', { name: nameOf(ws) }) });
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('ws.switch')}>
      <div className="card divide-y divide-line overflow-hidden">
        {workspaces.map((ws) => {
          const active = ws.id === workspace.id;
          return (
            <button
              key={ws.id}
              type="button"
              aria-pressed={active}
              onClick={() => choose(ws)}
              className="press flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2/60"
            >
              <WorkspaceMark icon={ws.icon} tone={ws.tone} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{nameOf(ws)}</span>
                <span className="mt-0.5 block text-[13px] text-ink-3">
                  {active ? t('ws.active') : t('ws.entries', { count: workspaceCount(ws.id) })}
                </span>
              </span>
              {active && <Check className="size-5 shrink-0 text-foil" aria-hidden />}
            </button>
          );
        })}
        {workspaces.length < MAX_WORKSPACES && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onNew();
            }}
            className="press flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2/60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2" aria-hidden>
              <Plus className="size-[18px]" />
            </span>
            <span className="text-[15px] font-medium">{t('ws.add')}</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Home: which workspace is open, as a small pill that opens the switcher. Hidden while there is only one. */
export function WorkspaceChip({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const { workspaces, workspace } = useWallet();
  const nameOf = useWorkspaceName();
  const [switching, setSwitching] = useState(false);
  const [creating, setCreating] = useState(false);

  if (workspaces.length < 2 && !creating) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setSwitching(true)}
        aria-label={`${t('ws.switch')}: ${nameOf(workspace)}`}
        className={`press inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface py-1 ps-1 pe-3 text-[14px] font-medium hover:bg-surface-2 ${className}`}
      >
        <WorkspaceMark icon={workspace.icon} tone={workspace.tone} size={28} />
        <span className="truncate">{nameOf(workspace)}</span>
        <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />
      </button>
      <WorkspaceSwitchSheet open={switching} onClose={() => setSwitching(false)} onNew={() => setCreating(true)} />
      <WorkspaceSheet open={creating} workspace={null} onClose={() => setCreating(false)} />
    </>
  );
}
