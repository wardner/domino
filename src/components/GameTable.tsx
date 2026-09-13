'use client';

import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type PointerEvent,
} from 'react';

import Domino from '@/components/Domino';
import { BOT_THINK_MS, chooseBotMove } from '@/lib/botPlay';
import { layoutBoardPath } from '@/lib/boardLayout';
import {
	GameState,
	getDisplayScore,
	getLeftEnd,
	getRightEnd,
	hasPlayableTile,
	isPlayable,
	mustOpenWithDoubleSix,
	Team,
	Tile,
} from '@/lib/dominoes';

export function teamNamesFromGame(game: GameState): [string, string] {
	return [
		`${game.players[0].name} + ${game.players[2].name}`,
		`${game.players[1].name} + ${game.players[3].name}`,
	];
}

export default function GameTable({
	game,
	mySeat,
	autoBots = false,
	onPlay,
	onPass,
	onNextRound,
	onNewMatch,
	onReorder,
	onReset,
	onLeave,
}: {
	game: GameState;
	mySeat: number;
	autoBots?: boolean;
	onPlay: (tileId: string, side: 'left' | 'right') => void;
	onPass: () => void;
	onNextRound: () => void;
	onNewMatch: () => void;
	onReorder: (from: number, to: number) => void;
	onReset?: () => void;
	onLeave?: () => void;
}) {
	const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [passSeconds, setPassSeconds] = useState(5);
	const [mesaWidth, setMesaWidth] = useState(280);
	const [arrivingId, setArrivingId] = useState<string | null>(null);
	const [holdTable, setHoldTable] = useState(false);
	const [lift, setLift] = useState<{
		index: number;
		dx: number;
		dy: number;
	} | null>(null);
	const mesaRef = useRef<HTMLDivElement>(null);
	const handRowRef = useRef<HTMLDivElement>(null);
	const onPlayRef = useRef(onPlay);
	const onPassRef = useRef(onPass);
	const dragRef = useRef<{
		index: number;
		x: number;
		y: number;
		active: boolean;
	} | null>(null);
	const prevTileIdsRef = useRef(new Set(game.board.map((item) => item.tile.id)));

	onPlayRef.current = onPlay;
	onPassRef.current = onPass;

	const myPlayer = game.players[mySeat];
	const myTurn = game.currentPlayer === mySeat;
	const myTeam = (mySeat % 2) as Team;
	const otherTeam = (1 - myTeam) as Team;
	const openingDoubleSix = mustOpenWithDoubleSix(game);
	const canHumanPlay = hasPlayableTile(
		myPlayer,
		game.board,
		openingDoubleSix,
	);
	const teamNames = teamNamesFromGame(game);
	const boardPath = layoutBoardPath(
		game.board,
		mesaWidth,
		game.openingTileId,
	);

	useEffect(() => {
		if (!autoBots || game.roundComplete || game.currentPlayer === mySeat) {
			return;
		}

		const timer = setTimeout(() => {
			const move = chooseBotMove(game);

			if (move.type === 'pass') {
				onPassRef.current();
				return;
			}

			onPlayRef.current(move.tileId, move.side);
		}, BOT_THINK_MS);

		return () => {
			clearTimeout(timer);
		};
	}, [autoBots, game, mySeat]);

	useEffect(() => {
		if (game.roundComplete || !myTurn || canHumanPlay) {
			setPassSeconds(5);
			return;
		}

		setPassSeconds(5);

		const countdown = setInterval(() => {
			setPassSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
		}, 1000);

		const timer = setTimeout(() => {
			setSelectedTile(null);
			setError(null);
			onPassRef.current();
		}, 5000);

		return () => {
			clearInterval(countdown);
			clearTimeout(timer);
		};
	}, [canHumanPlay, game, myTurn]);

	useEffect(() => {
		const el = mesaRef.current;

		if (!el) {
			return;
		}

		const update = () => {
			setMesaWidth(Math.max(160, Math.floor(el.clientWidth - 8)));
		};

		update();

		const observer = new ResizeObserver(update);
		observer.observe(el);

		return () => {
			observer.disconnect();
		};
	}, [game]);

	useEffect(() => {
		const prevIds = prevTileIdsRef.current;
		const added = game.board.find((item) => !prevIds.has(item.tile.id));
		prevTileIdsRef.current = new Set(game.board.map((item) => item.tile.id));

		if (!added) {
			return;
		}

		setArrivingId(added.tile.id);

		const capicua = Boolean(game.roundResult?.bonuses.includes('capicua'));
		const wait = game.roundComplete ? (capicua ? 720 : 360) : 360;

		if (game.roundComplete) {
			setHoldTable(true);
		}

		const timer = window.setTimeout(() => {
			setArrivingId(null);
			setHoldTable(false);
		}, wait);

		return () => {
			window.clearTimeout(timer);
		};
	}, [game.board, game.roundComplete, game.roundResult]);

	function getPlayableSides(tile: Tile) {
		if (game.board.length === 0) {
			return { left: false, right: false };
		}

		const leftEnd = getLeftEnd(game.board);
		const rightEnd = getRightEnd(game.board);

		return {
			left: tile.a === leftEnd || tile.b === leftEnd,
			right: tile.a === rightEnd || tile.b === rightEnd,
		};
	}

	function playAutomatically(tile: Tile, side: 'left' | 'right') {
		setSelectedTile(null);
		setError(null);
		onPlay(tile.id, side);
	}

	function selectTile(tile: Tile) {
		setError(null);

		if (!myTurn) {
			setError('No es tu turno');
			return;
		}

		if (!isPlayable(tile, game.board, openingDoubleSix)) {
			setError(
				openingDoubleSix
					? 'La partida sale con doble 6'
					: 'Ese domino no se puede jugar',
			);
			return;
		}

		if (game.board.length === 0) {
			playAutomatically(tile, 'right');
			return;
		}

		const sides = getPlayableSides(tile);
		const leftEnd = getLeftEnd(game.board);
		const rightEnd = getRightEnd(game.board);

		if (
			sides.left &&
			sides.right &&
			(leftEnd === rightEnd || myPlayer.hand.length === 1)
		) {
			playAutomatically(tile, 'right');
			return;
		}

		if (sides.left && !sides.right) {
			playAutomatically(tile, 'left');
			return;
		}

		if (sides.right && !sides.left) {
			playAutomatically(tile, 'right');
			return;
		}

		setSelectedTile(selectedTile?.id === tile.id ? null : tile);
	}

	function onHandPointerDown(
		event: PointerEvent<HTMLDivElement>,
		index: number,
	) {
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = {
			index,
			x: event.clientX,
			y: event.clientY,
			active: false,
		};
	}

	function onHandPointerMove(event: PointerEvent<HTMLDivElement>) {
		const drag = dragRef.current;

		if (!drag) {
			return;
		}

		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;

		if (!drag.active && Math.hypot(dx, dy) > 7) {
			drag.active = true;
		}

		if (drag.active) {
			setLift({
				index: drag.index,
				dx,
				dy,
			});
		}
	}

	function onHandPointerUp(event: PointerEvent<HTMLDivElement>, tile: Tile) {
		const drag = dragRef.current;
		dragRef.current = null;
		setLift(null);

		if (!drag) {
			return;
		}

		if (drag.active) {
			const row = handRowRef.current;

			if (!row) {
				return;
			}

			const rect = row.getBoundingClientRect();
			const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
			const to = Math.max(
				0,
				Math.min(
					myPlayer.hand.length - 1,
					Math.floor(ratio * myPlayer.hand.length),
				),
			);

			if (to !== drag.index) {
				onReorder(drag.index, to);
			}

			return;
		}

		selectTile(tile);
	}

	const capicuaHold = Boolean(
		holdTable && game.roundResult?.bonuses.includes('capicua'),
	);
	const arriveFrom = (() => {
		const seat = game.lastPlayerToPlay;

		if (seat === null) {
			return 's';
		}

		const relative = (((seat - mySeat) % 4) + 4) % 4;

		if (relative === 1) {
			return 'e';
		}

		if (relative === 2) {
			return 'n';
		}

		if (relative === 3) {
			return 'w';
		}

		return 's';
	})();

	if (game.matchComplete && game.roundResult && !holdTable) {
		const result = game.roundResult;

		return (
			<main className='felt-page flex min-h-dvh items-center justify-center p-3 text-[#f4e6c3]'>
				<div className='w-full max-w-xs rounded-2xl bg-black/35 p-3 text-center'>
					<p className='text-[10px] uppercase tracking-[0.18em] text-yellow-300'>
						Partida
					</p>
					<h1 className='mt-1 text-xl font-semibold'>Ganaron</h1>
					<p className='text-sm text-emerald-100/80'>
						{teamNames[result.winnerTeam]}
					</p>
					<div className='mt-2 grid grid-cols-2 gap-1.5 text-sm'>
						<div className='rounded-lg bg-black/30 py-1.5'>
							{result.finalScores[0]}
						</div>
						<div className='rounded-lg bg-black/30 py-1.5'>
							{result.finalScores[1]}
						</div>
					</div>
					<button
						type='button'
						onClick={onNewMatch}
						className='action-btn mt-3 w-full'
					>
						Nueva partida
					</button>
					{onLeave && (
						<button
							type='button'
							onClick={onLeave}
							className='ghost-btn mt-2 w-full'
						>
							Menú
						</button>
					)}
				</div>
			</main>
		);
	}

	if (game.roundComplete && game.roundResult && !holdTable) {
		const result = game.roundResult;
		const winner = game.players[result.winnerPlayer];

		return (
			<main className='felt-page flex min-h-dvh items-center justify-center p-3 text-[#f4e6c3]'>
				<div className='w-full max-w-xs rounded-2xl bg-black/35 p-3 text-center'>
					<p className='text-[10px] uppercase tracking-[0.18em] text-yellow-300'>
						{result.tranca ? 'Tranca' : 'Mano'}
					</p>
					<h1 className='mt-0.5 text-lg font-semibold'>{winner.name}</h1>
					<p className='text-sm font-semibold text-yellow-200'>
						+{result.totalPoints}
						{result.bonusPoints > 0
							? ` · ${result.bonuses
									.map((bonus) =>
										bonus === 'salida'
											? 'salida'
											: bonus === 'pase-corrido'
												? 'pase corrido'
												: 'capicúa',
									)
									.join(', ')}`
							: ''}
					</p>
					<div className='mt-2 space-y-1'>
						{result.scoringPlayers.map((player) => (
							<div
								key={player.playerIndex}
								className='flex items-center justify-between gap-2 rounded-lg bg-black/25 px-2 py-1'
							>
								<span className='text-[11px]'>{player.playerName}</span>
								<div className='flex items-center gap-px'>
									{player.tiles.map((tile) => (
										<Domino
											key={tile.id}
											tile={tile}
											size='mini'
											orientation='hand'
											disabled
											playable
										/>
									))}
								</div>
								<span className='text-[11px] text-yellow-200'>
									+{player.points}
								</span>
							</div>
						))}
					</div>
					<div className='mt-2 grid grid-cols-2 gap-1.5 text-sm'>
						<div className='rounded-lg bg-black/30 py-1'>
							Tú {result.finalScores[myTeam]}
						</div>
						<div className='rounded-lg bg-black/30 py-1'>
							Ellos {result.finalScores[otherTeam]}
						</div>
					</div>
					<button
						type='button'
						onClick={onNextRound}
						className='action-btn mt-2 w-full'
					>
						Siguiente mano
					</button>
				</div>
			</main>
		);
	}

	const leftEnd = game.board.length > 0 ? getLeftEnd(game.board) : null;
	const rightEnd = game.board.length > 0 ? getRightEnd(game.board) : null;
	const topSeat = (mySeat + 2) % 4;
	const rightSeat = (mySeat + 1) % 4;
	const leftSeat = (mySeat + 3) % 4;
	const partner = game.players[topSeat];
	const rightOpponent = game.players[rightSeat];
	const leftOpponent = game.players[leftSeat];

	return (
		<main className='felt-page h-dvh overflow-hidden text-[#f4e6c3]'>
			<div className='mx-auto flex h-dvh w-full max-w-md flex-col px-2 py-1.5'>
				<header className='flex shrink-0 items-center justify-between gap-2'>
					<p className='text-[10px] uppercase tracking-[0.16em] text-emerald-100/60'>
						Ronda {game.round}
					</p>
					<div className='flex items-center gap-1.5 text-[11px]'>
						<span>
							{getDisplayScore(game, 0)} · {getDisplayScore(game, 1)}
						</span>
						{onReset && (
							<button type='button' onClick={onReset} className='ghost-btn'>
								Nueva
							</button>
						)}
						{onLeave && (
							<button type='button' onClick={onLeave} className='ghost-btn'>
								Salir
							</button>
						)}
					</div>
				</header>

				<section className='table-rail mt-1.5 flex min-h-0 flex-1 flex-col overflow-hidden'>
					<div
						className={`felt-inner flex min-h-0 flex-1 flex-col overflow-hidden ${
							capicuaHold ? 'mesa-tremble' : ''
						}`}
					>
						<div className='flex shrink-0 flex-col items-center justify-center gap-0.5 px-2 pt-1.5'>
							<span
								className={`text-[9px] ${
									game.currentPlayer === topSeat
										? 'text-yellow-300'
										: 'text-white/70'
								}`}
							>
								{partner.name}
							</span>
							<div className='flex items-center justify-center gap-1'>
								<SideTiles tiles={partner.hand} axis='horizontal' />
								<span className='text-[9px] text-white/70'>
									{getDisplayScore(game, myTeam)} pts
								</span>
							</div>
						</div>

						<div className='flex min-h-0 flex-1 items-stretch'>
							<div className='flex w-10 shrink-0 flex-col items-center justify-center gap-1'>
								<span
									className={`max-w-10 truncate text-[8px] ${
										game.currentPlayer === leftSeat
											? 'text-yellow-300'
											: 'text-white/70'
									}`}
								>
									{leftOpponent.name}
								</span>
								<SideTiles tiles={leftOpponent.hand} axis='vertical' />
								<span className='text-[8px] text-white/70'>
									{getDisplayScore(game, otherTeam)}
								</span>
							</div>

							<div
								ref={mesaRef}
								className='relative min-h-0 min-w-0 flex-1 overflow-hidden'
							>
								{game.board.length === 0 ? (
									<div className='flex h-full items-center justify-center px-3 text-center text-[11px] text-emerald-50/70'>
										{openingDoubleSix
											? 'Sale el doble 6'
											: 'Toca una ficha'}
									</div>
								) : (
									<FitBoard
										width={boardPath.width}
										height={boardPath.height}
										anchorY={boardPath.anchorY}
									>
										{boardPath.tiles.map((placed) => (
											<div
												key={placed.key}
												className={`absolute ${
													arrivingId === placed.tile.id
														? `tile-arrive tile-arrive-${arriveFrom}${
																capicuaHold ? ' tile-capicua' : ''
															}`
														: ''
												}`}
												style={{ left: placed.x, top: placed.y }}
											>
												<Domino
													tile={placed.tile}
													heading={placed.heading}
													faceA={placed.faceA}
													faceB={placed.faceB}
													orientation='board'
													disabled
													playable
												/>
											</div>
										))}
									</FitBoard>
								)}
							</div>

							<div className='flex w-10 shrink-0 flex-col items-center justify-center gap-1'>
								<span
									className={`max-w-10 truncate text-[8px] ${
										game.currentPlayer === rightSeat
											? 'text-yellow-300'
											: 'text-white/70'
									}`}
								>
									{rightOpponent.name}
								</span>
								<SideTiles tiles={rightOpponent.hand} axis='vertical' />
								<span className='text-[8px] text-white/70'>
									{getDisplayScore(game, otherTeam)}
								</span>
							</div>
						</div>

						<div className='flex shrink-0 flex-col items-center gap-1 px-2 pb-1.5'>
							{myTurn && (
								<p className='text-[10px]'>
									{canHumanPlay
										? openingDoubleSix
											? 'Tu turno · doble 6'
											: 'Tu turno'
										: `Pasas en ${passSeconds}s`}
								</p>
							)}
							{error && (
								<p className='text-[10px] text-red-200'>{error}</p>
							)}
							{selectedTile && leftEnd !== null && rightEnd !== null && (
								<div className='flex items-center gap-2'>
									<button
										type='button'
										onClick={() => playAutomatically(selectedTile, 'left')}
										className='action-btn'
									>
										{leftEnd}
									</button>
									<button
										type='button'
										onClick={() => playAutomatically(selectedTile, 'right')}
										className='action-btn'
									>
										{rightEnd}
									</button>
								</div>
							)}
							{myTurn && !canHumanPlay && (
								<button
									type='button'
									onClick={onPass}
									className='rounded-md bg-orange-400 px-3 py-0.5 text-[11px] font-bold text-black'
								>
									Pasar
								</button>
							)}
							<div className='hand-rack flex items-end justify-center gap-1 rounded-xl bg-[#5a3016] px-3 py-1 shadow-md'>
								<div
									ref={handRowRef}
									className='flex items-end gap-1'
								>
									{myPlayer.hand.map((tile, index) => {
										const playable =
											myTurn &&
											isPlayable(tile, game.board, openingDoubleSix);
										const lifting = lift?.index === index;

										return (
											<div
												key={tile.id}
												className={`hand-tile-slot cursor-grab active:cursor-grabbing ${
													lifting ? 'is-lifting' : ''
												}`}
												style={
													lifting && lift
														? {
																transform: `translate(${lift.dx}px, ${lift.dy - 16}px) scale(1.08) rotate(-4deg)`,
															}
														: undefined
												}
												onPointerDown={(event) =>
													onHandPointerDown(event, index)
												}
												onPointerMove={onHandPointerMove}
												onPointerUp={(event) => onHandPointerUp(event, tile)}
												onPointerCancel={() => {
													dragRef.current = null;
													setLift(null);
												}}
											>
												<Domino
													tile={tile}
													selected={selectedTile?.id === tile.id}
													playable={playable}
													orientation='hand'
													className='pointer-events-none'
												/>
											</div>
										);
									})}
								</div>
								<span className='ml-1 text-[9px] text-[#f4e6c3]/80'>
									{getDisplayScore(game, myTeam)} pts
								</span>
							</div>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}

function FitBoard({
	children,
	width,
	height,
	anchorY,
}: {
	children: React.ReactNode;
	width: number;
	height: number;
	anchorY: number;
}) {
	const outerRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState({ scale: 1, left: 0, top: 0 });

	useLayoutEffect(() => {
		const outer = outerRef.current;

		if (!outer || width <= 0 || height <= 0) {
			return;
		}

		const availW = Math.max(outer.clientWidth - 8, 1);
		const availH = Math.max(outer.clientHeight - 8, 1);
		const scale = Math.min(1, availW / width, availH / height);
		const nextScale = Number.isFinite(scale) ? scale : 1;
		const left = (outer.clientWidth - width * nextScale) / 2;
		const top = outer.clientHeight / 2 - (anchorY + 10) * nextScale;

		setView({ scale: nextScale, left, top });
	}, [width, height, anchorY]);

	return (
		<div ref={outerRef} className='relative h-full w-full overflow-hidden'>
			<div
				className='absolute'
				style={{
					width,
					height,
					left: view.left,
					top: view.top,
					transform: `scale(${view.scale})`,
					transformOrigin: 'top left',
				}}
			>
				{children}
			</div>
		</div>
	);
}

function SideTiles({
	tiles,
	axis,
}: {
	tiles: Tile[];
	axis: 'horizontal' | 'vertical';
}) {
	return (
		<div
			className={`flex items-center justify-center ${
				axis === 'vertical' ? 'flex-col' : 'flex-row'
			}`}
		>
			{tiles.map((tile) => (
				<Domino
					key={tile.id}
					faceDown
					size='mini'
					orientation={axis === 'vertical' ? 'hand' : 'board'}
					disabled
					playable
				/>
			))}
		</div>
	);
}
