import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";
import type { ExecutionEventSink } from "@/tokenu/runtime/executionEventSink";

export class InMemoryExecutionEventSink implements ExecutionEventSink {
  private readonly events: ExecutionEvent[] = [];

  async emit(event: ExecutionEvent): Promise<void> {
    this.events.push(event);
  }

  getEvents(): readonly ExecutionEvent[] {
    return this.events;
  }
}
