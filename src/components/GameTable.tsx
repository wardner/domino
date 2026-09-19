'use client';

import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent,
} from 'react';

type StyleVars = CSSProperties & Record<`--${string}`, string>;

import Domino from '@/components/Domino';
import { BOT_THINK_MS, chooseBotMove } from '@/lib/botPlay';
import { layoutBoardPath } from '@/lib/boardLayout';
import {
	GameState,
	getDisplayScore,
	getLeftEnd,
	getRightEnd,
	BonusType,
	hasPlayableTile,
	isPlayable,
	mustOpenWithDoubleSix,
	rightPlayer,
	Team,
	Tile,
} from '@/lib/dominoes';

const PASS_WAIT_MS = 3000;
const PASS_WAIT_SEC = PASS_WAIT_MS / 1000;
const BONUS_BURST_MS = 1350;
const PASS_FX_MS = 1350;
const CAPICUA_ANIM_MS = 2000;
const CAPICUA_HOLD_MS = 3000;
const DEAL_STEP_MS = 90;

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
	const [passSeconds, setPassSeconds] = useState(PASS_WAIT_SEC);
	const [mesaWidth, setMesaWidth] = useState(280);
	const [arrivingId, setArrivingId] = useState<string | null>(null);
	const [showResult, setShowResult] = useState(false);
	const [peekTable, setPeekTable] = useState(false);
	const [dealtCount, setDealtCount] = useState(
		game.firstMoveMade || game.board.length > 0
			? game.players[mySeat].hand.length
			: 0,
	);
	const [dealReady, setDealReady] = useState(
		game.firstMoveMade || game.board.length > 0,
	);
	const [lift, setLift] = useState<{
		index: number;
		dx: number;
		dy: number;
	} | null>(null);
	const [bonusBurst, setBonusBurst] = useState<{
		playerIndex: number;
		type: BonusType;
		key: number;
	} | null>(null);
	const [passFx, setPassFx] = useState<{
		seat: number;
		nextSeat: number;
		key: number;
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
	const seenBonusCountRef = useRef(game.roundBonuses.length);
	const prevPassRef = useRef({
		streak: game.passStreak,
		round: game.round,
	});
	const completionIdRef = useRef('');

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

	const dealing =
		!game.firstMoveMade &&
		game.board.length === 0 &&
		!game.roundComplete &&
		!dealReady;

	useEffect(() => {
		if (game.firstMoveMade || game.board.length > 0 || game.roundComplete) {
			setDealtCount(game.players[mySeat].hand.length);
			setDealReady(true);
			return;
		}

		setDealtCount(0);
		setDealReady(false);
		const total = game.players[mySeat].hand.length;
		const timers: number[] = [];
		let count = 0;

		const dealNext = () => {
			count += 1;
			setDealtCount(count);

			if (count < total) {
				timers.push(window.setTimeout(dealNext, DEAL_STEP_MS));
			} else {
				timers.push(window.setTimeout(() => setDealReady(true), 520));
			}
		};

		timers.push(window.setTimeout(dealNext, 160));

		return () => {
			timers.forEach((timer) => window.clearTimeout(timer));
		};
	}, [game.round, mySeat]);

	useEffect(() => {
		if (
			!autoBots ||
			game.roundComplete ||
			game.currentPlayer === mySeat ||
			dealing
		) {
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
	}, [autoBots, dealing, game, mySeat]);

	useEffect(() => {
		if (game.roundComplete || dealing || !myTurn || canHumanPlay) {
			setPassSeconds(PASS_WAIT_SEC);
			return;
		}

		setPassSeconds(PASS_WAIT_SEC);

		const countdown = setInterval(() => {
			setPassSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
		}, 1000);

		const timer = setTimeout(() => {
			setSelectedTile(null);
			setError(null);
			onPassRef.current();
		}, PASS_WAIT_MS);

		return () => {
			clearInterval(countdown);
			clearTimeout(timer);
		};
	}, [canHumanPlay, dealing, game, myTurn]);

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
		window.addEventListener('orientationchange', update);

		return () => {
			observer.disconnect();
			window.removeEventListener('orientationchange', update);
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
		const timer = window.setTimeout(() => {
			setArrivingId(null);
		}, capicua ? CAPICUA_ANIM_MS : 360);

		return () => {
			window.clearTimeout(timer);
		};
	}, [game.board, game.roundResult]);

	useLayoutEffect(() => {
		if (!game.roundComplete || !game.roundResult) {
			completionIdRef.current = '';
			setShowResult(false);
			setPeekTable(false);
			return;
		}

		const completionId = `${game.round}-${game.roundResult.winnerPlayer}-${game.roundResult.bonuses.join(',')}`;

		if (completionIdRef.current !== completionId) {
			completionIdRef.current = completionId;
			setShowResult(false);
			setPeekTable(false);
		}

		if (showResult) {
			return;
		}

		const capicua = game.roundResult.bonuses.includes('capicua');
		const timer = window.setTimeout(() => {
			setShowResult(true);
		}, capicua ? CAPICUA_HOLD_MS : 1500);

		return () => {
			window.clearTimeout(timer);
		};
	}, [game.round, game.roundComplete, game.roundResult, showResult]);

	useEffect(() => {
		const count = game.roundBonuses.length;

		if (count <= seenBonusCountRef.current) {
			seenBonusCountRef.current = count;
			return;
		}

		seenBonusCountRef.current = count;

		const type = game.roundBonuses[count - 1];
		const playerIndex = game.lastPlayerToPlay;

		if (!type || playerIndex === null) {
			return;
		}

		setBonusBurst({
			playerIndex,
			type,
			key: Date.now(),
		});
	}, [game.round, game.roundBonuses.length, game.lastPlayerToPlay]);

	useEffect(() => {
		if (!bonusBurst) {
			return;
		}

		const timer = window.setTimeout(() => {
			setBonusBurst(null);
		}, BONUS_BURST_MS);

		return () => {
			window.clearTimeout(timer);
		};
	}, [bonusBurst]);

	useEffect(() => {
		const prev = prevPassRef.current;

		if (game.round !== prev.round) {
			prevPassRef.current = {
				streak: game.passStreak,
				round: game.round,
			};
			return;
		}

		if (game.passStreak > prev.streak) {
			const seat = (game.currentPlayer + 3) % 4;
			setPassFx({
				seat,
				nextSeat: game.currentPlayer,
				key: Date.now(),
			});
		}

		prevPassRef.current = {
			streak: game.passStreak,
			round: game.round,
		};
	}, [game.currentPlayer, game.passStreak, game.round]);

	useEffect(() => {
		if (!passFx) {
			return;
		}

		const timer = window.setTimeout(() => {
			setPassFx(null);
		}, PASS_FX_MS);

		return () => {
			window.clearTimeout(timer);
		};
	}, [passFx]);

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

		if (dealing) {
			return;
		}

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
		if (dealing) {
			return;
		}

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

	const holdTable = Boolean(
		game.roundComplete && game.roundResult && !showResult,
	);
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

	if (game.matchComplete && game.roundResult && showResult && !peekTable) {
		const result = game.roundResult;

		return (
			<main className='result-page felt-page flex min-h-dvh items-center justify-center p-3 text-[#f4e6c3]'>
				<div className='result-card w-full max-w-xs rounded-2xl bg-black/35 p-3 text-center'>
					<p className='text-[10px] uppercase tracking-[0.18em] text-yellow-300'>
						Partida
					</p>
					<h1 className='mt-1 text-xl font-semibold'>Ganaron</h1>
					<p className='text-sm text-emerald-100/80'>
						{teamNames[result.winnerTeam]}
					</p>
					<PointsBreakdown result={result} />
					<div className='mt-2 grid grid-cols-2 gap-1.5'>
						<div className='score-total rounded-lg bg-black/30 py-2 text-3xl'>
							{result.finalScores[0]}
						</div>
						<div className='score-total rounded-lg bg-black/30 py-2 text-3xl'>
							{result.finalScores[1]}
						</div>
					</div>
					<button
						type='button'
						onClick={() => setPeekTable(true)}
						className='ghost-btn mt-3 w-full'
					>
						Ver mesa
					</button>
					<button
						type='button'
						onClick={onNewMatch}
						className='action-btn mt-2 w-full'
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

	if (game.roundComplete && game.roundResult && showResult && !peekTable) {
		const result = game.roundResult;
		const winner = game.players[result.winnerPlayer];
		const trancador = result.trancador;
		const contra =
			trancador === null ? null : rightPlayer(trancador);

		return (
			<main className='result-page felt-page flex min-h-dvh items-center justify-center p-3 text-[#f4e6c3]'>
				<div className='result-card w-full max-w-xs rounded-2xl bg-black/35 p-3 text-center'>
					<p className='text-[10px] uppercase tracking-[0.18em] text-yellow-300'>
						{result.tranca ? 'Tranca' : 'Mano'}
					</p>
					<h1 className='mt-0.5 text-lg font-semibold'>{winner.name}</h1>
					{result.tranca && trancador !== null && contra !== null && (
						<p className='mt-0.5 text-[10px] text-emerald-100/75'>
							<span className='text-amber-200'>
								{game.players[trancador].name}
							</span>
							{' trancó · vs '}
							<span className='text-sky-200'>
								{game.players[contra].name}
							</span>
						</p>
					)}
					<PointsBreakdown result={result} />
					<div className='mt-2 space-y-1'>
						{result.scoringPlayers.map((player) => {
							const role =
								result.tranca && trancador !== null
									? player.playerIndex === trancador
										? 'trancador'
										: player.playerIndex === contra
											? 'contra'
											: null
									: null;

							return (
								<div
									key={player.playerIndex}
									className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${
										role === 'trancador'
											? 'tranca-trancador'
											: role === 'contra'
												? 'tranca-contra'
												: 'bg-black/25'
									}`}
								>
									<span className='min-w-0 text-left text-[11px]'>
										{player.playerName}
										{role === 'trancador' ? (
											<span className='ml-1 text-[9px] uppercase tracking-wide text-amber-200'>
												trancó
											</span>
										) : null}
										{role === 'contra' ? (
											<span className='ml-1 text-[9px] uppercase tracking-wide text-sky-200'>
												contra
											</span>
										) : null}
									</span>
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
									<span
										className={`text-[11px] ${
											role === 'contra'
												? 'text-sky-100'
												: 'text-yellow-200'
										}`}
									>
										+{player.points}
									</span>
								</div>
							);
						})}
					</div>
					<div className='mt-2 grid grid-cols-2 gap-1.5'>
						<div className='rounded-lg bg-black/30 py-2'>
							<p className='text-[10px] uppercase tracking-wide text-white/50'>
								Tú
							</p>
							<p className='score-total text-3xl'>
								{result.finalScores[myTeam]}
							</p>
						</div>
						<div className='rounded-lg bg-black/30 py-2'>
							<p className='text-[10px] uppercase tracking-wide text-white/50'>
								Ellos
							</p>
							<p className='score-total text-3xl'>
								{result.finalScores[otherTeam]}
							</p>
						</div>
					</div>
					<button
						type='button'
						onClick={() => setPeekTable(true)}
						className='ghost-btn mt-2 w-full'
					>
						Ver mesa
					</button>
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

	const leftPlacedEnd = boardPath.tiles.find(
		(item) => item.tile.id === game.board[0]?.tile.id,
	);
	const rightPlacedEnd = boardPath.tiles.find(
		(item) =>
			item.tile.id === game.board[game.board.length - 1]?.tile.id,
	);
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
			<div className='game-shell mx-auto flex h-dvh w-full max-w-md flex-col px-2 py-1.5 landscape:max-w-none landscape:px-3 landscape:py-1'>
				<header className='flex shrink-0 items-center justify-between gap-2 landscape:gap-3'>
					<p className='text-[10px] uppercase tracking-[0.16em] text-emerald-100/60'>
						Ronda {game.round}
					</p>
					<div className='flex items-center gap-3'>
						<div className='flex items-end gap-3'>
							<div className='text-center'>
								<p className='text-[9px] uppercase tracking-wide text-white/45'>
									{myTeam === 0 ? 'Tú' : 'Ellos'}
								</p>
								<p
									className={`score-total text-3xl landscape:text-[1.75rem] ${
										myTeam === 0 ? 'text-yellow-300' : 'text-[#f4e6c3]'
									}`}
								>
									{getDisplayScore(game, 0)}
								</p>
							</div>
							<div className='text-center'>
								<p className='text-[9px] uppercase tracking-wide text-white/45'>
									{myTeam === 1 ? 'Tú' : 'Ellos'}
								</p>
								<p
									className={`score-total text-3xl landscape:text-[1.75rem] ${
										myTeam === 1 ? 'text-yellow-300' : 'text-[#f4e6c3]'
									}`}
								>
									{getDisplayScore(game, 1)}
								</p>
							</div>
						</div>
						{onReset && (
							<button type='button' onClick={onReset} className='ghost-btn'>
								Nueva
							</button>
						)}
						{peekTable && (
							<button
								type='button'
								onClick={() => setPeekTable(false)}
								className='action-btn'
							>
								Resultado
							</button>
						)}
						{onLeave && (
							<button type='button' onClick={onLeave} className='ghost-btn'>
								Salir
							</button>
						)}
					</div>
				</header>

				<section className='table-rail mt-1.5 flex min-h-0 flex-1 flex-col overflow-hidden landscape:mt-1'>
					<div
						className={`felt-inner relative flex min-h-0 flex-1 flex-col overflow-hidden ${
							capicuaHold ? 'mesa-tremble' : ''
						} ${passFx ? 'mesa-tap' : ''}`}
					>
						{bonusBurst ? (
							<BonusBurst
								key={bonusBurst.key}
								playerIndex={bonusBurst.playerIndex}
								mySeat={mySeat}
								type={bonusBurst.type}
								playerName={game.players[bonusBurst.playerIndex].name}
							/>
						) : null}
						{passFx ? (
							<PassCallout
								key={passFx.key}
								seat={passFx.seat}
								nextSeat={passFx.nextSeat}
								mySeat={mySeat}
							/>
						) : null}
						<div className='flex shrink-0 flex-col items-center justify-center gap-0.5 px-2 pt-1.5 landscape:pt-1'>
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
								<SideTiles
									tiles={partner.hand}
									axis='horizontal'
									visible={dealing ? dealtCount : undefined}
								/>
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
								<SideTiles
									tiles={leftOpponent.hand}
									axis='vertical'
									visible={dealing ? dealtCount : undefined}
								/>
								<span className='text-[8px] text-white/70'>
									{getDisplayScore(game, otherTeam)}
								</span>
							</div>

							<div
								ref={mesaRef}
								className='relative min-h-0 min-w-0 flex-1 overflow-hidden'
							>
								{game.board.length === 0 ? (
									<div className='flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-[11px] text-emerald-50/70'>
										{dealing ? (
											<DealPile
												key={dealtCount}
												remaining={28 - dealtCount * 4}
											/>
										) : openingDoubleSix ? (
											'Sale el doble 6'
										) : (
											'Toca una ficha'
										)}
									</div>
								) : (
									<FitBoard
										width={boardPath.width}
										height={boardPath.height}
										anchorY={boardPath.anchorY}
									>
										{boardPath.tiles.map((placed) => {
											const capicuaStyle: StyleVars | null =
												capicuaHold && arrivingId === placed.tile.id
													? {
															['--capi-x']: `${(leftPlacedEnd?.x ?? placed.x) - placed.x}px`,
															['--capi-y']: `${(leftPlacedEnd?.y ?? placed.y) - placed.y}px`,
															['--cua-x']: `${(rightPlacedEnd?.x ?? placed.x) - placed.x}px`,
															['--cua-y']: `${(rightPlacedEnd?.y ?? placed.y) - placed.y}px`,
														}
													: null;

											return (
											<div
												key={placed.key}
												className={`absolute ${
													arrivingId === placed.tile.id
														? `tile-arrive tile-arrive-${arriveFrom}${
																capicuaHold ? ' tile-capicua' : ''
															}`
														: ''
												}`}
												style={{
													left: placed.x,
													top: placed.y,
													...capicuaStyle,
												}}
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
											);
										})}
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
								<SideTiles
									tiles={rightOpponent.hand}
									axis='vertical'
									visible={dealing ? dealtCount : undefined}
								/>
								<span className='text-[8px] text-white/70'>
									{getDisplayScore(game, otherTeam)}
								</span>
							</div>
						</div>

						<div className='flex shrink-0 flex-col items-center gap-1 px-2 pb-1.5 landscape:pb-1 landscape:gap-0.5'>
							{peekTable && (
								<button
									type='button'
									onClick={() => setPeekTable(false)}
									className='action-btn'
								>
									Resultado
								</button>
							)}
							{myTurn && !peekTable && !game.roundComplete && !dealing && (
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
							{selectedTile &&
								leftEnd !== null &&
								rightEnd !== null &&
								!peekTable &&
								!game.roundComplete && (
								<div className='flex items-center gap-3'>
									<button
										type='button'
										onClick={() => playAutomatically(selectedTile, 'left')}
										className='side-pick'
									>
										{leftEnd}
									</button>
									<button
										type='button'
										onClick={() => playAutomatically(selectedTile, 'right')}
										className='side-pick'
									>
										{rightEnd}
									</button>
								</div>
							)}
							{myTurn && !canHumanPlay && !peekTable && !game.roundComplete && !dealing && (
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
									{myPlayer.hand.slice(0, dealtCount).map((tile, index) => {
										const playable =
											!dealing &&
											(!myTurn ||
												isPlayable(tile, game.board, openingDoubleSix));
										const lifting = lift?.index === index;
										const arriving = !dealReady;

										return (
											<div
												key={tile.id}
												className={`hand-tile-slot cursor-grab active:cursor-grabbing ${
													lifting ? 'is-lifting' : ''
												} ${arriving ? 'tile-deal' : ''}`}
												style={
													lifting && lift
														? {
																transform: `translate(${lift.dx}px, ${lift.dy - 16}px) scale(1.08) rotate(-4deg)`,
															}
														: arriving
															? ({
																	['--deal-rot']: `${index % 2 === 0 ? -14 : 12}deg`,
																} as StyleVars)
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

function bonusLabel(bonus: BonusType) {
	if (bonus === 'salida') {
		return 'salida';
	}

	if (bonus === 'pase-corrido') {
		return 'pase corrido';
	}

	return 'capicúa';
}

function PointsBreakdown({
	result,
}: {
	result: {
		normalPoints: number;
		bonuses: BonusType[];
		totalPoints: number;
	};
}) {
	return (
		<div className='mt-2 space-y-0.5 text-left text-[12px]'>
			<div className='flex items-center justify-between gap-3 text-emerald-50/85'>
				<span>Fichas</span>
				<span>+{result.normalPoints}</span>
			</div>
			{result.bonuses.map((bonus, index) => (
				<div
					key={`${bonus}-${index}`}
					className='flex items-center justify-between gap-3 text-yellow-100/90'
				>
					<span>{bonusLabel(bonus)}</span>
					<span>+30</span>
				</div>
			))}
			<div className='flex items-center justify-between gap-3 font-semibold text-yellow-200'>
				<span>Total</span>
				<span>+{result.totalPoints}</span>
			</div>
		</div>
	);
}

function BonusBurst({
	playerIndex,
	mySeat,
	type,
	playerName,
}: {
	playerIndex: number;
	mySeat: number;
	type: BonusType;
	playerName: string;
}) {
	const relative = (((playerIndex - mySeat) % 4) + 4) % 4;
	const spot =
		relative === 0
			? 'bottom-14 left-1/2 -translate-x-1/2'
			: relative === 1
				? 'right-3 top-1/2 -translate-y-1/2'
				: relative === 2
					? 'top-12 left-1/2 -translate-x-1/2'
					: 'left-3 top-1/2 -translate-y-1/2';
	const label =
		type === 'salida'
			? 'salida'
			: type === 'pase-corrido'
				? 'pase corrido'
				: 'capicúa';

	return (
		<div className={`bonus-burst pointer-events-none absolute z-20 ${spot}`}>
			<p className='text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-100/80'>
				{playerName}
			</p>
			<p className='text-center text-5xl font-black leading-none text-yellow-300 drop-shadow-md'>
				+30
			</p>
			<p className='text-center text-[11px] text-yellow-50/90'>{label}</p>
		</div>
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

		const update = () => {
			const availW = Math.max(outer.clientWidth - 8, 1);
			const availH = Math.max(outer.clientHeight - 8, 1);
			const scale = Math.min(1, availW / width, availH / height);
			const nextScale = Number.isFinite(scale) ? scale : 1;
			const left = Math.round((outer.clientWidth - width * nextScale) / 2);
			const top = Math.round(
				outer.clientHeight / 2 - (anchorY + 10) * nextScale,
			);

			setView({ scale: nextScale, left, top });
		};

		update();

		const observer = new ResizeObserver(update);
		observer.observe(outer);
		window.addEventListener('orientationchange', update);

		return () => {
			observer.disconnect();
			window.removeEventListener('orientationchange', update);
		};
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
					transform:
						view.scale === 1 ? undefined : `scale(${view.scale})`,
					transformOrigin: 'top left',
				}}
			>
				{children}
			</div>
		</div>
	);
}

function seatSpot(relative: number) {
	if (relative === 0) {
		return 'bottom-16 left-1/2 -translate-x-1/2';
	}

	if (relative === 1) {
		return 'right-4 top-1/2 -translate-y-1/2';
	}

	if (relative === 2) {
		return 'top-10 left-1/2 -translate-x-1/2';
	}

	return 'left-4 top-1/2 -translate-y-1/2';
}

function TurnArrow({
	relative,
	className,
}: {
	relative: number;
	className?: string;
}) {
	const rotation =
		relative === 0
			? 'rotate-180'
			: relative === 1
				? 'rotate-90'
				: relative === 3
					? '-rotate-90'
					: '';

	return (
		<svg
			viewBox='0 0 24 24'
			className={`${className ?? 'h-8 w-8'} ${rotation}`}
			fill='currentColor'
			aria-hidden
		>
			<path d='M12 4l8 12H4z' />
		</svg>
	);
}

function PassCallout({
	seat,
	nextSeat,
	mySeat,
}: {
	seat: number;
	nextSeat: number;
	mySeat: number;
}) {
	const passRel = (((seat - mySeat) % 4) + 4) % 4;
	const nextRel = (((nextSeat - mySeat) % 4) + 4) % 4;
	const nudge: StyleVars =
		passRel === 0
			? { ['--nudge-x']: '5px', ['--nudge-y']: '0px' }
			: passRel === 1
				? { ['--nudge-x']: '0px', ['--nudge-y']: '-5px' }
				: passRel === 2
					? { ['--nudge-x']: '-5px', ['--nudge-y']: '0px' }
					: { ['--nudge-x']: '0px', ['--nudge-y']: '5px' };

	return (
		<>
			<div
				className={`paso-tag pointer-events-none absolute z-20 ${seatSpot(passRel)}`}
			>
				Paso
				<span className='paso-tag-arrow' style={nudge}>
					<TurnArrow relative={(passRel + 1) % 4} className='h-3.5 w-3.5' />
				</span>
			</div>
			<div
				className={`turn-arrow pointer-events-none absolute z-20 ${seatSpot(nextRel)}`}
			>
				<TurnArrow relative={nextRel} />
			</div>
		</>
	);
}

function DealPile({ remaining }: { remaining: number }) {
	const shown = Math.min(5, Math.max(0, remaining));

	if (shown === 0) {
		return null;
	}

	return (
		<div className='deal-pile relative h-14 w-10'>
			{Array.from({ length: shown }, (_, index) => (
				<div
					key={index}
					className='absolute left-1/2 top-1/2'
					style={{
						transform: `translate(-50%, -50%) translate(${index}px, ${-index * 1.5}px) rotate(${index * 4 - 8}deg)`,
					}}
				>
					<Domino
						faceDown
						size='mini'
						orientation='hand'
						disabled
						playable
					/>
				</div>
			))}
		</div>
	);
}

function SideTiles({
	tiles,
	axis,
	visible,
}: {
	tiles: Tile[];
	axis: 'horizontal' | 'vertical';
	visible?: number;
}) {
	const shown = visible == null ? tiles : tiles.slice(0, visible);

	return (
		<div
			className={`flex items-center justify-center ${
				axis === 'vertical' ? 'flex-col' : 'flex-row'
			}`}
		>
			{shown.map((tile) => (
				<div key={tile.id} className='tile-deal-mini'>
					<Domino
						faceDown
						size='mini'
						orientation={axis === 'vertical' ? 'hand' : 'board'}
						disabled
						playable
					/>
				</div>
			))}
		</div>
	);
}
