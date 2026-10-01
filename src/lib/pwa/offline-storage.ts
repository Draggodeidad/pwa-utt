import type { LocalInspection, LaboratoryOption } from "@/features/inspections";
import type { LocalFinding } from "@/features/findings";
import type { SyncQueueItem } from "@/features/sync";
import type { ConflictRecord } from "@/features/sync/types";
import type { DomainOperation, DomainOperationError, OperationAcknowledgement } from "@/features/sync/types";
import type { Uuid } from "@/types/entity";
import { openLocalDatabase, requestToPromise, runTransaction } from "./indexed-db.ts";
import { isSessionBlocked, isSessionCurrent, readLocalSession, sessionEpoch } from "./offline-session.ts";

/** Thrown when an operation would run without an active user partition. */
export class PartitionRequiredError extends Error {
  constructor() {
    super("Se requiere una partición de usuario activa");
    this.name = "PartitionRequiredError";
  }
}

/** A local entity write together with the intent (queue item) it produces. */
export type LocalEntityRecord =
  | { store: "inspection_local"; value: LocalInspection }
  | { store: "finding_local"; value: LocalFinding };

export type ConflictResolutionWrite = {
  records: readonly LocalEntityRecord[];
  enqueue: readonly SyncQueueItem[];
  update: readonly SyncQueueItem[];
  remove: readonly string[];
  resolution: NonNullable<ConflictRecord["resolution"]>;
};

type CatalogRecord = { id: Uuid; ownerUserId: Uuid; laboratories: LaboratoryOption[] };
type MetadataRecord = { name: string; value: string };
type LeaseRecord = { token: string; expiresAt: number };

export class LeaseLostError extends Error {
  constructor() { super("Lease de sincronización vencido o reemplazado"); this.name = "LeaseLostError"; }
}

const leaseName = (owner: Uuid) => `syncLease:${owner}`;

async function assertLease(store: IDBObjectStore, owner: Uuid, token: string, now: number): Promise<void> {
  const record = await requestToPromise<MetadataRecord | undefined>(store.get(leaseName(owner)));
  const lease = record ? JSON.parse(record.value) as LeaseRecord : null;
  if (!lease || lease.token !== token || lease.expiresAt <= now) throw new LeaseLostError();
}

function announceQueueChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pwa-utt:queue-changed"));
}

const ownerPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireOwner(owner: Uuid): void {
  if (typeof owner !== "string" || !ownerPattern.test(owner)) throw new PartitionRequiredError();
  if (typeof localStorage !== "undefined" && readLocalSession()?.userId !== owner) throw new PartitionRequiredError();
}

/**
 * Durable, per-user-partitioned local storage over IndexedDB. Every entity,
 * queue and catalog operation requires an active owner partition; installation
 * metadata (clientId) is the only shared technical record.
 */
export class LocalStorage {
  private readonly db: IDBDatabase;
  private readonly epoch: string;

  private constructor(db: IDBDatabase, epoch: string) {
    this.db = db;
    this.epoch = epoch;
  }

  static async open(databaseName?: string): Promise<LocalStorage> {
    const epoch = sessionEpoch();
    if (!isSessionCurrent(epoch)) throw new PartitionRequiredError();
    const db = await openLocalDatabase(databaseName);
    if (!isSessionCurrent(epoch)) { db.close(); throw new PartitionRequiredError(); }
    return new LocalStorage(db, epoch);
  }

  /** Invalidates an in-flight runner's lease without opening its locked partition. */
  static async revokeLease(owner: Uuid, blockedEpoch: string, databaseName?: string): Promise<void> {
    if (typeof owner !== "string" || !ownerPattern.test(owner)) return;
    if (!isSessionBlocked() || sessionEpoch() !== blockedEpoch) return;
    const db = await openLocalDatabase(databaseName);
    try {
      await runTransaction(db, ["metadata"], "readwrite", async (stores) => {
        if (!isSessionBlocked() || sessionEpoch() !== blockedEpoch) return;
        await requestToPromise(stores.metadata.delete(leaseName(owner)));
      });
    } finally { db.close(); }
  }

