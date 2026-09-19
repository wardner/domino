export type Team = 0 | 1;

export type Tile = {
	id: string;
	a: number;
	b: number;
};

export type BoardTile = {
	tile: Tile;

	/*
	 * Se conserva por compatibilidad con el resto
	 * del proyecto, pero YA NO se usa para rotar
	 * visualmente la ficha.
	 *
	 * El tile guardado en el board siempre está
	 * orientado en el sentido de izquierda -> derecha
	 * de ese tramo de la mesa.
	 */
	flipped: boolean;
};

export type Player = {
	id: string;
	name: string;
	hand: Tile[];
};

export type BonusType = 'salida' | 'pase-corrido' | 'capicua';

export type ScoringPlayer = {
	playerIndex: number;
	playerName: string;
	team: Team;
	tiles: Tile[];
	points: number;
};

export type RoundResult = {
	winnerPlayer: number;
	winnerTeam: Team;

	normalPoints: number;
	bonusPoints: number;

	bonuses: BonusType[];

	tranca: boolean;
	trancador: number | null;

	scoringPlayers: ScoringPlayer[];

	totalPoints: number;

	matchComplete: boolean;

	finalScores: [number, number];
};

export type GameState = {
	players: Player[];

	board: BoardTile[];

	currentPlayer: number;

	round: number;

	roundStarter: number;

	roundComplete: boolean;

	matchComplete: boolean;

	winnerTeam: Team | null;

	winnerPlayer: number | null;

	normalScores: [number, number];

	bonusScores: [number, number];

	passStreak: number;

	lastPlayerToPlay: number | null;

	firstMoveMade: boolean;

	openingTileId: string | null;

	openingPassPending: boolean;

	roundBonuses: BonusType[];

	roundResult: RoundResult | null;
};

export function createTiles(): Tile[] {
	const tiles: Tile[] = [];

	for (let a = 0; a <= 6; a++) {
		for (let b = a; b <= 6; b++) {
			tiles.push({
				id: `${a}-${b}`,
				a,
				b,
			});
		}
	}

	return tiles;
}

export function shuffle<T>(items: T[]): T[] {
	const result = [...items];

	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));

		[result[i], result[j]] = [result[j], result[i]];
	}

	return result;
}

export function teamOfPlayer(playerIndex: number): Team {
	return playerIndex % 2 === 0 ? 0 : 1;
}

export function nextPlayer(playerIndex: number): number {
	return (playerIndex + 1) % 4;
}

export function rightPlayer(playerIndex: number): number {
	return nextPlayer(playerIndex);
}

function createPlayers(names: string[], deck: Tile[]): Player[] {
	return names.map((name, index) => ({
		id: `player-${index}`,
		name,
		hand: deck.slice(index * 7, index * 7 + 7),
	}));
}

function findDoubleSixPlayer(players: Player[]): number {
	const playerIndex = players.findIndex((player) =>
		player.hand.some((tile) => tile.a === 6 && tile.b === 6),
	);

	if (playerIndex === -1) {
		throw new Error('No se encontró el doble 6');
	}

	return playerIndex;
}

function createRound(
	names: string[],
	round: number,
	starter: number,
	normalScores: [number, number],
	bonusScores: [number, number],
): GameState {
	const deck = shuffle(createTiles());

	const players = createPlayers(names, deck);

	return {
		players,

		board: [],

		currentPlayer: starter,

		round,

		roundStarter: starter,

		roundComplete: false,

		matchComplete: false,

		winnerTeam: null,

		winnerPlayer: null,

		normalScores,

		bonusScores,

		passStreak: 0,

		lastPlayerToPlay: null,

		firstMoveMade: false,

		openingTileId: null,

		openingPassPending: false,

		roundBonuses: [],

		roundResult: null,
	};
}

