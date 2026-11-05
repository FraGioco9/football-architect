/**
 * Pure read-only predicates for the three audited terminal milestones.
 *
 * These predicates only decide whether already-read milestone evidence matches
 * the command-specific prerequisites. They do not authorize a transition,
 * attest hashes, or substitute for the command's D1 CAS, receipt and audit guards.
 * Keep the three versioned command state machines separate.
 */
export interface TerminalMilestoneRow {
  readonly event_id:string;
  readonly kind:string;
  readonly scope:string;
  readonly scheduled_day:number;
  readonly event_order:number;
  readonly status:string;
  readonly receipt_hash:string|null;
}

export interface ArchiveMilestoneRow {
  readonly event_order:number;
  readonly status:string;
}

/** The archive command's SQL has already matched ID, kind, scope and day. */
export function canArchiveAtTerminalMilestone(event:ArchiveMilestoneRow|null):event is ArchiveMilestoneRow {
  return !!event&&event.status==='scheduled'&&event.event_order>=8000;
}

/** Shared exact archive receipt check present in both close and prepare. */
function hasCompletedArchiveReceipt(event:TerminalMilestoneRow|undefined,archiveHash:string):boolean {
  return !!event&&event.kind==='archive-season'&&event.scope==='season'&&
    event.scheduled_day===56&&event.status==='completed'&&event.receipt_hash===archiveHash;
}

/** Existing close-season-v2 eligibility, without modifying its storage guards. */
export function canCloseArchivedSeason(events:readonly TerminalMilestoneRow[],archiveHash:string):boolean {
  const archived=events.find(e=>e.event_id==='season:archive');
  const closing=events.find(e=>e.event_id==='season:close');
  return hasCompletedArchiveReceipt(archived,archiveHash)&&
    !!closing&&closing.kind==='close-season'&&closing.scope==='season'&&
    closing.scheduled_day===56&&closing.status==='scheduled'&&
    closing.event_order>archived!.event_order&&
    !events.some(e=>e.status==='scheduled'&&e.event_id!=='season:close'&&e.event_id!=='season:next-prepare');
}

/** Existing prepare-season-two-v2 eligibility over its three queried rows. */
export function canPrepareApprovedNextSeason(completion:readonly TerminalMilestoneRow[],sourceArchiveHash:string):boolean {
  const archive=completion.find(e=>e.event_id==='season:archive');
  const close=completion.find(e=>e.event_id==='season:close');
  const next=completion.find(e=>e.event_id==='season:next-prepare');
  return hasCompletedArchiveReceipt(archive,sourceArchiveHash)&&
    !!close&&!!next&&close.kind==='close-season'&&next.kind==='prepare-next-season'&&
    !completion.some(e=>e.scope!=='season'||e.scheduled_day!==56)&&
    archive!.event_order<close.event_order&&close.event_order<next.event_order&&
    close.status==='completed'&&next.status==='scheduled'&&
    close.receipt_hash===sourceArchiveHash&&next.receipt_hash===null;
}
