import { Lock, Locker, RequestRelease } from "@tus/utils";

/**
 * MemoryLocker is a simple in-process locker for local development
 * where Upstash Redis is not configured. It uses a plain Set to track
 * locked upload IDs. It is NOT safe for multi-instance production deployments
 * — use RedisLocker there.
 */
export class MemoryLocker implements Locker {
  private locks = new Set<string>();

  newLock(id: string): Lock {
    return new MemoryLock(id, this.locks);
  }
}

class MemoryLock implements Lock {
  constructor(
    private id: string,
    private locks: Set<string>,
  ) {}

  async lock(_signal: AbortSignal, _requestRelease: RequestRelease): Promise<void> {
    // Spin until the lock is free or the signal aborts (simple busy-wait for dev).
    while (this.locks.has(this.id)) {
      if (_signal.aborted) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    this.locks.add(this.id);
  }

  async unlock(): Promise<void> {
    this.locks.delete(this.id);
  }
}
