export type RoverAccountStatus = 'active' | 'disabled' | 'expired';

export type RoverAccountStation = {
    id: number;
    deviceId: string;
    name: string;
    sourceConnected: boolean;
};

export type RoverAccountMountpointAccess = {
    enabled: boolean;
    maxConnections: number | null;
    startsAt: string | null;
    expiresAt: string | null;
    createdBy: number | null;
};

export type RoverAccountMountpoint = {
    id: number;
    stationId: number;
    name: string;
    identifier: string | null;
    format: string | null;
    navSystem: string | null;
    enabled: boolean;
    accessMode: string;
    isPrimary: boolean;
    station: RoverAccountStation | null;
    access: RoverAccountMountpointAccess | null;
};

export type RoverAccount = {
    id: number;
    username: string;
    displayName: string | null;
    enabled: boolean;
    status: RoverAccountStatus;
    maxConnections: number;
    expiresAt: string | null;
    lastAuthenticatedAt: string | null;
    notes: string | null;
    mountpointCount: number;
    activeSessionCount: number;
    mountpoints: RoverAccountMountpoint[];
    createdAt: string | null;
    updatedAt: string | null;
};

export type RoverAccountCreateInput = {
    username: string;
    displayName: string | null;
    password: string;
    passwordConfirmation: string;
    enabled: boolean;
    maxConnections: number;
    expiresAt: string | null;
    notes: string | null;
};

export type RoverAccountUpdateInput = {
    username?: string;
    displayName?: string | null;
    password?: string;
    passwordConfirmation?: string;
    enabled?: boolean;
    maxConnections?: number;
    expiresAt?: string | null;
    notes?: string | null;
};

export type RoverAccountMountpointGrantInput = {
    id: number;
    enabled: boolean;
    maxConnections: number | null;
    startsAt: string | null;
    expiresAt: string | null;
};

export type RoverAccountFieldErrors = Record<string, string[]>;