  private async runTransaction<T>(storeNames: readonly string[], mode: IDBTransactionMode, work: (stores: Record<string, IDBObjectStore>) => Promise<T> | T): Promise<T> {
    if (!isSessionCurrent(this.epoch)) throw new PartitionRequiredError();
    const result = await runTransaction(this.db, storeNames, mode, work);
    if (!isSessionCurrent(this.epoch)) throw new PartitionRequiredError();
    return result;
  }

  close(): void {
    this.db.close();
  }

  /** Stable installation identifier; generated once and persisted. */
  async getClientId(): Promise<string> {
    const existing = await this.readMetadata("installationId");
    if (existing) return existing;
    const generated = crypto.randomUUID();
    await this.writeMetadata("installationId", generated);
    return generated;
  }

  private readMetadata(name: string): Promise<string | null> {
    return this.runTransaction(["metadata"], "readonly", async (stores) => {
      const record = await requestToPromise<MetadataRecord | undefined>(stores.metadata.get(name));
      return record?.value ?? null;
    });
  }

  private writeMetadata(name: string, value: string): Promise<void> {
    return this.runTransaction(["metadata"], "readwrite", async (stores) => {
      await requestToPromise(stores.metadata.put({ name, value }));
    });
  }

  /** A readwrite metadata transaction serializes contenders across tabs. */
  async acquireLease(owner: Uuid, now: number, durationMs: number): Promise<string | null> {
    requireOwner(owner);
    return this.runTransaction(["metadata"], "readwrite", async (stores) => {
      const name = leaseName(owner);
      const record = await requestToPromise<MetadataRecord | undefined>(stores.metadata.get(name));
      const current = record ? JSON.parse(record.value) as LeaseRecord : null;
      if (current && current.expiresAt > now) return null;
      const token = crypto.randomUUID();
      await requestToPromise(stores.metadata.put({ name, value: JSON.stringify({ token, expiresAt: now + durationMs }) }));
      return token;
    });
  }

  async renewLease(owner: Uuid, token: string, now: number, durationMs: number): Promise<void> {
    requireOwner(owner);
    await this.runTransaction(["metadata"], "readwrite", async (stores) => {
      await assertLease(stores.metadata, owner, token, now);
      await requestToPromise(stores.metadata.put({ name: leaseName(owner), value: JSON.stringify({ token, expiresAt: now + durationMs }) }));
    });
  }

  async releaseLease(owner: Uuid, token: string): Promise<void> {
    if (typeof owner !== "string" || !ownerPattern.test(owner)) throw new PartitionRequiredError();
    await runTransaction(this.db, ["metadata"], "readwrite", async (stores) => {
      const record = await requestToPromise<MetadataRecord | undefined>(stores.metadata.get(leaseName(owner)));
      if (record && (JSON.parse(record.value) as LeaseRecord).token === token) {
        await requestToPromise(stores.metadata.delete(leaseName(owner)));
      }
    });
  }

  async leaseExpiresAt(owner: Uuid): Promise<number | null> {
    requireOwner(owner);
    const record = await this.readMetadata(leaseName(owner));
    return record ? (JSON.parse(record) as LeaseRecord).expiresAt : null;
  }

  async saveInspection(owner: Uuid, inspection: LocalInspection): Promise<void> {
    requireOwner(owner);
    if (inspection.ownerUserId !== owner) throw new PartitionRequiredError();
    await this.runTransaction(["inspection_local"], "readwrite", async (stores) => {
      await requestToPromise(stores.inspection_local.put(inspection));
    });
  }

  async getInspection(owner: Uuid, id: string): Promise<LocalInspection | null> {
    requireOwner(owner);
    return this.runTransaction(["inspection_local"], "readonly", async (stores) => {
      const record = await requestToPromise<LocalInspection | undefined>(stores.inspection_local.get(id));
      return record && record.ownerUserId === owner ? record : null;
    });
  }

  async listInspections(owner: Uuid): Promise<LocalInspection[]> {
    requireOwner(owner);
    return this.runTransaction(["inspection_local"], "readonly", async (stores) => {
      const records = await requestToPromise<LocalInspection[]>(stores.inspection_local.index("owner").getAll(owner));
      return (records ?? []).filter((record) => record.ownerUserId === owner);
    });
  }

  async removeInspection(owner: Uuid, id: string): Promise<void> {
    requireOwner(owner);
    await this.runTransaction(["inspection_local"], "readwrite", async (stores) => {
      const record = await requestToPromise<LocalInspection | undefined>(stores.inspection_local.get(id));
      if (record && record.ownerUserId === owner) await requestToPromise(stores.inspection_local.delete(id));
    });
  }

