import { NextResponse } from 'next/server';

import { createRoom, toPublicRoom } from '@/lib/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as {
			playerId?: string;
			name?: string;
		};

		if (!body.playerId || !body.name) {
			return NextResponse.json(
				{ error: 'Falta el nombre o el jugador' },
				{ status: 400 },
			);
		}

		const room = createRoom(body.playerId, body.name);

		return NextResponse.json({
			room: toPublicRoom(room, body.playerId),
			playerId: body.playerId,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : 'No se pudo crear la sala',
			},
			{ status: 400 },
		);
	}
}
