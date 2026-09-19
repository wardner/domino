import { createContext, useContext } from 'react';

import { Tile } from '@/lib/dominoes';
import {
	DEFAULT_TABLE_SCALE,
	type TableScale,
} from '@/lib/tileScale';

export const TileScaleContext = createContext<TableScale>(DEFAULT_TABLE_SCALE);

const PIPS: Record<number, Array<[number, number]>> = {
	0: [],
	1: [[2, 2]],
	2: [
		[1, 1],
		[3, 3],
	],
	3: [
		[1, 1],
		[2, 2],
		[3, 3],
	],
	4: [
		[1, 1],
		[1, 3],
		[3, 1],
		[3, 3],
	],
	5: [
		[1, 1],
		[1, 3],
		[2, 2],
		[3, 1],
		[3, 3],
	],
	6: [
		[1, 1],
		[1, 2],
		[1, 3],
		[3, 1],
		[3, 2],
		[3, 3],
	],
};

function sizesFromScale(table: TableScale) {
	return {
		board: { regular: table.boardLong, double: table.boardShort },
		hand: { regular: table.handShort, double: table.handLong },
		mini: { regular: table.miniShort, double: table.miniLong },
	};
}

export const TILE_SIZE = sizesFromScale(DEFAULT_TABLE_SCALE);

type DominoOrientation = 'hand' | 'board';
type DominoSize = 'hand' | 'board' | 'mini';
export type Heading = 'E' | 'W' | 'S' | 'N';

type DominoProps = {
	tile?: Tile;
	faceDown?: boolean;
	reversed?: boolean;
	heading?: Heading;
	faceA?: number;
	faceB?: number;
	selected?: boolean;
	onClick?: () => void;
	disabled?: boolean;
	playable?: boolean;
	orientation?: DominoOrientation;
	size?: DominoSize;
	draggable?: boolean;
	onDragStart?: () => void;
	onDragOver?: (event: React.DragEvent<HTMLButtonElement>) => void;
	onDrop?: () => void;
	className?: string;
	style?: React.CSSProperties;
};

function Face({
	value,
	size,
	short,
	horizontal = false,
}: {
	value: number;
	size: 'hand' | 'board' | 'mini';
	short: number;
	horizontal?: boolean;
}) {
	const box =
		size === 'mini'
			? Math.max(6, Math.round(short * 0.82))
			: Math.max(10, Math.round(short * 0.84));
	const pip = Math.max(2, Math.round(box / 6));

	return (
		<div
			className='grid grid-cols-3 grid-rows-3 place-items-center'
			style={{ width: box, height: box }}
			aria-hidden
		>
			{PIPS[value].map(([col, row]) => {
				const pipCol = horizontal ? 4 - row : col;
				const pipRow = horizontal ? col : row;

				return (
					<span
						key={`${pipCol}-${pipRow}`}
						className='rounded-full bg-[#1a120c]'
						style={{
							gridColumn: pipCol,
							gridRow: pipRow,
							width: pip,
							height: pip,
						}}
					/>
				);
			})}
		</div>
	);
}

export default function Domino({
	tile,
	faceDown = false,
	reversed = false,
	heading,
	faceA,
	faceB,
	selected = false,
	onClick,
	disabled = false,
	playable = true,
	orientation = 'hand',
	size,
	draggable = false,
	onDragStart,
	onDragOver,
	onDrop,
	className: extraClassName,
	style,
}: DominoProps) {
	const table = useContext(TileScaleContext);
	const tileSize = sizesFromScale(table);
	const visualSize = size ?? (orientation === 'board' ? 'board' : 'hand');
	const isHand = orientation === 'hand' && !heading;
	const isDouble = Boolean(tile && tile.a === tile.b);
	const usedHeading = heading ?? (reversed ? 'W' : 'E');
	const vertical =
		isHand ||
		isDouble ||
		usedHeading === 'S' ||
		usedHeading === 'N';
	const first =
		faceA ??
		(tile ? (reversed && !isDouble ? tile.b : tile.a) : 0);
	const second =
		faceB ??
		(tile ? (reversed && !isDouble ? tile.a : tile.b) : 0);

	const short =
		visualSize === 'mini'
			? tileSize.mini.regular
			: visualSize === 'board'
				? tileSize.board.double
				: tileSize.hand.regular;
	const long =
		visualSize === 'mini'
			? tileSize.mini.double
			: visualSize === 'board'
				? tileSize.board.regular
				: tileSize.hand.double;

	const width = vertical ? short : long;
	const height = vertical ? long : short;

	const className = [
		'tile-body relative box-border flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] border-0 p-0 leading-none',
		vertical ? 'flex-col' : 'flex-row',
		selected ? 'tile-selected -translate-y-0.5' : '',
		playable && !selected && !faceDown ? 'tile-playable' : '',
		!playable && !faceDown ? 'opacity-40' : '',
		faceDown ? 'tile-back' : '',
		draggable ? 'cursor-grab active:cursor-grabbing' : '',
		onClick && !disabled ? 'cursor-pointer' : 'cursor-default',
		extraClassName ?? '',
	]
		.filter(Boolean)
		.join(' ');

	const label = faceDown
		? 'Ficha boca abajo'
		: tile
			? `Domino ${tile.a}-${tile.b}`
			: 'Domino';

	const body = faceDown ? (
		<div className='tile-back-pattern h-full w-full' />
	) : (
		<>
			<Face
				value={first}
				size={visualSize}
				short={short}
				horizontal={!vertical}
			/>
			<div className={vertical ? 'tile-divider-h' : 'tile-divider-v'} />
			<Face
				value={second}
				size={visualSize}
				short={short}
				horizontal={!vertical}
			/>
		</>
	);

	return (
		<button
			type='button'
			onClick={onClick}
			disabled={disabled}
			draggable={draggable}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDrop={onDrop}
			aria-label={label}
			className={className}
			style={{ width, height, ...style }}
		>
			{body}
		</button>
	);
}
