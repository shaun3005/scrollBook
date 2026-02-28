import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchScheduler } from './BatchScheduler';
import type { SentenceStats } from '../types/model';

describe('BatchScheduler', () => {
    type Fetcher = (ids: string[]) => Promise<Record<string, SentenceStats>>;
    let fetcher: ReturnType<typeof vi.fn<Fetcher>>;

    const makeStats = (id: string): SentenceStats => ({
        sentenceId: id,
        likesCount: 10,
        commentsCount: 2,
        likedByMe: false,
    });

    beforeEach(() => {
        vi.useFakeTimers();
        fetcher = vi.fn<Fetcher>();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('debounces schedule calls and flushes after debounceMs', async () => {
        fetcher.mockResolvedValue({ s1: makeStats('s1'), s2: makeStats('s2') });
        const scheduler = new BatchScheduler({ batchSize: 10, debounceMs: 100 }, fetcher);

        scheduler.schedule('s1');
        scheduler.schedule('s2');

        expect(fetcher).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(100);

        expect(fetcher).toHaveBeenCalledOnce();
        expect(fetcher).toHaveBeenCalledWith(['s1', 's2']);
        scheduler.destroy();
    });

    it('splits IDs into batches according to batchSize', async () => {
        fetcher.mockResolvedValue({});
        const scheduler = new BatchScheduler({ batchSize: 2, debounceMs: 50 }, fetcher);

        scheduler.schedule('a');
        scheduler.schedule('b');
        scheduler.schedule('c');
        scheduler.schedule('d');
        scheduler.schedule('e');

        await vi.advanceTimersByTimeAsync(50);

        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(fetcher).toHaveBeenNthCalledWith(1, ['a', 'b']);
        expect(fetcher).toHaveBeenNthCalledWith(2, ['c', 'd']);
        expect(fetcher).toHaveBeenNthCalledWith(3, ['e']);
        scheduler.destroy();
    });

    it('invokes subscriber callback with correct stats on success', async () => {
        const stats = makeStats('s1');
        fetcher.mockResolvedValue({ s1: stats });
        const scheduler = new BatchScheduler({ batchSize: 10, debounceMs: 50 }, fetcher);
        const callback = vi.fn();

        scheduler.schedule('s1', callback);

        await vi.advanceTimersByTimeAsync(50);

        expect(callback).toHaveBeenCalledWith(stats);
        scheduler.destroy();
    });

    it('cleans up subscribers after notify (C4 fix)', async () => {
        const stats = makeStats('s1');
        fetcher.mockResolvedValue({ s1: stats });
        const scheduler = new BatchScheduler({ batchSize: 10, debounceMs: 50 }, fetcher);
        const cb = vi.fn();

        scheduler.schedule('s1', cb);
        await vi.advanceTimersByTimeAsync(50);

        // Schedule again — should create new subscriber, not accumulate
        const cb2 = vi.fn();
        scheduler.schedule('s1', cb2);
        await vi.advanceTimersByTimeAsync(50);

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb2).toHaveBeenCalledTimes(1);
        scheduler.destroy();
    });

    it('retries on failure and succeeds on second attempt', async () => {
        const stats = makeStats('s1');
        fetcher
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce({ s1: stats });

        const scheduler = new BatchScheduler({ batchSize: 10, debounceMs: 50 }, fetcher);
        const cb = vi.fn();

        scheduler.schedule('s1', cb);
        await vi.advanceTimersByTimeAsync(50);

        // First attempt fails, backoff 500ms
        await vi.advanceTimersByTimeAsync(500);

        expect(cb).toHaveBeenCalledWith(stats);
        expect(fetcher).toHaveBeenCalledTimes(2);
        scheduler.destroy();
    });

    it('gives up after MAX_RETRIES (3) failures', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        fetcher
            .mockRejectedValueOnce(new Error('fail1'))
            .mockRejectedValueOnce(new Error('fail2'))
            .mockRejectedValueOnce(new Error('fail3'));

        const scheduler = new BatchScheduler({ batchSize: 10, debounceMs: 50 }, fetcher);

        scheduler.schedule('s1');
        await vi.advanceTimersByTimeAsync(50);

        // backoff: 500ms after 1st fail
        await vi.advanceTimersByTimeAsync(500);
        // backoff: 1000ms after 2nd fail
        await vi.advanceTimersByTimeAsync(1000);

        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('failed after 3 attempts'),
            expect.any(Error)
        );

        // Should be able to re-schedule after final failure (pending cleared)
        fetcher.mockResolvedValue({ s1: makeStats('s1') });
        const cb = vi.fn();
        scheduler.schedule('s1', cb);
        await vi.advanceTimersByTimeAsync(50);
        expect(cb).toHaveBeenCalled();

        consoleSpy.mockRestore();
        scheduler.destroy();
    });

    it('destroy() clears all internal state and timers', () => {
        const scheduler = new BatchScheduler({ batchSize: 10, debounceMs: 100 }, fetcher);

        scheduler.schedule('s1');
        scheduler.schedule('s2');
        scheduler.destroy();

        // After destroy, advancing timers should not trigger fetcher
        vi.advanceTimersByTime(200);
        expect(fetcher).not.toHaveBeenCalled();
    });
});