export function createGame(playerNames: string[]): GameState {
	if (playerNames.length !== 4) {
		throw new Error('El juego necesita 4 jugadores');
	}

	const deck = shuffle(createTiles());

	const players = createPlayers(playerNames, deck);

	/*
	 * Primera mano:
	 * comienza quien tenga doble 6.
	 */
	const starter = findDoubleSixPlayer(players);

	return {
		players,

		board: [],

		currentPlayer: starter,

		round: 1,

		roundStarter: starter,

		roundComplete: false,

		matchComplete: false,

		winnerTeam: null,

		winnerPlayer: null,

		normalScores: [0, 0],

		bonusScores: [0, 0],

		passStreak: 0,

		lastPlayerToPlay: null,

		firstMoveMade: false,

		openingTileId: null,

		openingPassPending: false,

		roundBonuses: [],

		roundResult: null,
	};
}

function tile(a: number, b: number, orientedA = a, orientedB = b): Tile {
	return {
		id: a <= b ? `${a}-${b}` : `${b}-${a}`,
		a: orientedA,
		b: orientedB,
	};
}

/*
 * Mano lista para tirar capicúa:
 * mesa 2 | … | 5 y última ficha 2-5.
 */
export function createCapicuaDemoGame(playerNames: string[]): GameState {
	return {
		players: [
			{
				id: 'player-0',
				name: playerNames[0],
				hand: [tile(2, 5)],
			},
			{
				id: 'player-1',
				name: playerNames[1],
				hand: [tile(1, 1), tile(1, 3), tile(3, 3)],
			},
			{
				id: 'player-2',
				name: playerNames[2],
				hand: [tile(0, 1), tile(2, 2), tile(4, 4)],
			},
			{
				id: 'player-3',
				name: playerNames[3],
				hand: [tile(0, 3), tile(1, 4), tile(2, 4)],
			},
		],
		board: [
			{ tile: tile(2, 0, 2, 0), flipped: false },
			{ tile: tile(0, 0), flipped: false },
			{ tile: tile(0, 4, 0, 4), flipped: false },
			{ tile: tile(4, 6, 4, 6), flipped: false },
			{ tile: tile(6, 6), flipped: false },
			{ tile: tile(3, 6, 6, 3), flipped: false },
			{ tile: tile(3, 5, 3, 5), flipped: false },
		],
		currentPlayer: 0,
		round: 1,
		roundStarter: 0,
		roundComplete: false,
		matchComplete: false,
		winnerTeam: null,
		winnerPlayer: null,
		normalScores: [169, 151],
		bonusScores: [0, 0],
		passStreak: 0,
		lastPlayerToPlay: 2,
		firstMoveMade: true,
		openingTileId: '6-6',
		openingPassPending: false,
		roundBonuses: [],
		roundResult: null,
	};
}

export function createMatchWonDemoGame(playerNames: string[]): GameState {
	return playTile(createCapicuaDemoGame(playerNames), '2-5', 'right');
}

/*
 * Mano lista para trancar:
 * mesa 3 | … | 4 y ficha 4-0.
 * Al tirarla nadie tiene 3 ni 0.
 */
export function createTrancaDemoGame(playerNames: string[]): GameState {
	return {
		players: [
			{
				id: 'player-0',
				name: playerNames[0],
				hand: [tile(4, 0), tile(2, 2), tile(5, 5)],
			},
			{
				id: 'player-1',
				name: playerNames[1],
				hand: [tile(2, 5), tile(5, 6), tile(2, 6)],
			},
			{
				id: 'player-2',
				name: playerNames[2],
				hand: [tile(6, 6), tile(4, 6)],
			},
			{
				id: 'player-3',
				name: playerNames[3],
				hand: [tile(2, 4), tile(4, 5)],
			},
		],
		board: [
			{ tile: tile(3, 1, 3, 1), flipped: false },
			{ tile: tile(1, 1), flipped: false },
			{ tile: tile(1, 4, 1, 4), flipped: false },
		],
		currentPlayer: 0,
		round: 1,
		roundStarter: 0,
		roundComplete: false,
		matchComplete: false,
		winnerTeam: null,
		winnerPlayer: null,
		normalScores: [40, 30],
		bonusScores: [0, 0],
		passStreak: 0,
		lastPlayerToPlay: 2,
		firstMoveMade: true,
		openingTileId: '1-1',
		openingPassPending: false,
		roundBonuses: [],
		roundResult: null,
	};
}

