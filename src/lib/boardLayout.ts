import { BoardTile, Tile } from '@/lib/dominoes';
import {
	BASE_BOARD_LONG,
	BASE_BOARD_SHORT,
} from '@/lib/tileScale';

export type Heading = 'E' | 'W' | 'S' | 'N';
export type Arm = 'left' | 'right';

export type PlacedBoardTile = {
	key: string;
	tile: Tile;
	x: number;
	y: number;
	heading: Heading;
	faceA: number;
	faceB: number;
};

export const BOARD_TILE_LONG = BASE_BOARD_LONG;
export const BOARD_TILE_SHORT = BASE_BOARD_SHORT;
const DROP_COUNT = 2;

export type TileSpan = {
	long: number;
	short: number;
};

const DEFAULT_SPAN: TileSpan = {
	long: BOARD_TILE_LONG,
	short: BOARD_TILE_SHORT,
};

export function tileBox(
	isDouble: boolean,
	heading: Heading,
	span: TileSpan = DEFAULT_SPAN,
) {
	const vertical = isDouble || heading === 'S' || heading === 'N';

	return {
		w: vertical ? span.short : span.long,
		h: vertical ? span.long : span.short,
	};
}

function laneY(
	cy: number,
	isDouble: boolean,
	heading: Heading,
	span: TileSpan,
) {
	if ((heading === 'E' || heading === 'W') && isDouble) {
		return cy - (span.long - span.short) / 2;
	}

	return cy;
}

/*
 * Brazo derecho: se recorre el board hacia adelante,
 * la cara que llega es tile.a.
 * Brazo izquierdo: se recorre al revés, la cara que
 * llega es tile.b.
 *
 * Así un 6-5 nunca se pinta como 5-6.
 */
function faces(tile: Tile, heading: Heading, arm: Arm): [number, number] {
	const incomingIsA = arm === 'right';
	const swap = incomingIsA
		? heading === 'W' || heading === 'N'
		: heading === 'E' || heading === 'S';

	if (swap) {
		return [tile.b, tile.a];
	}

	return [tile.a, tile.b];
}

function placeArm(
	items: BoardTile[],
	startCx: number,
	startCy: number,
	startHeading: 'E' | 'W',
	leftBound: number,
	rightBound: number,
	arm: Arm,
	lastTile: { x: number; y: number; w: number; h: number },
	span: TileSpan,
): PlacedBoardTile[] {
	const placed: PlacedBoardTile[] = [];
	let heading: Heading = startHeading;
	let lastEW: 'E' | 'W' = startHeading;
	let cx = startCx;
	let cy = startCy;
	let pendingDrop = 0;
	let dropX = 0;
	let dropY = 0;
	let last = lastTile;

	items.forEach((item, index) => {
		const isDouble = item.tile.a === item.tile.b;
		let nextHeading = heading;

		if (pendingDrop === 0) {
			const hitRight =
				heading === 'E' && cx + tileBox(isDouble, 'E', span).w > rightBound;
			const hitLeft =
				heading === 'W' && cx - tileBox(isDouble, 'W', span).w < leftBound;

			if (hitRight || hitLeft) {
				/*
				 * Derecha del origen: dobla hacia arriba.
				 * Izquierda del origen: dobla hacia abajo.
				 * Así las filas no se montan.
				 */
				nextHeading = arm === 'right' ? 'N' : 'S';
				pendingDrop = DROP_COUNT;
			}
		}

		const { w, h } = tileBox(isDouble, nextHeading, span);
		let x = 0;
		let y = 0;

		if (nextHeading === 'E') {
			x = cx;
			y = laneY(cy, isDouble, 'E', span);
			cx = x + w;
			heading = 'E';
			lastEW = 'E';
		} else if (nextHeading === 'W') {
			x = cx - w;
			y = laneY(cy, isDouble, 'W', span);
			cx = x;
			heading = 'W';
			lastEW = 'W';
		} else if (nextHeading === 'S') {
			const starting = pendingDrop === DROP_COUNT;
			x = starting
				? lastEW === 'W'
					? last.x
					: last.x + last.w - w
				: dropX;
			y = starting ? last.y + last.h : dropY;
			dropX = x;
			dropY = y + h;
			pendingDrop -= 1;

			if (pendingDrop === 0) {
				heading = lastEW === 'E' ? 'W' : 'E';
				lastEW = heading;
				cy = dropY;
				cx = heading === 'W' ? dropX + w : dropX;
			} else {
				heading = 'S';
			}
		} else {
			const starting = pendingDrop === DROP_COUNT;
			x = starting
				? lastEW === 'E'
					? last.x + last.w - w
					: last.x
				: dropX;
			y = starting ? last.y - h : dropY - h;
			dropX = x;
			dropY = y;
			pendingDrop -= 1;

			if (pendingDrop === 0) {
				heading = lastEW === 'W' ? 'E' : 'W';
				lastEW = heading;
				cy = dropY;
				cx = heading === 'E' ? dropX + w : dropX;
			} else {
				heading = 'N';
			}
		}

		const [faceA, faceB] = faces(item.tile, nextHeading, arm);

		placed.push({
			key: `${arm}-${item.tile.id}-${index}`,
			tile: item.tile,
			x: Math.round(x),
			y: Math.round(y),
			heading: nextHeading,
			faceA,
			faceB,
		});

		last = { x, y, w, h };
	});

	return placed;
}

