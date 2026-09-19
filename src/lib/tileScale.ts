export type TableScale = {
	scale: number;
	boardLong: number;
	boardShort: number;
	handLong: number;
	handShort: number;
	miniLong: number;
	miniShort: number;
	landscape: boolean;
};

export const BASE_BOARD_LONG = 56;
export const BASE_BOARD_SHORT = 28;
export const BASE_HAND_SHORT = 34;
export const BASE_HAND_LONG = 68;
export const BASE_MINI_SHORT = 12;
export const BASE_MINI_LONG = 24;

export const DEFAULT_TABLE_SCALE: TableScale = {
	scale: 1,
	boardLong: BASE_BOARD_LONG,
	boardShort: BASE_BOARD_SHORT,
	handLong: BASE_HAND_LONG,
	handShort: BASE_HAND_SHORT,
	miniLong: BASE_MINI_LONG,
	miniShort: BASE_MINI_SHORT,
	landscape: false,
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function span(base: number, scale: number, min: number) {
	return Math.max(min, Math.round(base * scale));
}

export function readViewportSize() {
	if (typeof window === 'undefined') {
		return { width: 390, height: 844 };
	}

	const view = window.visualViewport;

	return {
		width: Math.round(view?.width ?? window.innerWidth),
		height: Math.round(view?.height ?? window.innerHeight),
	};
}

export function tableScaleFromViewport(
	width: number,
	height: number,
): TableScale {
	const landscape = width > height;
	const usableW = width - (landscape ? 88 : 28);
	const usableH = height - (landscape ? 108 : 176);

	const handBudget = usableW - 56;
	const handScale = handBudget / (7 * BASE_HAND_SHORT + 24);
	const mesaW = usableW - (landscape ? 52 : 76);
	const mesaH = Math.max(72, usableH);
	const boardWScale = mesaW / (BASE_BOARD_LONG * 4.4);
	const boardHScale = mesaH / (BASE_BOARD_LONG * (landscape ? 2.8 : 2.2));
	const widthScale = (width - 24) / (landscape ? 760 : 420);
	const heightScale = (height - 20) / (landscape ? 430 : 760);

	const scale = clamp(
		Math.min(1, handScale, boardWScale, boardHScale, widthScale, heightScale),
		landscape ? 0.56 : 0.64,
		1,
	);

	return {
		scale,
		boardLong: span(BASE_BOARD_LONG, scale, 28),
		boardShort: span(BASE_BOARD_SHORT, scale, 14),
		handLong: span(BASE_HAND_LONG, scale, 36),
		handShort: span(BASE_HAND_SHORT, scale, 18),
		miniLong: span(BASE_MINI_LONG, scale, 14),
		miniShort: span(BASE_MINI_SHORT, scale, 7),
		landscape,
	};
}