export function startNextRound(state: GameState): GameState {
	if (!state.roundComplete) {
		throw new Error('La mano todavía no ha terminado');
	}

	if (state.matchComplete) {
		throw new Error('La partida completa ya terminó');
	}

	if (state.winnerPlayer === null) {
		throw new Error('No hay ganador de la mano');
	}

	const names = state.players.map((player) => player.name);

	/*
	 * El ganador de la mano siempre sale.
	 * Es específicamente quien hizo la jugada ganadora.
	 */
	return createRound(
		names,
		state.round + 1,
		state.winnerPlayer,
		state.normalScores,
		state.bonusScores,
	);
}

export function startNewMatch(state: GameState): GameState {
	const names = state.players.map((player) => player.name);

	/*
	 * Nueva partida completamente desde cero.
	 *
	 * Se vuelve a buscar el doble 6.
	 */
	return createGame(names);
}

export function getTeamTotal(state: GameState, team: Team): number {
	return state.normalScores[team] + state.bonusScores[team];
}

export function getLeftEnd(board: BoardTile[]): number {
	if (board.length === 0) {
		throw new Error('El tablero está vacío');
	}

	/*
	 * IMPORTANTE:
	 *
	 * Los BoardTile ahora siempre están guardados
	 * visualmente en orden.
	 *
	 * Por eso no rotamos ni invertimos la ficha.
	 */
	return board[0].tile.a;
}

export function getRightEnd(board: BoardTile[]): number {
	if (board.length === 0) {
		throw new Error('El tablero está vacío');
	}

	return board[board.length - 1].tile.b;
}

/*
 * En las filas impares la mesa va en serpiente
 * (derecha -> izquierda).
 *
 * flex-row-reverse solo cambia el orden de las
 * fichas, no el lado a/b de cada una.
 *
 * Si no espejamos la ficha, un 5-3 pegado a un
 * 5-1 se ve desconectado y parece trampa.
 */
export function getVisualTile(tile: Tile, snakeReversed: boolean): Tile {
	if (!snakeReversed || tile.a === tile.b) {
		return tile;
	}

	return {
		...tile,
		a: tile.b,
		b: tile.a,
	};
}

export function canPlayLeft(tile: Tile, board: BoardTile[]): boolean {
	if (board.length === 0) {
		return false;
	}

	const left = getLeftEnd(board);

	return tile.a === left || tile.b === left;
}

export function canPlayRight(tile: Tile, board: BoardTile[]): boolean {
	if (board.length === 0) {
		return false;
	}

	const right = getRightEnd(board);

	return tile.a === right || tile.b === right;
}

export function mustOpenWithDoubleSix(state: {
	round: number;
	board: BoardTile[];
}): boolean {
	return state.round === 1 && state.board.length === 0;
}

export function isDoubleSix(tile: Tile): boolean {
	return tile.a === 6 && tile.b === 6;
}

export function isPlayable(
	tile: Tile,
	board: BoardTile[],
	requireDoubleSix = false,
): boolean {
	if (board.length === 0) {
		return requireDoubleSix ? isDoubleSix(tile) : true;
	}

	return canPlayLeft(tile, board) || canPlayRight(tile, board);
}

export function hasPlayableTile(
	player: Player,
	board: BoardTile[],
	requireDoubleSix = false,
): boolean {
	return player.hand.some((tile) => isPlayable(tile, board, requireDoubleSix));
}

function isGameBlocked(state: GameState): boolean {
	if (state.board.length === 0) {
		return false;
	}

	return state.players.every(
		(player) => !hasPlayableTile(player, state.board),
	);
}

