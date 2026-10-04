/**
 * Scheibe 053: the steering view (Steuerungsansicht). The distribution (Verteilung) is two strips of totals from the
 * service, never a figure per person; the house vocabulary of docs/glossar.md applies (never "Matrix", "Dashboard").
 */
export const steeringDe = {
  'steering.distribution.title': 'Verteilung',
  'steering.distribution.units': 'Offen je Fachbereich',
  'steering.distribution.unitsHelp':
    'Einzelfragen, die weder vorgelesen noch geschlossen, zurückgezogen oder zusammengeführt sind. Summen aus dem Dienst, nie je Person.',
  'steering.distribution.noUnit': 'Ohne Fachbereich',
  'steering.distribution.seats': 'Auf der Bühne je Bühnenplatz',
  'steering.distribution.seatsHelp': 'Gestellt und noch nicht vorgelesen.',
  'steering.distribution.filter': '{unit}: {count} offen. Liste auf diesen Fachbereich filtern.',
  'steering.distribution.loading': 'Verteilung wird geladen …',
  'steering.distribution.failed': 'Verteilung nicht lesbar; die Liste bleibt bedienbar.',
  'steering.distribution.empty': 'Für diese Hauptversammlung sind noch keine Fachbereiche und Bühnenplätze angelegt.',
  'steering.detail.empty.title': 'Keine Einzelfrage gewählt',
  'steering.detail.empty.body':
    'Links eine Einzelfrage wählen. Hier stehen Antwortpfad, Bühnenplatz, Fachbereich und der nächste Schritt der Steuerung.',
  'steering.forbidden.title': 'In dieser Rolle keine Leseberechtigung für diese Ansicht',
  'steering.forbidden.body': 'Diese Rolle darf die Einzelfragen nicht lesen.',
};
