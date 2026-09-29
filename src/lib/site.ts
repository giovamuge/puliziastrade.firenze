/**
 * Site-wide facts shown in the disclaimer, privacy and contact sections.
 * Official channels were checked on 2026-09-24 on the Comune di Firenze
 * websites: re-verify them periodically.
 */
export const OFFICIAL_CHANNELS = {
	verifiedAt: "2026-09-24",
	alia: {
		name: "Alia Servizi Ambientali",
		phoneLandline: "800 888 333",
		phoneMobile: "199 105 105",
		hours: "lun–ven 8:30–19:30, sab 8:30–14:30",
		url: "https://servizi.comune.fi.it/servizi/scheda-servizio/alia-servizi-ambientali-richiesta-informazioni-e-segnalazioni",
	},
	comune: {
		name: "Comune di Firenze · Contact center",
		phone: "055 055",
		url: "https://www.055055.it/comune/all/segnalazione",
		infoUrl:
			"https://www.comune.firenze.it/punto-di-contatto/contact-center-055055",
	},
} as const;

/** Date of the latest revision of the privacy & cookie notice. */
export const PRIVACY_UPDATED_AT = "2026-09-28";