function resolveTranca(state: GameState): GameState {
	const trancador = state.lastPlayerToPlay;

	if (trancador === null) {
		throw new Error('No se pudo determinar el trancador');
	}

	/*
	 * Se compara el trancador contra
	 * el jugador inmediatamente a su derecha.
	 */
	const opponent = rightPlayer(trancador);

	const trancadorPoints = playerHandPoints(state.players[trancador]);

	const opponentPoints = playerHandPoints(state.players[opponent]);

	/*
	 * Empate:
	 * gana el trancador.
	 *
	 * Solo pierde el trancador si tiene
	 * MÁS tantos que el contrario.
	 */
	const trancaWinner =
		trancadorPoints <= opponentPoints ? trancador : opponent;

	return finishRound(state, trancaWinner, true, trancador);
}

export function reorderHand(
	state: GameState,
	playerIndex: number,
	fromIndex: number,
	toIndex: number,
): GameState {
	if (
		fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex >= state.players[playerIndex].hand.length ||
		toIndex >= state.players[playerIndex].hand.length
	) {
		return state;
	}

	const players = state.players.map((player, index) => {
		if (index !== playerIndex) {
			return player;
		}

		const hand = [...player.hand];

		const [moved] = hand.splice(fromIndex, 1);

		if (!moved) {
			return player;
		}

		hand.splice(toIndex, 0, moved);

		return {
			...player,
			hand,
		};
	});

	return {
		...state,
		players,
	};
}

function addBonus(
	state: GameState,
	playerIndex: number,
	type: BonusType,
): GameState {
	const team = teamOfPlayer(playerIndex);

	const currentTotal = getTeamTotal(state, team);

	/*
	 * Los bonus de 30 no pueden hacer que
	 * el marcador pase de 200.
	 *
	 * Si no caben, se cancelan.
	 */
	if (currentTotal + 30 > 200) {
		return state;
	}

	const bonusScores: [number, number] = [...state.bonusScores];

	bonusScores[team] += 30;

	return {
		...state,

		bonusScores,

		roundBonuses: [...state.roundBonuses, type],
	};
}

function getTilePoints(tile: Tile): number {
	return tile.a + tile.b;
}

function calculateScoringPlayers(players: Player[]): ScoringPlayer[] {
	return players
		.map((player, playerIndex) => {
			const tiles = player.hand;

			const points = tiles.reduce(
				(total, tile) => total + getTilePoints(tile),
				0,
			);

			return {
				playerIndex,

				playerName: player.name,

				team: teamOfPlayer(playerIndex),

				tiles: [...tiles],

				points,
			};
		})
		.filter((player) => player.tiles.length > 0);
}

function finishRound(
	state: GameState,
	winnerPlayer: number,
	tranca: boolean,
	trancador: number | null,
): GameState {
	const winnerTeam = teamOfPlayer(winnerPlayer);

	/*
	 * Se cuentan TODAS las fichas que quedaron
	 * sin jugar.
	 *
	 * En una victoria normal:
	 * la ficha con la que ganó ya salió de su mano.
	 *
	 * En una tranca:
	 * también se cuentan las fichas del trancador.
	 */
	const scoringPlayers = calculateScoringPlayers(state.players);

	const normalPoints = scoringPlayers.reduce(
		(total, player) => total + player.points,
		0,
	);

	const normalScores: [number, number] = [...state.normalScores];

	normalScores[winnerTeam] += normalPoints;

	const bonusPoints = state.roundBonuses.length * 30;

	const totalPoints = normalPoints + bonusPoints;

	const finalScores: [number, number] = [
		normalScores[0] + state.bonusScores[0],
		normalScores[1] + state.bonusScores[1],
	];

	const matchComplete = finalScores[winnerTeam] >= 200;

	const result: RoundResult = {
		winnerPlayer,

		winnerTeam,

		normalPoints,

		bonusPoints,

		bonuses: state.roundBonuses,

		tranca,

		trancador,

		scoringPlayers,

		totalPoints,

		matchComplete,

		finalScores,
	};

	return {
		...state,

		normalScores,

		roundComplete: true,

		matchComplete,

		winnerTeam: matchComplete ? winnerTeam : null,

		winnerPlayer,

		roundResult: result,
	};
}

