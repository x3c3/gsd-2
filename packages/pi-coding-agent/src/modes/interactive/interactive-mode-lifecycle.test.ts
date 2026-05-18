// GSD-2 + packages/pi-coding-agent/src/modes/interactive/interactive-mode-lifecycle.test.ts - InteractiveMode lifecycle regression coverage.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InteractiveMode } from "./interactive-mode.js";
import { initTheme } from "./theme/theme.js";

initTheme("dark", false);

type RuntimeInteractiveMode = {
	[key: string]: unknown;
	stop(): void;
	_themeChangeUnsub?: () => void;
};

describe("InteractiveMode lifecycle", () => {
	it("calls and clears the theme-change unsubscriber on stop", () => {
		const mode = Object.create(InteractiveMode.prototype) as RuntimeInteractiveMode;
		let unsubscribeCount = 0;

		mode.loadingAnimation = undefined;
		mode.extensionTerminalInputUnsubscribers = new Set();
		mode.clearExtensionTerminalInputListeners = () => {};
		mode._branchChangeUnsub = undefined;
		mode._themeChangeUnsub = () => {
			unsubscribeCount++;
		};
		mode.onInputCallback = undefined;
		mode.clearExtensionWidgets = () => {};
		mode.customFooter = undefined;
		mode.customHeader = undefined;
		mode.footer = { dispose() {} };
		mode.footerDataProvider = { dispose() {} };
		mode.unsubscribe = undefined;
		mode.isInitialized = false;

		mode.stop();

		assert.equal(unsubscribeCount, 1);
		assert.equal(mode._themeChangeUnsub, undefined);
	});
});
