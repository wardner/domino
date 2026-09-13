import { markConnected, readRoom, subscribeRoom, toPublicRoom } from '@/lib/rooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
	params: Promise<{ code: string }>;
};

export async function GET(request: Request, context: RouteContext) {
	const { code } = await context.params;
	const playerId = new URL(request.url).searchParams.get('playerId');

	if (!playerId) {
		return new Response('Falta el jugador', { status: 400 });
	}

	try {
		readRoom(code);
	} catch (error) {
		return new Response(
			error instanceof Error ? error.message : 'Sala no encontrada',
			{ status: 404 },
		);
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			const send = (data: unknown) => {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
				);
			};

			const unsubscribe = subscribeRoom(code, (room) => {
				send({ room: toPublicRoom(room, playerId) });
			});

			markConnected(code, playerId, true);
			send({ room: toPublicRoom(readRoom(code), playerId) });

			const ping = setInterval(() => {
				controller.enqueue(encoder.encode(`: ping\n\n`));
			}, 20000);

			const close = () => {
				clearInterval(ping);
				unsubscribe();
				markConnected(code, playerId, false);
			};

			request.signal.addEventListener('abort', () => {
				close();
				controller.close();
			});
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
		},
	});
}
