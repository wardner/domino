import { GameState } from '@/lib/dominoes';

export const SEAT_LABELS = ['Sur', 'Este', 'Norte', 'Oeste'] as const;

export const TEAM_SEATS: [number, number][] = [
	[0, 2],
	[1, 3],
];

export type RoomStatus = 'lobby' | 'playing';

export type RoomSeat = {
	playerId: string | null;
	name: string;
	isBot: boolean;
};

export type RoomMember = {
	id: string;
	name: string;
	seat: number | null;
	connected: boolean;
};

export type Room = {
	code: string;
	hostId: string;
	status: RoomStatus;
	members: RoomMember[];
	seats: [RoomSeat, RoomSeat, RoomSeat, RoomSeat];
	game: GameState | null;
	createdAt: number;
};

export type PublicSeat = {
	name: string;
	isBot: boolean;
	occupied: boolean;
	isYou: boolean;
};

export type PublicMember = {
	id: string;
	name: string;
	seat: number | null;
	isHost: boolean;
	isYou: boolean;
	connected: boolean;
};

export type PublicRoom = {
	code: string;
	hostId: string;
	status: RoomStatus;
	youAreHost: boolean;
	yourSeat: number | null;
	seats: PublicSeat[];
	members: PublicMember[];
	game: GameState | null;
};

export type RoomAction =
	| { action: 'join'; playerId: string; name: string }
	| { action: 'name'; playerId: string; name: string }
	| { action: 'seat'; playerId: string; seat: number | null }
	| { action: 'start'; playerId: string; fillBots?: boolean }
	| { action: 'play'; playerId: string; tileId: string; side: 'left' | 'right' }
	| { action: 'pass'; playerId: string }
	| { action: 'next'; playerId: string }
	| { action: 'match'; playerId: string }
	| { action: 'reorder'; playerId: string; from: number; to: number };
