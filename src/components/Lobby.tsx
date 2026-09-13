'use client';

import { useRef, useState } from 'react';

import { PublicRoom, SEAT_LABELS, TEAM_SEATS } from '@/lib/roomTypes';

function copyFromInput(input: HTMLInputElement) {
	input.focus();
	input.select();
	input.setSelectionRange(0, input.value.length);

	try {
		if (document.execCommand('copy')) {
			return true;
		}
	} catch {
		// el celu en http no siempre deja clipboard
	}

	return false;
}

export default function Lobby({
	room,
	name,
	error,
	busy,
	fillBots,
	onNameChange,
	onSaveName,
	onSeat,
	onFillBotsChange,
	onStart,
	onLeave,
}: {
	room: PublicRoom;
	name: string;
	error: string | null;
	busy: boolean;
	fillBots: boolean;
	onNameChange: (value: string) => void;
	onSaveName: () => void;
	onSeat: (seat: number | null) => void;
	onFillBotsChange: (value: boolean) => void;
	onStart: () => void;
	onLeave: () => void;
}) {
	const linkRef = useRef<HTMLInputElement>(null);
	const [copyState, setCopyState] = useState<'idle' | 'copied' | 'select'>('idle');
	const canShare =
		typeof navigator !== 'undefined' && typeof navigator.share === 'function';
	const taken = room.seats.filter((seat) => seat.occupied).length;
	const link =
		typeof window !== 'undefined'
			? `${window.location.origin}/sala/${room.code}`
			: `/sala/${room.code}`;

	async function copyLink() {
		const input = linkRef.current;

		if (!input) {
			return;
		}

		if (copyFromInput(input)) {
			setCopyState('copied');
			window.setTimeout(() => setCopyState('idle'), 1600);
			return;
		}

		try {
			await navigator.clipboard.writeText(link);
			setCopyState('copied');
			window.setTimeout(() => setCopyState('idle'), 1600);
		} catch {
			copyFromInput(input);
			setCopyState('select');
		}
	}

	async function shareLink() {
		try {
			await navigator.share({
				title: `Sala ${room.code}`,
				text: `Entra a la sala de dominó ${room.code}`,
				url: link,
			});
		} catch {
			copyLink();
		}
	}

	return (
		<main className='felt-page flex min-h-dvh items-center justify-center p-4 text-[#f4e6c3]'>
			<div className='w-full max-w-sm rounded-2xl bg-black/35 p-4'>
				<div className='flex items-start justify-between gap-2'>
					<div>
						<p className='text-[10px] uppercase tracking-[0.18em] text-yellow-300'>
							Sala {room.code}
						</p>
						<h1 className='mt-1 text-xl font-semibold'>Lobby</h1>
					</div>
					<button type='button' onClick={onLeave} className='ghost-btn'>
						Salir
					</button>
				</div>

				<label className='mt-3 block text-[11px] uppercase tracking-wide text-emerald-100/60'>
					Tu nombre
					<div className='mt-1 flex gap-2'>
						<input
							value={name}
							onChange={(event) => onNameChange(event.target.value)}
							maxLength={16}
							className='field-input flex-1'
						/>
						<button
							type='button'
							onClick={onSaveName}
							disabled={busy}
							className='action-btn'
						>
							OK
						</button>
					</div>
				</label>

				<div className='mt-3 rounded-xl bg-black/25 p-2'>
					<p className='text-[10px] uppercase tracking-wide text-emerald-100/60'>
						Link para unirse
					</p>
					<input
						ref={linkRef}
						readOnly
						value={link}
						onFocus={(event) => event.currentTarget.select()}
						className='field-input mt-1 text-[12px]'
					/>
					{copyState === 'select' && (
						<p className='mt-1 text-[11px] text-yellow-200'>
							Mantén presionado el link y toca Copiar
						</p>
					)}
					<div className='mt-2 flex gap-2'>
						<button
							type='button'
							onClick={copyLink}
							className='action-btn min-h-11 flex-1'
						>
							{copyState === 'copied' ? 'Copiado' : 'Copiar'}
						</button>
						{canShare && (
							<button
								type='button'
								onClick={shareLink}
								className='action-btn min-h-11 flex-1'
							>
								Compartir
							</button>
						)}
					</div>
				</div>

				<div className='mt-4 grid grid-cols-2 gap-2 text-[11px]'>
					{TEAM_SEATS.map((seats, team) => (
						<div key={team} className='rounded-xl bg-black/25 p-2'>
							<p className='text-yellow-200'>
								Equipo {team + 1}
							</p>
							<p className='mt-1 text-emerald-50/80'>
								{seats
									.map((seat) => room.seats[seat].name || SEAT_LABELS[seat])
									.join(' + ')}
							</p>
						</div>
					))}
				</div>

				<div className='mt-4'>
					<p className='text-[11px] uppercase tracking-wide text-emerald-100/60'>
						Elige tu asiento
					</p>
					<div className='mt-2 grid grid-cols-3 grid-rows-3 gap-2'>
						<div />
						<SeatButton
							seat={2}
							room={room}
							busy={busy}
							onSeat={onSeat}
						/>
						<div />
						<SeatButton
							seat={3}
							room={room}
							busy={busy}
							onSeat={onSeat}
						/>
						<div className='flex items-center justify-center rounded-xl bg-[#0d4a34] text-[10px] text-emerald-100/70'>
							Mesa
						</div>
						<SeatButton
							seat={1}
							room={room}
							busy={busy}
							onSeat={onSeat}
						/>
						<div />
						<SeatButton
							seat={0}
							room={room}
							busy={busy}
							onSeat={onSeat}
						/>
						<div />
					</div>
				</div>

				{error && (
					<p className='mt-3 text-[12px] text-red-200'>{error}</p>
				)}

				{room.youAreHost ? (
					<>
						<label className='mt-3 flex items-center gap-2 text-[12px] text-emerald-100/80'>
							<input
								type='checkbox'
								checked={fillBots}
								onChange={(event) => onFillBotsChange(event.target.checked)}
							/>
							Llenar vacíos con bots
						</label>
						<button
							type='button'
							onClick={onStart}
							disabled={busy || (taken < 4 && !fillBots)}
							className='menu-btn action-btn mt-3'
						>
							Iniciar partida
						</button>
					</>
				) : (
					<p className='mt-3 text-center text-[12px] text-emerald-100/70'>
						Esperando al anfitrión · {taken}/4 asientos
					</p>
				)}
			</div>
		</main>
	);
}

function SeatButton({
	seat,
	room,
	busy,
	onSeat,
}: {
	seat: number;
	room: PublicRoom;
	busy: boolean;
	onSeat: (seat: number | null) => void;
}) {
	const info = room.seats[seat];
	const takenByOther = info.occupied && !info.isYou;

	return (
		<button
			type='button'
			disabled={busy || takenByOther}
			onClick={() => onSeat(info.isYou ? null : seat)}
			className={`rounded-xl px-2 py-3 text-center text-[11px] ${
				info.isYou
					? 'bg-[#f4e6c3] font-semibold text-[#2a1c10]'
					: takenByOther
						? 'bg-black/40 text-emerald-100/50'
						: 'bg-black/25 text-[#f4e6c3]'
			}`}
		>
			<div className='text-[9px] uppercase tracking-wide opacity-70'>
				{SEAT_LABELS[seat]}
			</div>
			<div className='mt-0.5 truncate'>
				{info.name || (info.isBot ? 'Bot' : 'Libre')}
			</div>
		</button>
	);
}
