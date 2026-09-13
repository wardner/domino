import fs from 'fs';
import path from 'path';

import { BOT_THINK_MS, chooseBotMove } from '@/lib/botPlay';
import {
	createGame,
	GameState,
	passTurn,
	playTile,
	reorderHand,
	startNewMatch,
	startNextRound,
} from '@/lib/dominoes';
import {
	PublicRoom,
	Room,
	RoomAction,
	RoomMember,
	RoomSeat,
} from '@/lib/roomTypes';

type Listener = (room: Room) => void;

type Store = {
	rooms: Map<string, Room>;
	listeners: Map<string, Set<Listener>>;
	botTimers: Map<string, ReturnType<typeof setTimeout>>;
};

const globalStore = globalThis as typeof globalThis & {
	__dominoRooms?: Store;
};

const store: Store =
	globalStore.__dominoRooms ??
	(globalStore.__dominoRooms = {
		rooms: new Map(),
		listeners: new Map(),
		botTimers: new Map(),
	});

if (!store.botTimers) {
	store.botTimers = new Map();
}

const ROOM_FILE = path.join(process.cwd(), '.domino-rooms.json');

function persistRooms() {
	try {
		fs.writeFileSync(ROOM_FILE, JSON.stringify([...store.rooms.values()]));
	} catch (error) {
		console.error(error);
	}
}

function restoreRooms() {
	try {
		if (!fs.existsSync(ROOM_FILE)) {
			return;
		}

		const rooms = JSON.parse(fs.readFileSync(ROOM_FILE, 'utf8')) as Room[];

		for (const room of rooms) {
			if (!store.rooms.has(room.code)) {
				store.rooms.set(room.code, room);
			}
		}
	} catch (error) {
		console.error(error);
	}
}

restoreRooms();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;

function emptySeats(): [RoomSeat, RoomSeat, RoomSeat, RoomSeat] {
	return [
		{ playerId: null, name: '', isBot: false },
		{ playerId: null, name: '', isBot: false },
		{ playerId: null, name: '', isBot: false },
		{ playerId: null, name: '', isBot: false },
	];
}

function makeCode() {
	let code = '';

	for (let i = 0; i < 6; i += 1) {
		code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
	}

	return code;
}

function uniqueCode() {
	restoreRooms();

	for (let attempt = 0; attempt < 20; attempt += 1) {
		const code = makeCode();

		if (!store.rooms.has(code)) {
			return code;
		}
	}

	throw new Error('No se pudo crear un código de sala');
}

function cleanName(value: string) {
	const name = value.trim().replace(/\s+/g, ' ').slice(0, 16);

	if (!name) {
		throw new Error('Escribe un nombre');
	}

	return name;
}

function getRoom(code: string) {
	restoreRooms();

	const room = store.rooms.get(code.toUpperCase());

	if (!room) {
		throw new Error('Esa sala no existe');
	}

	if (Date.now() - room.createdAt > ROOM_TTL_MS) {
		clearBotTimer(room.code);
		store.rooms.delete(room.code);
		store.listeners.delete(room.code);
		persistRooms();
		throw new Error('Esa sala ya expiró');
	}

	return room;
}

function requireMember(room: Room, playerId: string) {
	const member = room.members.find((item) => item.id === playerId);

	if (!member) {
		throw new Error('No estás en esta sala');
	}

	return member;
}

function emit(room: Room) {
	persistRooms();

	const listeners = store.listeners.get(room.code);

	if (!listeners) {
		return;
	}

	for (const listener of listeners) {
		listener(room);
	}
}

function hideHands(game: GameState, viewerSeat: number | null): GameState {
	if (game.roundComplete || game.matchComplete) {
		return game;
	}

	return {
		...game,
		players: game.players.map((player, index) => ({
			...player,
			hand:
				index === viewerSeat
					? player.hand
					: player.hand.map((_, tileIndex) => ({
							id: `hidden-${index}-${tileIndex}`,
							a: 0,
							b: 0,
						})),
		})),
	};
}

