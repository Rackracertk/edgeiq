// Explicit free-beta rollout. Paid mode requires a deliberate code/config change.
export const FREE_BETA = true
export function researchAllowed(isSubscriber:boolean){return FREE_BETA || isSubscriber}
export function checkoutAllowed(){return !FREE_BETA}
