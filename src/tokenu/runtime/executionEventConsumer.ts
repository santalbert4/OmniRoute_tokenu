import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";

export interface ExecutionEventConsumer {
  consume(event: ExecutionEvent): Promise<void>;
}
