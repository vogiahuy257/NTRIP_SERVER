import type {
    DashboardRoverSession,
    DashboardSession,
} from '@/types/ntrip-dashboard';

export type DashboardRoverWithMapPosition = DashboardRoverSession & {
    roverLatitude: number;
    roverLongitude: number;
    roverPositionReceivedAt: string;
};

export function isDashboardRoverSession(
    session: DashboardSession,
): session is DashboardRoverSession {
    return session.connectionType === 'rover';
}

export function selectDashboardRovers(
    sessions: DashboardSession[],
): DashboardRoverSession[] {
    return sessions.filter(isDashboardRoverSession);
}

/**
 * Rover đã gửi ít nhất một câu GGA.
 *
 * Dùng cho giao diện:
 * - false: các giá trị GNSS hiển thị "-"
 * - true: hiển thị dữ liệu backend đã cung cấp
 */
export function hasRoverGgaData(rover: DashboardRoverSession): boolean {
    return rover.roverGgaReceivedAt !== null;
}

/**
 * Chỉ Rover có tọa độ GGA hợp lệ mới được đưa lên bản đồ.
 */
export function hasRoverMapPosition(
    rover: DashboardRoverSession,
): rover is DashboardRoverWithMapPosition {
    return (
        rover.roverPositionReceivedAt !== null &&
        rover.roverLatitude !== null &&
        rover.roverLongitude !== null &&
        Number.isFinite(rover.roverLatitude) &&
        Number.isFinite(rover.roverLongitude) &&
        rover.roverLatitude >= -90 &&
        rover.roverLatitude <= 90 &&
        rover.roverLongitude >= -180 &&
        rover.roverLongitude <= 180
    );
}

export function getDashboardRoverName(rover: DashboardRoverSession): string {
    return (
        rover.roverAccount?.displayName ??
        rover.roverAccount?.username ??
        rover.authenticatedUsername ??
        `Rover session ${String(rover.id)}`
    );
}
