import { useEffect, useRef, useState } from 'react';

import type { NtripRealtimeConnectionState } from './ntrip-realtime-types';

type UseRealtimeResyncOptions = {
    connectionState: NtripRealtimeConnectionState;
    refresh: () => Promise<boolean>;
};

type UseRealtimeResyncResult = {
    isRealtimeResyncing: boolean;
    lastRealtimeResyncedAt: Date | null;
};

function requiresResync(
    connectionState: NtripRealtimeConnectionState,
): boolean {
    return (
        connectionState === 'reconnecting' ||
        connectionState === 'disconnected' ||
        connectionState === 'failed'
    );
}

export function useRealtimeResync({
    connectionState,
    refresh,
}: UseRealtimeResyncOptions): UseRealtimeResyncResult {
    const [isRealtimeResyncing, setIsRealtimeResyncing] = useState(false);

    const [lastRealtimeResyncedAt, setLastRealtimeResyncedAt] =
        useState<Date | null>(null);

    /*
     * Kết nối đầu tiên không được xem là reconnect.
     *
     * Snapshot ban đầu đã được tải bởi
     * useDashboardData(), nên không gọi API lần hai.
     */
    const hasConnectedOnceRef = useRef(false);

    /*
     * Được bật khi WebSocket từng mất kết nối
     * sau lần connected đầu tiên.
     */
    const shouldResyncRef = useRef(false);

    /*
     * Giữ hàm refresh mới nhất mà không làm effect
     * reconnect chạy lại chỉ vì callback đổi reference.
     */
    const refreshRef = useRef(refresh);

    /*
     * Vô hiệu hóa kết quả của một lần resync cũ
     * khi trạng thái kết nối tiếp tục thay đổi.
     */
    const generationRef = useRef(0);

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);

    useEffect(() => {
        if (connectionState !== 'connected') {
            if (
                hasConnectedOnceRef.current &&
                requiresResync(connectionState)
            ) {
                shouldResyncRef.current = true;
            }

            /*
             * Vô hiệu hóa request resync đang chạy
             * nếu kết nối lại tiếp tục bị ngắt.
             */
            generationRef.current += 1;
            setIsRealtimeResyncing(false);

            return;
        }

        /*
         * Lần connected đầu tiên:
         * không gọi lại Snapshot API.
         */
        if (!hasConnectedOnceRef.current) {
            hasConnectedOnceRef.current = true;
            return;
        }

        /*
         * Component render lại khi vẫn connected
         * không được tạo thêm request.
         */
        if (!shouldResyncRef.current) {
            return;
        }

        shouldResyncRef.current = false;

        const generation = generationRef.current + 1;

        generationRef.current = generation;

        setIsRealtimeResyncing(true);

        void refreshRef
            .current()
            .then((succeeded) => {
                if (generationRef.current !== generation) {
                    return;
                }

                if (succeeded) {
                    setLastRealtimeResyncedAt(new Date());
                }
            })
            .finally(() => {
                if (generationRef.current !== generation) {
                    return;
                }

                setIsRealtimeResyncing(false);
            });
    }, [connectionState]);

    useEffect(
        () => () => {
            /*
             * Ngăn Promise đang chạy cập nhật state
             * sau khi component unmount.
             */
            generationRef.current += 1;
        },
        [],
    );

    return {
        isRealtimeResyncing,
        lastRealtimeResyncedAt,
    };
}
