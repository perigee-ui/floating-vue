// import { nextTick } from 'vue'

// export async function tick(times: number) {
//   while (times--) {
//     await nextTick()
//   }
// }

export async function act() {
	for (let i = 0; i < 7; i++) {
		await Promise.resolve()
	}
}
