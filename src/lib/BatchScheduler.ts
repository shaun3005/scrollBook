import type { SentenceId, SentenceStats } from '../types/model';

type BatchConfig = {
    batchSize: number;
    debounceMs: number;
};

export class BatchScheduler {
    private queue: Set<SentenceId> = new Set();
    private pending: Set<SentenceId> = new Set(); // IDs currently in network flight
    private timer: ReturnType<typeof setTimeout> | null = null;
    private subscribers: Map<SentenceId, Set<(stats: SentenceStats) => void>> = new Map();
    private config: BatchConfig;
    private fetcher: (ids: SentenceId[]) => Promise<Record<SentenceId, SentenceStats>>;

    private static readonly MAX_RETRIES = 3;
    private static readonly BASE_DELAY_MS = 500;

    constructor(
        config: BatchConfig,
        fetcher: (ids: SentenceId[]) => Promise<Record<SentenceId, SentenceStats>>
    ) {
        this.config = config;
        this.fetcher = fetcher;
    }

    public schedule(id: SentenceId, callback?: (stats: SentenceStats) => void) {

        if (this.pending.has(id) || this.queue.has(id)) {
            this.addSubscriber(id, callback);
            return;
        }

        this.queue.add(id);
        this.addSubscriber(id, callback);

        if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.config.debounceMs);
        }
    }

    private addSubscriber(id: SentenceId, callback?: (stats: SentenceStats) => void) {
        if (callback) {
            if (!this.subscribers.has(id)) {
                this.subscribers.set(id, new Set());
            }
            this.subscribers.get(id)!.add(callback);
        }
    }

    private async flush() {
        this.timer = null;
        const ids = Array.from(this.queue);
        this.queue.clear();

        if (ids.length === 0) return;


        ids.forEach(id => this.pending.add(id));


        for (let i = 0; i < ids.length; i += this.config.batchSize) {
            const batch = ids.slice(i, i + this.config.batchSize);
            await this.processBatch(batch);
        }
    }

    private async processBatch(ids: SentenceId[]) {
        let attempt = 0;

        while (attempt < BatchScheduler.MAX_RETRIES) {
            try {
                const results = await this.fetcher(ids);
                Object.entries(results).forEach(([id, stats]) => {
                    this.notify(id, stats);
                });
                // Success — release pending and return early
                ids.forEach(id => this.pending.delete(id));
                return;
            } catch (e) {
                attempt++;
                if (attempt >= BatchScheduler.MAX_RETRIES) {
                    // All retries exhausted — log and give up gracefully
                    console.error(`[BatchScheduler] Batch fetch failed after ${BatchScheduler.MAX_RETRIES} attempts. IDs: [${ids.join(', ')}]`, e);
                } else {
                    // Exponential backoff: 500ms → 1000ms → 2000ms
                    const delay = BatchScheduler.BASE_DELAY_MS * Math.pow(2, attempt - 1);
                    console.warn(`[BatchScheduler] Attempt ${attempt}/${BatchScheduler.MAX_RETRIES} failed. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Release pending IDs regardless of outcome to unblock future schedule() calls
        ids.forEach(id => this.pending.delete(id));
    }

    private notify(id: SentenceId, stats: SentenceStats) {
        const subs = this.subscribers.get(id);
        if (subs) {
            subs.forEach(cb => cb(stats));
            this.subscribers.delete(id);
        }
    }

    public destroy() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.queue.clear();
        this.pending.clear();
        this.subscribers.clear();
    }
}