function orientTileForLeft(tile: Tile, leftEnd: number): Tile {
	/*
	 * Para colocar a la izquierda:
	 *
	 * izquierda <- derecha
	 *
	 * el lado derecho de la ficha debe conectar
	 * con el extremo izquierdo actual.
	 *
	 * Guardamos la ficha ya orientada para que
	 * la UI NO tenga que rotarla.
	 */
	if (tile.b === leftEnd) {
		return {
			...tile,
			a: tile.a,
			b: tile.b,
		};
	}

	if (tile.a === leftEnd) {
		return {
			...tile,
			a: tile.b,
			b: tile.a,
		};
	}

	throw new Error('Ese domino no conecta a la izquierda');
}

function orientTileForRight(tile: Tile, rightEnd: number): Tile {
	/*
	 * Para colocar a la derecha:
	 *
	 * izquierda -> derecha
	 *
	 * el lado izquierdo de la ficha debe conectar
	 * con el extremo derecho actual.
	 */
	if (tile.a === rightEnd) {
		return {
			...tile,
			a: tile.a,
			b: tile.b,
		};
	}

	if (tile.b === rightEnd) {
		return {
			...tile,
			a: tile.b,
			b: tile.a,
		};
	}

	throw new Error('Ese domino no conecta a la derecha');
}

export function playTile(
	state: GameState,
	tileId: string,
	side: 'left' | 'right',
): GameState {
	if (state.roundComplete) {
		throw new Error('La mano ya terminó');
	}

	const player = state.players[state.currentPlayer];

	const tileIndex = player.hand.findIndex((tile) => tile.id === tileId);

	if (tileIndex === -1) {
		throw new Error('El jugador no tiene ese domino');
	}

	const tile = player.hand[tileIndex];

	if (!isPlayable(tile, state.board, mustOpenWithDoubleSix(state))) {
		throw new Error(
			mustOpenWithDoubleSix(state)
				? 'La partida sale con doble 6'
				: 'Ese domino no se puede jugar',
		);
	}

	const canLeft = canPlayLeft(tile, state.board);
	const canRight = canPlayRight(tile, state.board);

	let boardTile: BoardTile;

	if (state.board.length === 0) {
		boardTile = {
			tile: {
				...tile,
			},

			flipped: false,
		};
	} else if (side === 'left') {
		const leftEnd = getLeftEnd(state.board);

		if (!canLeft) {
			throw new Error('Ese domino no conecta a la izquierda');
		}

		boardTile = {
			tile: orientTileForLeft(tile, leftEnd),

			flipped: false,
		};
	} else {
		const rightEnd = getRightEnd(state.board);

		if (!canRight) {
			throw new Error('Ese domino no conecta a la derecha');
		}

		boardTile = {
			tile: orientTileForRight(tile, rightEnd),

			flipped: false,
		};
	}

	const newHand = player.hand.filter((_, index) => index !== tileIndex);

	const players = state.players.map((currentPlayer, index) =>
		index === state.currentPlayer
			? {
					...currentPlayer,
					hand: newHand,
				}
			: currentPlayer,
	);

	const board =
		state.board.length === 0 || side === 'right'
			? [...state.board, boardTile]
			: [boardTile, ...state.board];

	let nextState: GameState = {
		...state,

		players,

		board,

		currentPlayer: nextPlayer(state.currentPlayer),

		passStreak: 0,

		lastPlayerToPlay: state.currentPlayer,

		firstMoveMade: true,

		openingTileId: state.openingTileId ?? tile.id,

		openingPassPending: false,
	};

	/*
	 * SALIDA:
	 *
	 * Sale el jugador inicial.
	 * Si el siguiente jugador pasa y el frente
	 * puede jugar, el frente recibe +30.
	 */
	if (
		state.openingPassPending &&
		state.currentPlayer === nextPlayer(nextPlayer(state.roundStarter))
	) {
		nextState = addBonus(nextState, state.currentPlayer, 'salida');
	}

	/*
	 * CAPICÚA:
	 *
	 * La ficha ganadora (nunca un doble)
	 * tiene que poder ir en las DOS puntas,
	 * y esas puntas tienen que ser distintas.
	 *
	 * Si ambos lados son 6, un 6-0 no es
	 * capicúa: solo encaja el 6.
	 */
	const isWinningMove = newHand.length === 0;

	const isDouble = tile.a === tile.b;

	const leftEnd = state.board.length > 0 ? getLeftEnd(state.board) : null;
	const rightEnd = state.board.length > 0 ? getRightEnd(state.board) : null;

	const isCapicua =
		isWinningMove &&
		!isDouble &&
		leftEnd !== null &&
		rightEnd !== null &&
		leftEnd !== rightEnd &&
		canLeft &&
		canRight;

	if (isCapicua) {
		nextState = addBonus(nextState, state.currentPlayer, 'capicua');
	}

	if (isWinningMove) {
		return finishRound(nextState, state.currentPlayer, false, null);
	}

	/*
	 * TRANCA:
	 *
	 * Si nadie puede jugar después de esta
	 * ficha, la mano termina de una.
	 *
	 * No se espera a los pases ni se da
	 * pase corrido.
	 */
	if (isGameBlocked(nextState)) {
		return resolveTranca(nextState);
	}

	return nextState;
}