  async saveFinding(owner: Uuid, finding: LocalFinding): Promise<void> {
    requireOwner(owner);
    if (finding.ownerUserId !== owner) throw new PartitionRequiredError();
    await this.runTransaction(["finding_local"], "readwrite", async (stores) => {
      await requestToPromise(stores.finding_local.put(finding));
    });
  }

  async getFinding(owner: Uuid, id: string): Promise<LocalFinding | null> {
    requireOwner(owner);
    return this.runTransaction(["finding_local"], "readonly", async (stores) => {
      const record = await requestToPromise<LocalFinding | undefined>(stores.finding_local.get(id));
      return record && record.ownerUserId === owner ? record : null;
    });
  }

  async listFindings(owner: Uuid, inspectionId?: string): Promise<LocalFinding[]> {
    requireOwner(owner);
    return this.runTransaction(["finding_local"], "readonly", async (stores) => {
      const records = inspectionId
        ? await requestToPromise<LocalFinding[]>(stores.finding_local.index("inspection").getAll(inspectionId))
        : await requestToPromise<LocalFinding[]>(stores.finding_local.index("owner").getAll(owner));
      return (records ?? []).filter((record) => record.ownerUserId === owner);
    });
  }

  async removeFinding(owner: Uuid, id: string): Promise<void> {
    requireOwner(owner);
    await this.runTransaction(["finding_local"], "readwrite", async (stores) => {
      const record = await requestToPromise<LocalFinding | undefined>(stores.finding_local.get(id));
      if (record && record.ownerUserId === owner) await requestToPromise(stores.finding_local.delete(id));
    });
  }

  async saveCatalog(owner: Uuid, laboratories: readonly LaboratoryOption[]): Promise<void> {
    requireOwner(owner);
    await this.runTransaction(["catalog_local"], "readwrite", async (stores) => {
      const record: CatalogRecord = { id: owner, ownerUserId: owner, laboratories: [...laboratories] };
      await requestToPromise(stores.catalog_local.put(record));
    });
  }

  async getCatalog(owner: Uuid): Promise<LaboratoryOption[]> {
    requireOwner(owner);
    return this.runTransaction(["catalog_local"], "readonly", async (stores) => {
      const record = await requestToPromise<CatalogRecord | undefined>(stores.catalog_local.get(owner));
      return record && record.ownerUserId === owner ? record.laboratories : [];
    });
  }

  /**
   * Writes the entity and its intent in a single transaction; the promise only
   * resolves once the transaction commits, so a failing second write rolls back
   * the first and rejects (no false visual success).
   */
  async saveDraftWithIntent(owner: Uuid, record: LocalEntityRecord, intent: SyncQueueItem): Promise<void> {
    requireOwner(owner);
    if (record.value.ownerUserId !== owner || intent.ownerUserId !== owner) throw new PartitionRequiredError();
    await this.runTransaction([record.store, "sync_queue"], "readwrite", async (stores) => {
      await requestToPromise(stores[record.store].put(record.value));
      await requestToPromise(stores.sync_queue.put(intent));
    });
    announceQueueChange();
  }

  async enqueue(owner: Uuid, item: SyncQueueItem): Promise<void> {
    requireOwner(owner);
    if (item.ownerUserId !== owner) throw new PartitionRequiredError();
    await this.runTransaction(["sync_queue"], "readwrite", async (stores) => {
      await requestToPromise(stores.sync_queue.put(item));
    });
    announceQueueChange();
  }

  async listQueue(owner: Uuid): Promise<SyncQueueItem[]> {
    requireOwner(owner);
    return this.runTransaction(["sync_queue"], "readonly", async (stores) => {
      const records = await requestToPromise<SyncQueueItem[]>(stores.sync_queue.index("owner").getAll(owner));
      return (records ?? [])
        .filter((item) => item.ownerUserId === owner)
        .sort((a, b) => a.localOrder - b.localOrder);
    });
  }

  async listConflicts(owner: Uuid): Promise<ConflictRecord[]> {
    requireOwner(owner);
    return this.runTransaction(["conflict_local"], "readonly", async (stores) => {
      const records = await requestToPromise<ConflictRecord[]>(stores.conflict_local.index("owner").getAll(owner));
      return (records ?? []).filter((record) => record.ownerUserId === owner);
    });
  }

