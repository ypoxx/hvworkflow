/**
 * The demo marker in the header. It must always be obvious that the numbers on screen are synthetic
 * and local to this device (AGENTS.md rule 11) — and it must be one click to start over.
 */
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { resetDemo } from '../api';
import { Badge, Button, Dialog } from '../components';
import { useT } from '../i18n';

export function DemoControls() {
  const t = useT();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      <Badge tone="warning" title={t('demo.hint')}>
        {t('demo.badge')}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        data-testid="demo-reset"
        aria-label={t('demo.reset')}
        title={t('demo.reset')}
        onClick={() => setConfirming(true)}
        icon={<RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('demo.reset.title')}
        description={t('demo.reset.body')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={resetDemo}>
              {t('demo.reset.confirm')}
            </Button>
          </>
        }
      />
    </div>
  );
}
