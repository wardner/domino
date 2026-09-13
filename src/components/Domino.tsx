import { Tile } from '@/lib/dominoes';

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

export const TILE_SIZE = {
	board: { regular: 42, double: 21 },
	hand: { regular: 28, double: 56 },
	mini: { regular: 12, double: 24 },
};

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
};

function Face({
	value,
	size,
}: {
	value: number;
	size: 'hand' | 'board' | 'mini';
}) {
	const box = size === 'mini' ? 10 : size === 'board' ? 17 : 24;
	const pip = size === 'mini' ? 2 : size === 'board' ? 3 : 4;

	return (
		<div
			className='grid grid-cols-3 grid-rows-3 place-items-center'
			style={{ width: box, height: box }}
			aria-hidden
		>
			{PIPS[value].map(([col, row]) => (
				<span
					key={`${col}-${row}`}
					className='rounded-full bg-[#1a120c]'
					style={{
						gridColumn: col,
						gridRow: row,
						width: pip,
						height: pip,
					}}
				/>
			))}
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
}: DominoProps) {
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
			? TILE_SIZE.mini.regular
			: visualSize === 'board'
				? TILE_SIZE.board.double
				: TILE_SIZE.hand.regular;
	const long =
		visualSize === 'mini'
			? TILE_SIZE.mini.double
			: visualSize === 'board'
				? TILE_SIZE.board.regular
				: TILE_SIZE.hand.double;

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
			<Face value={first} size={visualSize} />
			<div className={vertical ? 'tile-divider-h' : 'tile-divider-v'} />
			<Face value={second} size={visualSize} />
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
			style={{ width, height }}
		>
			{body}
		</button>
	);
}