  async getConflict(owner: Uuid, operationId: string): Promise<ConflictRecord | null> {
    requireOwner(owner);
    return this.runTransaction(["conflict_local"], "readonly", async (stores) => {
      const record = await requestToPromise<ConflictRecord | undefined>(stores.conflict_local.get(operationId));
      return record?.ownerUserId === owner ? record : null;
    });
  }

  async updateConflictSnapshot(owner: Uuid, operationId: string, remoteSnapshot: unknown, remoteVersion: number, reason: ConflictRecord["reason"]): Promise<void> {
    requireOwner(owner);
    await this.runTransaction(["conflict_local"], "readwrite", async (stores) => {
      const current = await requestToPromise<ConflictRecord | undefined>(stores.conflict_local.get(operationId));
      if (!current || current.ownerUserId !== owner || current.resolvedAt) throw new PartitionRequiredError();
      await requestToPromise(stores.conflict_local.put({ ...current, remoteSnapshot, remoteVersion, reason }));
    });
  }

  /** Changes queue, entities and conflict status together; frozen dependent requests cannot be rewritten. */
  async resolveConflict(owner: Uuid, operationId: string, write: ConflictResolutionWrite, leaseToken: string, now = Date.now()): Promise<void> {
    requireOwner(owner);
    for (const record of write.records) if (record.value.ownerUserId !== owner) throw new PartitionRequiredError();
    for (const item of [...write.enqueue, ...write.update]) if (item.ownerUserId !== owner) throw new PartitionRequiredError();
    await this.runTransaction(["conflict_local", "sync_queue", "inspection_local", "finding_local", "metadata"], "readwrite", async (stores) => {
      await assertLease(stores.metadata, owner, leaseToken, now);
      const conflict = await requestToPromise<ConflictRecord | undefined>(stores.conflict_local.get(operationId));
      const failed = await requestToPromise<SyncQueueItem | undefined>(stores.sync_queue.get(operationId));
      if (!conflict || conflict.ownerUserId !== owner || conflict.resolvedAt || !failed || failed.ownerUserId !== owner || JSON.stringify(failed.frozenRequest) !== JSON.stringify(conflict.failedOperation.frozenRequest)) throw new PartitionRequiredError();
      const allQueue = await requestToPromise<SyncQueueItem[]>(stores.sync_queue.index("owner").getAll(owner));
      const handled = new Set([...write.remove, ...write.update.map((item) => item.operationId)]);
      if (allQueue.some((item) => item.ownerUserId === owner && item.dependsOn.includes(operationId) && !handled.has(item.operationId))) throw new Error("La cola cambió durante la resolución; vuelve a intentarlo");
      for (const id of write.remove) {
        const item = await requestToPromise<SyncQueueItem | undefined>(stores.sync_queue.get(id));
        if (!item || item.ownerUserId !== owner || (id !== operationId && item.frozenRequest)) throw new PartitionRequiredError();
      }
      for (const item of write.update) {
        const old = await requestToPromise<SyncQueueItem | undefined>(stores.sync_queue.get(item.operationId));
        if (!old || old.ownerUserId !== owner || old.frozenRequest) throw new PartitionRequiredError();
      }
      for (const record of write.records) await requestToPromise(stores[record.store].put(record.value));
      for (const id of write.remove) await requestToPromise(stores.sync_queue.delete(id));
      for (const item of [...write.update, ...write.enqueue]) await requestToPromise(stores.sync_queue.put(item));
      await requestToPromise(stores.conflict_local.put({ ...conflict, resolution: write.resolution, resolvedAt: new Date(now).toISOString() }));
    });
    announceQueueChange();
  }

  async listPending(owner: Uuid): Promise<SyncQueueItem[]> {
    return this.listQueue(owner);
  }

  async updateQueueItem(owner: Uuid, item: SyncQueueItem): Promise<void> {
    requireOwner(owner);
    if (item.ownerUserId !== owner) throw new PartitionRequiredError();
    await this.runTransaction(["sync_queue"], "readwrite", async (stores) => {
      await requestToPromise(stores.sync_queue.put(item));
    });
  }

