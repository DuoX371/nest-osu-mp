export function isEmpty<T>(payload: T): payload is Extract<T, null | undefined | '' | [] | Record<string, never>> {
    if (payload === undefined || payload === null) {
        return true;
    }

    if (typeof payload === 'string') {
        return payload === '';
    }

    if (Array.isArray(payload)) {
        return payload.length === 0;
    }

    if (typeof payload === 'object' && !(payload instanceof Date)) {
        return Object.keys(payload).length === 0;
    }

    return false;
}
