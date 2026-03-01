// ---------------------------------------------------------------------------
// EventBus — shared event emitter for cross-concern communication.
// Why a custom one instead of Phaser.Events? Because model code must not
// import Phaser, yet it needs to emit events that views consume.
// ---------------------------------------------------------------------------

// biome-ignore lint/complexity/noBannedTypes: EventBus is a loose coupling mechanism — listeners have varied signatures.
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
        for (const fn of this.listeners.get(event) ?? []) {
            (fn as (...a: unknown[]) => void)(...args);
        }
    }

    removeAll(): void {
        this.listeners.clear();
    }
}

/** Singleton shared across the entire game */
export const eventBus = new EventBus();
