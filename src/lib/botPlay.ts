import {
	GameState,
	getLeftEnd,
	getRightEnd,
	isPlayable,
	mustOpenWithDoubleSix,
} from '@/lib/dominoes';

export const BOT_THINK_MS = 2000;

export type BotMove =
	| { type: 'pass' }
	| { type: 'play'; tileId: string; side: 'left' | 'right' };

export function chooseBotMove(game: GameState): BotMove {
	const bot = game.players[game.currentPlayer];
	const playableTile = bot.hand.find((tile) =>
		isPlayable(tile, game.board, mustOpenWithDoubleSix(game)),
	);

	if (!playableTile) {
		return { type: 'pass' };
	}

	let side: 'left' | 'right' = 'right';

	if (game.board.length > 0) {
		const leftEnd = getLeftEnd(game.board);
		const rightEnd = getRightEnd(game.board);
		const canLeft =
			playableTile.a === leftEnd || playableTile.b === leftEnd;
		const canRight =
			playableTile.a === rightEnd || playableTile.b === rightEnd;

		if (canLeft && !canRight) {
			side = 'left';
		} else {
			side = 'right';
		}
	}

	return { type: 'play', tileId: playableTile.id, side };
}
