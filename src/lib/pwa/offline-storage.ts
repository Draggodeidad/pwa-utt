import type { LocalInspection, LaboratoryOption } from "@/features/inspections";
import type { LocalFinding } from "@/features/findings";
import type { SyncQueueItem } from "@/features/sync";
import type { Uuid } from "@/types/entity";
import { openLocalDatabase, requestToPromise, runTransaction } from "./indexed-db.ts";

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

type CatalogRecord = { id: "catalog"; ownerUserId: Uuid; laboratories: LaboratoryOption[] };
type MetadataRecord = { name: string; value: string };

const ownerPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireOwner(owner: Uuid): void {
  if (typeof owner !== "string" || !ownerPattern.test(owner)) throw new PartitionRequiredError();
}

/**
 * Durable, per-user-partitioned local storage over IndexedDB. Every entity,
 * queue and catalog operation requires an active owner partition; installation
 * metadata (clientId) is the only shared technical record.
 */
export class LocalStorage {
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static async open(databaseName?: string): Promise<LocalStorage> {
    return new LocalStorage(await openLocalDatabase(databaseName));
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
    return runTransaction(this.db, ["metadata"], "readonly", async (stores) => {
      const record = await requestToPromise<MetadataRecord | undefined>(stores.metadata.get(name));
      return record?.value ?? null;
    });
  }

  private writeMetadata(name: string, value: string): Promise<void> {
    return runTransaction(this.db, ["metadata"], "readwrite", async (stores) => {
      await requestToPromise(stores.metadata.put({ name, value }));
    });
  }

  async saveInspection(owner: Uuid, inspection: LocalInspection): Promise<void> {
    requireOwner(owner);
    if (inspection.ownerUserId !== owner) throw new PartitionRequiredError();
    await runTransaction(this.db, ["inspection_local"], "readwrite", async (stores) => {
      await requestToPromise(stores.inspection_local.put(inspection));
    });
  }

  async getInspection(owner: Uuid, id: string): Promise<LocalInspection | null> {
    requireOwner(owner);
    return runTransaction(this.db, ["inspection_local"], "readonly", async (stores) => {
      const record = await requestToPromise<LocalInspection | undefined>(stores.inspection_local.get(id));
      return record && record.ownerUserId === owner ? record : null;
    });
  }

  async listInspections(owner: Uuid): Promise<LocalInspection[]> {
    requireOwner(owner);
    return runTransaction(this.db, ["inspection_local"], "readonly", async (stores) => {
      const records = await requestToPromise<LocalInspection[]>(stores.inspection_local.index("owner").getAll(owner));
      return (records ?? []).filter((record) => record.ownerUserId === owner);
    });
  }

  async removeInspection(owner: Uuid, id: string): Promise<void> {
    requireOwner(owner);
    await runTransaction(this.db, ["inspection_local"], "readwrite", async (stores) => {
      const record = await requestToPromise<LocalInspection | undefined>(stores.inspection_local.get(id));
      if (record && record.ownerUserId === owner) await requestToPromise(stores.inspection_local.delete(id));
    });
  }

  async saveFinding(owner: Uuid, finding: LocalFinding): Promise<void> {
    requireOwner(owner);
    if (finding.ownerUserId !== owner) throw new PartitionRequiredError();
    await runTransaction(this.db, ["finding_local"], "readwrite", async (stores) => {
      await requestToPromise(stores.finding_local.put(finding));
    });
  }

  async getFinding(owner: Uuid, id: string): Promise<LocalFinding | null> {
    requireOwner(owner);
    return runTransaction(this.db, ["finding_local"], "readonly", async (stores) => {
      const record = await requestToPromise<LocalFinding | undefined>(stores.finding_local.get(id));
      return record && record.ownerUserId === owner ? record : null;
    });
  }

  async listFindings(owner: Uuid, inspectionId?: string): Promise<LocalFinding[]> {
    requireOwner(owner);
    return runTransaction(this.db, ["finding_local"], "readonly", async (stores) => {
      const records = inspectionId
        ? await requestToPromise<LocalFinding[]>(stores.finding_local.index("inspection").getAll(inspectionId))
        : await requestToPromise<LocalFinding[]>(stores.finding_local.index("owner").getAll(owner));
      return (records ?? []).filter((record) => record.ownerUserId === owner);
    });
  }

