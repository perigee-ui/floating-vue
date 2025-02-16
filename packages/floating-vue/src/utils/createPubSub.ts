export function createPubSub() {
	const map = new Map<string, Array<(data: any) => void>>()

	return {
		emit(event: string, data: any): void {
			map.get(event)?.forEach((handler) => handler(data))
		},
		on(event: string, listener: (data: any) => void): void {
			map.set(event, [...(map.get(event) || []), listener])
		},
		off(event: string, listener: (data: any) => void): void {
			map.set(event, map.get(event)?.filter((l) => l !== listener) || [])
		},
	}
}
