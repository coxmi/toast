
export const url = '/'

export const html = async () => {

	const submodule = (await import('./submodule.js')).default	

	return `<html>
		<head></head>
		<body>
			dynamic import
			${submodule.text}
		</body>
	</html>`
}