'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import GameTable from '@/components/GameTable';
import MainMenu from '@/components/MainMenu';
import {
	createCapicuaDemoGame,
	createGame,
	createMatchWonDemoGame,
	createTrancaDemoGame,
	GameState,
	passTurn,
	playTile,
	reorderHand,
	startNewMatch,
	startNextRound,
} from '@/lib/dominoes';
import {
	getOrCreatePlayerId,
	readStoredName,
	storeName,
} from '@/lib/playerSession';

const BOT_NAMES = ['Tú', 'Jugador 2', 'Jugador 3', 'Jugador 4'];

export default function Home() {
	const router = useRouter();
	const [playerId, setPlayerId] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [joinCode, setJoinCode] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [localGame, setLocalGame] = useState<GameState | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		setPlayerId(getOrCreatePlayerId());
		setName(readStoredName());
		setReady(true);

		const params = new URLSearchParams(window.location.search);

		if (params.has('partida')) {
			setLocalGame(createMatchWonDemoGame(BOT_NAMES));
			return;
		}

		if (params.has('capicua')) {
			setLocalGame(createCapicuaDemoGame(BOT_NAMES));
			return;
		}

		if (params.has('tranca')) {
			setLocalGame(createTrancaDemoGame(BOT_NAMES));
		}
	}, []);

	function startBots() {
		setError(null);
		setLocalGame(createGame(BOT_NAMES));
	}

	async function createRoom() {
		const clean = name.trim();
		const id = playerId ?? getOrCreatePlayerId();

		if (!clean) {
			setError('Escribe tu nombre');
			return;
		}

		setPlayerId(id);
		storeName(clean);
		setBusy(true);
		setError(null);

		try {
			const response = await fetch('/api/rooms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ playerId: id, name: clean }),
			});
			const data = (await response.json().catch(() => ({}))) as {
				room?: { code: string };
				error?: string;
			};

			if (!response.ok || !data.room) {
				throw new Error(data.error ?? `No se pudo crear la sala (${response.status})`);
			}

			router.push(`/sala/${data.room.code}`);
		} catch (err) {
			setError(
				err instanceof Error && err.message === 'Failed to fetch'
					? 'El celular no pudo hablar con el server. Recarga y usa la IP de la PC, no localhost.'
					: err instanceof Error
						? err.message
						: 'No se pudo crear la sala',
			);
		} finally {
			setBusy(false);
		}
	}

	function joinRoom() {
		const clean = name.trim();
		const code = joinCode.trim().toUpperCase();

		if (!clean) {
			setError('Escribe tu nombre');
			return;
		}

		if (code.length < 4) {
			setError('Escribe el código de la sala');
			return;
		}

		storeName(clean);
		router.push(`/sala/${code}`);
	}

	if (localGame) {
		return (
			<GameTable
				game={localGame}
				mySeat={0}
				autoBots
				onPlay={(tileId, side) => {
					try {
						setLocalGame(playTile(localGame, tileId, side));
					} catch (err) {
						console.error(err);
					}
				}}
				onPass={() => {
					try {
						setLocalGame(passTurn(localGame));
					} catch (err) {
						console.error(err);
					}
				}}
				onNextRound={() => setLocalGame(startNextRound(localGame))}
				onNewMatch={() => setLocalGame(startNewMatch(localGame))}
				onReorder={(from, to) =>
					setLocalGame(reorderHand(localGame, 0, from, to))
				}
				onReset={() => setLocalGame(createGame(BOT_NAMES))}
				onLeave={() => setLocalGame(null)}
			/>
		);
	}

	if (!ready) {
		return (
			<main
				className='felt-page flex min-h-dvh items-center justify-center p-4 text-[#f4e6c3]'
				suppressHydrationWarning
			>
				<div className='w-full max-w-sm rounded-2xl bg-black/35 p-4' />
			</main>
		);
	}

	return (
		<MainMenu
			name={name}
			joinCode={joinCode}
			error={error}
			busy={busy}
			onNameChange={setName}
			onJoinCodeChange={setJoinCode}
			onCreate={createRoom}
			onJoin={joinRoom}
			onBots={startBots}
		/>
	);
}