  async markComplete(owner: Uuid, operationId: string): Promise<void> {
    requireOwner(owner);
    await this.runTransaction(["sync_queue"], "readwrite", async (stores) => {
      const record = await requestToPromise<SyncQueueItem | undefined>(stores.sync_queue.get(operationId));
      if (record && record.ownerUserId === owner) await requestToPromise(stores.sync_queue.delete(operationId));
    });
  }

  /** Writes all records and their intents in one transaction (atomic capture). */
  async saveCapture(owner: Uuid, records: readonly LocalEntityRecord[], intents: readonly SyncQueueItem[], removedFindings: readonly { id: string; baseVersion: number | null }[] = []): Promise<void> {
    requireOwner(owner);
    for (const record of records) if (record.value.ownerUserId !== owner) throw new PartitionRequiredError();
    for (const intent of intents) if (intent.ownerUserId !== owner) throw new PartitionRequiredError();
    const storeNames = Array.from(new Set([...records.map((record) => record.store), ...(removedFindings.length ? ["finding_local"] : []), "sync_queue"]));
    await this.runTransaction(storeNames, "readwrite", async (stores) => {
      for (const removed of removedFindings) {
        const related = await requestToPromise<SyncQueueItem[]>(stores.sync_queue.index("entity").getAll(removed.id));
        const owned = related.filter((item) => item.ownerUserId === owner);
        const neverSent = removed.baseVersion === null && owned.every((item) => !item.frozenRequest);
        const current = await requestToPromise<LocalFinding | undefined>(stores.finding_local.get(removed.id));
        if (current && current.ownerUserId !== owner) throw new PartitionRequiredError();
        if (neverSent) {
          for (const item of owned) await requestToPromise(stores.sync_queue.delete(item.operationId));
          if (current) await requestToPromise(stores.finding_local.delete(removed.id));
        } else if (current) {
          await requestToPromise(stores.finding_local.put({
            ...current, deletedAt: new Date().toISOString(), localRevision: current.localRevision + 1, syncStatus: "pending",
          }));
        }
      }
      for (const record of records) await requestToPromise(stores[record.store].put(record.value));
      for (const intent of intents) await requestToPromise(stores.sync_queue.put(intent));
    });
    announceQueueChange();
  }

  /**
   * Atomically removes an inspection, its findings and every related intent.
   * Used by the not-sent discard path so no entity/intent is left orphaned.
   */
  async removeCapture(owner: Uuid, inspectionId: string): Promise<void> {
    requireOwner(owner);
    await this.runTransaction(["inspection_local", "finding_local", "sync_queue"], "readwrite", async (stores) => {
      const inspection = await requestToPromise<LocalInspection | undefined>(stores.inspection_local.get(inspectionId));
      if (!inspection || inspection.ownerUserId !== owner) return;
      const findings = await requestToPromise<LocalFinding[]>(stores.finding_local.index("inspection").getAll(inspectionId));
      const operationIds = new Set<string>();
      const inspectionIntents = await requestToPromise<SyncQueueItem[]>(stores.sync_queue.index("entity").getAll(inspectionId));
      for (const item of inspectionIntents) operationIds.add(item.operationId);
      for (const finding of findings) {
        const findingIntents = await requestToPromise<SyncQueueItem[]>(stores.sync_queue.index("entity").getAll(finding.id));
        for (const item of findingIntents) operationIds.add(item.operationId);
      }
      await requestToPromise(stores.inspection_local.delete(inspectionId));
      for (const finding of findings) await requestToPromise(stores.finding_local.delete(finding.id));
      operationIds.forEach((operationId) => void requestToPromise(stores.sync_queue.delete(operationId)));
    });
  }

  /**
   * Persists a tombstoned inspection together with its ordered discard intent,
   * keeping the identity and prior intents for a future remote discard.
   */
  async discardCapture(owner: Uuid, tombstone: LocalInspection, discardIntent: SyncQueueItem): Promise<void> {
    requireOwner(owner);
    if (tombstone.ownerUserId !== owner || discardIntent.ownerUserId !== owner) throw new PartitionRequiredError();
    await this.runTransaction(["inspection_local", "sync_queue"], "readwrite", async (stores) => {
      await requestToPromise(stores.inspection_local.put(tombstone));
      await requestToPromise(stores.sync_queue.put(discardIntent));
    });
    announceQueueChange();
  }