  async removeFinding(owner: Uuid, id: string): Promise<void> {
    requireOwner(owner);
    await runTransaction(this.db, ["finding_local"], "readwrite", async (stores) => {
      const record = await requestToPromise<LocalFinding | undefined>(stores.finding_local.get(id));
      if (record && record.ownerUserId === owner) await requestToPromise(stores.finding_local.delete(id));
    });
  }

  async saveCatalog(owner: Uuid, laboratories: readonly LaboratoryOption[]): Promise<void> {
    requireOwner(owner);
    await runTransaction(this.db, ["catalog_local"], "readwrite", async (stores) => {
      const record: CatalogRecord = { id: "catalog", ownerUserId: owner, laboratories: [...laboratories] };
      await requestToPromise(stores.catalog_local.put(record));
    });
  }

  async getCatalog(owner: Uuid): Promise<LaboratoryOption[]> {
    requireOwner(owner);
    return runTransaction(this.db, ["catalog_local"], "readonly", async (stores) => {
      const record = await requestToPromise<CatalogRecord | undefined>(stores.catalog_local.get("catalog"));
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
    await runTransaction(this.db, [record.store, "sync_queue"], "readwrite", async (stores) => {
      await requestToPromise(stores[record.store].put(record.value));
      await requestToPromise(stores.sync_queue.put(intent));
    });
  }

  async enqueue(owner: Uuid, item: SyncQueueItem): Promise<void> {
    requireOwner(owner);
    if (item.ownerUserId !== owner) throw new PartitionRequiredError();
    await runTransaction(this.db, ["sync_queue"], "readwrite", async (stores) => {
      await requestToPromise(stores.sync_queue.put(item));
    });
  }

  async listQueue(owner: Uuid): Promise<SyncQueueItem[]> {
    requireOwner(owner);
    return runTransaction(this.db, ["sync_queue"], "readonly", async (stores) => {
      const records = await requestToPromise<SyncQueueItem[]>(stores.sync_queue.index("owner").getAll(owner));
      return (records ?? [])
        .filter((item) => item.ownerUserId === owner)
        .sort((a, b) => a.localOrder - b.localOrder);
    });
  }

  async listPending(owner: Uuid): Promise<SyncQueueItem[]> {
    return this.listQueue(owner);
  }

  async updateQueueItem(owner: Uuid, item: SyncQueueItem): Promise<void> {
    requireOwner(owner);
    if (item.ownerUserId !== owner) throw new PartitionRequiredError();
    await runTransaction(this.db, ["sync_queue"], "readwrite", async (stores) => {
      await requestToPromise(stores.sync_queue.put(item));
    });
  }

  async markComplete(owner: Uuid, operationId: string): Promise<void> {
    requireOwner(owner);
    await runTransaction(this.db, ["sync_queue"], "readwrite", async (stores) => {
      const record = await requestToPromise<SyncQueueItem | undefined>(stores.sync_queue.get(operationId));
      if (record && record.ownerUserId === owner) await requestToPromise(stores.sync_queue.delete(operationId));
    });
  }

  /** Writes all records and their intents in one transaction (atomic capture). */
  async saveCapture(owner: Uuid, records: readonly LocalEntityRecord[], intents: readonly SyncQueueItem[]): Promise<void> {
    requireOwner(owner);
    for (const record of records) if (record.value.ownerUserId !== owner) throw new PartitionRequiredError();
    for (const intent of intents) if (intent.ownerUserId !== owner) throw new PartitionRequiredError();
    const storeNames = Array.from(new Set([...records.map((record) => record.store), "sync_queue"]));
    await runTransaction(this.db, storeNames, "readwrite", async (stores) => {
      for (const record of records) await requestToPromise(stores[record.store].put(record.value));
      for (const intent of intents) await requestToPromise(stores.sync_queue.put(intent));
    });
  }

  /**
   * Atomically removes an inspection, its findings and every related intent.
   * Used by the not-sent discard path so no entity/intent is left orphaned.
   */
  async removeCapture(owner: Uuid, inspectionId: string): Promise<void> {
    requireOwner(owner);
    await runTransaction(this.db, ["inspection_local", "finding_local", "sync_queue"], "readwrite", async (stores) => {
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
    await runTransaction(this.db, ["inspection_local", "sync_queue"], "readwrite", async (stores) => {
      await requestToPromise(stores.inspection_local.put(tombstone));
      await requestToPromise(stores.sync_queue.put(discardIntent));
    });
  }
}