export function toPublicRoom(room: Room, playerId: string): PublicRoom {
	const member = room.members.find((item) => item.id === playerId) ?? null;

	return {
		code: room.code,
		hostId: room.hostId,
		status: room.status,
		youAreHost: room.hostId === playerId,
		yourSeat: member?.seat ?? null,
		seats: room.seats.map((seat) => ({
			name: seat.name,
			isBot: seat.isBot,
			occupied: Boolean(seat.playerId) || seat.isBot,
			isYou: seat.playerId === playerId,
		})),
		members: room.members.map((item) => ({
			id: item.id,
			name: item.name,
			seat: item.seat,
			isHost: item.id === room.hostId,
			isYou: item.id === playerId,
			connected: item.connected,
		})),
		game: room.game ? hideHands(room.game, member?.seat ?? null) : null,
	};
}

export function subscribeRoom(code: string, listener: Listener) {
	const key = code.toUpperCase();
	const listeners = store.listeners.get(key) ?? new Set();

	listeners.add(listener);
	store.listeners.set(key, listeners);

	return () => {
		listeners.delete(listener);

		if (listeners.size === 0) {
			store.listeners.delete(key);
		}
	};
}

export function markConnected(code: string, playerId: string, connected: boolean) {
	try {
		const room = getRoom(code);
		const member = room.members.find((item) => item.id === playerId);

		if (!member || member.connected === connected) {
			return;
		}

		member.connected = connected;
		emit(room);
	} catch {
		// la sala pudo expirar mientras se cerraba el stream
	}
}

export function createRoom(playerId: string, name: string) {
	const hostName = cleanName(name);
	const code = uniqueCode();
	const host: RoomMember = {
		id: playerId,
		name: hostName,
		seat: null,
		connected: true,
	};

	const room: Room = {
		code,
		hostId: playerId,
		status: 'lobby',
		members: [host],
		seats: emptySeats(),
		game: null,
		createdAt: Date.now(),
	};

	store.rooms.set(code, room);
	persistRooms();
	return room;
}

function joinRoom(room: Room, playerId: string, name: string) {
	const playerName = cleanName(name);
	const existing = room.members.find((item) => item.id === playerId);

	if (existing) {
		existing.name = playerName;
		existing.connected = true;

		if (existing.seat !== null) {
			room.seats[existing.seat].name = playerName;
		}

		return existing;
	}

	const member: RoomMember = {
		id: playerId,
		name: playerName,
		seat: null,
		connected: true,
	};

	room.members.push(member);
	return member;
}

function claimSeat(room: Room, member: RoomMember, seat: number | null) {
	if (room.status !== 'lobby') {
		throw new Error('La partida ya empezó');
	}

	if (seat !== null && (seat < 0 || seat > 3)) {
		throw new Error('Ese asiento no existe');
	}

	if (member.seat !== null) {
		room.seats[member.seat] = {
			playerId: null,
			name: '',
			isBot: false,
		};
		member.seat = null;
	}

	if (seat === null) {
		return;
	}

	const target = room.seats[seat];

	if (target.playerId && target.playerId !== member.id) {
		throw new Error('Ese asiento ya está ocupado');
	}

	room.seats[seat] = {
		playerId: member.id,
		name: member.name,
		isBot: false,
	};
	member.seat = seat;
}

function fillEmptySeatsWithBots(room: Room) {
	room.seats.forEach((seat, index) => {
		if (seat.playerId || seat.isBot) {
			return;
		}

		room.seats[index] = {
			playerId: null,
			name: `Bot ${index + 1}`,
			isBot: true,
		};
	});
}

function seatNames(room: Room) {
	return room.seats.map((seat, index) => seat.name || `Jugador ${index + 1}`);
}

function clearBotTimer(code: string) {
	const timer = store.botTimers.get(code);

	if (timer) {
		clearTimeout(timer);
		store.botTimers.delete(code);
	}
}