  /** Freezes the complete request before HTTP; a later edit never changes its key or body. */
  async prepareSend(owner: Uuid, operationId: string, clientId: Uuid, leaseToken?: string, now = Date.now()): Promise<SyncQueueItem | null> {
    requireOwner(owner);
    const result = await this.runTransaction(["sync_queue", "inspection_local", "finding_local", "metadata"], "readwrite", async (stores) => {
      if (leaseToken) await assertLease(stores.metadata, owner, leaseToken, now);
      const item = await requestToPromise<SyncQueueItem | undefined>(stores.sync_queue.get(operationId));
      if (!item || item.ownerUserId !== owner) return null;
      const store = item.entity === "inspection" ? stores.inspection_local : stores.finding_local;
      const entity = await requestToPromise<LocalInspection | LocalFinding | undefined>(store.get(item.entityId));
      if (entity && entity.ownerUserId !== owner) throw new PartitionRequiredError();
      if (!entity && !["finding.delete", "finding.followup", "inspection.finalize", "inspection.discard"].includes(item.operation)) throw new PartitionRequiredError();
      const request: DomainOperation = item.frozenRequest ?? {
        clientId, kind: item.operation, entityId: item.entityId,
        baseVersion: item.baseVersion, payload: item.payload,
      } as DomainOperation;
      const prepared: SyncQueueItem = {
        ...item, frozenRequest: request, sentRevision: item.sentRevision ?? entity?.localRevision ?? null,
        status: "syncing", attempts: item.attempts + 1,
      };
      await requestToPromise(stores.sync_queue.put(prepared));
      return prepared;
    });
    if (result) announceQueueChange();
    return result;
  }

  /** Retrieves the ISO timestamp of the last successful synchronization ACK for this owner. */
  async getLastSyncAt(owner: Uuid): Promise<string | null> {
    requireOwner(owner);
    return this.readMetadata(`lastSync:${owner}`);
  }

  /**
   * Resets an errored queue item to pending without jumping causal dependencies.
   * Returns false if the item has unacknowledged dependencies still in queue.
   */
  async retryQueueItem(owner: Uuid, operationId: string): Promise<boolean> {
    requireOwner(owner);
    const retried = await this.runTransaction(["sync_queue"], "readwrite", async (stores) => {
      const queue = await requestToPromise<SyncQueueItem[]>(stores.sync_queue.index("owner").getAll(owner));
      const target = queue.find((item) => item.operationId === operationId);
      if (!target || target.ownerUserId !== owner) return false;
      const hasPendingDep = target.dependsOn.some((depId) => queue.some((other) => other.operationId === depId));
      if (hasPendingDep) return false;
      const updated: SyncQueueItem = {
        ...target,
        status: "pending",
        nextAttemptAt: null,
        retryExhausted: false,
      };
      await requestToPromise(stores.sync_queue.put(updated));
      return true;
    });
    if (retried) announceQueueChange();
    return retried;
  }

