/** Unknown address: say so in the house language and offer the way back into the process. */
import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button, EmptyState, PageHeader, Panel } from '../components';
import { useT } from '../i18n';
import { DEFAULT_ROUTE } from './routes';

export function NotFound() {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="flex h-full min-h-125 flex-col gap-5">
      <PageHeader title={t('page.notFound.title')} description={t('page.notFound.description')} />
      <Panel className="flex-1" bodyClassName="grid">
        <EmptyState
          icon={Compass}
          title={t('page.notFound.title')}
          description={t('page.notFound.description')}
          action={
            <Button variant="secondary" onClick={() => void navigate(DEFAULT_ROUTE)}>
              {t('page.notFound.back')}
            </Button>
          }
        />
      </Panel>
    </div>
  );
}
