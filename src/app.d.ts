/// <reference types="vite/client" />
// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Error {
			message: string;
		}
		interface Locals {
			/** Language of the server-rendered markup (`<html lang>`), when not Italian. */
			lang?: import('$lib/i18n').Locale;
		}
	}
}

export {};
