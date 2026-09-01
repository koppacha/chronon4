export type ReadTriggerState = {
    available: boolean;
    read: boolean;
    visible: boolean;
    scrolled: boolean;
    sending: boolean;
    automaticBlocked: boolean;
};

export function shouldTriggerRead(state: ReadTriggerState): boolean {
    return state.available
        && !state.read
        && state.visible
        && state.scrolled
        && !state.sending
        && !state.automaticBlocked;
}
