'use client';

export default function MainMenu({
	name,
	joinCode,
	error,
	busy,
	onNameChange,
	onJoinCodeChange,
	onCreate,
	onJoin,
	onBots,
}: {
	name: string;
	joinCode: string;
	error: string | null;
	busy: boolean;
	onNameChange: (value: string) => void;
	onJoinCodeChange: (value: string) => void;
	onCreate: () => void;
	onJoin: () => void;
	onBots: () => void;
}) {
	return (
		<main className='felt-page flex min-h-dvh items-center justify-center p-4 text-[#f4e6c3]'>
			<div className='w-full max-w-sm rounded-2xl bg-black/35 p-4'>
				<p className='text-[10px] uppercase tracking-[0.18em] text-yellow-300'>
					Dominó dominicano
				</p>
				<h1 className='mt-1 text-2xl font-semibold'>A 200, en línea</h1>
				<p className='mt-1 text-sm text-emerald-100/70'>
					Crea una sala, manda el link y cada quien pone su nombre y su
					asiento.
				</p>

				<label className='mt-4 block text-[11px] uppercase tracking-wide text-emerald-100/60'>
					Tu nombre
					<input
						value={name}
						onChange={(event) => onNameChange(event.target.value)}
						placeholder='Ej. Waner'
						maxLength={16}
						className='field-input mt-1'
					/>
				</label>

				{error && (
					<p className='mt-2 text-[12px] text-red-200'>{error}</p>
				)}

				<button
					type='button'
					onClick={onCreate}
					disabled={busy}
					className='menu-btn action-btn mt-4'
				>
					Crear sala
				</button>

				<div className='mt-3 flex items-stretch gap-2'>
					<input
						value={joinCode}
						onChange={(event) =>
							onJoinCodeChange(event.target.value.toUpperCase())
						}
						placeholder='Código'
						maxLength={6}
						autoComplete='off'
						spellCheck={false}
						className='field-input min-w-0 flex-1 uppercase tracking-[0.18em]'
					/>
					<button
						type='button'
						onClick={onJoin}
						disabled={busy}
						className='action-btn h-11 shrink-0 rounded-xl px-4 text-sm'
					>
						Unirme
					</button>
				</div>

				<button
					type='button'
					onClick={onBots}
					disabled={busy}
					className='menu-btn ghost-btn mt-3'
				>
					Probar con bots
				</button>
			</div>
		</main>
	);
}
