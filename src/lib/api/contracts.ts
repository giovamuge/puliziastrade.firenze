/**
 * Typed API contracts shared by server endpoints and the client. Times are
 * Europe/Rome wall-clock: dates as `YYYY-MM-DD`, times as minutes from
 * midnight. Relative wording ("oggi", "tra 3 giorni") is computed on the
 * client from its own clock, so CDN-cached responses never go stale in tone.
 */
import type { SourceMetadata } from '$lib/domain/snapshot';
import type { Messages } from '$lib/i18n/it';

export interface CleaningWindowDto {
	date: string;
	/** Minutes from midnight. */
	from: number;
	to: number;
	/** Effective end (source windows like 13:30–13:30 get +30 min). */
	end: number;
}

/** Rules sharing weekday and window (e.g. 1st and 3rd Tuesday). `kinds` are `WeekKind` values. */
export interface RuleDto {
	weekday: number;
	kinds: number[];
	from: number;
	to: number;
}

export interface StreetSummaryDto {
	slug: string;
	name: string;
	type: string;
	segmentCount: number;
	/** Disconnected pieces of road sharing this name. */
	sectionCount: number;
	/** Contiguous runs with distinct schedules. */
	groupCount: number;
	next: CleaningWindowDto | null;
}

export interface SearchResponse {
	query: string;
	results: StreetSummaryDto[];
}

export interface NearbyItemDto extends StreetSummaryDto {
	distanceMeters: number;
	/** Nearest segment (`cod_arco`) and its own next window. */
	segment: string;
	segmentNext: CleaningWindowDto | null;
	/** Cross streets delimiting the nearest segment's schedule group. */
	segmentBetween: string[];
}

export interface NearbyResponse {
	radiusMeters: number;
	items: NearbyItemDto[];
}

export interface OccurrenceDto extends CleaningWindowDto {
	/** Segments swept in this window. */
	segments: string[];
	/** Schedule groups swept in this window. */
	groups: number[];
	wholeStreet: boolean;
}

/** A connected piece of the street, labelled by the streets at its ends. */
export interface StreetPartDto {
	index: number;
	segments: string[];
	lengthMeters: number;
	bbox: [number, number, number, number];
	between: string[];
}

export interface ScheduleGroupDto extends StreetPartDto {
	section: number;
	rules: RuleDto[];
	next: CleaningWindowDto | null;
}

export interface SegmentDto {
	code: string;
	featureIds: string[];
	group: number;
	section: number;
}

export interface StreetDetailDto extends StreetSummaryDto {
	rawName: string;
	/** All rules of the street (union of groups). */
	rules: RuleDto[];
	sections: StreetPartDto[];
	groups: ScheduleGroupDto[];
	segments: SegmentDto[];
	upcoming: OccurrenceDto[];
	/** Sweeps of the last 3 days that already ended, most recent first. */
	recent: OccurrenceDto[];
	/** `[west, south, east, north]` */
	bbox: [number, number, number, number];
	dataVersion: string;
	/** When the source file was last modified (ISO), for the disclaimer. */
	dataUpdatedAt: string | null;
}

/**
 * Compact map layer. Relations use CSR offsets; coordinates are integer
 * (×1e5) and delta-encoded per segment to keep the payload small.
 */
export interface MapLayerDto {
	version: string;
	streetSlugs: string[];
	streetNames: string[];
	rules: number[];
	arcCodes: string[];
	arcStreet: number[];
	arcRuleOffsets: number[];
	arcRules: number[];
	arcPointOffsets: number[];
	coords: number[];
}
export const MAP_COORD_SCALE = 1e5;

export interface MetaDto {
	version: string;
	refreshedAt: string;
	source: SourceMetadata;
	counts: { streets: number; segments: number; features: number; rules: number; issues: number };
	/** Segment-sweeps per weekday (Mon..Sun) × band (night, morning, afternoon), averaged per month. */
	weekdayBand: number[][];
	reviewsEnabled: boolean;
}

export const REVIEW_OUTCOMES = ['clean', 'partial', 'dirty', 'skipped'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export interface ReviewDto {
	id: string;
	street: string;
	segment: string | null;
	date: string;
	outcome: ReviewOutcome;
	rating: number | null;
	note: string | null;
	/** Time window read on the street sign, when it differs from the open data. */
	signWindow: { from: number; to: number } | null;
	createdAt: string;
}

export interface ReviewAggregateDto {
	count: number;
	outcomes: Record<ReviewOutcome, number>;
	ratingAverage: number | null;
	lastDate: string | null;
	/** Reports saying the street sign shows a different time than the data. */
	signMismatch: number;
}

export interface StreetReviewsResponse {
	enabled: boolean;
	aggregate: ReviewAggregateDto;
	reviews: ReviewDto[];
	/** Dates (last 3 days) for which a verification can be submitted now. */
	verifiableDates: string[];
}

export interface ReviewSummaryResponse {
	enabled: boolean;
	streets: Record<string, ReviewAggregateDto>;
}

export type ApiErrorCode = keyof Messages['errors'];

export interface ApiErrorDto {
	code: ApiErrorCode;
	/** Italian fallback text; clients translate from `code`. */
	message: string;
}

/** Reminder timing for calendar feeds. */
export const ALARM_OPTIONS = ['auto', 'evening', '120', '60', 'none'] as const;
export type AlarmOption = (typeof ALARM_OPTIONS)[number];
