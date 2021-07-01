
export default (time, value) => new Promise(
	resolve => setTimeout(resolve, time, value)
)
