// The join screen's discovered-host list lives in viewmodel state, which the
// diagnostics screen can't reach. Stash the latest scan result here so a
// connection report can say what the phone actually saw on the network.
import type { ReportedHost } from './formatReport';

let lastSeen: ReportedHost[] = [];

export function setLastSeenHosts(hosts: ReportedHost[]): void {
  lastSeen = hosts;
}

export function getLastSeenHosts(): ReportedHost[] {
  return [...lastSeen];
}
