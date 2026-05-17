export function installAbortSignalTimeoutReasonListener(): void {
	const originalAbortSignalTimeout = AbortSignal.timeout.bind(AbortSignal);

	AbortSignal.timeout = ((delay: number) => {
		const signal = originalAbortSignalTimeout(delay);
		signal.addEventListener("abort", () => {
			void signal.reason;
		}, { once: true });
		return signal;
	}) as typeof AbortSignal.timeout;
}
