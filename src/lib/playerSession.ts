const ID_KEY = 'domino-player-id';
const NAME_KEY = 'domino-player-name';

function makePlayerId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreatePlayerId() {
	try {
		const existing = window.localStorage.getItem(ID_KEY);

		if (existing) {
			return existing;
		}

		const id = makePlayerId();
		window.localStorage.setItem(ID_KEY, id);
		return id;
	} catch {
		return makePlayerId();
	}
}

export function readStoredName() {
	return window.localStorage.getItem(NAME_KEY) ?? '';
}

export function storeName(name: string) {
	window.localStorage.setItem(NAME_KEY, name);
}
