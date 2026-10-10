import type { ApiClient } from "../../../lib/api/client.ts";
import type { CoordinationAcknowledgement, CoordinationRequest } from "../coordination.ts";

/** No queue or local writes: recheck connectivity and identity immediately before POST. */
export async function submitCoordination(
  client: ApiClient, id: string, request: CoordinationRequest, operationId: string,
  context: { owner: string; isOnline: () => boolean; isCurrent: () => boolean },
): Promise<CoordinationAcknowledgement> {
  const check = () => {
    if (!context.isCurrent()) throw new Error("La sesión cambió. Vuelve a iniciar sesión.");
    if (!context.isOnline()) throw new Error("Necesitas conexión para revisar, archivar o eliminar. Esta acción no se guarda en la cola.");
  };
  check();
  const session = await client.get<{ user: { id: string; role: string } }>("/api/session");
  check();
  if (session.user.id !== context.owner || session.user.role !== "coordinator") throw new Error("Sesión de coordinación no disponible.");
  return client.post(`/api/inspections/${id}/coordination`, request, { operationId });
}
