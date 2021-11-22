
export const url = '/'

export const html = async () => {
	const partial = ['partial.js', 'partial-2.js']
	const partials = Promise.all(partial.map(async partial => {
		return await import(`./submodule-${partial}`).default
	}))
	const submodule = (await import('./submodule.js')).default	

	return `<html>
		<head></head>
		<body>
			dynamic import
			${submodule.text}
		</body>
	</html>`
}