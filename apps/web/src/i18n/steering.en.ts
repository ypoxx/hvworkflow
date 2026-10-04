import { steeringDe } from './steering.de';

export const steeringEn: typeof steeringDe = {
  'steering.distribution.title': 'Distribution',
  'steering.distribution.units': 'Open per answering unit',
  'steering.distribution.unitsHelp':
    'Questions not yet read out, closed, withdrawn or merged. Totals from the service, never per person.',
  'steering.distribution.noUnit': 'No answering unit',
  'steering.distribution.seats': 'On the podium per seat',
  'steering.distribution.seatsHelp': 'Staged and not yet read out.',
  'steering.distribution.filter': '{unit}: {count} open. Filter the list to this answering unit.',
  'steering.distribution.loading': 'Loading the distribution …',
  'steering.distribution.failed': 'The distribution cannot be read; the list stays usable.',
  'steering.distribution.empty': 'No answering units or podium seats have been set up for this general meeting yet.',
  'steering.detail.empty.title': 'No question selected',
  'steering.detail.empty.body':
    'Choose a question on the left. Its answer track, podium seat, answering unit and next steering step appear here.',
  'steering.forbidden.title': 'No read permission for this view in this role',
  'steering.forbidden.body': 'This role may not read the questions.',
};
