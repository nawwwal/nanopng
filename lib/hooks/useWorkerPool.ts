import { useEffect, useRef, useState, useCallback } from 'react';
import * as Comlink from 'comlink';
import type { ProcessorAPI } from '@/lib/workers/processor.worker';

const MAX_WORKERS = navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 2;

interface WorkerInstance {
    worker: Worker;
    api: Comlink.Remote<ProcessorAPI>;
    busy: boolean;
}

export function useWorkerPool() {
    const [workers, setWorkers] = useState<WorkerInstance[]>([]);

    useEffect(() => {
        const pool: WorkerInstance[] = [];

        for (let i = 0; i < MAX_WORKERS; i++) {
            const worker = new Worker(new URL('../workers/processor.worker.ts', import.meta.url), {
                type: 'module'
            });
            const api = Comlink.wrap<ProcessorAPI>(worker);
            pool.push({ worker, api, busy: false });
        }

        setWorkers(pool);

        return () => {
            pool.forEach(w => w.worker.terminate());
        };
    }, []);

    const execute = useCallback(async <T>(task: (api: Comlink.Remote<ProcessorAPI>) => Promise<T>): Promise<T> => {
        let available = workers.find(w => !w.busy);

        if (!available) {
            available = workers[Math.floor(Math.random() * workers.length)];
        }

        if (!available) throw new Error("No workers available");

        available.busy = true;
        try {
            return await task(available.api);
        } finally {
            available.busy = false;
        }
    }, [workers]);

    return { execute, workerCount: workers.length };
}