export function passTurn(state: GameState): GameState {
	if (state.roundComplete) {
		throw new Error('La mano ya terminó');
	}

	const player = state.players[state.currentPlayer];

	if (hasPlayableTile(player, state.board)) {
		throw new Error('No puedes pasar si tienes una ficha jugable');
	}

	const nextPassStreak = state.passStreak + 1;

	const openingPlayer = state.roundStarter;

	const playerAfterOpening = nextPlayer(openingPlayer);

	const isOpeningPass =
		state.firstMoveMade &&
		state.board.length === 1 &&
		state.currentPlayer === playerAfterOpening;

	let nextState: GameState = {
		...state,

		currentPlayer: nextPlayer(state.currentPlayer),

		passStreak: nextPassStreak,
	};

	if (isOpeningPass) {
		nextState = {
			...nextState,

			openingPassPending: true,
		};
	}

	const openingFront = nextPlayer(nextPlayer(openingPlayer));

	if (state.openingPassPending && state.currentPlayer === openingFront) {
		nextState = {
			...nextState,

			openingPassPending: false,
		};
	}

	/*
	 * TRANCA:
	 *
	 * Si nadie puede conectar, no es pase
	 * corrido: se cuenta de una.
	 */
	if (isGameBlocked(state)) {
		return resolveTranca(nextState);
	}

	/*
	 * PASE CORRIDO:
	 *
	 * Después de la jugada:
	 * jugador 1 pasa
	 * jugador 2 pasa
	 * jugador 3 pasa
	 *
	 * Solo aplica si el que tiró todavía
	 * puede jugar. Si también está trabado
	 * es tranca, no bonus.
	 *
	 * Los 30 corresponden al jugador
	 * que hizo la última jugada.
	 */
	if (nextPassStreak === 3 && state.lastPlayerToPlay !== null) {
		const lastPlayer = state.players[state.lastPlayerToPlay];

		if (hasPlayableTile(lastPlayer, state.board)) {
			nextState = addBonus(nextState, state.lastPlayerToPlay, 'pase-corrido');
		}
	}

	if (nextPassStreak >= 4) {
		return resolveTranca(nextState);
	}

	return nextState;
}

export function playerHandPoints(player: Player): number {
	return player.hand.reduce((total, tile) => total + tile.a + tile.b, 0);
}

export function getDisplayScore(state: GameState, team: Team): number {
	return getTeamTotal(state, team);
}
