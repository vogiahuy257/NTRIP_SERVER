import helpCatalog from '../content/observability-help.vi.json';

export type ObservabilityHelpId = keyof typeof helpCatalog;

export type ObservabilityHelpEntry = (typeof helpCatalog)[ObservabilityHelpId];

export function getObservabilityHelp(
    id: ObservabilityHelpId,
): ObservabilityHelpEntry {
    return helpCatalog[id];
}
