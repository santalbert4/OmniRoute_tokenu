import type { ExecutionEvent } from "@/tokenu/contracts/executionEvent";
import type { ExecutionEventConsumer } from "@/tokenu/runtime/executionEventConsumer";
import type { ExecutionEventSink } from "@/tokenu/runtime/executionEventSink";

/**
 * Fans one execution event out to independent consumers.
 *
 * Consumers for the same event are invoked together so one consumer
 * cannot prevent another from seeing that event. The returned promise
 * still rejects if any consumer fails, preserving the existing awaited
 * ExecutionEventSink contract.
 */
export class CompositeExecutionEventSink implements ExecutionEventSink {
  constructor(private readonly consumers: readonly ExecutionEventConsumer[]) {}

  async emit(event: ExecutionEvent): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.consume(event)));
  }
}
