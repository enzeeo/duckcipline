export const START_TIMER_MESSAGE_TYPE = "startTimer";
export const STOP_TIMER_MESSAGE_TYPE = "stopTimer";
export const GET_TIMER_STATE_MESSAGE_TYPE = "getTimerState";
function isObjectRecord(value) {
    return typeof value === "object" && value !== null;
}
function isTimerErrorResponse(value) {
    if (!isObjectRecord(value)) {
        return false;
    }
    return typeof value.error === "string";
}
function isTimerStatusResponse(value) {
    if (!isObjectRecord(value)) {
        return false;
    }
    return typeof value.isRunning === "boolean" && typeof value.remainingSeconds === "number";
}
export function isTimerMessageResponse(value) {
    return isTimerErrorResponse(value) || isTimerStatusResponse(value);
}
export function isTimerRequestMessage(value) {
    if (!isObjectRecord(value) || typeof value.type !== "string") {
        return false;
    }
    if (value.type === START_TIMER_MESSAGE_TYPE) {
        return typeof value.durationSeconds === "number";
    }
    if (value.type === STOP_TIMER_MESSAGE_TYPE) {
        return true;
    }
    if (value.type === GET_TIMER_STATE_MESSAGE_TYPE) {
        return true;
    }
    return false;
}
