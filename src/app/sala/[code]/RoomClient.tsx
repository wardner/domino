'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import GameTable from '@/components/GameTable';
import Lobby from '@/components/Lobby';
import {
	getOrCreatePlayerId,
	readStoredName,
	storeName,
} from '@/lib/playerSession';
import { PublicRoom, RoomAction } from '@/lib/roomTypes';

async function postRoomAction(code: string, action: RoomAction) {
	const response = await fetch(`/api/rooms/${code}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(action),
	});
	const data = (await response.json()) as {
		room?: PublicRoom;
		error?: string;
	};

	if (!response.ok || !data.room) {
		throw new Error(data.error ?? 'No se pudo actualizar la sala');
	}

	return data.room;
}

export default function RoomClient({ code }: { code: string }) {
	const router = useRouter();
	const [playerId, setPlayerId] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [room, setRoom] = useState<PublicRoom | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [fillBots, setFillBots] = useState(false);
	const [sessionReady, setSessionReady] = useState(false);

	useEffect(() => {
		setPlayerId(getOrCreatePlayerId());
		setName(readStoredName());
		setSessionReady(true);
	}, []);

	useEffect(() => {
		if (!playerId) {
			return;
		}

		const source = new EventSource(
			`/api/rooms/${code}/events?playerId=${playerId}`,
		);

		source.onmessage = (event) => {
			const payload = JSON.parse(event.data) as { room: PublicRoom };
			setRoom(payload.room);
		};

		return () => {
			source.close();
		};
	}, [code, playerId]);

	useEffect(() => {
		if (!playerId) {
			return;
		}

		const storedName = readStoredName();

		if (!storedName) {
			return;
		}

		let cancelled = false;

		postRoomAction(code, {
			action: 'join',
			playerId,
			name: storedName,
		})
			.then((next) => {
				if (!cancelled) {
					setRoom(next);
					setError(null);
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'No se pudo entrar');
				}
			});

		return () => {
			cancelled = true;
		};
	}, [code, playerId]);

	async function run(action: RoomAction) {
		if (!playerId) {
			return;
		}

		setBusy(true);
		setError(null);

		try {
			const next = await postRoomAction(code, action);
			setRoom(next);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'No se pudo actualizar');
		} finally {
			setBusy(false);
		}
	}

	async function enterWithName() {
		const clean = name.trim();

		if (!clean || !playerId) {
			setError('Escribe tu nombre');
			return;
		}

		storeName(clean);
		setName(clean);
		await run({ action: 'join', playerId, name: clean });
	}

	if (!sessionReady || !playerId) {
		return (
			<main className='felt-page flex min-h-dvh items-center justify-center text-[#f4e6c3]'>
				Preparando sala...
			</main>
		);
	}

	if (!room && name && !error) {
		return (
			<main className='felt-page flex min-h-dvh items-center justify-center text-[#f4e6c3]'>
				Entrando a la sala...
			</main>
		);
	}

	if (!room) {
		return (
			<main className='felt-page flex min-h-dvh items-center justify-center p-4 text-[#f4e6c3]'>
				<div className='w-full max-w-sm rounded-2xl bg-black/35 p-4'>
					<h1 className='text-xl font-semibold'>Sala {code}</h1>
					<label className='mt-3 block text-[11px] uppercase tracking-wide text-emerald-100/60'>
						Tu nombre
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							className='field-input mt-1'
							maxLength={16}
							placeholder='Ej. Waner'
						/>
					</label>
					{error && (
						<p className='mt-2 text-[12px] text-red-200'>{error}</p>
					)}
					<button
						type='button'
						onClick={enterWithName}
						disabled={busy}
						className='menu-btn action-btn mt-4'
					>
						Entrar
					</button>
					<button
						type='button'
						onClick={() => router.push('/')}
						className='menu-btn ghost-btn mt-2'
					>
						Volver
					</button>
				</div>
			</main>
		);
	}

	if (room.status === 'playing' && room.game && room.yourSeat !== null) {
		return (
			<GameTable
				game={room.game}
				mySeat={room.yourSeat}
				onPlay={(tileId, side) =>
					run({ action: 'play', playerId, tileId, side })
				}
				onPass={() => run({ action: 'pass', playerId })}
				onNextRound={() => run({ action: 'next', playerId })}
				onNewMatch={() => run({ action: 'match', playerId })}
				onReorder={(from, to) =>
					run({ action: 'reorder', playerId, from, to })
				}
				onLeave={() => router.push('/')}
			/>
		);
	}

	if (room.status === 'playing' && room.yourSeat === null) {
		return (
			<main className='felt-page flex min-h-dvh items-center justify-center p-4 text-[#f4e6c3]'>
				<div className='w-full max-w-sm rounded-2xl bg-black/35 p-4 text-center'>
					<h1 className='text-xl font-semibold'>La partida ya empezó</h1>
					<p className='mt-2 text-sm text-emerald-100/70'>
						Esta sala está jugando. Pide otro link o espera a que
						terminen.
					</p>
					<button
						type='button'
						onClick={() => router.push('/')}
						className='menu-btn action-btn mt-4'
					>
						Volver
					</button>
				</div>
			</main>
		);
	}

	return (
		<Lobby
			room={room}
			name={name}
			error={error}
			busy={busy}
			fillBots={fillBots}
			onNameChange={setName}
			onSaveName={() => {
				const clean = name.trim();
				storeName(clean);
				run({ action: 'name', playerId, name: clean });
			}}
			onSeat={(seat) => run({ action: 'seat', playerId, seat })}
			onFillBotsChange={setFillBots}
			onStart={() => run({ action: 'start', playerId, fillBots })}
			onLeave={() => router.push('/')}
		/>
	);
}
