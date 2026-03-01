// ---------------------------------------------------------------------------
// EventBus — shared event emitter for cross-concern communication.
// Why a custom one instead of Phaser.Events? Because model code must not
// import Phaser, yet it needs to emit events that views consume.
// ---------------------------------------------------------------------------

// We use Function here deliberately — event listeners have varied signatures
// and the EventBus is a loose coupling mechanism, not a typed contract.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Listener = Function;

export class EventBus {
    private listeners = new Map<string, Set<Listener>>();

    on(event: string, fn: Listener): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(fn);
    }

    off(event: string, fn: Listener): void {
        this.listeners.get(event)?.delete(fn);
    }

    emit(event: string, ...args: unknown[]): void {
        this.listeners.get(event)?.forEach((fn) => (fn as (...a: unknown[]) => void)(...args));
    }

    removeAll(): void {
        this.listeners.clear();
    }
}

/** Singleton shared across the entire game */
export const eventBus = new EventBus();