function scheduleBots(room: Room) {
	clearBotTimer(room.code);

	if (!room.game || room.game.roundComplete) {
		return;
	}

	if (!room.seats[room.game.currentPlayer]?.isBot) {
		return;
	}

	const timer = setTimeout(() => {
		store.botTimers.delete(room.code);

		if (!room.game || room.game.roundComplete) {
			return;
		}

		if (!room.seats[room.game.currentPlayer]?.isBot) {
			return;
		}

		try {
			const move = chooseBotMove(room.game);
			room.game =
				move.type === 'pass'
					? passTurn(room.game)
					: playTile(room.game, move.tileId, move.side);
			emit(room);
			scheduleBots(room);
		} catch (error) {
			console.error(error);
		}
	}, BOT_THINK_MS);

	store.botTimers.set(room.code, timer);
}

function startGame(room: Room, member: RoomMember, fillBots: boolean) {
	if (member.id !== room.hostId) {
		throw new Error('Solo el anfitrión puede iniciar');
	}

	if (room.status !== 'lobby') {
		throw new Error('La partida ya empezó');
	}

	if (fillBots) {
		fillEmptySeatsWithBots(room);
	}

	const taken = room.seats.filter((seat) => seat.playerId || seat.isBot).length;

	if (taken < 4) {
		throw new Error('Faltan jugadores. Elige un asiento o llena con bots');
	}

	room.game = createGame(seatNames(room));
	room.status = 'playing';
	scheduleBots(room);
}

function requireSeatedTurn(room: Room, member: RoomMember) {
	if (room.status !== 'playing' || !room.game) {
		throw new Error('La partida no ha empezado');
	}

	if (member.seat === null) {
		throw new Error('No tienes asiento en esta partida');
	}

	if (room.game.roundComplete) {
		throw new Error('La mano ya terminó');
	}

	if (room.game.currentPlayer !== member.seat) {
		throw new Error('No es tu turno');
	}

	return room.game;
}

export function applyRoomAction(code: string, action: RoomAction) {
	const room = getRoom(code);

	if (action.action === 'join') {
		joinRoom(room, action.playerId, action.name);
		emit(room);
		return room;
	}

	const member = requireMember(room, action.playerId);

	if (action.action === 'name') {
		member.name = cleanName(action.name);

		if (member.seat !== null) {
			room.seats[member.seat].name = member.name;
		}

		emit(room);
		return room;
	}

	if (action.action === 'seat') {
		claimSeat(room, member, action.seat);
		emit(room);
		return room;
	}

	if (action.action === 'start') {
		startGame(room, member, Boolean(action.fillBots));
		emit(room);
		return room;
	}

	if (action.action === 'play') {
		requireSeatedTurn(room, member);
		room.game = playTile(room.game!, action.tileId, action.side);
		scheduleBots(room);
		emit(room);
		return room;
	}

	if (action.action === 'pass') {
		requireSeatedTurn(room, member);
		room.game = passTurn(room.game!);
		scheduleBots(room);
		emit(room);
		return room;
	}

	if (action.action === 'next') {
		if (!room.game) {
			throw new Error('La partida no ha empezado');
		}

		room.game = startNextRound(room.game);
		scheduleBots(room);
		emit(room);
		return room;
	}

	if (action.action === 'match') {
		if (!room.game) {
			throw new Error('La partida no ha empezado');
		}

		room.game = startNewMatch(room.game);
		room.status = 'playing';
		scheduleBots(room);
		emit(room);
		return room;
	}

	if (action.action === 'reorder') {
		if (member.seat === null || !room.game) {
			throw new Error('No puedes reordenar ahora');
		}

		room.game = reorderHand(
			room.game,
			member.seat,
			action.from,
			action.to,
		);
		emit(room);
		return room;
	}

	throw new Error('Acción no válida');
}

export function readRoom(code: string) {
	return getRoom(code);
}
