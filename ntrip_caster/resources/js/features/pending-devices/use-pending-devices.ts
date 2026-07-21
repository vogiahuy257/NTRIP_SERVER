import { useContext } from 'react';

import {
    PendingDeviceContext
    
} from './pending-device-context';
import type {PendingDeviceContextValue} from './pending-device-context';

export function usePendingDevices(): PendingDeviceContextValue {
    const context = useContext(PendingDeviceContext);

    if (context === undefined) {
        throw new Error(
            'usePendingDevices must be used inside PendingDeviceProvider.',
        );
    }

    return context;
}