export function layoutBoardPath(
	board: BoardTile[],
	maxWidth: number,
	openingTileId?: string | null,
	span: TileSpan = DEFAULT_SPAN,
) {
	if (board.length === 0) {
		return { tiles: [] as PlacedBoardTile[], width: 0, height: 0, anchorY: 0 };
	}

	const limit = Math.max(Math.floor(maxWidth), span.long * 3);
	const originIndex = Math.max(
		0,
		openingTileId
			? board.findIndex((item) => item.tile.id === openingTileId)
			: Math.floor(board.length / 2),
	);
	const origin = board[originIndex];
	const originDouble = origin.tile.a === origin.tile.b;
	const originBox = tileBox(originDouble, 'E', span);
	const originX = (limit - originBox.w) / 2;
	const originY = laneY(0, originDouble, 'E', span);
	const originLast = {
		x: originX,
		y: originY,
		w: originBox.w,
		h: originBox.h,
	};

	const tiles: PlacedBoardTile[] = [
		{
			key: `origin-${origin.tile.id}`,
			tile: origin.tile,
			x: originX,
			y: originY,
			heading: 'E',
			faceA: origin.tile.a,
			faceB: origin.tile.b,
		},
	];

	tiles.push(
		...placeArm(
			board.slice(originIndex + 1),
			originX + originBox.w,
			0,
			'E',
			0,
			limit,
			'right',
			originLast,
			span,
		),
		...placeArm(
			board.slice(0, originIndex).reverse(),
			originX,
			0,
			'W',
			0,
			limit,
			'left',
			originLast,
			span,
		),
	);

	const minX = Math.min(...tiles.map((tile) => tile.x));
	const minY = Math.min(...tiles.map((tile) => tile.y));
	const maxX = Math.max(
		...tiles.map((tile) => {
			const box = tileBox(tile.tile.a === tile.tile.b, tile.heading, span);
			return tile.x + box.w;
		}),
	);
	const maxY = Math.max(
		...tiles.map((tile) => {
			const box = tileBox(tile.tile.a === tile.tile.b, tile.heading, span);
			return tile.y + box.h;
		}),
	);

	const originLeft = originX - minX;
	const originRight = maxX - (originX + originBox.w);
	const sidePad = Math.max(originLeft, originRight);

	return {
		tiles: tiles.map((tile) => ({
			...tile,
			x: Math.round(tile.x - originX + sidePad),
			y: Math.round(tile.y - minY),
		})),
		width: sidePad * 2 + originBox.w,
		height: maxY - minY,
		anchorY: 0 - minY,
	};
}
