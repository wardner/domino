import { NextResponse } from 'next/server';

import { applyRoomAction, readRoom, toPublicRoom } from '@/lib/rooms';
import { RoomAction } from '@/lib/roomTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
	params: Promise<{ code: string }>;
};

export async function GET(request: Request, context: RouteContext) {
	try {
		const { code } = await context.params;
		const playerId = new URL(request.url).searchParams.get('playerId');

		if (!playerId) {
			return NextResponse.json(
				{ error: 'Falta el jugador' },
				{ status: 400 },
			);
		}

		const room = readRoom(code);

		return NextResponse.json({ room: toPublicRoom(room, playerId) });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : 'No se encontró la sala',
			},
			{ status: 404 },
		);
	}
}

export async function POST(request: Request, context: RouteContext) {
	try {
		const { code } = await context.params;
		const action = (await request.json()) as RoomAction;

		if (!action?.action || !action.playerId) {
			return NextResponse.json(
				{ error: 'Falta la acción' },
				{ status: 400 },
			);
		}

		const room = applyRoomAction(code, action);

		return NextResponse.json({ room: toPublicRoom(room, action.playerId) });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: 'No se pudo actualizar la sala',
			},
			{ status: 400 },
		);
	}
}
