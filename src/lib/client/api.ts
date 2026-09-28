import type {
	AlarmOption,
	ApiErrorCode,
	CalendarMode,
	ApiErrorDto,
	MapLayerDto,
	MetaDto,
	NearbyResponse,
	ReviewDto,
	ReviewOutcome,
	ReviewSummaryResponse,
	SearchResponse,
	StreetDetailDto,
	StreetReviewsResponse
} from '$lib/api/contracts';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: ApiErrorCode
	) {
		super(code);
		this.name = 'ApiError';
	}
}

/** Error code for anything thrown by the API layer. */
export function errorCode(error: unknown): ApiErrorCode {
	return error instanceof ApiError ? error.code : 'generic';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await fetch(path, init);
	} catch (error) {
		if ((error as Error).name === 'AbortError') throw error;
		throw new ApiError(0, 'network');
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiErrorDto | null;
		throw new ApiError(response.status, body?.code ?? 'generic');
	}
	return (await response.json()) as T;
}

export interface ReviewSubmission {
	street: string;
	segment: string | null;
	date: string;
	outcome: ReviewOutcome;
	rating: number | null;
	note: string | null;
	signFrom: number | null;
	signTo: number | null;
	website: string;
}

/** Typed facade over the HTTP API: the only module that knows endpoint paths. */
export const api = {
	search: (q: string, signal?: AbortSignal) =>
		request<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}&limit=8`, { signal }),
	nearby: (lat: number, lon: number, signal?: AbortSignal) =>
		request<NearbyResponse>('/api/nearby', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) }),
			signal
		}),
	street: (slug: string, signal?: AbortSignal) =>
		request<StreetDetailDto>(`/api/streets/${encodeURIComponent(slug)}`, { signal }),
	mapLayer: () => request<MapLayerDto>('/api/map'),
	meta: () => request<MetaDto>('/api/meta'),
	reviews: (slug: string, signal?: AbortSignal) =>
		request<StreetReviewsResponse>(`/api/reviews?strada=${encodeURIComponent(slug)}`, { signal }),
	reviewSummary: () => request<ReviewSummaryResponse>('/api/reviews/summary'),
	submitReview: (body: ReviewSubmission) =>
		request<{ review: ReviewDto | null }>('/api/reviews', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
	calendarPath: (slug: string, options: { segment?: string | null; alarm: AlarmOption; lang: string; mode?: CalendarMode }) => {
		const params = new URLSearchParams({ avviso: options.alarm, lang: options.lang });
		if (options.segment) params.set('tratto', options.segment);
		if (options.mode && options.mode !== 'feed') params.set('modo', options.mode);
		return `/api/calendar/${encodeURIComponent(slug)}.ics?${params}`;
	}
};