  /** Applies the ACK and dependent version chain in one committed transaction. */
  async acknowledge(owner: Uuid, sent: SyncQueueItem, ack: OperationAcknowledgement, leaseToken?: string, now = Date.now()): Promise<void> {
    requireOwner(owner);
    if (sent.ownerUserId !== owner || ack.operationId !== sent.operationId || ack.entityId !== sent.entityId || ack.entityType !== sent.entity || !Number.isSafeInteger(ack.version) || ack.version < 1 || typeof ack.appliedAt !== "string") throw new Error("ACK incompatible");
    await this.runTransaction(["sync_queue", "inspection_local", "finding_local", "metadata"], "readwrite", async (stores) => {
      if (leaseToken) await assertLease(stores.metadata, owner, leaseToken, now);
      const queued = await requestToPromise<SyncQueueItem | undefined>(stores.sync_queue.get(sent.operationId));
      if (!queued || queued.ownerUserId !== owner || !queued.frozenRequest || JSON.stringify(queued.frozenRequest) !== JSON.stringify(sent.frozenRequest)) throw new PartitionRequiredError();
      const store = sent.entity === "inspection" ? stores.inspection_local : stores.finding_local;
      const entity = await requestToPromise<LocalInspection | LocalFinding | undefined>(store.get(sent.entityId));
      if (entity && entity.ownerUserId !== owner) throw new PartitionRequiredError();
      const queue = await requestToPromise<SyncQueueItem[]>(stores.sync_queue.index("owner").getAll(owner));
      const later = queue.some((item) => item.operationId !== sent.operationId && item.entityId === sent.entityId && item.localOrder > sent.localOrder);
      const editedAfterSend = entity ? entity.localRevision !== sent.sentRevision : false;
      const synced = !later && !editedAfterSend;
      if (entity) {
        const updated = {
          ...entity, version: ack.version, baseVersion: ack.version,
          updatedAt: ack.appliedAt, syncStatus: synced ? "synced" as const : "pending" as const,
          ...(sent.entity === "inspection" && Number.isSafeInteger(ack.folioNumber) && (ack.folioNumber as number) > 0 ? { folioNumber: ack.folioNumber } : {}),
          ...(sent.operation === "inspection.finalize" && synced ? { workflowStatus: "completed" as const, completedAt: ack.appliedAt } : {}),
          ...(sent.operation === "finding.delete" && synced ? { deletedAt: ack.appliedAt } : {}),
        };
        await requestToPromise(store.put(updated));
      }
      for (const dependent of queue) {
        if (dependent.ownerUserId !== owner || dependent.operationId === sent.operationId || dependent.frozenRequest || !dependent.dependsOn.includes(sent.operationId)) continue;
        const next = {
          ...dependent,
          baseVersion: dependent.entityId === sent.entityId ? ack.version : dependent.baseVersion,
        };
        await requestToPromise(stores.sync_queue.put(next));
      }
      await requestToPromise(stores.metadata.put({ name: `lastSync:${owner}`, value: ack.appliedAt }));
      await requestToPromise(stores.sync_queue.delete(sent.operationId));
    });
    announceQueueChange();
  }

  async failSend(owner: Uuid, sent: SyncQueueItem, error: DomainOperationError, nextAttemptAt: string | null = null, leaseToken?: string, now = Date.now(), retryExhausted = false, conflict?: Pick<ConflictRecord, "reason" | "remoteSnapshot" | "remoteVersion">): Promise<void> {
    requireOwner(owner);
    await this.runTransaction(["sync_queue", "metadata", "inspection_local", "finding_local", "conflict_local"], "readwrite", async (stores) => {
      if (leaseToken) await assertLease(stores.metadata, owner, leaseToken, now);
      const current = await requestToPromise<SyncQueueItem | undefined>(stores.sync_queue.get(sent.operationId));
      if (!current || current.ownerUserId !== owner) return;
      const failed: SyncQueueItem = { ...current, status: "error", nextAttemptAt, lastError: error, retryExhausted };
      await requestToPromise(stores.sync_queue.put(failed));
      if (conflict) {
        const entityStore = sent.entity === "inspection" ? stores.inspection_local : stores.finding_local;
        const local = await requestToPromise<LocalInspection | LocalFinding | undefined>(entityStore.get(sent.entityId));
        if (local && local.ownerUserId !== owner) throw new PartitionRequiredError();
        const inspectionId = sent.entity === "inspection" ? sent.entityId : (local as LocalFinding | undefined)?.inspectionId ?? sent.parentEntityId;
        const parent = inspectionId ? await requestToPromise<LocalInspection | undefined>(stores.inspection_local.get(inspectionId)) : undefined;
        const findings = inspectionId ? await requestToPromise<LocalFinding[]>(stores.finding_local.index("inspection").getAll(inspectionId)) : [];
        if (parent && parent.ownerUserId !== owner || findings.some((finding) => finding.ownerUserId !== owner)) throw new PartitionRequiredError();
        const record: ConflictRecord = {
          operationId: sent.operationId, ownerUserId: owner, entity: sent.entity, entityId: sent.entityId,
          ...(sent.parentEntityId ? { parentEntityId: sent.parentEntityId } : {}),
          reason: conflict.reason, error, failedOperation: failed, localSnapshot: { entity: local ?? null, inspection: parent ?? null, findings },
          remoteSnapshot: conflict.remoteSnapshot, localVersion: sent.frozenRequest?.baseVersion ?? sent.baseVersion,
          remoteVersion: conflict.remoteVersion, createdAt: new Date(now).toISOString(), resolvedAt: null, resolution: null,
        };
        await requestToPromise(stores.conflict_local.put(record));
      }
    });
    announceQueueChange();
  }
}
